-- Reclamar ventas: todos los casos de docs/01 contra la función transaccional.
begin;
select plan(31);

-- Escala fija para estos casos (1 punto por euro, café 150, sanguche 300, gorra 1000). La escala real
-- de la tarjeta (10 puntos por euro) se prueba en 10_economy_scale.test.sql.
update public.settings set value = '1' where key = 'points_per_euro';
update public.rewards set threshold = 150 where kind = 'points' and name = 'Un café';
update public.rewards set threshold = 300 where kind = 'points' and name = 'Un sanguche de miga';
update public.rewards set threshold = 1000 where kind = 'points' and name = 'Gorra Uno de Miga';

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com');

-- Venta válida
create temp table r1 as select public.claim_sale_apply(
  'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  jsonb_build_object('total_cents', 6200, 'sold_at', now(), 'voided', false, 'channel', 'local')) as r;
select is((select r ->> 'status' from r1), 'confirmed', 'venta válida: confirmada');
select is((select (r ->> 'points')::int from r1), 62, '62 € = 62 puntos');
select is((select (r ->> 'balance')::int from r1), 62, 'el saldo sube a 62');
select is((select count(*)::int from public.point_movements where customer_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1, 'un movimiento en el libro');

-- Redondeo hacia abajo
select is(
  (public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
    jsonb_build_object('total_cents', 1299, 'sold_at', now(), 'voided', false, 'channel', 'local')) ->> 'points')::int,
  12, '12,99 € = 12 puntos (redondeo hacia abajo)');

-- Duplicada: mismo cliente (idempotente) y otro cliente (rechazada)
select is(
  (public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    jsonb_build_object('total_cents', 6200, 'sold_at', now(), 'voided', false, 'channel', 'local')) ->> 'repeat')::boolean,
  true, 'reclamar de nuevo devuelve lo mismo');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 74, 'y no suma dos veces');
select is(
  public.claim_sale_apply('bbbbbbbb-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
    jsonb_build_object('total_cents', 6200, 'sold_at', now(), 'voided', false, 'channel', 'local')) ->> 'reason',
  'already_claimed', 'otro cliente no puede quedarse con la misma venta');
select is(public.customer_balance('bbbbbbbb-0000-4000-8000-000000000002'), 0, 'el otro cliente no suma nada');

-- Anulada
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
    jsonb_build_object('total_cents', 4500, 'sold_at', now(), 'voided', true, 'channel', 'local')) ->> 'reason',
  'voided', 'venta anulada: rechazada');

-- Glovo y Too Good To Go
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004',
    jsonb_build_object('total_cents', 3000, 'sold_at', now(), 'voided', false, 'channel', 'glovo')) ->> 'reason',
  'excluded_channel', 'Glovo no suma');
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005',
    jsonb_build_object('total_cents', 3000, 'sold_at', now(), 'voided', false, 'channel', 'togoo')) ->> 'reason',
  'excluded_channel', 'Too Good To Go no suma');

-- Vieja
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006',
    jsonb_build_object('total_cents', 5000, 'sold_at', now() - interval '3 hours', 'voided', false, 'channel', 'local')) ->> 'reason',
  'too_old', 'venta de hace 3 h: fuera de la ventana de 2 h');
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000007',
    jsonb_build_object('total_cents', 5000, 'sold_at', now() - interval '110 minutes', 'voided', false, 'channel', 'local')) ->> 'status',
  'confirmed', 'venta de hace 110 min: todavía vale');

select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 124, 'solo sumaron las válidas (62+12+50)');

-- Inexistente / todavía no sincronizada: queda pendiente
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008', null) ->> 'status',
  'pending', 'venta que el POS no conoce: pendiente');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 124, 'pendiente no suma todavía');
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008', null) ->> 'status',
  'pending', 'reintentar sin novedades sigue pendiente');
select is(
  public.claim_sale_apply('bbbbbbbb-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000008', null) ->> 'reason',
  'already_claimed', 'otro cliente no puede reclamar una pendiente ajena');

-- La pendiente aparece más tarde: se acredita sola, aunque la venta ya tenga más de 2 h desde que se reclamó.
update public.claims set created_at = now() - interval '1 hour' where sale_uuid = 'd0000000-0000-4000-8000-000000000008';
create temp table r2 as select public.claim_sale_apply(
  'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008',
  jsonb_build_object('total_cents', 2000, 'sold_at', now() - interval '2 hours', 'voided', false, 'channel', 'local')) as r;
select is((select r ->> 'status' from r2), 'confirmed', 'la pendiente se confirma cuando aparece');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 144, 'y suma sus 20 puntos');

-- Pendiente que nunca aparece: vence
select public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000009', null);
update public.claims set created_at = now() - interval '3 hours' where sale_uuid = 'd0000000-0000-4000-8000-000000000009';
select is(public.expire_pending_claims(), 1, 'una pendiente vencida');
select is((select reject_reason from public.claims where sale_uuid = 'd0000000-0000-4000-8000-000000000009'), 'not_found', 'queda rechazada como no encontrada');

-- Anulación posterior: movimiento inverso, una sola vez
select is(public.reverse_claim('d0000000-0000-4000-8000-000000000001'), true, 'se revierte la venta anulada después');
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 82, 'se descuentan sus 62 puntos');
select is(public.reverse_claim('d0000000-0000-4000-8000-000000000001'), false, 'no se revierte dos veces');
select is(public.reverse_claim('d0000000-0000-4000-8000-000000000004'), false, 'una venta rechazada no se revierte');

-- Premio desbloqueado al cruzar el umbral (café = 150): saldo 82 + 100 = 182
select is(
  public.claim_sale_apply('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000010',
    jsonb_build_object('total_cents', 10000, 'sold_at', now(), 'voided', false, 'channel', 'local')) -> 'unlocked' -> 0 ->> 'name',
  'Un café', 'cruzar 150 puntos desbloquea el café');

-- Rate limit: 15 por minuto
select lives_ok($$ select public.rate_limit_hit('aaaaaaaa-0000-4000-8000-000000000001', 'claim_sale') from generate_series(1, 14) $$, '14 intentos pasan');
select is(public.rate_limit_hit('aaaaaaaa-0000-4000-8000-000000000001', 'claim_sale'), true, 'el 15 todavía pasa');
select is(public.rate_limit_hit('aaaaaaaa-0000-4000-8000-000000000001', 'claim_sale'), false, 'el 16 se frena');

select * from finish();
rollback;
