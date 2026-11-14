-- export_my_data incluye game_scores propios (no ajenos) y la baja de cuenta los borra y saca del ranking.
begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cami@test.com', '{"full_name": "Cami Ruiz"}'),
  ('bbbbbbbb-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dani@test.com', '{"full_name": "Dani Sosa"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select public.submit_game_score('ninja', 10);
select public.submit_game_score('sokoban', 7);
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
select public.submit_game_score('ninja', 20);

select is(jsonb_array_length(public.export_my_data() -> 'game_scores'), 1, 'el export trae solo mis puntajes');
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select is(jsonb_array_length(public.export_my_data() -> 'game_scores'), 2, 'el export trae los dos puntajes de Cami');

reset role;
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-0000000000a1';
select is((select count(*)::int from public.game_scores where customer_id = 'bbbbbbbb-0000-4000-8000-0000000000a1'), 0, 'la baja borra los puntajes');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
select is(jsonb_array_length(public.leaderboard_casual('ninja') -> 'rows'), 1, 'el ranking ya no muestra a quien se dio de baja');
select is(jsonb_array_length(public.leaderboard_casual('sokoban') -> 'rows'), 0, 'ni en otros juegos');

select * from finish();
rollback;
