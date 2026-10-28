-- Economía de puntos, parte 2 (docs/06): saldo gastable, monedas de juego, partidas oficiales, pases de
-- desafío y rankings.
--
-- Dos monedas que no se mezclan:
--   * Puntos de compra: salen del libro `point_movements` (el "total ganado" solo sube y define los
--     escalones de comida). Lo que se gasta en la tienda va a `point_spends`: saldo gastable = total - gastado.
--   * Monedas de juego: salen de jugar partidas oficiales (`coin_movements`). Nunca se canjean por comida.

-- 1. Saldo gastable ---------------------------------------------------------------------------------------

create table public.point_spends (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  item_kind text not null,
  item_ref uuid,
  created_at timestamptz not null default now()
);
create index point_spends_customer_idx on public.point_spends (customer_id, created_at desc);
alter table public.point_spends enable row level security;
create policy point_spends_select_own on public.point_spends for select to authenticated
  using (customer_id = (select auth.uid()));
grant select on public.point_spends to authenticated;

create function public.customer_spendable(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, public.customer_balance(p_customer)
    - coalesce((select sum(amount) from public.point_spends where customer_id = p_customer), 0))::integer;
$$;

-- Gasta puntos del saldo gastable (no toca el total ganado ni los escalones de comida).
create function public.spend_points(p_customer uuid, p_amount integer, p_kind text, p_ref uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 6));
  if public.customer_spendable(p_customer) < p_amount then
    raise exception 'not_enough_points' using errcode = 'P0001';
  end if;
  insert into public.point_spends (customer_id, amount, item_kind, item_ref)
  values (p_customer, p_amount, p_kind, p_ref);
  return public.customer_spendable(p_customer);
end;
$$;

-- 2. Monedas de juego -------------------------------------------------------------------------------------

create table public.coin_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('run', 'shop', 'adjustment')),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index coin_movements_customer_idx on public.coin_movements (customer_id, created_at desc);
alter table public.coin_movements enable row level security;
create policy coin_movements_select_own on public.coin_movements for select to authenticated
  using (customer_id = (select auth.uid()));
grant select on public.coin_movements to authenticated;

create function public.customer_coins(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer from public.coin_movements where customer_id = p_customer;
$$;

-- Gasta monedas (mejoras y cosméticos). Nunca deja el saldo en negativo.
create function public.spend_coins(p_customer uuid, p_amount integer, p_ref uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 7));
  if public.customer_coins(p_customer) < p_amount then
    raise exception 'not_enough_coins' using errcode = 'P0001';
  end if;
  insert into public.coin_movements (customer_id, amount, kind, ref_id) values (p_customer, -p_amount, 'shop', p_ref);
  return public.customer_coins(p_customer);
end;
$$;

-- 3. Reglas de la economía (todo ajustable sin tocar código) ---------------------------------------------

insert into public.settings (key, value, is_public) values
  ('economy', '{
     "coins_win": 15,
     "coins_loss": 2,
     "coins_per_1000_score": 5,
     "coins_per_run_max": 40,
     "coins_daily_cap": 150,
     "pass_cap": 3,
     "pass_daily_cap": 3,
     "run_minutes": 20
   }', false),
  ('ranked_game', '{"overrides": {}}', false)
on conflict (key) do nothing;

update public.settings
   set value = value || '{"run": {"max": 20, "window_seconds": 60}}'::jsonb
 where key = 'rate_limits' and not (value ? 'run');

-- 4. Partidas oficiales y pases de desafío ----------------------------------------------------------------

create table public.game_runs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('survivors', 'skate')),
  stage integer not null default 1 check (stage between 1 and 6),
  seed bigint not null,
  overrides jsonb not null default '{}'::jsonb,
  status text not null default 'playing' check (status in ('playing', 'won', 'lost', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  score integer not null default 0,
  coins integer not null default 0,
  pass_granted boolean not null default false,
  summary jsonb
);
create index game_runs_customer_idx on public.game_runs (customer_id, started_at desc);
create index game_runs_board_idx on public.game_runs (game, stage, score desc) where status = 'won';
alter table public.game_runs enable row level security;
create policy game_runs_select_own on public.game_runs for select to authenticated
  using (customer_id = (select auth.uid()));
grant select on public.game_runs to authenticated;

create table public.challenge_passes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  run_id uuid references public.game_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index challenge_passes_open_idx on public.challenge_passes (customer_id, created_at) where used_at is null;
alter table public.challenge_passes enable row level security;
create policy challenge_passes_select_own on public.challenge_passes for select to authenticated
  using (customer_id = (select auth.uid()));
grant select on public.challenge_passes to authenticated;

alter table public.profiles add column show_in_rankings boolean not null default true;

create function public.start_run(p_customer uuid, p_game text, p_stage integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eco jsonb := coalesce(public.setting_json('economy'), '{}'::jsonb);
  v_cfg jsonb := coalesce(public.setting_json('ranked_game'), '{}'::jsonb);
  v_run public.game_runs;
begin
  if p_game not in ('survivors', 'skate') then
    raise exception 'invalid_game' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 5));
  update public.game_runs set status = 'expired', finished_at = now()
   where customer_id = p_customer and status = 'playing';

  insert into public.game_runs (customer_id, game, stage, seed, overrides, expires_at)
  values (
    p_customer, p_game,
    case when p_game = 'survivors' then greatest(1, least(coalesce(p_stage, 1), 6)) else 1 end,
    floor(random() * 4294967296)::bigint,
    coalesce(v_cfg -> 'overrides' -> p_game, '{}'::jsonb),
    now() + make_interval(mins => coalesce((v_eco ->> 'run_minutes')::integer, 20))
  )
  returning * into v_run;

  return jsonb_build_object('run_id', v_run.id, 'game', v_run.game, 'stage', v_run.stage,
    'seed', v_run.seed, 'overrides', v_run.overrides, 'expires_at', v_run.expires_at);
end;
$$;

create function public.get_run(p_customer uuid, p_run uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(r) - 'summary' - 'customer_id'
    from public.game_runs r
   where r.id = p_run and r.customer_id = p_customer;
$$;

-- Cierra una partida oficial con lo que reprodujo el servidor: guarda el puntaje, da monedas (con tope
-- diario) y, si se ganó, un pase de desafío (con tope de pases guardados y por día).
create function public.finish_run(
  p_customer uuid,
  p_run uuid,
  p_won boolean,
  p_score integer,
  p_min_seconds numeric,
  p_summary jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.game_runs;
  v_eco jsonb := coalesce(public.setting_json('economy'), '{}'::jsonb);
  v_tz text := coalesce(public.setting_json('timezone') #>> '{}', 'Europe/Madrid');
  v_day_start timestamptz := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  v_coins integer;
  v_today integer;
  v_pass boolean := false;
  v_best integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 5));
  select * into v_run from public.game_runs where id = p_run and customer_id = p_customer for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_run.status <> 'playing' then
    raise exception 'session_closed' using errcode = 'P0001';
  end if;
  if v_run.expires_at < now() then
    update public.game_runs set status = 'expired', finished_at = now() where id = v_run.id;
    raise exception 'session_expired' using errcode = 'P0001';
  end if;
  -- Nadie termina una partida más rápido que lo que dura en tiempo real.
  if now() - v_run.started_at < make_interval(secs => p_min_seconds) then
    raise exception 'too_fast' using errcode = 'P0001';
  end if;

  select coalesce(max(score), 0) into v_best from public.game_runs
   where customer_id = p_customer and game = v_run.game and stage = v_run.stage and status = 'won';

  -- Monedas: base por jugar o ganar, más un extra por puntaje, todo con tope por partida y por día.
  v_coins := case
    when p_won then coalesce((v_eco ->> 'coins_win')::integer, 15)
      + least(
          coalesce((v_eco ->> 'coins_per_run_max')::integer, 40),
          floor(greatest(p_score, 0) / 1000.0 * coalesce((v_eco ->> 'coins_per_1000_score')::numeric, 5))::integer
        )
    else coalesce((v_eco ->> 'coins_loss')::integer, 2)
  end;
  select coalesce(sum(amount), 0) into v_today from public.coin_movements
   where customer_id = p_customer and kind = 'run' and created_at >= v_day_start;
  v_coins := greatest(0, least(v_coins, coalesce((v_eco ->> 'coins_daily_cap')::integer, 150) - v_today));
  if v_coins > 0 then
    insert into public.coin_movements (customer_id, amount, kind, ref_id) values (p_customer, v_coins, 'run', v_run.id);
  end if;

  -- Pase de desafío: solo al ganar, con tope de pases guardados y de pases por día.
  if p_won
     and (select count(*) from public.challenge_passes where customer_id = p_customer and used_at is null)
         < coalesce((v_eco ->> 'pass_cap')::integer, 3)
     and (select count(*) from public.challenge_passes where customer_id = p_customer and created_at >= v_day_start)
         < coalesce((v_eco ->> 'pass_daily_cap')::integer, 3) then
    insert into public.challenge_passes (customer_id, run_id) values (p_customer, v_run.id);
    v_pass := true;
  end if;

  update public.game_runs
     set status = case when p_won then 'won' else 'lost' end, finished_at = now(),
         score = greatest(p_score, 0), coins = v_coins, pass_granted = v_pass, summary = p_summary
   where id = v_run.id;

  return jsonb_build_object('won', p_won, 'score', greatest(p_score, 0), 'coins', v_coins,
    'pass_granted', v_pass, 'new_best', p_won and p_score > v_best, 'game', v_run.game, 'stage', v_run.stage);
end;
$$;

-- 5. Cofre: un pase de desafío abre el premio sin volver a jugar --------------------------------------------

create or replace function public.start_chest(p_customer uuid, p_reward uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := coalesce(public.setting_json('chest_game'), '{}'::jsonb);
  v_games jsonb := coalesce(nullif(v_cfg -> 'games', 'null'::jsonb), '["survivors"]'::jsonb);
  v_active public.redemptions;
  v_last_win timestamptz;
  v_losses integer;
  v_last_game text;
  v_game text;
  v_relaxed boolean;
  v_session public.chest_sessions;
  v_pass uuid;
  v_redemption jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 3));
  perform public.expire_redemptions(p_customer);

  if not exists (select 1 from public.rewards where id = p_reward and active) then
    raise exception 'reward_not_found' using errcode = 'P0002';
  end if;

  select * into v_active from public.redemptions
   where customer_id = p_customer and reward_id = p_reward and status = 'active';
  if found then
    return jsonb_build_object('already_unlocked', true, 'redemption_id', v_active.id);
  end if;

  if public.reward_tickets(p_customer, p_reward) <= 0 then
    raise exception 'reward_not_reached' using errcode = 'P0001';
  end if;

  -- Si ya superó un desafío antes (pase guardado), el código sale directo.
  select id into v_pass from public.challenge_passes
   where customer_id = p_customer and used_at is null
   order by created_at limit 1 for update skip locked;
  if found then
    update public.challenge_passes set used_at = now() where id = v_pass;
    v_redemption := public.issue_redemption(p_customer, p_reward, null);
    return jsonb_build_object('already_unlocked', true, 'redemption_id', (v_redemption ->> 'id')::uuid,
      'via_pass', true);
  end if;

  -- Lo que quedó a medias se da por abandonado.
  update public.chest_sessions set status = 'expired', finished_at = now()
   where customer_id = p_customer and status = 'playing';

  select max(started_at) into v_last_win from public.chest_sessions
   where customer_id = p_customer and reward_id = p_reward and status = 'won';
  select count(*) into v_losses from public.chest_sessions
   where customer_id = p_customer and reward_id = p_reward and status in ('lost', 'expired')
     and started_at > coalesce(v_last_win, '-infinity') and started_at > now() - interval '6 hours';
  v_relaxed := v_losses >= coalesce((v_cfg ->> 'relaxed_after_losses')::integer, 2);

  -- Mientras siga perdiendo, el mismo juego; si no, uno al azar de la lista.
  select game into v_last_game from public.chest_sessions
   where customer_id = p_customer and reward_id = p_reward and status in ('lost', 'expired')
     and started_at > coalesce(v_last_win, '-infinity') and started_at > now() - interval '6 hours'
   order by started_at desc limit 1;
  if v_last_game is not null and v_games ? v_last_game then
    v_game := v_last_game;
  else
    v_game := v_games ->> floor(random() * jsonb_array_length(v_games))::integer;
  end if;

  insert into public.chest_sessions (customer_id, reward_id, game, seed, relaxed, overrides, expires_at)
  values (
    p_customer, p_reward, v_game, floor(random() * 4294967296)::bigint, v_relaxed,
    coalesce(v_cfg -> 'overrides' -> v_game, '{}'::jsonb),
    now() + make_interval(secs => 300 + coalesce((v_cfg ->> 'grace_seconds')::integer, 300))
  )
  returning * into v_session;

  return jsonb_build_object('already_unlocked', false, 'session_id', v_session.id, 'game', v_session.game,
    'seed', v_session.seed, 'relaxed', v_session.relaxed, 'overrides', v_session.overrides,
    'expires_at', v_session.expires_at);
end;
$$;

-- 6. Lo que ve el cliente: su billetera y los rankings ------------------------------------------------------

create function public.my_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_eco jsonb := coalesce(public.setting_json('economy'), '{}'::jsonb);
  v_tz text := coalesce(public.setting_json('timezone') #>> '{}', 'Europe/Madrid');
  v_day_start timestamptz := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'balance', public.customer_balance(v_uid),
    'spendable', public.customer_spendable(v_uid),
    'coins', public.customer_coins(v_uid),
    'coins_today', coalesce((select sum(amount) from public.coin_movements
       where customer_id = v_uid and kind = 'run' and created_at >= v_day_start), 0),
    'coins_daily_cap', coalesce((v_eco ->> 'coins_daily_cap')::integer, 150),
    'passes', (select count(*) from public.challenge_passes where customer_id = v_uid and used_at is null),
    'pass_cap', coalesce((v_eco ->> 'pass_cap')::integer, 3),
    'show_in_rankings', coalesce((select show_in_rankings from public.profiles where id = v_uid), true)
  );
end;
$$;

-- Nombre para mostrar en los rankings: nombre y la inicial del apellido ("Ana P."). Los invitados ya traen un
-- código para distinguirse.
create function public.public_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^Invitado ' then p_name
    when array_length(parts, 1) > 1 then parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.'
    else coalesce(parts[1], '')
  end
  from (select regexp_split_to_array(btrim(p_name), '\s+') as parts) s;
$$;

create function public.set_show_in_rankings(p_show boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.profiles set show_in_rankings = coalesce(p_show, true) where id = auth.uid();
end;
$$;

-- Ranking de un juego (y nivel): el mejor puntaje ganado de cada jugador.
create function public.leaderboard(p_game text, p_stage integer default 1, p_limit integer default 20)
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
    with best as (
      select distinct on (r.customer_id) r.customer_id, r.score
        from public.game_runs r
       where r.game = p_game and r.stage = p_stage and r.status = 'won'
       order by r.customer_id, r.score desc
    ), ranked as (
      select b.customer_id, b.score, rank() over (order by b.score desc) as pos from best b
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

-- Ranking general: quién acumuló más puntos (total ganado, que solo sube).
create function public.leaderboard_points(p_limit integer default 20)
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
    with totals as (
      select m.customer_id, sum(m.points)::integer as score
        from public.point_movements m group by m.customer_id having sum(m.points) > 0
    ), ranked as (
      select t.customer_id, t.score, rank() over (order by t.score desc) as pos from totals t
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

grant execute on function
  public.my_wallet(), public.set_show_in_rankings(boolean),
  public.leaderboard(text, integer, integer), public.leaderboard_points(integer)
to authenticated;
