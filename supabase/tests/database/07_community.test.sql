-- Comunidad: lugares moderados, comentarios, likes anónimos, topes diarios y moderación.
begin;
select plan(36);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com'),
  ('cccccccc-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.com');
update public.profiles set is_admin = true where id = 'cccccccc-0000-4000-8000-000000000003';

-- Ana propone un lugar: queda pendiente y no se ve.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.submit_place('Pizzería La Porteña', 'pizzeria', 'https://maps.app.goo.gl/abc123', 'Carrer Colón 1', 'Fugazzeta enorme') $$,
  'Ana propone un lugar');
select is(jsonb_array_length(public.community_places()), 0, 'un lugar pendiente no se muestra');
select throws_ok(
  $$ select public.submit_place('Pizzería La Porteña', 'pizzeria', null, null, '') $$,
  'P0001', 'duplicate_place', 'no se repite un lugar ya propuesto');
select throws_ok(
  $$ select public.submit_place('Otro lugar', 'pizzeria', 'https://malicioso.example.com/x', null, '') $$,
  '22023', 'invalid_maps_url', 'solo se aceptan links de Google Maps');
select throws_ok(
  $$ select public.submit_place('Lugar raro', 'tienda', null, null, '') $$,
  '22023', 'invalid_place', 'la categoría tiene que ser válida');
select lives_ok($$ select public.submit_place('Medialunas del Puerto', 'medialunas', null, null, '') $$, 'segundo lugar del día');
select lives_ok($$ select public.submit_place('Café Che', 'cafe', null, null, '') $$, 'tercer lugar del día');
select throws_ok($$ select public.submit_place('Heladería Sur', 'helado', null, null, '') $$, 'P0001', 'rate_limited', 'cuarto lugar del día: tope');

-- Un cliente no puede moderar.
select throws_ok($$ select public.admin_pending_places() $$, '42501', 'forbidden', 'Ana no ve la cola de moderación');

-- El admin aprueba: la autora recibe sus puntos una sola vez.
reset role;
select set_config('app.place', (select id::text from public.places where name = 'Pizzería La Porteña'), false);
select set_config('app.cafe', (select id::text from public.places where name = 'Café Che'), false);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select is(jsonb_array_length(public.admin_pending_places()), 3, 'el admin ve 3 pendientes');
select lives_ok($$ select public.admin_review_place(current_setting('app.place')::uuid, true) $$, 'aprueba el lugar');
select throws_ok($$ select public.admin_review_place(current_setting('app.place')::uuid, true) $$, 'P0001', 'not_pending', 'no se aprueba dos veces');
select lives_ok(
  $$ select public.admin_review_place(current_setting('app.cafe')::uuid, false) $$,
  'rechaza otro');
select lives_ok(
  $$ select public.admin_create_place('Helados Rosario', 'helado', 'https://www.google.com/maps/place/x', null, 'Dulce de leche') $$,
  'el admin puede cargar un lugar directo');
reset role;
select is(public.customer_balance('aaaaaaaa-0000-4000-8000-000000000001'), 30, 'Ana suma 30 puntos por el lugar aprobado');

-- Beto: ve el lugar, da like (suma), no puede likear dos veces para sumar.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select is(jsonb_array_length(public.community_places()), 2, 'Beto ve los 2 lugares aprobados');
select is(jsonb_array_length(public.community_places('helado')), 1, 'y puede filtrar por categoría');
select is((public.toggle_place_like(current_setting('app.place')::uuid) ->> 'points')::int, 1, 'el primer like suma 1 punto');
select is((public.toggle_place_like(current_setting('app.place')::uuid) ->> 'liked')::boolean, false, 'quitar el like');
select is((public.toggle_place_like(current_setting('app.place')::uuid) ->> 'points')::int, 0, 'volver a darlo NO suma otra vez (anti-granja)');
select is((public.community_places() -> 0 ->> 'likes')::int, 1, 'el conteo refleja el like activo');
select is((public.community_places() -> 0 ->> 'liked')::boolean, true, 'y Beto sabe que ya dio like');

-- Ana no puede likearse a sí misma.
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select public.toggle_place_like(current_setting('app.place')::uuid) $$, 'P0001', 'own_content', 'no se puede dar like a lo propio');

-- Comentarios: anónimos, con puntos y con tope diario.
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
create temp table c1 as select public.add_comment(current_setting('app.place')::uuid, '  La fugazzeta está de diez  ') as r;
select is((select (r ->> 'points')::int from c1), 3, 'comentar suma 3 puntos');
select throws_ok($$ select public.add_comment(current_setting('app.place')::uuid, 'x') $$, '22023', 'invalid_comment', 'comentario demasiado corto');
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select matches(public.place_comments_list(current_setting('app.place')::uuid) -> 0 ->> 'alias', '^Miguero [0-9A-F]{4}$', 'otros ven un alias, no el nombre');
select is((public.toggle_comment_like((public.place_comments_list(current_setting('app.place')::uuid) -> 0 ->> 'id')::uuid) ->> 'likes')::int, 1, 'Ana likea el comentario de Beto');

-- Reportar oculta el comentario hasta que el admin lo revise.
select lives_ok($$ select public.report_comment((public.place_comments_list(current_setting('app.place')::uuid) -> 0 ->> 'id')::uuid) $$, 'Ana reporta el comentario');
select is(jsonb_array_length(public.place_comments_list(current_setting('app.place')::uuid)), 0, 'queda oculto de inmediato');
reset role;
select set_config('app.comment', (select id::text from public.place_comments limit 1), false);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select is(jsonb_array_length(public.admin_reported_comments()), 1, 'el admin lo ve en reportados');
select lives_ok($$ select public.admin_review_comment(current_setting('app.comment')::uuid, true) $$, 'el admin lo restituye');
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is(jsonb_array_length(public.place_comments_list(current_setting('app.place')::uuid)), 1, 'vuelve a mostrarse');

-- Tope diario de puntos de comunidad (12): Beto ya sumó 1 + 3; seguimos comentando hasta pasarlo.
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select public.add_comment(current_setting('app.place')::uuid, 'segundo comentario');
select public.add_comment(current_setting('app.place')::uuid, 'tercer comentario');
select public.add_comment(current_setting('app.place')::uuid, 'cuarto comentario');
reset role;
select cmp_ok(
  (select sum(points)::int from public.point_movements where customer_id = 'bbbbbbbb-0000-4000-8000-000000000002' and kind = 'community'),
  '<=', 12, 'los puntos de comunidad de un día nunca pasan el tope');

-- El cliente no toca las tablas: ni leer ni escribir directo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select * from public.place_likes $$, '42501', null, 'no se leen los likes directamente (anonimato)');
select throws_ok($$ select * from public.places $$, '42501', null, 'no se leen los lugares directamente');
select throws_ok(
  $$ insert into public.places (name, category, submitted_by, status) values ('Trampa', 'cafe', 'aaaaaaaa-0000-4000-8000-000000000001', 'approved') $$,
  '42501', null, 'no se puede insertar un lugar ya aprobado');
reset role;

select * from finish();
rollback;
