-- Reconciliación programada: pendientes, vencimientos, anulaciones y limpieza.
-- Dos tareas de pg_cron cada 5 minutos:
--   1. reconcile-maintenance: solo SQL (siempre funciona, no depende de la red).
--   2. reconcile-pos: llama a la Edge Function `reconcile` (necesita hablar con el POS).

insert into public.settings (key, value, is_public) values
  ('reversal_check_days', '7', false)
on conflict (key) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Tareas que no necesitan al POS.
create function public.reconcile_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending integer;
  v_codes integer;
  v_limits integer;
begin
  v_pending := public.expire_pending_claims();
  v_codes := public.expire_redemptions();
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_limits = row_count;
  return jsonb_build_object('expired_pending', v_pending, 'expired_codes', v_codes, 'cleaned_limits', v_limits);
end;
$$;

-- Ventas que conviene volver a mirar en el POS: las pendientes y las confirmadas recientes (por si se anularon).
create function public.reconcile_candidates()
returns table (sale_uuid uuid, customer_id uuid, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.sale_uuid, c.customer_id, c.status
    from public.claims c
   where c.status = 'pending'
      or (c.status = 'confirmed'
          and c.created_at > now() - make_interval(days => coalesce((public.setting_json('reversal_check_days') #>> '{}')::integer, 7)))
   order by c.created_at
   limit 500;
$$;

-- Programa (o reprograma) las dos tareas. Se ejecuta una vez por entorno con la URL de la función y su secreto.
create function public.schedule_reconcile(p_function_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('reconcile-maintenance', 'reconcile-pos');

  perform cron.schedule('reconcile-maintenance', '*/5 * * * *', 'select public.reconcile_maintenance()');

  perform cron.schedule(
    'reconcile-pos',
    '*/5 * * * *',
    format(
      $job$select public.reconcile_http_call(%L, %L)$job$,
      p_function_url,
      p_secret
    )
  );
end;
$$;

-- Envoltorio de net.http_post con el secreto en un header (net.http_post vive en el schema net).
create function public.reconcile_http_call(p_url text, p_secret text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := p_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reconcile-secret', p_secret),
    body := '{}'::jsonb
  );
$$;

