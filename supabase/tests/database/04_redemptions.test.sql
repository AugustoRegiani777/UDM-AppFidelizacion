-- Canjes: código único con vencimiento, puntos descontados al validar, un solo uso.
begin;
select plan(26);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana María Pérez"}');

create temp table reward_ids as
  select name, id from public.rewards;

-- Sin puntos suficientes no hay código.
select throws_ok(
  $$ select public.create_redemption('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) $$,
  'P0001', 'reward_not_reached', 'sin puntos no se puede canjear');

insert into public.point_movements (customer_id, kind, points) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'adjustment', 160);

create temp table c1 as select public.create_redemption(
  'aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) as r;

select matches((select r ->> 'code' from c1), '^MIGA-[A-HJ-KM-NP-Z2-9]{4}$', 'el código tiene el formato MIGA-XXXX sin caracteres ambiguos');
select cmp_ok((select (r ->> 'expires_at')::timestamptz from c1), '>', now() + interval '14 minutes', 'vence en 15 minutos');
select cmp_ok((select (r ->> 'expires_at')::timestamptz from c1), '<=', now() + interval '15 minutes', 'y no más');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 160, 'generar el código NO descuenta puntos');
select is(
  (public.create_redemption('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) ->> 'code'),
  (select r ->> 'code' from c1), 'pedir de nuevo devuelve el mismo código vigente');
select is((select count(*)::int from public.redemptions where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1, 'no se acumulan códigos');

-- Los puntos del código vigente quedan reservados.
select throws_ok(
  $$ select public.create_redemption('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un sanguche de miga')) $$,
  'P0001', 'reward_not_reached', 'premio mayor no alcanzado');

-- La caja valida: descuenta, marca usado y devuelve el premio.
create temp table v1 as select public.validate_redemption(lower(' ' || (select r ->> 'code' from c1) || ' ')) as r;
select is((select (r ->> 'valid')::boolean from v1), true, 'código válido (sin importar mayúsculas ni espacios)');
select is((select r -> 'reward' ->> 'name' from v1), 'Un café', 'devuelve el premio');
select is((select r ->> 'customer_name' from v1), 'Ana', 'devuelve solo el primer nombre');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 10, 'recién ahora se descuentan los 150 puntos');
select is((select status from public.redemptions where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'used', 'el código queda usado');
select is((select kind from public.point_movements where ref_table = 'redemptions' and customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'redeem', 'el descuento es un movimiento del libro');

-- Usado, inexistente
select is(public.validate_redemption((select r ->> 'code' from c1)) ->> 'reason', 'used', 'no se puede usar dos veces');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 10, 'y no se descuenta dos veces');
select is(public.validate_redemption('MIGA-ZZZZ') ->> 'reason', 'not_found', 'código inexistente');
select is(public.validate_redemption(null) ->> 'reason', 'not_found', 'código vacío');

-- Vencido: no se pierde nada y se puede pedir otro.
insert into public.point_movements (customer_id, kind, points) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'adjustment', 200);
create temp table c2 as select public.create_redemption(
  'aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) as r;
update public.redemptions set expires_at = now() - interval '1 minute' where code = (select r ->> 'code' from c2);
select is(public.validate_redemption((select r ->> 'code' from c2)) ->> 'reason', 'expired', 'código vencido');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 210, 'si vence no se pierde ningún punto');
select isnt(
  public.create_redemption('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Un café')) ->> 'code',
  (select r ->> 'code' from c2), 'después de vencer se puede generar otro código');

-- Premio por compras: cada 50 compras, sin consumir puntos.
insert into public.claims (customer_id, sale_uuid, status, sale_total_cents, points)
select 'aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid(), 'confirmed', 100, 0 from generate_series(1, 49);
select throws_ok(
  $$ select public.create_redemption('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Media docena de migas')) $$,
  'P0001', 'reward_not_reached', 'con 49 compras todavía no');
insert into public.claims (customer_id, sale_uuid, status, sale_total_cents, points)
values ('aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid(), 'confirmed', 100, 0);
create temp table c3 as select public.create_redemption(
  'aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Media docena de migas')) as r;
select is(public.validate_redemption((select r ->> 'code' from c3)) -> 'reward' ->> 'kind', 'purchases', 'con 50 compras se canjea la media docena');
select is((select count(*)::int from public.point_movements where ref_table = 'redemptions' and points = 0 and customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0, 'canjear por compras no mueve puntos');
select throws_ok(
  $$ select public.create_redemption('aaaaaaaa-0000-4000-8000-000000000001', (select id from reward_ids where name = 'Media docena de migas')) $$,
  'P0001', 'reward_not_reached', 'el siguiente recién a las 100 compras');

-- Ni la API ni el cliente pueden llamar a estas funciones.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select public.validate_redemption('MIGA-AAAA') $$, '42501', null, 'el cliente no valida códigos');
reset role;

select * from finish();
rollback;
