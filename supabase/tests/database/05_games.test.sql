-- Juegos: el servidor decide, con límites diarios, tope de presupuesto y un solo juego por origen.
begin;
select plan(19);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com');

-- Las probabilidades reales siguen los pesos configurados (10 000 tiradas, tolerancia amplia).
create temp table draws as
  select (public.pick_prize((public.setting_json('games') -> 'roulette') -> 'prizes')) ->> 'id' as prize
    from generate_series(1, 10000);
select cmp_ok((select count(*)::int from draws where prize = 'p50'), '<', 700, 'el premio de 4% sale poco (<7%)');
select cmp_ok((select count(*)::int from draws where prize = 'p50'), '>', 150, '...pero sale (>1,5%)');
select cmp_ok((select count(*)::int from draws where prize = 'p5'), '>', 2500, 'el de 30% sale seguido');
select is((select count(distinct prize)::int from draws), 6, 'todos los premios pueden salir');

-- Ruleta: una por día.
create temp table spin1 as select public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'roulette') as r;
select is((select r ->> 'game' from spin1), 'roulette', 'la ruleta responde con el premio decidido');
select is(
  (select count(*)::int from public.game_plays where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1, 'queda registrada la jugada');
select is(
  public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'),
  (select (r ->> 'points')::int from spin1), 'los puntos del premio entran al libro (o 0 si no hubo)');
select throws_ok(
  $$ select public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'roulette') $$,
  'P0001', 'daily_limit_reached', 'segundo giro del día: rechazado');
select is(public.play_game('bbbbbbbb-0000-4000-8000-000000000002', 'roulette') ->> 'game', 'roulette', 'otro cliente sí puede girar');

-- Raspadita: una por compra confirmada propia.
insert into public.claims (id, customer_id, sale_uuid, status, sale_total_cents, points) values
  ('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'confirmed', 1000, 10),
  ('c2000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002', 'rejected', 1000, 0);
select throws_ok(
  $$ select public.play_game('bbbbbbbb-0000-4000-8000-000000000002', 'scratch', 'c1000000-0000-4000-8000-000000000001') $$,
  'P0001', 'play_not_available', 'no se puede raspar la compra de otro');
select throws_ok(
  $$ select public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'scratch', 'c2000000-0000-4000-8000-000000000002') $$,
  'P0001', 'play_not_available', 'no se raspa una compra rechazada');
select throws_ok(
  $$ select public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'scratch', null) $$,
  'P0001', 'play_not_available', 'sin compra no hay raspadita');
create temp table scratch1 as select public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'scratch', 'c1000000-0000-4000-8000-000000000001') as r;
select is((select (r ->> 'repeat')::boolean from scratch1), false, 'primera raspadita');
select is(
  public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'scratch', 'c1000000-0000-4000-8000-000000000001') ->> 'prize_id',
  (select r ->> 'prize_id' from scratch1), 'raspar de nuevo muestra el MISMO resultado');
select is(
  (select count(*)::int from public.game_plays where game = 'scratch' and customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1, 'y no se juega dos veces');

-- La app muestra qué hay para jugar.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((public.games_status() -> 'roulette' ->> 'available')::boolean, false, 'la ruleta de hoy ya se usó');
select is(public.games_status() ->> 'scratch_claim_id', null, 'no quedan raspaditas pendientes');
select throws_ok($$ select public.play_game('aaaaaaaa-0000-4000-8000-000000000001', 'roulette') $$, '42501', null, 'el cliente no puede jugar por su cuenta');
reset role;

-- Tope diario de presupuesto: con el presupuesto agotado se juega igual, pero sin premio.
update public.settings set value = jsonb_set(value, '{daily_points_budget}', '0') where key = 'games';
update public.settings set value = jsonb_set(value, '{roulette,prizes}', '[{"id":"zero","label":"Nada","points":0,"weight":1},{"id":"big","label":"+50","points":50,"weight":1000}]') where key = 'games';
delete from public.game_plays where customer_id = 'bbbbbbbb-0000-4000-8000-000000000002';
select is(
  (public.play_game('bbbbbbbb-0000-4000-8000-000000000002', 'roulette') ->> 'points')::int, 0, 'sin presupuesto el premio grande se convierte en "seguí participando"');

select * from finish();
rollback;
