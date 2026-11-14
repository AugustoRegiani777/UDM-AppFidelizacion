-- Rankings no oficiales (juegos del celular): solo sube, con tope, respeta ocultarse y no muestra emails.
begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.com', '{"full_name": "Ana Pérez"}'),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.com', '{"full_name": "Beto Gómez"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);

select is(public.submit_game_score('ninja', 12), 12, 'guarda el primer puntaje');
select is(public.submit_game_score('ninja', 5), 12, 'un puntaje menor no baja el récord');
select throws_ok($$ select public.submit_game_score('ninja', 31) $$, 'P0001', 'invalid_score', 'rechaza más del máximo posible');
select throws_ok($$ select public.submit_game_score('survivors', 3) $$, 'P0001', 'invalid_game', 'survivors es oficial: no entra por acá');

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
select public.submit_game_score('ninja', 20);
select public.set_show_in_rankings(false);

select is((public.leaderboard_casual('ninja') -> 'rows' -> 0 ->> 'score')::int, 20, 'quien se ocultó se ve a sí mismo primero');
select is((public.leaderboard_casual('ninja') -> 'me' ->> 'rank')::int, 1, 'y conoce su puesto');

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select is(jsonb_array_length(public.leaderboard_casual('ninja') -> 'rows'), 1, 'los demás no ven a quien se ocultó');
select is((public.leaderboard_casual('ninja') -> 'me' ->> 'rank')::int, 2, 'pero el puesto cuenta a todos');
select ok(public.leaderboard_casual('ninja')::text not like '%@%', 'sin emails en el ranking');
select is(jsonb_array_length(public.leaderboard_casual('truco') -> 'rows'), 0, 'un juego sin datos viene vacío');

select set_config('request.jwt.claims', '{}', true);
select throws_ok($$ select public.submit_game_score('ninja', 1) $$, '28000', null, 'sin sesión no se puede');
select * from finish();
rollback;
