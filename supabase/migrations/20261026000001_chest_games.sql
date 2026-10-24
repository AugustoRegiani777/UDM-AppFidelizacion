-- El cofre ahora tiene varios juegos ("survivors" y "skate"). El servidor elige uno al abrir la sesión
-- y lo mantiene mientras el cliente siga perdiendo (para que pueda practicar); tras ganar, vuelve a sortear.

alter table public.chest_sessions
  add column game text not null default 'survivors' check (game in ('survivors', 'skate'));

-- Reglas por juego: `overrides` pasa a ser { survivors: {...}, skate: {...} }.
update public.settings
   set value = (value - 'overrides')
     || '{"games": ["survivors", "skate"], "overrides": {}}'::jsonb
 where key = 'chest_game';

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
