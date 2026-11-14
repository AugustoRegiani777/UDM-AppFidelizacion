-- Ajuste de economía (docs/06). Todo configurable en settings / tablas, sin tocar código.
--  1. La escalera de café y sanguche (reward_tickets) cuenta SOLO compras y sus reversiones. Los puntos de
--     ruleta, raspadita, comunidad, misiones y ajustes siguen sumando al saldo gastable (tienda), no a la escalera.
--  2. Límite de canjes por día (settings.redeem_daily_limit).
--  3. Raspadita y compras que cuentan para la docena de migas piden ticket mínimo.
--  4. La raspadita queda fuera del presupuesto diario de juegos (ya está atada a una compra); la ruleta lo conserva.
--  5. Ranking de puntos: solo compras.
--  6. Gorra de la escalera desactivada (queda solo en la tienda).
--  7. Precios de la tienda y costos estimados de los premios.

-- 1. Puntos de compra (los que valen para la escalera) ----------------------------------------------------------------

create function public.customer_ladder_points(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(points), 0)::integer
    from public.point_movements
   where customer_id = p_customer and kind in ('purchase', 'reversal');
$$;
revoke all on function public.customer_ladder_points(uuid) from public, anon, authenticated;

-- Ticket mínimo (en centavos) para que una compra cuente en "cada N compras".
insert into public.settings (key, value, is_public) values ('purchase_count_min_cents', '500', false)
on conflict (key) do nothing;

create or replace function public.customer_purchase_count(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.claims
   where customer_id = p_customer and status = 'confirmed'
     and coalesce(sale_total_cents, 0) >= coalesce((public.setting_json('purchase_count_min_cents') #>> '{}')::integer, 0);
$$;

create or replace function public.reward_tickets(p_customer uuid, p_reward uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    greatest(
      case when r.kind = 'points'
        then public.customer_ladder_points(p_customer)
        else public.customer_purchase_count(p_customer) end,
      0
    ) / r.threshold
    - (select count(*) from public.redemptions d
        where d.customer_id = p_customer and d.reward_id = r.id and d.status in ('used', 'active'))
  )::integer
  from public.rewards r
  where r.id = p_reward;
$$;

-- 2. Límite de canjes por día -------------------------------------------------------------------------------------------

insert into public.settings (key, value, is_public) values ('redeem_daily_limit', '2', false)
on conflict (key) do nothing;

-- Falla con 'daily_redeem_limit' si el cliente ya tiene en el día local tantos canjes (usados o vigentes) como el tope.
-- Un código vencido sin usar no cuenta.
create function public.assert_redeem_quota(p_customer uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.redemptions
       where customer_id = p_customer and status in ('active', 'used')
         and created_at >= public.local_day_start())
     >= coalesce((public.setting_json('redeem_daily_limit') #>> '{}')::integer, 2) then
    raise exception 'daily_redeem_limit' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.assert_redeem_quota(uuid) from public, anon, authenticated;

create or replace function public.issue_redemption(p_customer uuid, p_reward uuid, p_chest uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward public.rewards;
  v_existing public.redemptions;
  v_row public.redemptions;
  v_code text;
  v_attempt integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 1));
  perform public.expire_redemptions(p_customer);

  select * into v_reward from public.rewards where id = p_reward and active;
  if not found then
    raise exception 'reward_not_found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.redemptions
   where customer_id = p_customer and reward_id = p_reward and status = 'active';
  if found then
    return jsonb_build_object('id', v_existing.id, 'code', v_existing.code,
      'expires_at', v_existing.expires_at, 'reward_name', v_reward.name);
  end if;

  if public.reward_tickets(p_customer, p_reward) <= 0 then
    raise exception 'reward_not_reached' using errcode = 'P0001';
  end if;
  perform public.assert_redeem_quota(p_customer);

  loop
    v_attempt := v_attempt + 1;
    v_code := public.generate_redemption_code();
    begin
      insert into public.redemptions (customer_id, reward_id, code, expires_at, chest_session_id)
      values (
        p_customer, p_reward, v_code,
        now() + make_interval(mins => coalesce((public.setting_json('redeem_code_minutes') #>> '{}')::integer, 15)),
        p_chest
      )
      returning * into v_row;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then raise; end if;
    end;
  end loop;

  return jsonb_build_object('id', v_row.id, 'code', v_row.code,
    'expires_at', v_row.expires_at, 'reward_name', v_reward.name);
end;
$$;

-- start_chest: igual que antes, más el tope diario ANTES de gastar un pase o abrir una partida.
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
  v_overrides jsonb;
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
  perform public.assert_redeem_quota(p_customer);

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

  v_overrides := coalesce(v_cfg -> 'overrides' -> v_game, '{}'::jsonb);
  if v_game = 'survivors' then
    v_overrides := v_overrides || jsonb_build_object('perks', public.customer_perks(p_customer, 'survivors'));
  end if;

  insert into public.chest_sessions (customer_id, reward_id, game, seed, relaxed, overrides, expires_at)
  values (
    p_customer, p_reward, v_game, floor(random() * 4294967296)::bigint, v_relaxed, v_overrides,
    now() + make_interval(secs => 300 + coalesce((v_cfg ->> 'grace_seconds')::integer, 300))
  )
  returning * into v_session;

  return jsonb_build_object('already_unlocked', false, 'session_id', v_session.id, 'game', v_session.game,
    'seed', v_session.seed, 'relaxed', v_session.relaxed, 'overrides', v_session.overrides,
    'expires_at', v_session.expires_at);
end;
$$;

-- 3. Desbloqueos al reclamar una compra: la escalera se mide con puntos de compra ---------------------------------------

create or replace function public.claim_sale_apply(p_customer uuid, p_sale_uuid uuid, p_sale jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_claimed_at timestamptz := now();
  v_status text;
  v_reason text;
  v_points integer := 0;
  v_total integer;
  v_sold_at timestamptz;
  v_ladder_before integer;
  v_purchases_before integer;
  v_balance integer;
  v_ladder integer;
  v_purchases integer;
begin
  -- Serializa intentos simultáneos sobre la misma venta (una venta, un solo dueño).
  perform pg_advisory_xact_lock(hashtextextended(p_sale_uuid::text, 0));

  select * into v_claim from public.claims where sale_uuid = p_sale_uuid;

  if found then
    if v_claim.customer_id <> p_customer then
      return jsonb_build_object('status', 'rejected', 'reason', 'already_claimed', 'points', 0);
    end if;
    if v_claim.status <> 'pending' or p_sale is null then
      return jsonb_build_object(
        'status', v_claim.status,
        'reason', v_claim.reject_reason,
        'points', v_claim.points,
        'balance', public.customer_balance(p_customer),
        'claim_id', v_claim.id,
        'repeat', true
      );
    end if;
    -- Pendiente que por fin apareció: la ventana se mide desde que el cliente la reclamó.
    v_claimed_at := v_claim.created_at;
  elsif p_sale is null then
    insert into public.claims (customer_id, sale_uuid, status)
    values (p_customer, p_sale_uuid, 'pending')
    returning * into v_claim;
    return jsonb_build_object('status', 'pending', 'points', 0, 'claim_id', v_claim.id, 'repeat', false);
  end if;

  v_total := (p_sale ->> 'total_cents')::integer;
  v_sold_at := (p_sale ->> 'sold_at')::timestamptz;

  if coalesce((p_sale ->> 'voided')::boolean, false) then
    v_status := 'rejected';
    v_reason := 'voided';
  elsif coalesce(public.setting_json('excluded_channels'), '[]'::jsonb) ? (p_sale ->> 'channel') then
    v_status := 'rejected';
    v_reason := 'excluded_channel';
  elsif v_sold_at < v_claimed_at - make_interval(hours => coalesce((public.setting_json('claim_window_hours') #>> '{}')::integer, 2)) then
    v_status := 'rejected';
    v_reason := 'too_old';
  else
    v_status := 'confirmed';
    v_points := floor(v_total::numeric / 100 * coalesce((public.setting_json('points_per_euro') #>> '{}')::numeric, 1))::integer;
  end if;

  v_ladder_before := public.customer_ladder_points(p_customer);
  v_purchases_before := public.customer_purchase_count(p_customer);

  if v_claim.id is null then
    insert into public.claims (customer_id, sale_uuid, status, reject_reason, sale_total_cents, sale_at, points)
    values (p_customer, p_sale_uuid, v_status, v_reason, v_total, v_sold_at, v_points)
    returning * into v_claim;
  else
    update public.claims
       set status = v_status, reject_reason = v_reason, sale_total_cents = v_total,
           sale_at = v_sold_at, points = v_points, updated_at = now()
     where id = v_claim.id
    returning * into v_claim;
  end if;

  if v_status = 'confirmed' and v_points > 0 then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (p_customer, 'purchase', v_points, 'claims', v_claim.id);
  end if;

  v_balance := public.customer_balance(p_customer);
  v_ladder := public.customer_ladder_points(p_customer);
  v_purchases := public.customer_purchase_count(p_customer);

  return jsonb_build_object(
    'status', v_status,
    'reason', v_reason,
    'points', v_points,
    'balance', v_balance,
    'claim_id', v_claim.id,
    'repeat', false,
    'unlocked', case when v_status = 'confirmed'
      then public.newly_unlocked_rewards(v_ladder_before, v_ladder, v_purchases_before, v_purchases)
      else '[]'::jsonb end
  );
end;
$$;

-- Panel del cliente: el progreso de la escalera usa puntos de compra. 'balance' sigue siendo el total del libro.
create or replace function public.customer_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
  v_ladder integer;
  v_purchases integer;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_balance := public.customer_balance(v_uid);
  v_ladder := public.customer_ladder_points(v_uid);
  v_purchases := public.customer_purchase_count(v_uid);

  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'onboarded', p.program_consent_at is not null
      ) from public.profiles p where p.id = v_uid
    ),
    'balance', v_balance,
    'ladder_points', v_ladder,
    'purchase_count', v_purchases,
    'streak_weeks', public.customer_streak_weeks(v_uid),
    'pending_count', (select count(*) from public.claims where customer_id = v_uid and status = 'pending'),
    'rewards', coalesce((
      select jsonb_agg(t.item order by t.sort_order, t.threshold)
        from (
          select
            rw.sort_order,
            rw.threshold,
            jsonb_build_object(
              'id', rw.id,
              'name', rw.name,
              'description', rw.description,
              'kind', rw.kind,
              'threshold', rw.threshold,
              'image_url', rw.image_url,
              'current', case when m.available > 0 then rw.threshold else m.measure % rw.threshold end,
              'remaining', case when m.available > 0 then 0 else rw.threshold - (m.measure % rw.threshold) end,
              'available', m.available,
              'unlocked', m.available > 0 and ar.id is null,
              'active_redemption', case when ar.id is null then null else
                jsonb_build_object('id', ar.id, 'code', ar.code, 'expires_at', ar.expires_at) end
            ) as item
          from public.rewards rw
          left join lateral (
            select d.id, d.code, d.expires_at
              from public.redemptions d
             where d.customer_id = v_uid and d.reward_id = rw.id
               and d.status = 'active' and d.expires_at > now()
             limit 1
          ) ar on true
          cross join lateral (
            select
              greatest(case when rw.kind = 'points' then v_ladder else v_purchases end, 0) as measure,
              public.reward_tickets(v_uid, rw.id) as available
          ) m
          where rw.active
        ) t
    ), '[]'::jsonb),
    'recent_claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'status', c.status, 'points', c.points,
        'sale_total_cents', c.sale_total_cents, 'sale_at', c.sale_at, 'created_at', c.created_at
      ) order by c.created_at desc)
      from (
        select * from public.claims
         where customer_id = v_uid and status in ('confirmed', 'pending', 'reversed')
         order by created_at desc limit 10
      ) c
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- 4. Juegos: ticket mínimo para la raspadita y presupuesto solo para la ruleta ------------------------------------------

update public.settings
   set value = jsonb_set(
         jsonb_set(value, '{daily_points_budget}', '2000'::jsonb),
         '{scratch,min_total_cents}', '500'::jsonb, true)
 where key = 'games';

create or replace function public.play_game(p_customer uuid, p_game text, p_ref uuid default null)
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
       and coalesce(sale_total_cents, 0) >= coalesce((v_cfg ->> 'min_total_cents')::integer, 0)
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

  -- Tope diario de puntos regalados por la RULETA (la raspadita está atada a una compra y no usa presupuesto).
  -- Si se agotó, la ruleta se juega igual pero sin premio.
  if p_game = 'roulette' then
    select coalesce(sum(points), 0) into v_given from public.game_plays
     where game = 'roulette' and created_at >= v_day_start;
    if (v_prize ->> 'points')::integer > 0 and v_given + (v_prize ->> 'points')::integer > v_budget then
      select p into v_zero from jsonb_array_elements(v_cfg -> 'prizes') p where (p ->> 'points')::integer = 0 limit 1;
      v_prize := coalesce(v_zero, v_prize);
      v_capped := true;
    end if;
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

-- games_status: la raspadita pendiente también exige el ticket mínimo.
create or replace function public.games_status()
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
  v_min integer := coalesce((v_cfg -> 'scratch' ->> 'min_total_cents')::integer, 0);
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
     and coalesce(c.sale_total_cents, 0) >= v_min
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

-- 5. Ranking de puntos: solo compras --------------------------------------------------------------------------------------

create or replace function public.leaderboard_points(p_limit integer default 20)
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
        from public.point_movements m
       where m.kind in ('purchase', 'reversal')
       group by m.customer_id having sum(m.points) > 0
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

-- 6. Gorra: sale de la escalera (sigue en la tienda) ------------------------------------------------------------------------

update public.rewards set active = false where kind = 'points' and name = 'Gorra Uno de Miga';

-- 7. Precios de la tienda y costos estimados -------------------------------------------------------------------------------

update public.shop_items set price_points = 200 where slug = 'chipa';
update public.shop_items set price_points = 280 where slug = 'alfajor';
update public.shop_items set price_points = 500 where slug = 'medialuna';
update public.shop_items set price_points = 2400 where slug = 'dulce-de-leche';
update public.shop_items set price_points = 4000 where slug = 'gorra';

-- Costos en centavos. Café 1,00 € y sanguche 1,20 € son ESTIMADOS (un tercio del precio de carta: 3 € y 3,5 €).
update public.settings
   set value = value || '{"Un café": 100, "Un sanguche de miga": 120}'::jsonb
 where key = 'reward_costs';
