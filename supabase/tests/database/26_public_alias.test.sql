-- Privacidad del alias público: nunca sale del email, se valida y los rankings lo enmascaran.
begin;
select plan(23);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-2600-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'usab-17946@test.com', '{}'),
  ('bbbbbbbb-2600-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucia.perez@test.com', '{"full_name": "Lucía Pérez"}');

-- 1. Alta ----------------------------------------------------------------------------------------------------------------
select is((select display_name from public.profiles where id = 'aaaaaaaa-2600-4000-8000-000000000001'), 'Cliente AAAA', 'sin nombre de Google: Cliente + 4 del id, no el prefijo del mail');
select is((select display_name from public.profiles where id = 'bbbbbbbb-2600-4000-8000-000000000002'), 'Cliente BBBB', 'con nombre de Google tampoco se usa solo');
select is((select google_name from public.profiles where id = 'bbbbbbbb-2600-4000-8000-000000000002'), 'Lucía Pérez', 'pero el nombre de Google queda guardado para ofrecerlo');

-- 2. Validación -----------------------------------------------------------------------------------------------------------
select ok(not public.alias_is_valid('usab-17946', 'aaaaaaaa-2600-4000-8000-000000000001'), 'el prefijo de su propio mail no sirve');
select ok(not public.alias_is_valid('USAB-17946', 'aaaaaaaa-2600-4000-8000-000000000001'), 'ni con otras mayúsculas');
select ok(not public.alias_is_valid('ana@test.com', null), 'un email no sirve');
select ok(not public.alias_is_valid('611 222 333', null), 'un teléfono no sirve');
select ok(not public.alias_is_valid('www.mipagina.es', null), 'un enlace no sirve');
select ok(not public.alias_is_valid('Hitler', null), 'una grosería básica no sirve');
select ok(not public.alias_is_valid('A', null), 'muy corto no sirve');
select ok(not public.alias_is_valid(repeat('a', 31), null), 'muy largo no sirve');
select ok(not public.alias_is_valid('Ana <b>', null), 'caracteres raros no sirven');
select ok(public.alias_is_valid('Lucía P.', null), 'un alias normal sirve');
select ok(public.alias_is_valid('Computadora', null), 'una palabra que solo contiene una grosería adentro sirve');

-- 3. Onboarding y edición como cliente ------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-2600-4000-8000-000000000001", "role": "authenticated"}', true);

select throws_ok($$ select public.complete_onboarding('usab-17946', false, true, true, true) $$, '22023', 'invalid_name', 'la bienvenida rechaza el prefijo del mail');
select throws_ok($$ select public.complete_onboarding('mi@correo.com', false, true, true, true) $$, '22023', 'invalid_name', 'y un email');
select lives_ok($$ select public.complete_onboarding('Miguel R.', false, true, true, true) $$, 'un alias válido se guarda');
select is((select display_name from public.profiles where id = 'aaaaaaaa-2600-4000-8000-000000000001'), 'Miguel R.', 'y queda como nombre');
select throws_ok($$ select public.update_profile('666 777 888', false) $$, '22023', 'invalid_name', 'editar el perfil también valida');

reset role;

-- 4. Lo que ven los rankings -------------------------------------------------------------------------------------------------
select is(public.public_name('usab@test.com'), 'Cliente', 'un nombre con @ sale como Cliente');
select is(public.public_name('Ana Pérez'), 'Ana P.', 'nombre e inicial, como antes');
select is(public.public_name('Cliente 1A2B'), 'Cliente 1A2B', 'el alias neutro se muestra tal cual');
select is(public.public_name('Invitado 1A2B'), 'Invitado 1A2B', 'y el de invitado también');

select * from finish();
rollback;
