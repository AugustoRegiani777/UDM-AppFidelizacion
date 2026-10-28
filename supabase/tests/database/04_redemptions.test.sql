-- Canjes y cofre: los puntos no se gastan, el código solo sale al pasar el juego, un solo uso.
begin;
select plan(32);

-- Escala fija para estos casos (1 punto por euro, café 150, sanguche 300, gorra 1000). La escala real
-- de la tarjeta (10 puntos por euro) se prueba en 10_economy_scale.test.sql.
update public.settings set value = '1' where key = 'points_per_euro';
update public.rewards set threshold = 150 where kind = 'points' and name = 'Un café';
update public.rewards set threshold = 300 where kind = 'points' and name = 'Un sanguche de miga';
update public.rewards set threshold = 1000 where kind = 'points' and name = 'Gorra Uno de Miga';

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana María Pérez"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com', '{}');

create temp table reward_ids as select name, id from public.rewards;

-- Sin puntos suficientes no hay cofre.
select throws_ok(
  $$ select public.start_chest('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) $$,
  'P0001', 'reward_not_reached', 'sin puntos no se puede abrir el cofre');

insert into public.point_movements (customer_id, kind, points) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'adjustment', 160);
select is(public.reward_tickets('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')), 1, 'con 160 puntos hay 1 ticket de café');
select is(public.reward_tickets('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un sanguche de miga')), 0, 'y 0 de sanguche (300)');

create temp table s1 as select public.start_chest(
  'aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) as r;
select is((select (r ->> 'already_unlocked')::boolean from s1), false, 'se abre una sesión de cofre');
select is((select (r ->> 'relaxed')::boolean from s1), false, 'la primera partida es en modo normal');
select ok((select (r ->> 'seed')::bigint between 0 and 4294967295 from s1), 'la semilla entra en 32 bits');
select is((select count(*)::int from public.redemptions where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0, 'todavía no hay código: falta pasar el juego');

-- Ganar demasiado rápido no vale.
select throws_ok(
  format($$ select public.finish_chest('aaaaaaaa-0000-4000-8000-000000000001', %L, true, 40, '{}') $$, (select r ->> 'session_id' from s1)),
  'P0001', 'too_fast', 'ganar antes del tiempo real de la partida se rechaza');

-- Ganar de verdad: sale el código y los puntos no se tocan.
update public.chest_sessions set started_at = now() - interval '60 seconds' where id = (select (r ->> 'session_id')::uuid from s1);
create temp table f1 as select public.finish_chest(
  'aaaaaaaa-0000-4000-8000-000000000001', (select (r ->> 'session_id')::uuid from s1), true, 40, '{"kills": 120}') as r;
select is((select (r ->> 'won')::boolean from f1), true, 'ganar el juego emite el código');
select matches((select r -> 'redemption' ->> 'code' from f1), '^MIGA-[A-HJ-KM-NP-Z2-9]{4}$', 'formato MIGA-XXXX sin caracteres ambiguos');
select cmp_ok((select (r -> 'redemption' ->> 'expires_at')::timestamptz from f1), '>', now() + interval '14 minutes', 'vence en 15 minutos');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 160, 'los puntos no se gastan');
select throws_ok(
  format($$ select public.finish_chest('aaaaaaaa-0000-4000-8000-000000000001', %L, true, 40, '{}') $$, (select (r ->> 'session_id') from s1)),
  'P0001', 'session_closed', 'una sesión ganada no se puede reutilizar');
select is((select (public.start_chest('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) ->> 'already_unlocked')::boolean), true, 'con código vigente no se vuelve a jugar');

-- La caja valida: marca usado, el saldo sigue igual.
create temp table v1 as select public.validate_redemption(lower(' ' || (select r -> 'redemption' ->> 'code' from f1) || ' ')) as r;
select is((select (r ->> 'valid')::boolean from v1), true, 'código válido (sin importar mayúsculas ni espacios)');
select is((select r -> 'reward' ->> 'name' from v1), 'Un café', 'devuelve el premio');
select is((select r ->> 'customer_name' from v1), 'Ana', 'devuelve solo el primer nombre');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 160, 'validar en caja tampoco descuenta');
select is(public.validate_redemption((select r -> 'redemption' ->> 'code' from f1)) ->> 'reason', 'used', 'no se puede usar dos veces');
select is(public.validate_redemption('MIGA-ZZZZ') ->> 'reason', 'not_found', 'código inexistente');
select is(public.reward_tickets('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')), 0, 'el ticket se consumió: el próximo café es a los 300');

-- Escalón repetible: con 310 puntos hay otro ticket.
insert into public.point_movements (customer_id, kind, points) values ('aaaaaaaa-0000-4000-8000-000000000001', 'adjustment', 150);
select is(public.reward_tickets('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')), 1, 'cada 150 puntos acumulados, un café más');

-- Perder no cuesta nada, y tras dos derrotas se ofrece el modo relajado.
create temp table s2 as select public.start_chest('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) as r;
select is(public.finish_chest('aaaaaaaa-0000-4000-8000-000000000001', (select (r ->> 'session_id')::uuid from s2), false, 40, '{}') ->> 'won', 'false', 'perder deja la sesión como derrota');
create temp table s3 as select public.start_chest('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) as r;
select is((select (r ->> 'relaxed')::boolean from s3), false, 'tras una derrota todavía es normal');
select public.finish_chest('aaaaaaaa-0000-4000-8000-000000000001', (select (r ->> 'session_id')::uuid from s3), false, 40, '{}');
create temp table s4 as select public.start_chest('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) as r;
select is((select (r ->> 'relaxed')::boolean from s4), true, 'tras dos derrotas: modo relajado');

-- Una sesión ajena o vencida no sirve.
select throws_ok(
  format($$ select public.finish_chest('bbbbbbbb-0000-4000-8000-000000000002', %L, true, 40, '{}') $$, (select r ->> 'session_id' from s4)),
  'P0002', 'session_not_found', 'no se puede cerrar la sesión de otro cliente');
update public.chest_sessions set expires_at = now() - interval '1 second' where id = (select (r ->> 'session_id')::uuid from s4);
select throws_ok(
  format($$ select public.finish_chest('aaaaaaaa-0000-4000-8000-000000000001', %L, false, 40, '{}') $$, (select r ->> 'session_id' from s4)),
  'P0001', 'session_expired', 'una sesión vencida no se puede cerrar');

-- Código vencido: se renueva sin volver a jugar, y solo si se había ganado el cofre.
create temp table s5 as select public.start_chest('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) as r;
update public.chest_sessions set started_at = now() - interval '60 seconds' where id = (select (r ->> 'session_id')::uuid from s5);
create temp table f2 as select public.finish_chest('aaaaaaaa-0000-4000-8000-000000000001', (select (r ->> 'session_id')::uuid from s5), true, 40, '{}') as r;
update public.redemptions set expires_at = now() - interval '1 minute' where id = (select (r -> 'redemption' ->> 'id')::uuid from f2);
select is(public.validate_redemption((select r -> 'redemption' ->> 'code' from f2)) ->> 'reason', 'expired', 'código vencido');
select isnt(
  public.renew_redemption('aaaaaaaa-0000-4000-8000-000000000001', (select (r -> 'redemption' ->> 'id')::uuid from f2)) ->> 'code',
  (select r -> 'redemption' ->> 'code' from f2), 'se renueva con otro código, sin jugar de nuevo');

-- Premio por compras: cada 50, sin consumir puntos.
insert into public.claims (customer_id, sale_uuid, status, sale_total_cents, points)
select 'bbbbbbbb-0000-4000-8000-000000000002', gen_random_uuid(), 'confirmed', 100, 0 from generate_series(1, 50);
select is(public.reward_tickets('bbbbbbbb-0000-4000-8000-000000000002', (select id from reward_ids where name = 'Media docena de migas')), 1, 'con 50 compras hay 1 ticket de media docena');

-- La API y el cliente no pueden llamar a estas funciones.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select public.validate_redemption('MIGA-AAAA') $$, '42501', null, 'el cliente no valida códigos');
select throws_ok($$ select public.start_chest('aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid()) $$, '42501', null, 'el cliente no abre cofres por su cuenta');
reset role;

select * from finish();
rollback;
