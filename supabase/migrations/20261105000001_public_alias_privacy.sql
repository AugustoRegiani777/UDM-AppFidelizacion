-- Privacidad del alias público.
--
-- Problema: el nombre del perfil (profiles.display_name) nacía del nombre de Google y, si faltaba, del prefijo del
-- email; y los rankings lo muestran. Con un correo real eso expone el email en un ranking público.
--
-- Cambios:
--   1. Nunca más se deriva el nombre del email: el alta crea "Cliente XXXX" (4 caracteres del id). El nombre de
--      Google queda guardado en google_name y solo pasa a ser el alias si la persona lo elige en la bienvenida.
--   2. complete_onboarding y update_profile validan el alias (2 a 30 caracteres, solo letras, números y los signos . _ -,
--      sin emails, teléfonos, enlaces ni groserías básicas, y distinto del prefijo del propio email).
--   3. public_name (lo que ven todos los rankings: puntos, casuales y Sobreviví) enmascara como "Cliente" cualquier
--      nombre que no sea seguro, aunque venga de datos viejos.
--   4. Se sanean los alias existentes que parezcan emails, prefijos de email, teléfonos o enlaces.
--   La regla show_in_rankings ya estaba bien: los tres rankings filtran por "show_in_rankings o es el propio
--   cliente"; admin_overview (top_customers) exige require_admin y nunca llega al cliente.

-- 1. Validación --------------------------------------------------------------------------------------------------------

-- Seguro para mostrar: sin '@', enlaces, teléfonos (6 o más dígitos) ni groserías básicas.
create function public.alias_is_safe(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name is not null
     and p_name !~ '@'
     and p_name !~* '(https?:|www[.]|[.](com|es|net|org|ar|io)[[:>:]])'
     and char_length(regexp_replace(p_name, '[^0-9]', '', 'g')) < 6
     and lower(p_name) !~ '[[:<:]](puta|puto|mierda|carajo|pelotud|boludo|verga|forro|zorra|maricon|marica|nazi|hitler|gilipollas|cabron|coño|chupala|culiado|pendej)';
$$;

create function public.alias_is_valid(p_name text, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select p_name is not null
     and char_length(btrim(p_name)) between 2 and 30
     and btrim(p_name) ~ '^[[:alpha:]0-9]'
     and btrim(p_name) !~ '[^[:alpha:]0-9 ._-]'
     and public.alias_is_safe(p_name)
     and not exists (
       select 1 from auth.users u
        where u.id = p_uid and u.email is not null
          and lower(btrim(p_name)) = lower(split_part(u.email, '@', 1))
     );
$fn$;

revoke execute on function public.alias_is_safe(text) from public, anon, authenticated;
revoke execute on function public.alias_is_valid(text, uuid) from public, anon, authenticated;

-- 2. Alta: nunca desde el email -----------------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_google_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), '');
  v_name text;
  v_welcome integer;
begin
  if new.is_anonymous then
    v_name := 'Invitado ' || upper(substr(md5(new.id::text), 1, 4));
  else
    v_name := 'Cliente ' || upper(left(replace(new.id::text, '-', ''), 4));
  end if;

  insert into public.profiles (id, display_name, google_name, avatar_url)
  values (
    new.id,
    v_name,
    left(v_google_name, 60),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );

  if new.is_anonymous then
    select coalesce((value ->> 'welcome_points')::integer, 0)
      into v_welcome
      from public.settings
     where key = 'demo';
    if coalesce(v_welcome, 0) > 0 then
      insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
      values (new.id, 'adjustment', v_welcome, 'demo', new.id);
    end if;
  end if;

  return new;
end;
$$;

-- Al vincular un invitado a Google: se guarda el nombre de Google pero NO se pisa el alias.
create or replace function public.sync_profile_on_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_google_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), '');
  v_avatar text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
begin
  update public.profiles
     set google_name = coalesce(left(v_google_name, 60), google_name),
         avatar_url = coalesce(avatar_url, v_avatar)
   where id = new.id;
  return new;
end;
$$;

create or replace function public.ensure_profile()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_created integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into public.profiles (id, display_name, google_name, avatar_url)
  select u.id,
         case when u.is_anonymous then 'Invitado ' || upper(substr(md5(u.id::text), 1, 4))
              else 'Cliente ' || upper(left(replace(u.id::text, '-', ''), 4)) end,
         left(nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), ''), 60),
         coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
    from auth.users u
   where u.id = v_uid
  on conflict (id) do nothing;
  get diagnostics v_created = row_count;
  return v_created > 0;
end;
$$;

-- 3. Onboarding y edición de perfil validan el alias -------------------------------------------------------------------

create or replace function public.complete_onboarding(
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
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.alias_is_valid(v_name, auth.uid()) then
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

create or replace function public.update_profile(p_display_name text, p_promo_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.alias_is_valid(v_name, auth.uid()) then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  update public.profiles
     set display_name = v_name,
         promo_consent_at = case
           when p_promo_consent and not promo_consent then now()
           when not p_promo_consent then null
           else promo_consent_at
         end,
         promo_consent = p_promo_consent
   where id = auth.uid();
end;
$$;

-- 4. Lo que ven los rankings --------------------------------------------------------------------------------------------

create or replace function public.public_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when not public.alias_is_safe(p_name) then 'Cliente'
    when p_name ~ '^(Invitado|Cliente) ' then p_name
    when array_length(parts, 1) > 1 then parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.'
    else coalesce(parts[1], '')
  end
  from (select regexp_split_to_array(btrim(p_name), '\s+') as parts) s;
$$;

-- 5. Sanear alias existentes ---------------------------------------------------------------------------------------------

update public.profiles p
   set display_name = 'Cliente ' || upper(left(replace(p.id::text, '-', ''), 4))
  from auth.users u
 where u.id = p.id
   and (
     not public.alias_is_safe(p.display_name)
     or (u.email is not null
         and p.google_name is distinct from p.display_name
         and lower(btrim(p.display_name)) = lower(left(split_part(u.email, '@', 1), 60)))
   );
