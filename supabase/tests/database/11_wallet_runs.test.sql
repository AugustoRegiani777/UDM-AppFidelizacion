-- Saldo gastable, monedas de juego, partidas oficiales, pases de desafío y rankings (docs/06).
begin;
select plan(36);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana María Pérez"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com', '{"full_name": "Beto"}'),
  ('cccccccc-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cami@test.com', '{"full_name": "Camila Roldán"}');

-- 50 € de compras = 500 puntos para Ana.
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 5000, 'sold_at', now(), 'voided', false, 'channel', 'local'));

-- 1. Saldo gastable -----------------------------------------------------------------------------------------
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 500, 'Ana tiene 500 puntos ganados');
select is(public.customer_spendable('aaaaaaaa-0000-4000-8000-000000000001'), 500, 'y 500 para gastar');
select is(public.spend_points('aaaaaaaa-0000-4000-8000-000000000001', 200, 'shop', null), 300, 'gastar 200 deja 300');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 500, 'el total ganado no se toca (los escalones siguen)');
select throws_ok($$ select public.spend_points('aaaaaaaa-0000-4000-8000-000000000001', 400, 'shop', null) $$,
  'P0001', 'not_enough_points', 'no se puede gastar más de lo que hay');
select throws_ok($$ select public.spend_points('aaaaaaaa-0000-4000-8000-000000000001', 0, 'shop', null) $$,
  'P0001', 'invalid_amount', 'ni gastar cero o negativo');
select is(public.customer_spendable('bbbbbbbb-0000-4000-8000-000000000002'), 0, 'quien no compró no tiene nada para gastar');

-- 2. Partida oficial: ganar da monedas y un pase ----------------------------------------------------------------
create temp table run1 as select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'survivors', 2) as r;
select is((select r ->> 'game' from run1), 'survivors', 'la partida arranca con el juego pedido');
select is((select (r ->> 'stage')::int from run1), 2, 'y su nivel');
select is((select count(*)::int from public.game_runs where status = 'playing'), 1, 'queda una partida en juego');

create temp table done1 as select public.finish_run('aaaaaaaa-0000-4000-8000-000000000001',
  (select (r ->> 'run_id')::uuid from run1), true, 3000, 0, '{"ticks": 5000}') as r;
select is((select (r ->> 'coins')::int from done1), 30, 'ganar con 3000 puntos da 15 + 15 monedas');
select is((select (r ->> 'pass_granted')::boolean from done1), true, 'ganar da un pase de desafío');
select is((select (r ->> 'new_best')::boolean from done1), true, 'y es un récord');
select is(public.customer_coins('aaaaaaaa-0000-4000-8000-000000000001'), 30, 'las monedas quedan en la billetera');
select throws_ok($$ select public.finish_run('aaaaaaaa-0000-4000-8000-000000000001', (select (r ->> 'run_id')::uuid from run1), true, 1, 0, '{}') $$,
  'P0001', 'session_closed', 'una partida cerrada no se vuelve a cerrar');

-- Terminar antes del tiempo real de la partida se rechaza.
create temp table run2 as select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'survivors', 1) as r;
select throws_ok($$ select public.finish_run('aaaaaaaa-0000-4000-8000-000000000001', (select (r ->> 'run_id')::uuid from run2), true, 900, 600, '{}') $$,
  'P0001', 'too_fast', 'no se puede terminar más rápido que el tiempo real');

-- Perder da pocas monedas y ningún pase.
create temp table lost1 as select public.finish_run('aaaaaaaa-0000-4000-8000-000000000001',
  (select (r ->> 'run_id')::uuid from run2), false, 120, 0, '{}') as r;
select is((select (r ->> 'coins')::int from lost1), 2, 'perder da 2 monedas');
select is((select (r ->> 'pass_granted')::boolean from lost1), false, 'y ningún pase');
select is((select count(*)::int from public.challenge_passes where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001' and used_at is null), 1, 'hay un solo pase guardado');

-- Empezar otra partida deja vencida la que quedó a medias.
create temp table run3 as select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'skate', 7) as r;
create temp table run4 as select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'skate', 7) as r;
select is((select status from public.game_runs where id = (select (r ->> 'run_id')::uuid from run3)), 'expired', 'la partida abandonada vence');
select is((select (r ->> 'stage')::int from run4), 1, 'el skate siempre es nivel 1');
select throws_ok($$ select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'truco', 1) $$,
  'P0001', 'invalid_game', 'solo se juegan oficialmente los juegos que el servidor puede validar');

-- 3. Topes: monedas por día y pases guardados --------------------------------------------------------------------
update public.settings set value = value || '{"coins_daily_cap": 40, "pass_cap": 2}'::jsonb where key = 'economy';
create temp table win2 as select public.finish_run('aaaaaaaa-0000-4000-8000-000000000001',
  (select (r ->> 'run_id')::uuid from run4), true, 1000, 0, '{}') as r;
-- Ya tenía 32 monedas hoy (30 + 2): el tope de 40 deja pasar solo 8.
select is((select (r ->> 'coins')::int from win2), 8, 'el tope diario recorta las monedas');
select is((select (r ->> 'pass_granted')::boolean from win2), true, 'se guarda el segundo pase');
create temp table run5 as select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'survivors', 1) as r;
create temp table win3 as select public.finish_run('aaaaaaaa-0000-4000-8000-000000000001',
  (select (r ->> 'run_id')::uuid from run5), true, 5000, 0, '{}') as r;
select is((select (r ->> 'coins')::int from win3), 0, 'con el tope diario agotado no hay más monedas');
select is((select (r ->> 'pass_granted')::boolean from win3), false, 'con 2 pases guardados no se suma un tercero');

-- 4. Un pase abre el cofre sin volver a jugar ---------------------------------------------------------------------
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
  jsonb_build_object('total_cents', 4000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
create temp table chest as select public.start_chest('aaaaaaaa-0000-4000-8000-000000000001',
  (select id from public.rewards where name = 'Un café')) as r;
select is((select (r ->> 'via_pass')::boolean from chest), true, 'el cofre se abre con un pase');
select is((select count(*)::int from public.challenge_passes where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001' and used_at is null), 1, 'el pase usado se gasta');

-- 5. Rankings --------------------------------------------------------------------------------------------------------
-- Beto y Camila también juegan el nivel 1 de Sobreviví.
select public.finish_run('bbbbbbbb-0000-4000-8000-000000000002',
  (select (public.start_run('bbbbbbbb-0000-4000-8000-000000000002', 'survivors', 1) ->> 'run_id')::uuid), true, 7000, 0, '{}');
select public.finish_run('cccccccc-0000-4000-8000-000000000003',
  (select (public.start_run('cccccccc-0000-4000-8000-000000000003', 'survivors', 1) ->> 'run_id')::uuid), true, 4000, 0, '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
-- En el nivel 1 ganaron: Ana (5000, el mejor de sus partidas), Beto (7000) y Camila (4000).
select is((public.leaderboard('survivors', 1) -> 'rows' -> 0 ->> 'name'), 'Beto', 'el primero es Beto con 7000');
select is((public.leaderboard('survivors', 1) -> 'rows' -> 1 ->> 'score')::int, 5000, 'cada jugador cuenta con su mejor puntaje');
select is((public.leaderboard('survivors', 1) -> 'me' ->> 'rank')::int, 2, 'Ana ve que es la segunda');
select is((public.leaderboard('survivors', 1) -> 'rows' -> 2 ->> 'name'), 'Camila R.', 'se muestra nombre e inicial del apellido');

-- Sacarse del ranking oculta a la persona (menos para sí misma).
select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select public.set_show_in_rankings(false);
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is(jsonb_array_length(public.leaderboard('survivors', 1) -> 'rows'), 2, 'quien se oculta no aparece en el ranking de los demás');
select is((public.leaderboard_points() -> 'rows' -> 0 ->> 'name'), 'Ana P.', 'el ranking general ordena por puntos acumulados');

-- 6. Privacidad ---------------------------------------------------------------------------------------------------------
select is((select count(*)::int from public.game_runs), 5, 'cada cliente solo ve sus propias partidas');
select throws_ok($$ select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'survivors', 1) $$,
  '42501', null, 'un cliente no puede abrir partidas por su cuenta: eso lo hace el servidor');

select * from finish();
rollback;
