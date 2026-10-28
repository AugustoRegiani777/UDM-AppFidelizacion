-- Panel: saldo, progreso de premios, racha y eventos de saldo.
begin;
select plan(12);

-- Escala fija para estos casos (1 punto por euro, café 150, sanguche 300, gorra 1000). La escala real
-- de la tarjeta (10 puntos por euro) se prueba en 10_economy_scale.test.sql.
update public.settings set value = '1' where key = 'points_per_euro';
update public.rewards set threshold = 150 where kind = 'points' and name = 'Un café';
update public.rewards set threshold = 300 where kind = 'points' and name = 'Un sanguche de miga';
update public.rewards set threshold = 1000 where kind = 'points' and name = 'Gorra Uno de Miga';

insert into auth.users (id, instance_id, aud, role, email)
values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com');

-- Cliente nuevo: todo en cero y premios con "te falta".
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select is((public.customer_dashboard() ->> 'balance')::int, 0, 'cliente nuevo: saldo 0');
select is(jsonb_array_length(public.customer_dashboard() -> 'rewards'), 4, 've los 4 premios');
select is((public.customer_dashboard() -> 'rewards' -> 0 ->> 'remaining')::int, 150, 'al café le faltan 150');
select is((public.customer_dashboard() -> 'rewards' -> 0 ->> 'unlocked')::boolean, false, 'café bloqueado');
select is((public.customer_dashboard() ->> 'streak_weeks')::int, 0, 'sin racha');

reset role;

-- Dos compras confirmadas, esta semana y la anterior: 160 puntos.
insert into public.claims (id, customer_id, sale_uuid, status, sale_total_cents, sale_at, points) values
  ('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'confirmed', 10000, now(), 100),
  ('c1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'confirmed', 6000, now() - interval '7 days', 60);
insert into public.point_movements (customer_id, kind, points, ref_table, ref_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'purchase', 100, 'claims', 'c1000000-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'purchase', 60, 'claims', 'c1000000-0000-4000-8000-000000000002');

select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 160, 'saldo = suma del libro');
select is((select count(*)::int from public.balance_events where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 2, 'cada movimiento emite un evento de saldo');
select is((select balance from public.balance_events order by id desc limit 1), 160, 'el último evento trae el saldo nuevo');
select is(public.customer_streak_weeks('aaaaaaaa-0000-4000-8000-000000000001'), 2, 'racha de 2 semanas');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((public.customer_dashboard() -> 'rewards' -> 0 ->> 'unlocked')::boolean, true, 'con 160 puntos el café se desbloquea');
select is((public.customer_dashboard() -> 'rewards' -> 1 ->> 'remaining')::int, 140, 'al sanguche le faltan 140');
reset role;

set local role service_role;
select throws_ok(
  $$ delete from public.point_movements $$,
  '42501', null, 'ni el service role puede borrar del libro');

select * from finish();
rollback;
