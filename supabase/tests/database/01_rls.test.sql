-- RLS: un cliente no puede leer ni escribir datos de otro, ni tocar el libro de puntos.
begin;
select plan(24);

-- Dos clientes (el trigger crea sus perfiles).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com', '{}');

-- Datos de cada uno (como superusuario, igual que lo haría el service role).
insert into public.claims (id, customer_id, sale_uuid, status, sale_total_cents, points) values
  ('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'confirmed', 6200, 62),
  ('c2000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'confirmed', 1000, 10);
insert into public.point_movements (customer_id, kind, points, ref_table, ref_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'purchase', 62, 'claims', 'c1000000-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'purchase', 10, 'claims', 'c2000000-0000-4000-8000-000000000002');

select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'Ana', 'el perfil toma el nombre de Google');
select is((select display_name from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002'), 'beto', 'sin nombre, usa el mail');

-- Actuamos como Ana.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'Ana solo ve su perfil');
select is((select count(*)::int from public.claims), 1, 'Ana solo ve sus claims');
select is((select count(*)::int from public.point_movements), 1, 'Ana solo ve sus movimientos');
select is((select count(*)::int from public.claims where customer_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 0, 'Ana no ve claims de Beto');
select is((select count(*)::int from public.rewards), 4, 'los premios son públicos');
select is((select count(*)::int from public.settings where key = 'excluded_channels'), 0, 'settings no públicos quedan ocultos');
select is((select count(*)::int from public.settings where key = 'points_per_euro'), 1, 'settings públicos visibles');

select throws_ok(
  $$ insert into public.point_movements (customer_id, kind, points) values ('aaaaaaaa-0000-4000-8000-000000000001', 'adjustment', 1000) $$,
  '42501', null, 'Ana no puede regalarse puntos');
select throws_ok(
  $$ insert into public.claims (customer_id, sale_uuid, status, points) values ('aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid(), 'confirmed', 500) $$,
  '42501', null, 'Ana no puede crear claims');
select throws_ok(
  $$ update public.claims set points = 9999 where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'Ana no puede editar claims');
select throws_ok(
  $$ update public.point_movements set points = 9999 $$,
  '42501', null, 'Ana no puede editar el libro');
select throws_ok(
  $$ delete from public.point_movements $$,
  '42501', null, 'Ana no puede borrar del libro');
select throws_ok(
  $$ update public.profiles set display_name = 'hack' $$,
  '42501', null, 'el perfil no se edita directo (solo por funciones)');
select throws_ok(
  $$ insert into public.redemptions (customer_id, reward_id, code, expires_at) select 'aaaaaaaa-0000-4000-8000-000000000001', id, 'MIGA-HACK', now() + interval '1 day' from public.rewards limit 1 $$,
  '42501', null, 'Ana no puede fabricarse códigos de canje');
select throws_ok(
  $$ select * from public.balance_events $$,
  '42501', null, 'balance_events no es accesible al cliente');
select throws_ok(
  $$ select * from public.rate_limits $$,
  '42501', null, 'rate_limits no es accesible al cliente');
select throws_ok(
  $$ select public.customer_balance('bbbbbbbb-0000-4000-8000-000000000002') $$,
  '42501', null, 'Ana no puede pedir el saldo de Beto');

-- Funciones propias.
select is((public.customer_dashboard() ->> 'balance')::int, 62, 'el panel de Ana muestra 62 puntos');
select lives_ok($$ select public.complete_onboarding('Ana M.', true, true, true, true) $$, 'la bienvenida funciona');
select isnt((select program_consent_at from public.profiles), null, 'quedó guardada la fecha de consentimiento');

-- Un anónimo no ve nada de clientes.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$ select * from public.claims $$, '42501', null, 'anon no lee claims');
select throws_ok($$ select public.customer_dashboard() $$, '42501', null, 'anon no llama al panel');

select * from finish();
rollback;
