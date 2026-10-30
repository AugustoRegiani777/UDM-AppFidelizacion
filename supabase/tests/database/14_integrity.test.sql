-- Integridad: el cliente no puede escribir nada sensible, ningún dato queda huérfano ni se pierde al vincular Google.
begin;
select plan(72);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-1400-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana Pérez"}'),
  ('bbbbbbbb-1400-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com', '{"full_name": "Beto Gómez"}');

-- Ana tiene puntos, monedas, un gasto, una partida y un pase: hay "de todo" para intentar romper.
select public.claim_sale_apply('aaaaaaaa-1400-4000-8000-000000000001', 'd1400000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
select public.claim_sale_apply('bbbbbbbb-1400-4000-8000-000000000002', 'd1400000-0000-4000-8000-000000000002',
  jsonb_build_object('total_cents', 5000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
insert into public.coin_movements (customer_id, amount, kind) values ('aaaaaaaa-1400-4000-8000-000000000001', 100, 'adjustment');
select public.spend_points('aaaaaaaa-1400-4000-8000-000000000001', 100, 'shop', null);
select public.finish_run('aaaaaaaa-1400-4000-8000-000000000001',
  (public.start_run('aaaaaaaa-1400-4000-8000-000000000001', 'survivors', 1) ->> 'run_id')::uuid, true, 4000, 0, '{}');

-- 1. Permisos de tablas y funciones (estructura) -----------------------------------------------------------------------

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
          0, 'todas las tablas de public tienen RLS activado');

select is((select count(*)::int from information_schema.role_table_grants
            where table_schema = 'public' and grantee in ('authenticated', 'anon')
              and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
          0, 'ni el cliente ni el visitante tienen permiso de escritura sobre ninguna tabla');

select is((select count(*)::int from information_schema.column_privileges
            where table_schema = 'public' and grantee in ('authenticated', 'anon')
              and privilege_type in ('INSERT', 'UPDATE')),
          0, 'tampoco por columna');

select is((select array_agg(table_name::text order by table_name::text) from information_schema.role_table_grants
            where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT'),
          array['rewards', 'settings'], 'el visitante solo lee premios y reglas públicas');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'))),
          0, 'el visitante no puede ejecutar ninguna función');

select is((select array_agg(p.proname::text) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
              and exists (select 1 from unnest(p.proargnames) a where a ~ 'customer|user')),
          null, 'el cliente no puede ejecutar ninguna función que reciba un id de cliente o de usuario');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') and not p.prosecdef),
          0, 'toda función que el cliente puede llamar es security definer (no depende de permisos de tabla)');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
              and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))),
          0, 'y todas fijan el search_path (no se pueden secuestrar con objetos falsos)');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in
              ('claim_sale_apply', 'reverse_claim', 'spend_points', 'spend_coins', 'finish_run', 'start_run', 'finish_chest',
               'start_chest', 'issue_redemption', 'create_redemption', 'play_game', 'award_community', 'customer_balance',
               'customer_spendable', 'customer_coins', 'upsert_google_reviews', 'match_google_reviews', 'expire_pending_claims')
              and has_function_privilege('authenticated', p.oid, 'execute')),
          0, 'las funciones que mueven puntos o monedas no son ejecutables con un JWT de cliente');

-- 2. Como cliente (JWT de Ana) no se puede escribir nada --------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-1400-4000-8000-000000000001", "role": "authenticated"}', true);

select throws_ok($$ insert into public.point_movements (customer_id, kind, points) values ('aaaaaaaa-1400-4000-8000-000000000001', 'adjustment', 99999) $$, '42501', null, 'no se inventan puntos');
select throws_ok($$ update public.point_movements set points = 99999 $$, '42501', null, 'no se editan los movimientos de puntos');
select throws_ok($$ delete from public.point_movements $$, '42501', null, 'no se borran los movimientos de puntos');
select throws_ok($$ insert into public.point_spends (customer_id, amount, item_kind) values ('aaaaaaaa-1400-4000-8000-000000000001', 1, 'x') $$, '42501', null, 'no se escriben gastos');
select throws_ok($$ delete from public.point_spends $$, '42501', null, 'no se borran los gastos (para recuperar puntos)');
select throws_ok($$ insert into public.coin_movements (customer_id, amount, kind) values ('aaaaaaaa-1400-4000-8000-000000000001', 500, 'adjustment') $$, '42501', null, 'no se inventan monedas');
select throws_ok($$ update public.coin_movements set amount = 999 $$, '42501', null, 'no se editan las monedas');
select throws_ok($$ insert into public.challenge_passes (customer_id) values ('aaaaaaaa-1400-4000-8000-000000000001') $$, '42501', null, 'no se inventan pases');
select throws_ok($$ update public.challenge_passes set used_at = null $$, '42501', null, 'no se reciclan pases usados');
select throws_ok($$ insert into public.customer_items (customer_id, item_id, level) select 'aaaaaaaa-1400-4000-8000-000000000001', id, 10 from public.shop_items limit 1 $$, '42501', null, 'no se regalan mejoras');
select throws_ok($$ update public.customer_items set level = 10 $$, '42501', null, 'no se suben de nivel las mejoras');
select throws_ok($$ insert into public.shop_orders (customer_id, item_id, price_points, code, expires_at) select 'aaaaaaaa-1400-4000-8000-000000000001', id, 0, 'MIGA-HACK', now() + interval '1 day' from public.shop_items limit 1 $$, '42501', null, 'no se fabrican códigos de la tienda');
select throws_ok($$ update public.shop_orders set status = 'active' $$, '42501', null, 'no se reactivan códigos usados');
select throws_ok($$ update public.game_runs set score = 999999 $$, '42501', null, 'no se edita el puntaje de una partida');
select throws_ok($$ insert into public.game_runs (customer_id, game, seed, expires_at) values ('aaaaaaaa-1400-4000-8000-000000000001', 'survivors', 1, now()) $$, '42501', null, 'no se crean partidas');
select throws_ok($$ update public.redemptions set status = 'active' $$, '42501', null, 'no se reactivan canjes');
select throws_ok($$ insert into public.redemptions (customer_id, reward_id, code, expires_at) select 'aaaaaaaa-1400-4000-8000-000000000001', id, 'MIGA-HACK', now() from public.rewards limit 1 $$, '42501', null, 'no se fabrican canjes');
select throws_ok($$ insert into public.claims (customer_id, sale_uuid, status, points) values ('aaaaaaaa-1400-4000-8000-000000000001', gen_random_uuid(), 'confirmed', 9999) $$, '42501', null, 'no se fabrican compras');
select throws_ok($$ update public.claims set points = 9999 $$, '42501', null, 'no se editan los puntos de una compra');
select throws_ok($$ update public.profiles set is_admin = true where id = 'aaaaaaaa-1400-4000-8000-000000000001' $$, '42501', null, 'nadie se hace administrador');
select throws_ok($$ update public.settings set value = '{}'::jsonb $$, '42501', null, 'no se tocan las reglas');
select throws_ok($$ update public.rewards set threshold = 1 $$, '42501', null, 'no se tocan los premios');
select throws_ok($$ update public.shop_items set price_points = 1 $$, '42501', null, 'no se tocan los precios de la tienda');
select throws_ok($$ insert into public.game_plays (customer_id, game, points) values ('aaaaaaaa-1400-4000-8000-000000000001', 'roulette', 999) $$, '42501', null, 'no se inventan jugadas');
select throws_ok($$ select public.claim_sale_apply('aaaaaaaa-1400-4000-8000-000000000001', gen_random_uuid(), '{"total_cents": 99999999}'::jsonb) $$, '42501', null, 'no se acredita una venta inventada');
select throws_ok($$ select public.spend_points('bbbbbbbb-1400-4000-8000-000000000002', 1, 'shop', null) $$, '42501', null, 'no se gastan los puntos de otra persona');
select throws_ok($$ select public.finish_run('bbbbbbbb-1400-4000-8000-000000000002', gen_random_uuid(), true, 999999, 0, '{}') $$, '42501', null, 'no se cierran partidas con puntaje inventado');
select throws_ok($$ select public.customer_balance('bbbbbbbb-1400-4000-8000-000000000002') $$, '42501', null, 'ni se consulta el saldo de otra persona');

-- Lo propio se ve; lo ajeno no.
select is((select count(*)::int from public.point_movements where customer_id <> 'aaaaaaaa-1400-4000-8000-000000000001'), 0, 'Ana no ve movimientos de Beto');
select is((select count(*)::int from public.profiles), 1, 'ni su perfil');
select is((select count(*)::int from public.claims where customer_id <> 'aaaaaaaa-1400-4000-8000-000000000001'), 0, 'ni sus compras');
select is((select count(*)::int from public.settings where key in ('demo', 'economy', 'rate_limits')), 0, 'las reglas privadas (puntos de entrada, economía) no se leen');

-- Doble gasto: con el saldo justo, el segundo intento falla.
select is((public.my_wallet() ->> 'spendable')::int, 900, 'Ana tiene 900 gastables (1000 - 100 gastados)');
select throws_ok($$ select public.buy_item((select id from public.shop_items where slug = 'gorra')) $$, 'P0001', 'not_enough_points', 'sin saldo no hay compra (la gorra cuesta 3000)');

-- 3. El service role tampoco reescribe los libros ----------------------------------------------------------------------

reset role;
set local role service_role;
select throws_ok($$ update public.point_movements set points = 1 $$, '42501', null, 'service role: no edita puntos');
select throws_ok($$ delete from public.point_spends $$, '42501', null, 'service role: no borra gastos');
select throws_ok($$ update public.coin_movements set amount = 1 $$, '42501', null, 'service role: no edita monedas');
select throws_ok($$ truncate public.point_movements $$, '42501', null, 'service role: no vacía el libro de puntos');
reset role;

-- 4. is_admin tiene una segunda barrera ----------------------------------------------------------------------------------

-- Simula un error futuro de permisos: tabla editable y sin RLS que lo frene.
grant update on public.profiles to authenticated;
create policy tmp_update_all on public.profiles for update to authenticated using (true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-1400-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ update public.profiles set is_admin = true where id = 'aaaaaaaa-1400-4000-8000-000000000001' $$, '42501', 'forbidden', 'aunque la tabla fuera editable, is_admin no cambia con un JWT de cliente');
select lives_ok($$ update public.profiles set display_name = 'Ana P.' where id = 'aaaaaaaa-1400-4000-8000-000000000001' $$, 'pero el nombre sí');
reset role;
drop policy tmp_update_all on public.profiles;
revoke update on public.profiles from authenticated;
select is((select is_admin from public.profiles where id = 'aaaaaaaa-1400-4000-8000-000000000001'), false, 'Ana sigue sin ser administradora');

-- 5. Idempotencia de ventas ------------------------------------------------------------------------------------------------

select is((select count(*)::int from public.point_movements where ref_table = 'claims' and customer_id = 'aaaaaaaa-1400-4000-8000-000000000001'), 1, 'una venta, un movimiento');
select is((public.claim_sale_apply('aaaaaaaa-1400-4000-8000-000000000001', 'd1400000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local')) ->> 'repeat')::boolean, true, 'reclamar de nuevo no suma otra vez');
select is(public.claim_sale_apply('bbbbbbbb-1400-4000-8000-000000000002', 'd1400000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local')) ->> 'reason', 'already_claimed', 'otra cuenta no puede quedarse con la misma venta');
select is(public.customer_balance('aaaaaaaa-1400-4000-8000-000000000001'), 1000, 'el saldo de Ana sigue en 1000');
select throws_ok($$ insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
  select customer_id, kind, points, ref_table, ref_id from public.point_movements where ref_table = 'claims' limit 1 $$,
  '23505', null, 'ni a mano se duplica el movimiento de una venta');

-- 6. Invitado que se vincula a Google: mismo usuario, mismos datos --------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, is_anonymous) values
  ('cccccccc-1400-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
select matches((select display_name from public.profiles where id = 'cccccccc-1400-4000-8000-000000000003'), '^Invitado [0-9A-F]{4}$', 'el invitado nace con nombre de invitado');
select is(public.customer_balance('cccccccc-1400-4000-8000-000000000003'), 1500, 'y con sus puntos de entrada');
select public.claim_sale_apply('cccccccc-1400-4000-8000-000000000003', 'd1400000-0000-4000-8000-000000000003',
  jsonb_build_object('total_cents', 2000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
select public.spend_points('cccccccc-1400-4000-8000-000000000003', 50, 'shop', null);

-- Es lo que hace Supabase al vincular: la misma fila pasa a no anónima y recibe email y datos de Google.
update auth.users
   set is_anonymous = false, email = 'invitada@test.com',
       raw_user_meta_data = '{"full_name": "Carla Díaz", "avatar_url": "https://example.com/c.png"}'
 where id = 'cccccccc-1400-4000-8000-000000000003';

select is((select display_name from public.profiles where id = 'cccccccc-1400-4000-8000-000000000003'), 'Carla Díaz', 'al vincular, el perfil toma el nombre de Google');
select is((select google_name from public.profiles where id = 'cccccccc-1400-4000-8000-000000000003'), 'Carla Díaz', 'y lo guarda para verificar reseñas');
select is((select avatar_url from public.profiles where id = 'cccccccc-1400-4000-8000-000000000003'), 'https://example.com/c.png', 'y la foto');
select is(public.customer_balance('cccccccc-1400-4000-8000-000000000003'), 1700, 'los puntos (entrada + compra) siguen intactos');
select is((select count(*)::int from public.point_spends where customer_id = 'cccccccc-1400-4000-8000-000000000003'), 1, 'y los gastos también');
select is((select count(*)::int from public.profiles where id = 'cccccccc-1400-4000-8000-000000000003'), 1, 'sin perfiles duplicados');

-- Si ya había elegido un nombre, no se pisa.
insert into auth.users (id, instance_id, aud, role, is_anonymous) values
  ('dddddddd-1400-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
update public.profiles set display_name = 'Dani' where id = 'dddddddd-1400-4000-8000-000000000004';
update auth.users set is_anonymous = false, raw_user_meta_data = '{"full_name": "Daniela Real"}' where id = 'dddddddd-1400-4000-8000-000000000004';
select is((select display_name from public.profiles where id = 'dddddddd-1400-4000-8000-000000000004'), 'Dani', 'el nombre elegido por la persona se respeta');

-- 7. Perfil faltante: se repara solo, sin tocar nada más -------------------------------------------------------------------

delete from public.profiles where id = 'dddddddd-1400-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "dddddddd-1400-4000-8000-000000000004", "role": "authenticated"}', true);
select is(public.ensure_profile(), true, 'ensure_profile recrea el perfil que faltaba');
select is(public.ensure_profile(), false, 'y no hace nada si ya existe');
reset role;
select is((select count(*)::int from public.profiles where id = 'dddddddd-1400-4000-8000-000000000004'), 1, 'queda un solo perfil');

-- 8. Borrar una cuenta no deja huérfanos y no toca a nadie más ------------------------------------------------------------

delete from auth.users where id = 'cccccccc-1400-4000-8000-000000000003';
select is((select count(*)::int from public.profiles where id = 'cccccccc-1400-4000-8000-000000000003'), 0, 'el perfil se va con la cuenta');
select is((select count(*)::int from public.point_movements where customer_id = 'cccccccc-1400-4000-8000-000000000003'), 0, 'y sus puntos');
select is((select count(*)::int from public.point_spends where customer_id = 'cccccccc-1400-4000-8000-000000000003'), 0, 'y sus gastos (aunque el libro sea de solo inserción)');
select is((select count(*)::int from public.claims where customer_id = 'cccccccc-1400-4000-8000-000000000003'), 0, 'y sus compras');
select is(public.customer_balance('aaaaaaaa-1400-4000-8000-000000000001'), 1000, 'los datos de las demás cuentas no cambian');

select * from finish();
rollback;
