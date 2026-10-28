-- Escala de puntos calibrada con la tarjeta de papel: 10 puntos por euro, café cada 400, sanguche cada 800.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com');

select is((public.setting_json('points_per_euro') #>> '{}')::int, 10, 'la escala es de 10 puntos por euro');
select is((select threshold from public.rewards where name = 'Un café'), 400, 'el café se abre a los 400 puntos');
select is((select threshold from public.rewards where name = 'Un sanguche de miga'), 800, 'el sanguche se abre a los 800 puntos');

-- Un ticket promedio de 8 € da 80 puntos.
create temp table s1 as select public.claim_sale_apply(
  'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 800, 'sold_at', now(), 'voided', false, 'channel', 'local')) as r;
select is((select (r ->> 'points')::int from s1), 80, 'un ticket de 8 € suma 80 puntos');

-- Tres compras más de 8 €: 4 compras = 320 puntos, el café todavía no.
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
  jsonb_build_object('total_cents', 800, 'sold_at', now(), 'voided', false, 'channel', 'local'));
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
  jsonb_build_object('total_cents', 800, 'sold_at', now(), 'voided', false, 'channel', 'local'));
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004',
  jsonb_build_object('total_cents', 800, 'sold_at', now(), 'voided', false, 'channel', 'local'));

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((public.customer_dashboard() ->> 'balance')::int, 320, '4 compras de 8 € = 320 puntos');
select is((public.customer_dashboard() -> 'rewards' -> 0 ->> 'unlocked')::boolean, false, 'con 4 compras todavía no hay café');
select is((public.customer_dashboard() -> 'rewards' -> 0 ->> 'remaining')::int, 80, 'al café le faltan 80 puntos (una compra)');

-- La quinta compra abre el café, igual que la tarjeta de papel.
reset role;
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005',
  jsonb_build_object('total_cents', 800, 'sold_at', now(), 'voided', false, 'channel', 'local'));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((public.customer_dashboard() -> 'rewards' -> 0 ->> 'unlocked')::boolean, true, 'la 5ª compra abre el café');
select is((public.customer_dashboard() -> 'rewards' -> 1 ->> 'unlocked')::boolean, false, 'el sanguche todavía no');

-- Las compras 6 a 10 abren el sanguche.
reset role;
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006',
  jsonb_build_object('total_cents', 4000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((public.customer_dashboard() -> 'rewards' -> 1 ->> 'unlocked')::boolean, true, '80 € en total (10 compras) abren el sanguche');

select * from finish();
rollback;
