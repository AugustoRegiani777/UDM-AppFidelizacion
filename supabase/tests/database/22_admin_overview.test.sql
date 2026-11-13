-- Panel del dueño: resumen general. Solo admin.
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com'),
  ('eeeeeeee-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@test.com');
update public.profiles set is_admin = true where id = 'eeeeeeee-0000-4000-8000-00000000000e';

select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local'));
insert into public.game_plays (customer_id, game, points) values ('aaaaaaaa-0000-4000-8000-000000000001', 'roulette', 5);

set local role anon;
select throws_ok($$ select public.admin_overview() $$, '42501', null, 'anon no puede ejecutarla');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select public.admin_overview() $$, '42501', 'forbidden', 'un cliente común es rechazado');

select set_config('request.jwt.claims', '{"sub": "eeeeeeee-0000-4000-8000-00000000000e", "role": "authenticated"}', true);
create temp table ov as select public.admin_overview(30) as s;
select ok((select (s -> 'users' ->> 'total')::int from ov) >= 2, 'usuarios totales');
select is((select (s -> 'users' ->> 'active_7d')::int from ov), 1, 'un usuario activo');
select ok((select (s -> 'points' ->> 'issued')::int from ov) > 0, 'hay puntos emitidos');
select is((select (s -> 'sales' -> 'claimed_by_day' -> 0 ->> 'count')::int from ov), 1, 'una venta reclamada hoy');
select is((select s -> 'sales' -> 'qr_scans_by_day' from ov), '[]'::jsonb, 'escaneos sin tabla: vacío');
select is((select (s -> 'games' -> 0 ->> 'plays_total')::int from ov), 1, 'una jugada');
select is((select jsonb_array_length(s -> 'points' -> 'top_customers') from ov), 1, 'un cliente en el top');

select * from finish();
rollback;
