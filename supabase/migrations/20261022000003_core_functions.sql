-- Alta de perfil, saldo, panel y eventos de saldo.

-- Perfil automático al registrarse (nombre y foto vienen de Google).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Cliente'
      ),
      60
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bienvenida: nombre editable + consentimiento del programa (obligatorio) y de promos (opcional).
create function public.complete_onboarding(p_display_name text, p_promo_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  update public.profiles
     set display_name = v_name,
         program_consent_at = coalesce(program_consent_at, now()),
         promo_consent = coalesce(p_promo_consent, false),
         promo_consent_at = case when coalesce(p_promo_consent, false) then now() else null end
   where id = auth.uid();
end;
$$;

create function public.update_profile(p_display_name text, p_promo_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  update public.profiles
     set display_name = v_name,
         promo_consent_at = case
           when p_promo_consent and not promo_consent then now()
           when not p_promo_consent then null
           else promo_consent_at
         end,
         promo_consent = p_promo_consent
   where id = auth.uid();
end;
$$;

-- Saldo = suma del libro de movimientos.
create function public.customer_balance(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(points), 0)::integer from public.point_movements where customer_id = p_customer;
$$;

create function public.customer_purchase_count(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.claims where customer_id = p_customer and status = 'confirmed';
$$;

create function public.setting_json(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.settings where key = p_key;
$$;

-- Semanas seguidas con al menos una compra confirmada (la semana actual puede estar todavía vacía).
create function public.customer_streak_weeks(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with tz as (
    select coalesce(public.setting_json('timezone') #>> '{}', 'Europe/Madrid') as name
  ),
  weeks as (
    select distinct date_trunc('week', coalesce(c.sale_at, c.created_at) at time zone tz.name)::date as wk
      from public.claims c, tz
     where c.customer_id = p_customer and c.status = 'confirmed'
  ),
  numbered as (
    select wk, row_number() over (order by wk desc) as rn from weeks
  ),
  islands as (
    select wk, rn, (wk + (rn * 7)::integer) as island from numbered
  ),
  current_week as (
    select date_trunc('week', now() at time zone tz.name)::date as wk from tz
  )
  select coalesce((
    select count(*)::integer
      from islands
     where island = (select island from islands where rn = 1)
       and (select wk from islands where rn = 1) >= (select wk - 7 from current_week)
  ), 0);
$$;

-- Todo lo que necesita el panel en una sola llamada.
create function public.customer_dashboard()
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
  v_reserved integer;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_balance := public.customer_balance(v_uid);
  v_purchases := public.customer_purchase_count(v_uid);

  -- Puntos comprometidos en códigos de canje vigentes (se descuentan recién al validar en caja).
  select coalesce(sum(r.threshold), 0) into v_reserved
    from public.redemptions d
    join public.rewards r on r.id = d.reward_id
   where d.customer_id = v_uid and d.status = 'active' and d.expires_at > now() and r.kind = 'points';

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
              'current', p.progress,
              'remaining', p.remaining,
              'unlocked', p.available and ar.id is null,
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
              case when rw.kind = 'points'
                then v_balance - v_reserved >= rw.threshold
                else (v_purchases / rw.threshold) - (
                  select count(*) from public.redemptions u
                   where u.customer_id = v_uid and u.reward_id = rw.id and u.status in ('used', 'active')
                ) > 0
              end as available,
              case when rw.kind = 'points'
                then least(greatest(v_balance, 0), rw.threshold)
                else v_purchases % rw.threshold
              end as progress,
              case when rw.kind = 'points'
                then greatest(rw.threshold - v_balance, 0)
                else rw.threshold - (v_purchases % rw.threshold)
              end as remaining
          ) p
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

-- Outbox de saldo: cada movimiento deja un evento para integraciones futuras (Wallet).
create function public.emit_balance_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.balance_events (customer_id, delta, balance)
  values (new.customer_id, new.points, public.customer_balance(new.customer_id));
  return new;
end;
$$;

create trigger point_movements_balance_event
  after insert on public.point_movements
  for each row execute function public.emit_balance_event();

-- Solo lo que el cliente puede llamar desde la app.
grant execute on function public.customer_dashboard() to authenticated;
grant execute on function public.complete_onboarding(text, boolean) to authenticated;
grant execute on function public.update_profile(text, boolean) to authenticated;
