-- Consentimiento legal (+18, privacidad, bases) y exportación de datos del propio usuario.
begin;
select plan(26);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-2100-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana Pérez"}'),
  ('bbbbbbbb-2100-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com', '{"full_name": "Beto Gómez"}');

-- Datos de las dos personas para comprobar que la exportación no mezcla.
select public.claim_sale_apply('aaaaaaaa-2100-4000-8000-000000000001', 'd2100000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
select public.claim_sale_apply('bbbbbbbb-2100-4000-8000-000000000002', 'd2100000-0000-4000-8000-000000000002',
  jsonb_build_object('total_cents', 5000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
insert into public.places (id, name, category, submitted_by) values
  ('e2100000-0000-4000-8000-000000000001', 'Lugar de Ana', 'cafe', 'aaaaaaaa-2100-4000-8000-000000000001'),
  ('e2100000-0000-4000-8000-000000000002', 'Lugar de Beto', 'cafe', 'bbbbbbbb-2100-4000-8000-000000000002');
insert into public.place_comments (place_id, customer_id, body) values
  ('e2100000-0000-4000-8000-000000000002', 'aaaaaaaa-2100-4000-8000-000000000001', 'Comentario de Ana'),
  ('e2100000-0000-4000-8000-000000000002', 'bbbbbbbb-2100-4000-8000-000000000002', 'Comentario de Beto');

-- 1. Estructura -----------------------------------------------------------------------------------------------------

select is((select value ->> 'version' from public.settings where key = 'legal'), '2026-11-01', 'hay una versión legal vigente en settings');
select is((select is_public from public.settings where key = 'legal'), true, 'y es pública (la app la lee sin sesión)');
select is((select count(*)::int from public.profiles where id in ('aaaaaaaa-2100-4000-8000-000000000001', 'bbbbbbbb-2100-4000-8000-000000000002') and (adult_confirmed_at is not null or legal_version is not null)),
          0, 'nadie arranca con el consentimiento dado');
select is((select count(*)::int from information_schema.column_privileges
            where table_schema = 'public' and table_name = 'profiles' and grantee in ('authenticated', 'anon')
              and privilege_type in ('INSERT', 'UPDATE')),
          0, 'el cliente no tiene permiso de escritura sobre las columnas del perfil');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('accept_legal', 'complete_onboarding', 'export_my_data')
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'))),
          0, 'un visitante sin sesión no puede ejecutar las funciones legales');

-- 2. Ana acepta ------------------------------------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-2100-4000-8000-000000000001", "role": "authenticated"}', true);
set local role authenticated;

select throws_ok($$ update public.profiles set adult_confirmed_at = now(), legal_version = 'trucho' $$,
                 '42501', null, 'Ana no puede escribir las columnas legales directamente');
select throws_ok($$ select public.complete_onboarding('Ana', false, true, true, false) $$,
                 '22023', 'consent_required', 'sin aceptar las bases no se completa la bienvenida');
select throws_ok($$ select public.complete_onboarding('Ana', false, false, true, true) $$,
                 '22023', 'consent_required', 'sin confirmar +18 no se completa la bienvenida');
select throws_ok($$ select public.accept_legal(true, false, true) $$,
                 '22023', 'consent_required', 'sin aceptar la privacidad no se registra nada');
select is((select program_consent_at from public.profiles), null, 'los intentos fallidos no dejaron rastro');

select lives_ok($$ select public.complete_onboarding('Ana M.', false, true, true, true) $$, 'con las tres confirmaciones la bienvenida funciona');
select isnt((select adult_confirmed_at from public.profiles), null, 'queda la fecha de la confirmación +18');
select isnt((select privacy_accepted_at from public.profiles), null, 'queda la fecha de la aceptación de la privacidad');
select isnt((select terms_accepted_at from public.profiles), null, 'queda la fecha de la aceptación de las bases');
select is((select legal_version from public.profiles), '2026-11-01', 'queda la versión aceptada');
select isnt((select program_consent_at from public.profiles), null, 'se mantiene program_consent_at por compatibilidad');
select is((select promo_consent from public.profiles), false, 'la casilla de promos opcional quedó desmarcada');
select is((select count(*)::int from public.profiles), 1, 'Ana solo ve su perfil');

-- 3. Cambio de versión: se vuelve a aceptar sin perder nada -------------------------------------------------------------

reset role;
update public.settings set value = '{"version": "2026-12-01"}' where key = 'legal';
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-2100-4000-8000-000000000001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.accept_legal(true, true, true) $$, 'Ana acepta la versión nueva');
select is((select legal_version from public.profiles), '2026-12-01', 'quedó la versión nueva');
select is((select display_name from public.profiles), 'Ana M.', 'y no se tocó su nombre');
select is((public.customer_dashboard() ->> 'balance')::int, 1000, 'ni sus puntos');

-- 4. Exportación -------------------------------------------------------------------------------------------------------

create temp table export_ana as select public.export_my_data() as j;
grant all on export_ana to authenticated;

select is((select j -> 'profile' ->> 'id' from export_ana), 'aaaaaaaa-2100-4000-8000-000000000001', 'la exportación trae el perfil de Ana');
select is((select jsonb_array_length(j -> 'point_movements') from export_ana), 1, 'trae sus movimientos de puntos');
select is((select jsonb_array_length(j -> 'comments') from export_ana), 1, 'trae solo su comentario');
select is((select position('Beto' in j::text) from export_ana), 0, 'no incluye ningún dato de Beto');

select * from finish();
rollback;
