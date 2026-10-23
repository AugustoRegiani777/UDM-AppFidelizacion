-- Puntos que no se gastan + cofre con juego.
--  * El saldo es un total acumulado que solo sube. Cada premio es un escalón repetible:
--    tickets = floor(acumulado / umbral) - canjes (usados o vigentes).
--  * El código de canje solo se emite cuando el cliente pasa el juego (sesión de cofre ganada).

-- 1. Canjear ya no mueve el saldo ---------------------------------------------------------------

delete from public.point_movements where kind = 'redeem'; -- (antes del lanzamiento no hay datos reales)
alter table public.point_movements drop constraint point_movements_kind_check;
alter table public.point_movements
  add constraint point_movements_kind_check check (kind in ('purchase', 'game', 'adjustment', 'reversal'));
alter table public.redemptions drop column points_spent;

create function public.reward_tickets(p_customer uuid, p_reward uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    greatest(
      case when r.kind = 'points'
        then public.customer_balance(p_customer)
        else public.customer_purchase_count(p_customer) end,
      0
    ) / r.threshold
    - (select count(*) from public.redemptions d
        where d.customer_id = p_customer and d.reward_id = r.id and d.status in ('used', 'active'))
  )::integer
  from public.rewards r
  where r.id = p_reward;
$$;

-- 2. Sesiones de cofre ----------------------------------------------------------------------------

create table public.chest_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id),
  seed bigint not null,
  relaxed boolean not null default false,
  overrides jsonb not null default '{}'::jsonb,
  status text not null default 'playing' check (status in ('playing', 'won', 'lost', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  summary jsonb,
  redemption_id uuid
);
create index chest_sessions_customer_idx on public.chest_sessions (customer_id, reward_id, started_at desc);
alter table public.chest_sessions enable row level security; -- sin políticas: solo service role

alter table public.redemptions add column chest_session_id uuid references public.chest_sessions (id);

insert into public.settings (key, value, is_public) values
  ('chest_game', '{"grace_seconds": 300, "min_elapsed_ratio": 0.85, "relaxed_after_losses": 2, "overrides": {}}', false)
on conflict (key) do nothing;

update public.settings
   set value = value || '{"chest": {"max": 20, "window_seconds": 60}}'::jsonb
 where key = 'rate_limits';

-- 3. Emitir el código (interno: lo llaman finish_chest y renew_redemption) ----------------------------

drop function public.create_redemption(uuid, uuid);

create function public.issue_redemption(p_customer uuid, p_reward uuid, p_chest uuid)
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

-- 4. Cofre: empezar, consultar y terminar ----------------------------------------------------------

create function public.start_chest(p_customer uuid, p_reward uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := coalesce(public.setting_json('chest_game'), '{}'::jsonb);
  v_active public.redemptions;
  v_last_win timestamptz;
  v_losses integer;
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

  insert into public.chest_sessions (customer_id, reward_id, seed, relaxed, overrides, expires_at)
  values (
    p_customer, p_reward, floor(random() * 4294967296)::bigint, v_relaxed,
    coalesce(v_cfg -> 'overrides', '{}'::jsonb),
    now() + make_interval(secs => 300 + coalesce((v_cfg ->> 'grace_seconds')::integer, 300))
  )
  returning * into v_session;

  return jsonb_build_object('already_unlocked', false, 'session_id', v_session.id, 'seed', v_session.seed,
    'relaxed', v_session.relaxed, 'overrides', v_session.overrides, 'expires_at', v_session.expires_at);
end;
$$;

create function public.get_chest_session(p_customer uuid, p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(s) - 'summary' - 'customer_id'
    from public.chest_sessions s
   where s.id = p_session and s.customer_id = p_customer;
$$;

create function public.finish_chest(p_customer uuid, p_session uuid, p_won boolean, p_min_seconds numeric, p_summary jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.chest_sessions;
  v_redemption jsonb;
begin
  select * into v_session from public.chest_sessions
   where id = p_session and customer_id = p_customer for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_session.status <> 'playing' then
    raise exception 'session_closed' using errcode = 'P0001';
  end if;
  if v_session.expires_at < now() then
    update public.chest_sessions set status = 'expired', finished_at = now() where id = v_session.id;
    raise exception 'session_expired' using errcode = 'P0001';
  end if;

  if not p_won then
    update public.chest_sessions
       set status = 'lost', finished_at = now(), summary = p_summary where id = v_session.id;
    return jsonb_build_object('won', false);
  end if;

  -- Nadie puede ganar más rápido que el tiempo real que dura la partida.
  if now() - v_session.started_at < make_interval(secs => p_min_seconds) then
    raise exception 'too_fast' using errcode = 'P0001';
  end if;

  v_redemption := public.issue_redemption(p_customer, v_session.reward_id, v_session.id);
  update public.chest_sessions
     set status = 'won', finished_at = now(), summary = p_summary,
         redemption_id = (v_redemption ->> 'id')::uuid
   where id = v_session.id;
  return jsonb_build_object('won', true, 'redemption', v_redemption);
end;
$$;

-- Si el código venció, se renueva sin volver a jugar (el cliente ya pasó el juego).
create function public.renew_redemption(p_customer uuid, p_old uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.redemptions;
begin
  perform public.expire_redemptions(p_customer);
  select * into v_old from public.redemptions
   where id = p_old and customer_id = p_customer and status = 'expired' and chest_session_id is not null;
  if not found then
    raise exception 'not_renewable' using errcode = 'P0001';
  end if;
  return public.issue_redemption(p_customer, v_old.reward_id, v_old.chest_session_id);
end;
$$;

-- 5. La caja valida: ya no se descuentan puntos -------------------------------------------------------

create or replace function public.validate_redemption(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.redemptions;
  v_reward public.rewards;
  v_name text;
begin
  select * into v_row from public.redemptions
   where code = upper(trim(coalesce(p_code, ''))) for update;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
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

-- 6. Panel: tickets por premio, sin reservas de puntos ------------------------------------------------

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
  v_purchases integer;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_balance := public.customer_balance(v_uid);
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
              greatest(case when rw.kind = 'points' then v_balance else v_purchases end, 0) as measure,
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
