-- Panel del dueño: costo de los premios sobre las ventas.
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com'),
  ('eeeeeeee-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@test.com');
update public.profiles set is_admin = true where id = 'eeeeeeee-0000-4000-8000-00000000000e';

-- 100 € de ventas confirmadas.
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local'));

-- Se entregó un café y un chipá de la tienda.
insert into public.redemptions (customer_id, reward_id, code, status, expires_at, used_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.rewards where name = 'Un café'), 'MIGA-TEST', 'used', now() + interval '1 day', now());
insert into public.shop_orders (customer_id, item_id, price_points, code, status, expires_at, used_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.shop_items where slug = 'chipa'), 150, 'MIGA-SHOP', 'used', now() + interval '1 day', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select public.admin_economy_stats() $$, '42501', 'forbidden', 'un cliente común no ve las cuentas del local');

select set_config('request.jwt.claims', '{"sub": "eeeeeeee-0000-4000-8000-00000000000e", "role": "authenticated"}', true);
create temp table stats as select public.admin_economy_stats(30) as s;
select is((select (s ->> 'revenue_cents')::int from stats), 10000, 'las ventas del período suman 100 €');
select is((select (s ->> 'purchases')::int from stats), 1, 'es una compra');
select is((select (s -> 'rewards' -> 0 ->> 'name') from stats), 'Un café', 'se lista el café entregado');
select is((select (s -> 'rewards' -> 0 ->> 'total_cents')::int from stats), 40, 'a 0,40 € de costo');
select is((select (s -> 'shop' -> 0 ->> 'total_cents')::int from stats), 30, 'y el chipá de la tienda a 0,30 €');
select is((select (s ->> 'cost_cents')::int from stats), 70, 'el costo total es de 0,70 €');
select is((select (s ->> 'cost_percent')::numeric from stats), 0.70, 'o sea 0,7 % de las ventas');
select is((select (s ->> 'players')::int from stats), 0, 'nadie jugó partidas oficiales todavía');

select * from finish();
rollback;
