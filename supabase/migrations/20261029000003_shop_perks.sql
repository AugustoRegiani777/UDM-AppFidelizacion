-- Economía de puntos, parte 3 (docs/06): la tienda.
--   * Puntos de compra (saldo gastable): mejoras de personaje y premios del local con código para el mostrador.
--   * Monedas de juego: pases de desafío.
-- Gastar puntos NO atrasa los escalones de comida (esos usan el total ganado, que solo sube).
-- Las mejoras se guardan en cada partida al abrirla, así el servidor la reproduce con las mismas reglas.
-- Nada se vende con dinero.

-- 1. Catálogo, mejoras del cliente y pedidos con código -----------------------------------------------------------

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('voucher', 'upgrade')),
  name text not null,
  description text not null default '',
  icon text not null default '🎁',
  game text check (game in ('survivors', 'skate')),
  -- Efecto por nivel de una mejora, por ejemplo {"hp": 1}.
  perk jsonb not null default '{}'::jsonb,
  -- Premio del local: precio fijo. Mejora: el nivel N cuesta price_points * N.
  price_points integer not null check (price_points > 0),
  max_level integer not null default 1 check (max_level between 1 and 10),
  active boolean not null default true,
  sort_order integer not null default 0
);
alter table public.shop_items enable row level security;
create policy shop_items_select_active on public.shop_items for select to authenticated using (active);
grant select on public.shop_items to authenticated;

create table public.customer_items (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.shop_items (id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  acquired_at timestamptz not null default now(),
  primary key (customer_id, item_id)
);
alter table public.customer_items enable row level security;
create policy customer_items_select_own on public.customer_items for select to authenticated
  using (customer_id = (select auth.uid()));
grant select on public.customer_items to authenticated;

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.shop_items (id),
  price_points integer not null,
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'used', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index shop_orders_customer_idx on public.shop_orders (customer_id, created_at desc);
alter table public.shop_orders enable row level security;
create policy shop_orders_select_own on public.shop_orders for select to authenticated
  using (customer_id = (select auth.uid()));
grant select on public.shop_orders to authenticated;

-- Precios orientativos: salen de mantener el costo de los premios cerca del 2 por mil de lo que se gasta
-- (un chipá de 0,30 € de costo = 150 puntos). Se editan desde la tabla, no desde el código.
insert into public.shop_items (slug, kind, name, description, icon, game, perk, price_points, max_level, sort_order) values
  ('chipa', 'voucher', 'Un chipá', 'Un chipá calentito, va por la casa.', '🧀', null, '{}', 150, 1, 10),
  ('alfajor', 'voucher', 'Un alfajor', 'Un alfajor argentino para llevar.', '🍪', null, '{}', 130, 1, 11),
  ('medialuna', 'voucher', 'Una medialuna', 'Una medialuna de las nuestras.', '🥐', null, '{}', 250, 1, 12),
  ('dulce-de-leche', 'voucher', 'Pote de dulce de leche', 'Un pote de dulce de leche Havanna.', '🍯', null, '{}', 1200, 1, 13),
  ('gorra', 'voucher', 'Gorra Uno de Miga', 'La gorra oficial para llevar la miga puesta.', '🧢', null, '{}', 3000, 1, 14),
  ('corazon', 'upgrade', 'Corazón extra', 'Empezás Sobreviví a las migas con una vida más por nivel.', '❤️', 'survivors', '{"hp": 1}', 300, 3, 20),
  ('zapatillas', 'upgrade', 'Zapatillas veloces', 'Te movés un 6 % más rápido por nivel.', '👟', 'survivors', '{"speed": 1}', 250, 3, 21),
  ('iman', 'upgrade', 'Imán de gemas', 'Las gemas vienen solas desde un 25 % más lejos por nivel.', '🧲', 'survivors', '{"magnet": 1}', 200, 2, 22)
on conflict (slug) do nothing;

update public.settings
   set value = value || '{"pass_coin_price": 80}'::jsonb
 where key = 'economy';

-- 2. Mejoras que lleva cada partida -------------------------------------------------------------------------------

alter table public.game_runs
  add column perks jsonb not null default '{}'::jsonb,
  add column boosted boolean generated always as (perks <> '{}'::jsonb) stored;

create function public.customer_perks(p_customer uuid, p_game text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t.k, t.v), '{}'::jsonb)
    from (
      select e.key as k, sum(e.value::numeric * ci.level)::integer as v
        from public.customer_items ci
        join public.shop_items si on si.id = ci.item_id and si.kind = 'upgrade' and si.game = p_game
        cross join lateral jsonb_each_text(si.perk) e
       where ci.customer_id = p_customer
       group by e.key
    ) t;
$$;

create or replace function public.start_run(p_customer uuid, p_game text, p_stage integer)
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

  insert into public.game_runs (customer_id, game, stage, seed, overrides, perks, expires_at)
  values (
    p_customer, p_game,
    case when p_game = 'survivors' then greatest(1, least(coalesce(p_stage, 1), 6)) else 1 end,
    floor(random() * 4294967296)::bigint,
    coalesce(v_cfg -> 'overrides' -> p_game, '{}'::jsonb),
    public.customer_perks(p_customer, p_game),
    now() + make_interval(mins => coalesce((v_eco ->> 'run_minutes')::integer, 20))
  )
  returning * into v_run;

  return jsonb_build_object('run_id', v_run.id, 'game', v_run.game, 'stage', v_run.stage,
    'seed', v_run.seed, 'overrides', v_run.overrides, 'perks', v_run.perks, 'expires_at', v_run.expires_at);
end;
$$;

-- El cofre de un premio también lleva las mejoras: el desafío se vuelve más fácil con ellas.
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

-- 3. Comprar -------------------------------------------------------------------------------------------------------

create function public.generate_order_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := public.generate_redemption_code();
    exit when not exists (select 1 from public.redemptions where code = v_code)
          and not exists (select 1 from public.shop_orders where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Compra con puntos de compra (saldo gastable): una mejora (sube de nivel) o un premio del local (da un código).
create function public.buy_item(p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.shop_items;
  v_level integer;
  v_price integer;
  v_order public.shop_orders;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_item from public.shop_items where id = p_item and active;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 8));

  if v_item.kind = 'upgrade' then
    select level into v_level from public.customer_items where customer_id = v_uid and item_id = v_item.id;
    v_level := coalesce(v_level, 0) + 1;
    if v_level > v_item.max_level then
      raise exception 'max_level' using errcode = 'P0001';
    end if;
    v_price := v_item.price_points * v_level;
    perform public.spend_points(v_uid, v_price, 'shop', v_item.id);
    insert into public.customer_items (customer_id, item_id, level) values (v_uid, v_item.id, v_level)
      on conflict (customer_id, item_id) do update set level = excluded.level;
    return jsonb_build_object('kind', 'upgrade', 'name', v_item.name, 'level', v_level, 'price', v_price,
      'spendable', public.customer_spendable(v_uid));
  end if;

  v_price := v_item.price_points;
  perform public.spend_points(v_uid, v_price, 'shop', v_item.id);
  insert into public.shop_orders (customer_id, item_id, price_points, code, expires_at)
  values (v_uid, v_item.id, v_price, public.generate_order_code(), now() + interval '30 days')
  returning * into v_order;
  return jsonb_build_object('kind', 'voucher', 'name', v_item.name, 'order_id', v_order.id, 'code', v_order.code,
    'expires_at', v_order.expires_at, 'price', v_price, 'spendable', public.customer_spendable(v_uid));
end;
$$;

-- Compra con monedas de juego: un pase de desafío (respeta el tope de pases guardados).
create function public.buy_pass_with_coins()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_eco jsonb := coalesce(public.setting_json('economy'), '{}'::jsonb);
  v_price integer := coalesce((v_eco ->> 'pass_coin_price')::integer, 80);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 8));
  if (select count(*) from public.challenge_passes where customer_id = v_uid and used_at is null)
     >= coalesce((v_eco ->> 'pass_cap')::integer, 3) then
    raise exception 'pass_cap_reached' using errcode = 'P0001';
  end if;
  perform public.spend_coins(v_uid, v_price, null);
  insert into public.challenge_passes (customer_id) values (v_uid);
  return jsonb_build_object('coins', public.customer_coins(v_uid),
    'passes', (select count(*) from public.challenge_passes where customer_id = v_uid and used_at is null));
end;
$$;

-- 4. Lo que ve el cliente --------------------------------------------------------------------------------------------

create function public.shop_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_eco jsonb := coalesce(public.setting_json('economy'), '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'pass_coin_price', coalesce((v_eco ->> 'pass_coin_price')::integer, 80),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', si.id, 'slug', si.slug, 'kind', si.kind, 'name', si.name, 'description', si.description,
        'icon', si.icon, 'game', si.game, 'max_level', si.max_level,
        'level', coalesce(ci.level, 0),
        'maxed', coalesce(ci.level, 0) >= si.max_level,
        'price', case when si.kind = 'upgrade' then si.price_points * (coalesce(ci.level, 0) + 1) else si.price_points end
      ) order by si.sort_order, si.name)
      from public.shop_items si
      left join public.customer_items ci on ci.item_id = si.id and ci.customer_id = v_uid
      where si.active
    ), '[]'::jsonb)
  );
end;
$$;

create function public.my_shop_orders()
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
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', si.name, 'icon', si.icon, 'code', o.code,
      'status', case when o.status = 'active' and o.expires_at <= now() then 'expired' else o.status end,
      'expires_at', o.expires_at, 'created_at', o.created_at
    ) order by o.created_at desc)
    from (select * from public.shop_orders where customer_id = v_uid order by created_at desc limit 20) o
    join public.shop_items si on si.id = o.item_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.my_wallet()
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
    'show_in_rankings', coalesce((select show_in_rankings from public.profiles where id = v_uid), true),
    'perks', jsonb_build_object('survivors', public.customer_perks(v_uid, 'survivors'))
  );
end;
$$;

-- Ranking de un juego: por defecto solo partidas sin mejoras (las más parejas); con p_boosted = true, las que
-- llevaron mejoras de la tienda.
drop function public.leaderboard(text, integer, integer);
create function public.leaderboard(
  p_game text,
  p_stage integer default 1,
  p_limit integer default 20,
  p_boosted boolean default false
)
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
       where r.game = p_game and r.stage = p_stage and r.status = 'won' and r.boosted = coalesce(p_boosted, false)
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

grant execute on function
  public.buy_item(uuid), public.buy_pass_with_coins(), public.shop_catalog(), public.my_shop_orders(),
  public.leaderboard(text, integer, integer, boolean)
to authenticated;

-- 5. La caja también valida los códigos de la tienda -----------------------------------------------------------------

create or replace function public.validate_redemption(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_row public.redemptions;
  v_reward public.rewards;
  v_order public.shop_orders;
  v_item public.shop_items;
  v_name text;
begin
  select * into v_row from public.redemptions where code = v_code for update;

  if not found then
    -- No es un premio por puntos: puede ser un pedido de la tienda.
    select * into v_order from public.shop_orders where code = v_code for update;
    if not found then
      return jsonb_build_object('valid', false, 'reason', 'not_found');
    end if;
    if v_order.status = 'used' then
      return jsonb_build_object('valid', false, 'reason', 'used');
    end if;
    if v_order.status = 'expired' or v_order.expires_at <= now() then
      update public.shop_orders set status = 'expired' where id = v_order.id and status = 'active';
      return jsonb_build_object('valid', false, 'reason', 'expired');
    end if;
    select * into v_item from public.shop_items where id = v_order.item_id;
    select split_part(display_name, ' ', 1) into v_name from public.profiles where id = v_order.customer_id;
    update public.shop_orders set status = 'used', used_at = now() where id = v_order.id;
    return jsonb_build_object(
      'valid', true,
      'reward', jsonb_build_object('id', v_item.id, 'name', v_item.name, 'kind', 'shop'),
      'customer_name', v_name
    );
  end if;

  if v_row.status = 'used' then
    return jsonb_build_object('valid', false, 'reason', 'used');
  end if;
  if v_row.status = 'expired' or v_row.expires_at <= now() then
    update public.redemptions set status = 'expired' where id = v_row.id and status = 'active';
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  select * into v_reward from public.rewards where id = v_row.reward_id;
  select split_part(display_name, ' ', 1) into v_name from public.profiles where id = v_row.customer_id;

  update public.redemptions set status = 'used', used_at = now() where id = v_row.id;

  return jsonb_build_object(
    'valid', true,
    'reward', jsonb_build_object('id', v_reward.id, 'name', v_reward.name, 'kind', v_reward.kind),
    'customer_name', v_name
  );
end;
$$;
