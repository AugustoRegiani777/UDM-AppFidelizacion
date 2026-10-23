-- Misiones de puntos extra y rol de administrador.
begin;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com'),
  ('cccccccc-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.com');
update public.profiles set is_admin = true where id = 'cccccccc-0000-4000-8000-000000000003';

-- Ana: misión automática (Instagram) y pendiente (reseña).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select is(public.claim_mission('instagram_follow') ->> 'status', 'approved', 'seguir en Instagram se acredita al instante');
select is((public.customer_dashboard() ->> 'balance')::int, 15, 'suma los puntos configurados (15)');
select throws_ok($$ select public.claim_mission('instagram_follow') $$, 'P0001', 'already_claimed', 'solo una vez');
select is(public.claim_mission('google_review', '  Ana P.  ') ->> 'status', 'pending', 'la reseña queda pendiente de aprobación');
select is((public.customer_dashboard() ->> 'balance')::int, 15, 'y todavía no suma');
select throws_ok($$ select public.claim_mission('google_review') $$, 'P0001', 'already_claimed', 'no se puede pedir dos veces mientras está pendiente');
select throws_ok($$ select public.claim_mission('inventada') $$, 'P0002', 'mission_not_found', 'misión inexistente');
select is((select note from public.bonus_claims where mission = 'google_review'), 'Ana P.', 'guarda el nombre limpio para verificar');

-- (guardamos el id con permisos de superusuario: el admin no ve claims ajenos por RLS, sí por las funciones)
reset role;
select set_config('app.ana_claim', (select id::text from public.bonus_claims where mission = 'google_review'), false);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

-- Un cliente común no es administrador.
select is(public.is_admin(), false, 'Ana no es admin');
select throws_ok($$ select * from public.admin_pending_missions() $$, '42501', 'forbidden', 'no puede ver pendientes ajenos');
select throws_ok(
  $$ select public.admin_review_mission(current_setting('app.ana_claim')::uuid, true) $$,
  '42501', 'forbidden', 'no puede aprobarse sus propios puntos');

-- Beto no ve los claims de Ana.
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select is((select count(*)::int from public.bonus_claims), 0, 'Beto no ve las misiones de Ana');

-- El admin aprueba y los puntos entran una sola vez.
select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select is(public.is_admin(), true, 'el admin es admin');
select is((select count(*)::int from public.admin_pending_missions()), 1, 've la reseña pendiente con el nombre del cliente');
select lives_ok(
  $$ select public.admin_review_mission(current_setting('app.ana_claim')::uuid, true) $$,
  'aprueba la reseña');
select throws_ok(
  $$ select public.admin_review_mission(current_setting('app.ana_claim')::uuid, true) $$,
  'P0001', 'not_pending', 'no se aprueba dos veces');
reset role;
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 65, '15 + 50 puntos de la reseña, una sola vez');

-- Si se rechaza, puede volver a intentar.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select public.claim_mission('google_review');
reset role;
select set_config('app.beto_claim', (select id::text from public.bonus_claims where customer_id = 'bbbbbbbb-0000-4000-8000-000000000002'), false);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select public.admin_review_mission(current_setting('app.beto_claim')::uuid, false);
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select is(public.claim_mission('google_review') ->> 'status', 'pending', 'tras un rechazo puede volver a intentar');

select * from finish();
rollback;
