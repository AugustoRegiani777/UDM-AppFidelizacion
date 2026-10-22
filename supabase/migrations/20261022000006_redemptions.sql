-- Canjes: el servidor genera el código, la caja lo valida y recién ahí se descuentan los puntos.

update public.settings
   set value = value || '{"create_redemption": {"max": 10, "window_seconds": 60}}'::jsonb
 where key = 'rate_limits';

-- Marca como vencidos los códigos activos cuyo tiempo ya pasó (opcionalmente solo de un cliente).
create function public.expire_redemptions(p_customer uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.redemptions
     set status = 'expired'
   where status = 'active'
     and expires_at <= now()
     and (p_customer is null or customer_id = p_customer);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Código sin caracteres ambiguos (sin 0/O ni 1/I/L), ej. MIGA-7K3P.
create function public.generate_redemption_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(4);
  v_code text := '';
  i integer;
begin
  for i in 0..3 loop
    v_code := v_code || substr(c_alphabet, (get_byte(v_bytes, i) % length(c_alphabet)) + 1, 1);
  end loop;
  return 'MIGA-' || v_code;
end;
$$;

-- Crea (o devuelve el vigente de) un código de canje si el premio está alcanzado.
create function public.create_redemption(p_customer uuid, p_reward uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward public.rewards;
  v_existing public.redemptions;
  v_row public.redemptions;
  v_balance integer;
  v_reserved integer;
  v_available boolean;
  v_code text;
  v_attempt integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 1));
  perform public.expire_redemptions(p_customer);

  select * into v_reward from public.rewards where id = p_reward and active;
  if not found then
    raise exception 'reward_not_found' using errcode = 'P0002';
  end if;

  -- Si ya tiene un código vigente para este premio, es el mismo (no se acumulan).
  select * into v_existing from public.redemptions
   where customer_id = p_customer and reward_id = p_reward and status = 'active';
  if found then
    return jsonb_build_object('id', v_existing.id, 'code', v_existing.code,
      'expires_at', v_existing.expires_at, 'reward_name', v_reward.name);
  end if;

  if v_reward.kind = 'points' then
    v_balance := public.customer_balance(p_customer);
    select coalesce(sum(r.threshold), 0) into v_reserved
      from public.redemptions d join public.rewards r on r.id = d.reward_id
     where d.customer_id = p_customer and d.status = 'active' and r.kind = 'points';
    v_available := v_balance - v_reserved >= v_reward.threshold;
  else
    v_available := (public.customer_purchase_count(p_customer) / v_reward.threshold) - (
      select count(*) from public.redemptions u
       where u.customer_id = p_customer and u.reward_id = p_reward and u.status in ('used', 'active')
    ) > 0;
  end if;

  if not v_available then
    raise exception 'reward_not_reached' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public.generate_redemption_code();
    begin
      insert into public.redemptions (customer_id, reward_id, code, expires_at)
      values (
        p_customer, p_reward, v_code,
        now() + make_interval(mins => coalesce((public.setting_json('redeem_code_minutes') #>> '{}')::integer, 15))
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

-- La llama la caja (vía validate-redemption con HMAC). Atómica: dos validaciones simultáneas
-- del mismo código no pueden ganar las dos. Los puntos se descuentan acá, no al generar el código.
create function public.validate_redemption(p_code text)
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

  update public.redemptions
     set status = 'used', used_at = now(),
         points_spent = case when v_reward.kind = 'points' then v_reward.threshold else 0 end
   where id = v_row.id;

  if v_reward.kind = 'points' then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (v_row.customer_id, 'redeem', -v_reward.threshold, 'redemptions', v_row.id);
  end if;

  return jsonb_build_object(
    'valid', true,
    'reward', jsonb_build_object('id', v_reward.id, 'name', v_reward.name, 'kind', v_reward.kind),
    'customer_name', v_name
  );
end;
$$;
