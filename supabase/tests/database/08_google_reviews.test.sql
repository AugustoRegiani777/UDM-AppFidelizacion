-- Verificación automática de reseñas de Google: coincidencias, sugerencias y que cada reseña cuente una sola vez.
begin;
select plan(21);

select is(public.normalize_name('  LUCÍA   Pérez '), 'lucia perez', 'normaliza mayúsculas, tildes y espacios');
select is(public.normalize_name(null), '', 'nombre vacío');

-- Ana entra con Google (nombre "Lucía Pérez"); Beto con otro nombre; Carla anónima en Google.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Lucía Pérez"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com', '{"full_name": "Beto Gómez"}'),
  ('cccccccc-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla@test.com', '{"full_name": "Carla Ruiz"}'),
  ('dddddddd-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev@test.com', '{}');

select is((select google_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'Lucía Pérez', 'se guarda el nombre de la cuenta de Google al registrarse');
select is((select google_name from public.profiles where id = 'dddddddd-0000-4000-8000-000000000004'), null, 'sin nombre de Google queda vacío');

-- Todos piden la misión de reseña.
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
set local role authenticated;
select public.claim_mission('google_review', 'Lucy P');
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select public.claim_mission('google_review', 'Beto G.');
select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select public.claim_mission('google_review', 'Carla R');
reset role;

-- Sin reseñas todavía: no pasa nada.
select is(public.match_google_reviews() ->> 'approved', '0', 'sin reseñas, nada que aprobar');

-- Llegan reseñas de Google: la de Lucía (con tildes distintas), una de "Beto G." (nombre que escribió Beto),
-- una anónima y una muy vieja.
select is(
  public.upsert_google_reviews(jsonb_build_array(
    jsonb_build_object('id', 'r1', 'name', 'LUCIA PEREZ', 'anonymous', false, 'time', now() - interval '2 days'),
    jsonb_build_object('id', 'r2', 'name', 'Beto G.', 'anonymous', false, 'time', now() - interval '1 day'),
    jsonb_build_object('id', 'r3', 'name', 'Carla Ruiz', 'anonymous', true, 'time', now() - interval '1 day'),
    jsonb_build_object('id', 'r4', 'name', 'Otra Persona', 'anonymous', false, 'time', now() - interval '400 days')
  )), 4, 'se guardan las 4 reseñas');
select is(public.upsert_google_reviews(jsonb_build_array(jsonb_build_object('id', 'r1', 'name', 'LUCIA PEREZ', 'time', now()))), 0, 'una reseña repetida no se vuelve a guardar');
select is((select reviewer_name from public.google_reviews where review_id = 'r3'), null, 'el nombre de las reseñas anónimas no se guarda');

create temp table m as select public.match_google_reviews() as r;
select is((select (r ->> 'approved')::int from m), 1, 'se aprueba la de Lucía (coincide con su cuenta de Google)');
select is((select (r ->> 'suggested')::int from m), 1, 'se sugiere la de Beto (solo coincide el nombre que escribió)');

select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 50, 'Lucía suma los 50 puntos');
select is(public.customer_balance('bbbbbbbb-0000-4000-8000-000000000002'), 0, 'Beto todavía no: la aprueba el admin');
select is(public.customer_balance('cccccccc-0000-4000-8000-000000000003'), 0, 'la reseña anónima no se puede verificar sola');
select is((select claimed_by is not null from public.google_reviews where review_id = 'r1'), true, 'la reseña de Lucía queda usada');

-- Correr de nuevo no acredita dos veces.
select is((public.match_google_reviews() ->> 'approved')::int, 0, 'no se acredita dos veces');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 50, 'el saldo de Lucía no cambia');

-- Un admin ve la sugerencia primero y, al aprobar, la reseña queda usada.
update public.profiles set is_admin = true where id = 'dddddddd-0000-4000-8000-000000000004';
select set_config('request.jwt.claims', '{"sub": "dddddddd-0000-4000-8000-000000000004", "role": "authenticated"}', true);
set local role authenticated;
select is((select suggested from public.admin_pending_missions() order by suggested desc limit 1), true, 'la sugerida aparece primera con la marca de coincidencia');
reset role;
select set_config('app.beto_claim', (select id::text from public.bonus_claims where customer_id = 'bbbbbbbb-0000-4000-8000-000000000002'), false);
set local role authenticated;
select lives_ok($$ select public.admin_review_mission(current_setting('app.beto_claim')::uuid, true) $$, 'el admin aprueba la sugerida');
reset role;
select is((select claimed_by is not null from public.google_reviews where review_id = 'r2'), true, 'esa reseña queda usada');

-- Con la aprobación automática apagada, la coincidencia por cuenta de Google solo se sugiere.
update public.settings set value = jsonb_set(value, '{auto_approve}', 'false') where key = 'google_reviews';
update public.bonus_claims set status = 'rejected' where customer_id = 'cccccccc-0000-4000-8000-000000000003';
select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
set local role authenticated;
select public.claim_mission('google_review', 'Carla Ruiz');
reset role;
select public.upsert_google_reviews(jsonb_build_array(jsonb_build_object('id', 'r5', 'name', 'Carla Ruiz', 'anonymous', false, 'time', now())));
select is((public.match_google_reviews() ->> 'approved')::int, 0, 'con la aprobación automática apagada no se aprueba sola');
select is((select suggested_review from public.bonus_claims where customer_id = 'cccccccc-0000-4000-8000-000000000003' and status = 'pending'), 'r5', 'pero queda sugerida');

select * from finish();
rollback;
