-- Reclamar ventas: toda la decisión de puntos vive acá, en una transacción.
-- La Edge Function claim-sale solo consulta al POS y llama a claim_sale_apply.

insert into public.settings (key, value, is_public) values
  ('rate_limits', '{"claim_sale": {"max": 15, "window_seconds": 60}, "play_game": {"max": 20, "window_seconds": 60}}', false)
on conflict (key) do nothing;

-- Límite de ritmo de ventana fija. Devuelve false cuando se pasó del máximo.
create function public.rate_limit_hit(p_customer uuid, p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public.setting_json('rate_limits') -> p_action;
  v_window integer := coalesce((v_cfg ->> 'window_seconds')::integer, 60);
  v_max integer := coalesce((v_cfg ->> 'max')::integer, 30);
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);
  v_hits integer;
begin
  insert into public.rate_limits (customer_id, action, window_start)
  values (p_customer, p_action, v_start)
  on conflict (customer_id, action, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= v_max;
end;
$$;

-- Premios que este movimiento acaba de desbloquear (para celebrarlos en la pantalla de compra).
create function public.newly_unlocked_rewards(
  p_balance_before integer,
  p_balance_after integer,
  p_purchases_before integer,
  p_purchases_after integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'kind', r.kind) order by r.sort_order), '[]'::jsonb)
    from public.rewards r
   where r.active
     and (
       (r.kind = 'points' and p_balance_before < r.threshold and p_balance_after >= r.threshold)
       or (r.kind = 'purchases' and p_purchases_before / r.threshold < p_purchases_after / r.threshold)
     );
$$;

-- p_sale = null significa "el POS todavía no conoce esa venta".
-- p_sale = {total_cents, sold_at, voided, channel} cuando el POS la devolvió.
create function public.claim_sale_apply(p_customer uuid, p_sale_uuid uuid, p_sale jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_claimed_at timestamptz := now();
  v_status text;
  v_reason text;
  v_points integer := 0;
  v_total integer;
  v_sold_at timestamptz;
  v_balance_before integer;
  v_purchases_before integer;
  v_balance integer;
  v_purchases integer;
begin
  -- Serializa intentos simultáneos sobre la misma venta (una venta, un solo dueño).
  perform pg_advisory_xact_lock(hashtextextended(p_sale_uuid::text, 0));

  select * into v_claim from public.claims where sale_uuid = p_sale_uuid;

  if found then
    if v_claim.customer_id <> p_customer then
      return jsonb_build_object('status', 'rejected', 'reason', 'already_claimed', 'points', 0);
    end if;
    if v_claim.status <> 'pending' or p_sale is null then
      return jsonb_build_object(
        'status', v_claim.status,
        'reason', v_claim.reject_reason,
        'points', v_claim.points,
        'balance', public.customer_balance(p_customer),
        'claim_id', v_claim.id,
        'repeat', true
      );
    end if;
    -- Pendiente que por fin apareció: la ventana se mide desde que el cliente la reclamó.
    v_claimed_at := v_claim.created_at;
  elsif p_sale is null then
    insert into public.claims (customer_id, sale_uuid, status)
    values (p_customer, p_sale_uuid, 'pending')
    returning * into v_claim;
    return jsonb_build_object('status', 'pending', 'points', 0, 'claim_id', v_claim.id, 'repeat', false);
  end if;

  v_total := (p_sale ->> 'total_cents')::integer;
  v_sold_at := (p_sale ->> 'sold_at')::timestamptz;

  if coalesce((p_sale ->> 'voided')::boolean, false) then
    v_status := 'rejected';
    v_reason := 'voided';
  elsif coalesce(public.setting_json('excluded_channels'), '[]'::jsonb) ? (p_sale ->> 'channel') then
    v_status := 'rejected';
    v_reason := 'excluded_channel';
  elsif v_sold_at < v_claimed_at - make_interval(hours => coalesce((public.setting_json('claim_window_hours') #>> '{}')::integer, 2)) then
    v_status := 'rejected';
    v_reason := 'too_old';
  else
    v_status := 'confirmed';
    v_points := floor(v_total::numeric / 100 * coalesce((public.setting_json('points_per_euro') #>> '{}')::numeric, 1))::integer;
  end if;

  v_balance_before := public.customer_balance(p_customer);
  v_purchases_before := public.customer_purchase_count(p_customer);

  if v_claim.id is null then
    insert into public.claims (customer_id, sale_uuid, status, reject_reason, sale_total_cents, sale_at, points)
    values (p_customer, p_sale_uuid, v_status, v_reason, v_total, v_sold_at, v_points)
    returning * into v_claim;
  else
    update public.claims
       set status = v_status, reject_reason = v_reason, sale_total_cents = v_total,
           sale_at = v_sold_at, points = v_points, updated_at = now()
     where id = v_claim.id
    returning * into v_claim;
  end if;

  if v_status = 'confirmed' and v_points > 0 then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (p_customer, 'purchase', v_points, 'claims', v_claim.id);
  end if;

  v_balance := public.customer_balance(p_customer);
  v_purchases := public.customer_purchase_count(p_customer);

  return jsonb_build_object(
    'status', v_status,
    'reason', v_reason,
    'points', v_points,
    'balance', v_balance,
    'claim_id', v_claim.id,
    'repeat', false,
    'unlocked', case when v_status = 'confirmed'
      then public.newly_unlocked_rewards(v_balance_before, v_balance, v_purchases_before, v_purchases)
      else '[]'::jsonb end
  );
end;
$$;

-- Venta ya acreditada que el POS anuló después: se descuentan sus puntos con un movimiento inverso.
create function public.reverse_claim(p_sale_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_sale_uuid::text, 0));
  select * into v_claim from public.claims where sale_uuid = p_sale_uuid and status = 'confirmed';
  if not found then
    return false;
  end if;
  update public.claims set status = 'reversed', updated_at = now() where id = v_claim.id;
  if v_claim.points > 0 then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (v_claim.customer_id, 'reversal', -v_claim.points, 'claims', v_claim.id);
  end if;
  return true;
end;
$$;

-- Pendientes que no aparecieron dentro de la ventana de reclamo dejan de esperar.
create function public.expire_pending_claims()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.claims
     set status = 'rejected', reject_reason = 'not_found', updated_at = now()
   where status = 'pending'
     and created_at < now() - make_interval(hours => coalesce((public.setting_json('claim_window_hours') #>> '{}')::integer, 2));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
