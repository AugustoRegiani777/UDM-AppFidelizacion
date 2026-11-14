-- Rankings de los juegos que corren en el celular (no oficiales): el cliente informa su progreso y el servidor
-- solo guarda el mejor valor, con un tope razonable por juego. No dan monedas, pases ni puntos: solo orgullo.
-- Sobreviví a las migas sigue siendo oficial (game_runs) y no pasa por acá.

create table public.game_scores (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('racing', 'rally', 'skatepark', 'truco', 'ninja', 'sokoban')),
  score integer not null check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (customer_id, game)
);
create index game_scores_board_idx on public.game_scores (game, score desc);
alter table public.game_scores enable row level security;
create policy game_scores_select_own on public.game_scores for select to authenticated
  using (customer_id = (select auth.uid()));
grant select on public.game_scores to authenticated;

-- Informa el progreso de un juego. Solo sube (se queda con el mayor) y se rechaza lo que pasa el máximo posible.
create function public.submit_game_score(p_game text, p_score integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max integer;
  v_best integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  v_max := case p_game
    when 'ninja' then 30
    when 'skatepark' then 15
    when 'sokoban' then 36
    when 'racing' then 20
    when 'rally' then 100000
    when 'truco' then 100000
    else null end;
  if v_max is null then
    raise exception 'invalid_game';
  end if;
  if p_score is null or p_score < 0 or p_score > v_max then
    raise exception 'invalid_score';
  end if;
  insert into public.game_scores (customer_id, game, score)
  values (v_uid, p_game, p_score)
  on conflict (customer_id, game) do update
    set score = greatest(public.game_scores.score, excluded.score),
        updated_at = case when excluded.score > public.game_scores.score then now() else public.game_scores.updated_at end
  returning score into v_best;
  return v_best;
end;
$$;

-- Ranking de un juego no oficial: mejor valor de cada cliente que no se ocultó (más el propio), sin emails.
create function public.leaderboard_casual(p_game text, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return (
    with ranked as (
      select s.customer_id, s.score, rank() over (order by s.score desc) as pos
        from public.game_scores s where s.game = p_game and s.score > 0
    ), shown as (
      select rk.pos, rk.score, rk.customer_id, public.public_name(p.display_name) as name
        from ranked rk join public.profiles p on p.id = rk.customer_id
       where p.show_in_rankings or rk.customer_id = v_uid
       order by rk.pos, p.display_name
       limit least(greatest(coalesce(p_limit, 20), 1), 100)
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
          'rank', s.pos, 'name', s.name, 'score', s.score, 'me', s.customer_id = v_uid
        ) order by s.pos, s.name) from shown s), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', rk.pos, 'score', rk.score) from ranked rk where rk.customer_id = v_uid)
    )
  );
end;
$$;

revoke all on function public.submit_game_score(text, integer), public.leaderboard_casual(text, integer) from public, anon;
grant execute on function public.submit_game_score(text, integer), public.leaderboard_casual(text, integer) to authenticated;
