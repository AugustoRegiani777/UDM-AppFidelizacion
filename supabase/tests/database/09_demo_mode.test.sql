-- Modo de prueba: los invitados (ingreso anónimo) reciben puntos de entrada; las cuentas normales no.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('a1a1a1a1-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}'),
  ('b2b2b2b2-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', false, '{"full_name": "Ana Pérez"}');

select is(public.customer_balance('a1a1a1a1-0000-4000-8000-000000000001'), 1500, 'el invitado entra con 1500 puntos');
select is(public.customer_balance('b2b2b2b2-0000-4000-8000-000000000002'), 0, 'una cuenta normal no recibe puntos de entrada');
select matches((select display_name from public.profiles where id = 'a1a1a1a1-0000-4000-8000-000000000001'), '^Invitado [0-9A-F]{4}$', 'el invitado tiene un nombre amable');
select is((select display_name from public.profiles where id = 'b2b2b2b2-0000-4000-8000-000000000002'), 'Ana Pérez', 'una cuenta normal conserva su nombre');
select is(
  (select count(*)::int from public.point_movements where customer_id = 'a1a1a1a1-0000-4000-8000-000000000001' and kind = 'adjustment' and ref_table = 'demo'),
  1, 'queda un solo movimiento de ajuste en el libro');

-- Los 1500 puntos desbloquean los escalones de los premios (el saldo no se gasta).
select set_config('request.jwt.claims', '{"sub": "a1a1a1a1-0000-4000-8000-000000000001", "role": "authenticated"}', true);
set local role authenticated;
select is((public.customer_dashboard() ->> 'balance')::int, 1500, 'el panel muestra el saldo de entrada');
select is((public.customer_dashboard() -> 'rewards' -> 0 ->> 'unlocked')::boolean, true, 'el café ya está desbloqueado');
reset role;

-- Con el modo de prueba apagado no se regalan puntos.
update public.settings set value = '{"welcome_points": 0}' where key = 'demo';
insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('c3c3c3c3-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}');
select is(public.customer_balance('c3c3c3c3-0000-4000-8000-000000000003'), 0, 'con welcome_points = 0 no se regalan puntos');
select is((select count(*)::int from public.profiles where id = 'c3c3c3c3-0000-4000-8000-000000000003'), 1, 'igual se crea el perfil');

-- Un valor roto en la configuración no impide registrarse.
update public.settings set value = '{}' where key = 'demo';
insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('d4d4d4d4-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}');
select is(public.customer_balance('d4d4d4d4-0000-4000-8000-000000000004'), 0, 'sin welcome_points en la configuración tampoco falla');

select * from finish();
rollback;
