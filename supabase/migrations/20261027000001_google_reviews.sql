-- Verificación automática de reseñas de Google Maps.
-- Una función programada trae las reseñas del local (API de Google Business Profile, con la cuenta del dueño)
-- y las cruza con las misiones "reseña de Google" pendientes:
--   * Coincidencia con el nombre de la cuenta de Google con la que entró el cliente (no editable): se aprueba sola.
--   * Coincidencia solo con el nombre que escribió el cliente: queda como "posible coincidencia" para aprobar de un toque.
-- Cada reseña acredita una sola vez. Si algo no coincide (reseña anónima, nombre distinto), queda la revisión manual.

-- Nombre de la cuenta de Google tal como vino al registrarse (el cliente no puede cambiarlo).
alter table public.profiles add column google_name text;

update public.profiles p
   set google_name = nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), '')
  from auth.users u
 where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_google_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), '');
begin
  insert into public.profiles (id, display_name, google_name, avatar_url)
  values (
    new.id,
    left(coalesce(v_google_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Cliente'), 60),
    v_google_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

-- Compara nombres sin importar mayúsculas, tildes ni espacios de más.
create function public.normalize_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(trim(regexp_replace(
    translate(
      coalesce(p_name, ''),
      'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'
    ),
    '\s+', ' ', 'g'
  )));
$$;

insert into public.settings (key, value, is_public) values
  ('google_reviews', '{"auto_approve": true, "lookback_days": 60}', false)
on conflict (key) do nothing;

create table public.google_reviews (
  review_id text primary key,
  reviewer_name text,
  review_time timestamptz not null,
  claimed_by uuid references public.bonus_claims (id) on delete set null,
  fetched_at timestamptz not null default now()
);
create index google_reviews_unclaimed_idx on public.google_reviews (review_time) where claimed_by is null;
alter table public.google_reviews enable row level security; -- sin políticas: solo service role

alter table public.bonus_claims add column suggested_review text;

-- Guarda las reseñas que trajo Google (las que ya estaban se ignoran). No se guarda el texto de la reseña.
create function public.upsert_google_reviews(p_reviews jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.google_reviews (review_id, reviewer_name, review_time)
  select
    r ->> 'id',
    case when coalesce((r ->> 'anonymous')::boolean, false) then null else nullif(trim(r ->> 'name'), '') end,
    (r ->> 'time')::timestamptz
  from jsonb_array_elements(p_reviews) r
  on conflict (review_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.match_google_reviews()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := coalesce(public.setting_json('google_reviews'), '{}'::jsonb);
  v_auto boolean := coalesce((v_cfg ->> 'auto_approve')::boolean, true);
  v_lookback integer := coalesce((v_cfg ->> 'lookback_days')::integer, 60);
  v_points integer := coalesce((public.setting_json('missions') -> 'google_review' ->> 'points')::integer, 0);
  v_claim record;
  v_review public.google_reviews;
  v_approved integer := 0;
  v_suggested integer := 0;
begin
  for v_claim in
    select b.id, b.customer_id, b.note, b.created_at, p.google_name
      from public.bonus_claims b
      join public.profiles p on p.id = b.customer_id
     where b.mission = 'google_review' and b.status = 'pending'
     order by b.created_at
  loop
    v_review := null;

    -- 1) Coincide con el nombre de la cuenta de Google del cliente (no se puede falsificar).
    if v_claim.google_name is not null then
      select * into v_review from public.google_reviews r
       where r.claimed_by is null and r.reviewer_name is not null
         and public.normalize_name(r.reviewer_name) = public.normalize_name(v_claim.google_name)
         and r.review_time >= v_claim.created_at - make_interval(days => v_lookback)
       order by r.review_time limit 1;
    end if;

    if v_review.review_id is not null and v_auto then
      update public.bonus_claims
         set status = 'approved', points = v_points, decided_at = now(), suggested_review = v_review.review_id
       where id = v_claim.id and status = 'pending';
      if v_points > 0 then
        insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
        values (v_claim.customer_id, 'bonus', v_points, 'bonus_claims', v_claim.id)
        on conflict (kind, ref_table, ref_id) where ref_id is not null do nothing;
      end if;
      update public.google_reviews set claimed_by = v_claim.id where review_id = v_review.review_id;
      v_approved := v_approved + 1;
      continue;
    end if;

    -- 2) Si no, coincide con el nombre que escribió el cliente: solo se sugiere (lo aprueba el admin).
    if v_review.review_id is null and v_claim.note is not null then
      select * into v_review from public.google_reviews r
       where r.claimed_by is null and r.reviewer_name is not null
         and public.normalize_name(r.reviewer_name) = public.normalize_name(v_claim.note)
         and r.review_time >= v_claim.created_at - make_interval(days => v_lookback)
       order by r.review_time limit 1;
    end if;
    if v_review.review_id is not null then
      update public.bonus_claims set suggested_review = v_review.review_id
       where id = v_claim.id and suggested_review is distinct from v_review.review_id;
      v_suggested := v_suggested + 1;
    end if;
  end loop;

  return jsonb_build_object('approved', v_approved, 'suggested', v_suggested);
end;
$$;

-- Pendientes del admin: ahora indican si hay una reseña que parece ser la del cliente.
drop function public.admin_pending_missions();
create function public.admin_pending_missions()
returns table (id uuid, mission text, note text, display_name text, created_at timestamptz, suggested boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select b.id, b.mission, b.note, p.display_name, b.created_at, b.suggested_review is not null
      from public.bonus_claims b join public.profiles p on p.id = b.customer_id
     where b.status = 'pending'
     order by (b.suggested_review is not null) desc, b.created_at;
end;
$$;
grant execute on function public.admin_pending_missions() to authenticated;

-- Al aprobar a mano, la reseña sugerida queda usada (no se puede acreditar dos veces).
create or replace function public.admin_review_mission(p_claim uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.bonus_claims;
  v_points integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_claim from public.bonus_claims where id = p_claim and status = 'pending' for update;
  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  v_points := coalesce((public.setting_json('missions') -> v_claim.mission ->> 'points')::integer, 0);

  update public.bonus_claims
     set status = case when p_approve then 'approved' else 'rejected' end,
         points = case when p_approve then v_points else 0 end,
         decided_at = now(), decided_by = auth.uid()
   where id = v_claim.id;

  if p_approve and v_points > 0 then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (v_claim.customer_id, 'bonus', v_points, 'bonus_claims', v_claim.id)
    on conflict (kind, ref_table, ref_id) where ref_id is not null do nothing;
  end if;
  if p_approve and v_claim.suggested_review is not null then
    update public.google_reviews set claimed_by = v_claim.id
     where review_id = v_claim.suggested_review and claimed_by is null;
  end if;
end;
$$;

-- Programa la búsqueda de reseñas cada 30 minutos (reusa el llamador HTTP firmado de la reconciliación).
create function public.schedule_google_sync(p_function_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'google-sync';
  perform cron.schedule(
    'google-sync',
    '*/30 * * * *',
    format($job$select public.reconcile_http_call(%L, %L)$job$, p_function_url, p_secret)
  );
end;
$$;
