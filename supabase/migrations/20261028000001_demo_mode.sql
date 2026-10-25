-- Modo de prueba: cualquiera entra como invitado (ingreso anónimo de Supabase Auth, sin cuenta de Google)
-- y recibe puntos de entrada. Los puntos entran por el libro de movimientos como un ajuste, igual que
-- cualquier otro movimiento. Para apagarlo: settings.demo.welcome_points = 0 (y apagar el ingreso anónimo).

insert into public.settings (key, value, is_public)
values ('demo', '{"welcome_points": 1500}', false)
on conflict (key) do nothing;

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
    v_name := left(coalesce(v_google_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Cliente'), 60);
  end if;

  insert into public.profiles (id, display_name, google_name, avatar_url)
  values (
    new.id,
    v_name,
    v_google_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );

  -- Puntos de entrada para invitados (una sola vez por usuario: el índice único del libro lo garantiza).
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
