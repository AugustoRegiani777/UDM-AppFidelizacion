-- Cumplimiento legal (RGPD / LOPDGDD / LSSI): prueba de la aceptación de las condiciones y de la mayoría de edad.
--
--   * profiles guarda cuándo la persona confirmó +18, aceptó la política de privacidad y aceptó las bases y normas,
--     y qué versión de los textos legales aceptó. El cliente NO puede escribir esas columnas: solo se llenan por las
--     funciones de abajo, que usan auth.uid() y nunca reciben un id desde el cliente.
--   * settings.legal.version es la versión vigente de los textos. Si sube, los clientes tienen que volver a aceptar
--     (la app los lleva a la bienvenida) sin perder puntos ni datos.
--   * export_my_data() devuelve todo lo que la app guarda de quien llama (derecho de acceso y portabilidad).
--
-- IMPORTANTE: la versión de abajo debe coincidir con LEGAL_VERSION de src/legal/company.ts (hay un test que lo vigila).

alter table public.profiles
  add column adult_confirmed_at timestamptz,
  add column privacy_accepted_at timestamptz,
  add column terms_accepted_at timestamptz,
  add column legal_version text;

insert into public.settings (key, value, is_public)
values ('legal', '{"version": "2026-11-01"}'::jsonb, true)
on conflict (key) do nothing;

-- Registra la aceptación de quien llama. Las tres confirmaciones son obligatorias.
create function public.accept_legal(p_adult boolean, p_privacy boolean, p_terms boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (coalesce(p_adult, false) and coalesce(p_privacy, false) and coalesce(p_terms, false)) then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  select s.value ->> 'version' into v_version from public.settings s where s.key = 'legal';
  update public.profiles
     set adult_confirmed_at = now(),
         privacy_accepted_at = now(),
         terms_accepted_at = now(),
         legal_version = coalesce(v_version, 'unknown'),
         program_consent_at = coalesce(program_consent_at, now())
   where id = auth.uid();
end;
$$;

-- La bienvenida ahora exige las tres confirmaciones. Reemplaza a la versión anterior (solo nombre y promos).
drop function public.complete_onboarding(text, boolean);

create function public.complete_onboarding(
  p_display_name text,
  p_promo_consent boolean,
  p_adult boolean,
  p_privacy boolean,
  p_terms boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  perform public.accept_legal(p_adult, p_privacy, p_terms);
  update public.profiles
     set display_name = v_name,
         promo_consent = coalesce(p_promo_consent, false),
         promo_consent_at = case when coalesce(p_promo_consent, false) then now() else null end
   where id = auth.uid();
end;
$$;

-- Derecho de acceso y portabilidad: todo lo que la app guarda de quien llama, en un JSON.
create function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                                            'is_guest', coalesce(u.is_anonymous, false))
                  from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'claims', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.claims c where c.customer_id = v_uid), '[]'),
    'point_movements', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.point_movements m where m.customer_id = v_uid), '[]'),
    'point_spends', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from public.point_spends s where s.customer_id = v_uid), '[]'),
    'coin_movements', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.coin_movements m where m.customer_id = v_uid), '[]'),
    'redemptions', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.redemptions r where r.customer_id = v_uid), '[]'),
    'game_plays', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from public.game_plays g where g.customer_id = v_uid), '[]'),
    'game_runs', coalesce((select jsonb_agg(to_jsonb(g) order by g.started_at) from public.game_runs g where g.customer_id = v_uid), '[]'),
    'challenge_passes', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from public.challenge_passes g where g.customer_id = v_uid), '[]'),
    'shop_orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.shop_orders o where o.customer_id = v_uid), '[]'),
    'shop_items_owned', coalesce((select jsonb_agg(to_jsonb(i)) from public.customer_items i where i.customer_id = v_uid), '[]'),
    'bonus_claims', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from public.bonus_claims b where b.customer_id = v_uid), '[]'),
    'places_submitted', coalesce((select jsonb_agg(to_jsonb(pl) order by pl.created_at) from public.places pl where pl.submitted_by = v_uid), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(cm) order by cm.created_at) from public.place_comments cm where cm.customer_id = v_uid), '[]'),
    'place_likes', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.place_likes l where l.customer_id = v_uid), '[]'),
    'comment_likes', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.comment_likes l where l.customer_id = v_uid), '[]')
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.accept_legal(boolean, boolean, boolean) from public, anon;
revoke execute on function public.complete_onboarding(text, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.accept_legal(boolean, boolean, boolean) to authenticated;
grant execute on function public.complete_onboarding(text, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.export_my_data() to authenticated;
