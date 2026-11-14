-- Ajuste de economía: la escalera cuenta solo compras, tope de canjes por día, ticket mínimo, presupuesto de la ruleta,
-- ranking de puntos por compras, gorra fuera de la escalera y precios de la tienda.
begin;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com');

create temp table reward_ids as select name, id from public.rewards;

-- 1. Configuración cargada --------------------------------------------------------------------------------------------
select is((public.setting_json('games') ->> 'daily_points_budget')::int, 2000, 'el presupuesto diario de juegos es 2000');
select is((public.setting_json('games') -> 'scratch' ->> 'min_total_cents')::int, 500, 'la raspadita pide ticket de 5 €');
select is((public.setting_json('purchase_count_min_cents') #>> '{}')::int, 500, 'la docena de migas cuenta compras de 5 € o más');
select is((public.setting_json('redeem_daily_limit') #>> '{}')::int, 2, 'tope de 2 canjes por día');
select is((public.setting_json('reward_costs') ->> 'Un café')::int, 100, 'costo estimado del café: 1,00 €');
select is((public.setting_json('reward_costs') ->> 'Un sanguche de miga')::int, 120, 'costo estimado del sanguche: 1,20 €');
select is((select active from public.rewards where name = 'Gorra Uno de Miga'), false, 'la gorra salió de la escalera');
select is((select array_agg(price_points order by slug) from public.shop_items
            where slug in ('chipa', 'alfajor', 'medialuna', 'dulce-de-leche', 'gorra')),
          array[280, 200, 2400, 4000, 500], 'precios de la tienda (alfajor, chipá, dulce de leche, gorra, medialuna)');

-- 2. La escalera solo cuenta compras ----------------------------------------------------------------------------------
insert into public.point_movements (customer_id, kind, points) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'game', 900),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'adjustment', 900);
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 1800, 'los puntos de juego y ajustes suman al saldo');
select is(public.customer_spendable('aaaaaaaa-0000-4000-8000-000000000001'), 1800, 'y son gastables en la tienda');
select is(public.reward_tickets('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')), 0,
  'pero no dan café ni sanguche');

select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 4000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
select is(public.reward_tickets('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')), 1,
  '400 puntos de compra abren el café');
select public.reverse_claim('d0000000-0000-4000-8000-000000000001');
select is(public.reward_tickets('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')), 0,
  'si la compra se revierte, el café vuelve a cerrarse');

-- 3. Tope de canjes por día -------------------------------------------------------------------------------------------
select public.claim_sale_apply('bbbbbbbb-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002',
  jsonb_build_object('total_cents', 12000, 'sold_at', now(), 'voided', false, 'channel', 'local')); -- 1200 puntos = 3 cafés
select is(public.reward_tickets('bbbbbbbb-0000-4000-8000-000000000002', (select id from reward_ids where name = 'Un café')), 3, '3 cafés disponibles');

create temp table r1 as select public.issue_redemption('bbbbbbbb-0000-4000-8000-000000000002', (select id from reward_ids where name = 'Un café'), null) as r;
update public.redemptions set status = 'used', used_at = now() where id = (select (r ->> 'id')::uuid from r1);
create temp table r2 as select public.issue_redemption('bbbbbbbb-0000-4000-8000-000000000002', (select id from reward_ids where name = 'Un café'), null) as r;
select ok((select r ->> 'code' from r2) is not null, 'el segundo canje del día sale');
update public.redemptions set status = 'used', used_at = now() where id = (select (r ->> 'id')::uuid from r2);

select throws_ok(
  $$ select public.issue_redemption('bbbbbbbb-0000-4000-8000-000000000002', (select id from reward_ids where name = 'Un café'), null) $$,
  'P0001', 'daily_redeem_limit', 'el tercer canje del día se rechaza');
select throws_ok(
  $$ select public.start_chest('bbbbbbbb-0000-4000-8000-000000000002', (select id from reward_ids where name = 'Un café')) $$,
  'P0001', 'daily_redeem_limit', 'ni siquiera se abre el cofre');

-- Un código vencido sin usar no consume el cupo.
update public.redemptions set status = 'expired' where id = (select (r ->> 'id')::uuid from r2);
select is((public.start_chest('bbbbbbbb-0000-4000-8000-000000000002', (select id from reward_ids where name = 'Un café')) ->> 'already_unlocked')::boolean,
  false, 'un código vencido no cuenta para el tope');

-- 4. Ticket mínimo ---------------------------------------------------------------------------------------------------
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
  jsonb_build_object('total_cents', 499, 'sold_at', now(), 'voided', false, 'channel', 'local'));
select is(public.customer_purchase_count('aaaaaaaa-0000-4000-8000-000000000001'), 0, 'una compra de 4,99 € no cuenta para la docena de migas');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is(public.games_status() ->> 'scratch_claim_id', null, 'ni da raspadita');
reset role;
select throws_ok(
  format($$ select public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'scratch', %L) $$,
    (select id from public.claims where sale_uuid = 'd0000000-0000-4000-8000-000000000003')),
  'P0001', 'play_not_available', 'la raspadita no se juega con un ticket menor al mínimo');

-- 5. La raspadita no usa el presupuesto, la ruleta sí --------------------------------------------------------------------
update public.settings set value = jsonb_set(jsonb_set(jsonb_set(value, '{daily_points_budget}', '0'),
  '{scratch,prizes}', '[{"id": "p25", "label": "+25", "points": 25, "weight": 1}]'),
  '{roulette,prizes}', '[{"id": "none", "label": "x", "points": 0, "weight": 1}, {"id": "p50", "label": "+50", "points": 50, "weight": 1000000}]')
 where key = 'games';
select is((public.play_game('bbbbbbbb-0000-4000-8000-000000000002', 'scratch',
  (select id from public.claims where sale_uuid = 'd0000000-0000-4000-8000-000000000002')) ->> 'points')::int, 25,
  'con presupuesto 0 la raspadita igual paga (ticket de 120 €)');
select is((public.play_game('bbbbbbbb-0000-4000-8000-000000000002', 'roulette') ->> 'points')::int, 0,
  'con presupuesto 0 la ruleta no paga');

-- 6. Ranking de puntos: solo compras ----------------------------------------------------------------------------------
-- Ana: 5000 puntos de juego y una compra de 50 € (500). Beto: 1200 de compras. Beto va primero.
insert into public.point_movements (customer_id, kind, points) values ('aaaaaaaa-0000-4000-8000-000000000001', 'game', 5000);
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004',
  jsonb_build_object('total_cents', 5000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((public.leaderboard_points() -> 'rows' -> 0 ->> 'score')::int, 1200, 'el primero del ranking tiene 1200 puntos de compra');
select is((public.leaderboard_points() -> 'me' ->> 'score')::int, 549, 'Ana figura con sus 549 puntos de compra (49 + 500), no con los de juego');
reset role;

select * from finish();
rollback;
