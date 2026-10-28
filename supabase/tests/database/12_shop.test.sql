-- La tienda: mejoras de personaje y premios del local con puntos de compra; pases con monedas (docs/06).
begin;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana Pérez"}');

-- 100 € de compras = 1000 puntos.
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local'));

create temp table ids as select slug, id from public.shop_items;
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

-- 1. Catálogo ----------------------------------------------------------------------------------------------------
select ok(jsonb_array_length(public.shop_catalog() -> 'items') >= 8, 'el catálogo trae premios del local y mejoras');
select is((select (i ->> 'price')::int from jsonb_array_elements(public.shop_catalog() -> 'items') i where i ->> 'slug' = 'corazon'), 300, 'el corazón cuesta 300 el primer nivel');

-- 2. Mejoras: cada nivel cuesta más y suma su efecto -------------------------------------------------------------
select is((public.buy_item((select id from ids where slug = 'corazon')) ->> 'level')::int, 1, 'comprar el corazón da el nivel 1');
select is((public.my_wallet() ->> 'spendable')::int, 700, 'y descuenta 300 del saldo gastable');
select is((public.my_wallet() ->> 'balance')::int, 1000, 'el total ganado (escalones de comida) no se toca');
select is((select (i ->> 'price')::int from jsonb_array_elements(public.shop_catalog() -> 'items') i where i ->> 'slug' = 'corazon'), 600, 'el nivel 2 cuesta 600');
select is((public.buy_item((select id from ids where slug = 'corazon')) ->> 'level')::int, 2, 'se sube al nivel 2');
select is((public.my_wallet() ->> 'spendable')::int, 100, 'quedan 100');
select throws_ok($$ select public.buy_item((select id from ids where slug = 'corazon')) $$, 'P0001', 'not_enough_points', 'sin puntos no se compra');
select is((public.my_wallet() -> 'perks' -> 'survivors' ->> 'hp')::int, 2, 'las mejoras suman: dos corazones');

-- 3. Premios del local con código para la caja ---------------------------------------------------------------------
select throws_ok($$ select public.buy_item((select id from ids where slug = 'chipa')) $$, 'P0001', 'not_enough_points', 'con 100 no alcanza para un chipá de 150');
reset role;
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
  jsonb_build_object('total_cents', 5000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
create temp table bought as select public.buy_item((select id from ids where slug = 'chipa')) as r;
select is((select r ->> 'kind' from bought), 'voucher', 'comprar un chipá da un código');
select matches((select r ->> 'code' from bought), '^MIGA-', 'con el formato de los códigos del local');
select is((public.my_wallet() ->> 'spendable')::int, 450, '600 de saldo menos 150');
select is(jsonb_array_length(public.my_shop_orders()), 1, 'el pedido queda en la lista del cliente');
select throws_ok($$ select public.buy_item(gen_random_uuid()) $$, 'P0002', 'item_not_found', 'un artículo que no existe se rechaza');

-- La caja valida el código una sola vez.
reset role;
select is((public.validate_redemption((select r ->> 'code' from bought)) -> 'reward' ->> 'kind'), 'shop', 'la caja lo reconoce como compra de la tienda');
select is((public.validate_redemption((select r ->> 'code' from bought)) ->> 'reason'), 'used', 'y no se usa dos veces');
select is((public.validate_redemption('MIGA-ZZZZ') ->> 'reason'), 'not_found', 'un código inventado no existe');

-- 4. Pases con monedas ------------------------------------------------------------------------------------------------
insert into public.coin_movements (customer_id, amount, kind) values ('aaaaaaaa-0000-4000-8000-000000000001', 100, 'adjustment');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((public.buy_pass_with_coins() ->> 'coins')::int, 20, 'un pase cuesta 80 monedas');
select is((public.my_wallet() ->> 'passes')::int, 1, 'y queda guardado');
select throws_ok($$ select public.buy_pass_with_coins() $$, 'P0001', 'not_enough_coins', 'sin monedas no hay pase');

-- 5. Las mejoras viajan con la partida y separan los rankings -------------------------------------------------------
reset role;
create temp table run as select public.start_run('aaaaaaaa-0000-4000-8000-000000000001', 'survivors', 1) as r;
select is((select r -> 'perks' ->> 'hp' from run), '2', 'la partida guarda las mejoras con las que arrancó');
select public.finish_run('aaaaaaaa-0000-4000-8000-000000000001', (select (r ->> 'run_id')::uuid from run), true, 4000, 0, '{}');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is(jsonb_array_length(public.leaderboard('survivors', 1) -> 'rows'), 0, 'el ranking común no incluye partidas con mejoras');
select is(jsonb_array_length(public.leaderboard('survivors', 1, 20, true) -> 'rows'), 1, 'el ranking "con mejoras" sí');

select * from finish();
rollback;
