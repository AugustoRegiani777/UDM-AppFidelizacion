-- Juegos: el servidor decide el resultado ANTES de que empiece la animación.
-- Premios, probabilidades y límites viven en settings.games (públicos: se muestran en "¿Cómo funciona?").

alter table public.game_plays add column ref_id uuid;
-- Una raspadita por compra: el mismo origen no puede jugarse dos veces.
create unique index game_plays_ref_uniq on public.game_plays (game, ref_id) where ref_id is not null;

insert into public.settings (key, value, is_public) values
  ('games', $json$
  {
    "daily_points_budget": 1000,
    "scratch": {
      "enabled": true,
      "valid_hours": 24,
      "prizes": [
        {"id": "none", "label": "Seguí participando", "points": 0, "weight": 60},
        {"id": "p5", "label": "+5 puntos", "points": 5, "weight": 25},
        {"id": "p10", "label": "+10 puntos", "points": 10, "weight": 10},
        {"id": "p25", "label": "+25 puntos", "points": 25, "weight": 5}
      ]
    },
    "roulette": {
      "enabled": true,
      "daily_limit": 1,
      "prizes": [
        {"id": "none-a", "label": "Seguí participando", "points": 0, "weight": 20},
        {"id": "p5", "label": "+5", "points": 5, "weight": 30},
        {"id": "none-b", "label": "Seguí participando", "points": 0, "weight": 20},
        {"id": "p10", "label": "+10", "points": 10, "weight": 18},
        {"id": "p20", "label": "+20", "points": 20, "weight": 8},
        {"id": "p50", "label": "+50", "points": 50, "weight": 4}
      ]
    }
  }
  $json$::jsonb, true)
on conflict (key) do nothing;

update public.settings
   set value = value || '{"play_game": {"max": 20, "window_seconds": 60}}'::jsonb
 where key = 'rate_limits' and not (value ? 'play_game');

-- Elige un premio según sus pesos. Devuelve el elemento elegido del arreglo.
create function public.pick_prize(p_prizes jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_total numeric;
  v_roll numeric;
  v_prize jsonb;
begin
  select sum((p ->> 'weight')::numeric) into v_total from jsonb_array_elements(p_prizes) p;
  v_roll := random() * v_total;
  for v_prize in select p from jsonb_array_elements(p_prizes) p loop
    v_roll := v_roll - (v_prize ->> 'weight')::numeric;
    if v_roll < 0 then
      return v_prize;
    end if;
  end loop;
  return p_prizes -> (jsonb_array_length(p_prizes) - 1);
end;
$$;

-- Comienzo del día local (Madrid) como timestamptz.
create function public.local_day_start()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select date_trunc('day', now() at time zone tz.name) at time zone tz.name
    from (select coalesce(public.setting_json('timezone') #>> '{}', 'Europe/Madrid') as name) tz;
$$;

create function public.play_game(p_customer uuid, p_game text, p_ref uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public.setting_json('games') -> p_game;
  v_budget integer := coalesce((public.setting_json('games') ->> 'daily_points_budget')::integer, 0);
  v_day_start timestamptz := public.local_day_start();
  v_prize jsonb;
  v_zero jsonb;
  v_capped boolean := false;
  v_played integer;
  v_given integer;
  v_existing public.game_plays;
  v_claim public.claims;
  v_play public.game_plays;
begin
  if v_cfg is null or not coalesce((v_cfg ->> 'enabled')::boolean, false) then
    raise exception 'game_disabled' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 2));

  if p_game = 'scratch' then
    select * into v_claim from public.claims
     where id = p_ref and customer_id = p_customer and status = 'confirmed'
       and created_at > now() - make_interval(hours => coalesce((v_cfg ->> 'valid_hours')::integer, 24));
    if not found then
      raise exception 'play_not_available' using errcode = 'P0001';
    end if;
    select * into v_existing from public.game_plays where game = 'scratch' and ref_id = p_ref;
    if found then
      return jsonb_build_object('play_id', v_existing.id, 'game', p_game,
        'prize_id', v_existing.result ->> 'prize_id', 'points', v_existing.points,
        'balance', public.customer_balance(p_customer), 'repeat', true);
    end if;
  elsif p_game = 'roulette' then
    select count(*) into v_played from public.game_plays
     where customer_id = p_customer and game = 'roulette' and created_at >= v_day_start;
    if v_played >= coalesce((v_cfg ->> 'daily_limit')::integer, 1) then
      raise exception 'daily_limit_reached' using errcode = 'P0001';
    end if;
  else
    raise exception 'game_disabled' using errcode = 'P0001';
  end if;

  v_prize := public.pick_prize(v_cfg -> 'prizes');

  -- Tope diario de puntos regalados por los juegos: si se agotó, el juego se juega igual pero sin premio.
  select coalesce(sum(points), 0) into v_given from public.game_plays where created_at >= v_day_start;
  if (v_prize ->> 'points')::integer > 0 and v_given + (v_prize ->> 'points')::integer > v_budget then
    select p into v_zero from jsonb_array_elements(v_cfg -> 'prizes') p where (p ->> 'points')::integer = 0 limit 1;
    v_prize := coalesce(v_zero, v_prize);
    v_capped := true;
  end if;

  insert into public.game_plays (customer_id, game, ref_id, points, result)
  values (p_customer, p_game, p_ref, (v_prize ->> 'points')::integer,
          jsonb_build_object('prize_id', v_prize ->> 'id', 'capped', v_capped))
  returning * into v_play;

  if v_play.points > 0 then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (p_customer, 'game', v_play.points, 'game_plays', v_play.id);
  end if;

  return jsonb_build_object('play_id', v_play.id, 'game', p_game, 'prize_id', v_prize ->> 'id',
    'points', v_play.points, 'balance', public.customer_balance(p_customer), 'repeat', false);
end;
$$;

-- Qué puede jugar el cliente ahora: la ruleta de hoy y la raspadita pendiente más reciente.
create function public.games_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb := public.setting_json('games');
  v_limit integer := coalesce((v_cfg -> 'roulette' ->> 'daily_limit')::integer, 1);
  v_played integer;
  v_claim uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select count(*) into v_played from public.game_plays
   where customer_id = v_uid and game = 'roulette' and created_at >= public.local_day_start();

  select c.id into v_claim from public.claims c
   where c.customer_id = v_uid and c.status = 'confirmed'
     and c.created_at > now() - make_interval(hours => coalesce((v_cfg -> 'scratch' ->> 'valid_hours')::integer, 24))
     and not exists (select 1 from public.game_plays g where g.game = 'scratch' and g.ref_id = c.id)
   order by c.created_at desc limit 1;

  return jsonb_build_object(
    'roulette', jsonb_build_object(
      'enabled', coalesce((v_cfg -> 'roulette' ->> 'enabled')::boolean, false),
      'available', v_played < v_limit and coalesce((v_cfg -> 'roulette' ->> 'enabled')::boolean, false),
      'plays_today', v_played, 'daily_limit', v_limit),
    'scratch_claim_id', case when coalesce((v_cfg -> 'scratch' ->> 'enabled')::boolean, false) then v_claim else null end
  );
end;
$$;

grant execute on function public.games_status() to authenticated;
