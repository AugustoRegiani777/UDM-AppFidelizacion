-- Integridad de los datos del cliente (auditoría de login con Google / cuentas de invitado).
--
-- Lo que ya estaba bien y ahora además tiene test (supabase/tests/database/14_integrity.test.sql):
--   * el cliente (rol authenticated) solo tiene SELECT sobre sus filas; toda escritura pasa por funciones
--     security definer que usan auth.uid() o por Edge Functions con service role;
--   * ninguna función con un id de cliente como parámetro se puede ejecutar con un JWT de cliente.
--
-- Lo que agrega esta migración:
--   1. Los libros de gastos (puntos y monedas) quedan de solo inserción, como el de puntos: ni siquiera el
--      service role puede editarlos o vaciarlos. (Borrar la cuenta sigue funcionando: la cascada de las claves
--      foráneas la hace el dueño de las tablas.)
--   2. Al vincular una cuenta de invitado a Google (linkIdentity) el perfil se actualiza con el nombre y la foto
--      de Google, sin tocar puntos ni nada más: el usuario conserva el mismo id, así que todo sigue siendo suyo.
--   3. profiles.is_admin no se puede cambiar con un JWT de cliente aunque algún día se le dé un UPDATE a la tabla.
--   4. ensure_profile(): repara en silencio un perfil faltante del usuario que llama (nunca crea ni borra datos
--      de otros) para que una sesión válida no termine cerrada por error.

-- 1. Libros de solo inserción ---------------------------------------------------------------------------------------

revoke update, delete, truncate on public.point_spends from service_role;
revoke update, delete, truncate on public.coin_movements from service_role;
revoke truncate on public.point_movements from service_role;

-- 2. Invitado que se vincula a Google --------------------------------------------------------------------------------

create function public.sync_profile_on_link()
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
     set google_name = coalesce(v_google_name, google_name),
         avatar_url = coalesce(avatar_url, v_avatar),
         -- Solo se reemplaza el nombre automático de invitado; si la persona ya eligió uno, se respeta.
         display_name = case
           when display_name ~ '^Invitado [0-9A-F]{4}$' and v_google_name is not null then left(v_google_name, 60)
           else display_name
         end
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_linked
  after update of is_anonymous, raw_user_meta_data, email on auth.users
  for each row
  when (new.is_anonymous is not true)
  execute function public.sync_profile_on_link();

-- 3. is_admin solo lo cambia el servidor ------------------------------------------------------------------------------

create function public.guard_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- 4. Reparar un perfil faltante ----------------------------------------------------------------------------------------

create function public.ensure_profile()
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
              else left(coalesce(nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), ''),
                                 nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Cliente'), 60) end,
         nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), ''),
         coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
    from auth.users u
   where u.id = v_uid
  on conflict (id) do nothing;
  get diagnostics v_created = row_count;
  return v_created > 0;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
