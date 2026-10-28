-- Panel del dueño: cuánto cuestan los premios sobre las ventas (docs/06). Los costos unitarios salen de
-- settings.reward_costs (en centavos de euro) y son SUPUESTOS hasta que Augusto cargue los reales.

insert into public.settings (key, value, is_public) values
  ('reward_costs', '{
     "Un café": 40,
     "Un sanguche de miga": 300,
     "Gorra Uno de Miga": 600,
     "Media docena de migas": 900,
     "chipa": 30,
     "alfajor": 40,
     "medialuna": 80,
     "dulce-de-leche": 350,
     "gorra": 600
   }', false)
on conflict (key) do nothing;

create function public.admin_economy_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_costs jsonb := coalesce(public.setting_json('reward_costs'), '{}'::jsonb);
  v_revenue bigint;
  v_purchases integer;
  v_rewards jsonb;
  v_shop jsonb;
  v_cost bigint;
begin
  perform public.require_admin();

  select coalesce(sum(sale_total_cents), 0), count(*) into v_revenue, v_purchases
    from public.claims where status = 'confirmed' and created_at >= v_since;

  -- Premios por puntos que se entregaron en la caja.
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', t.name, 'count', t.n, 'unit_cents', t.unit, 'total_cents', t.n * t.unit
    ) order by t.n desc), '[]'::jsonb)
    into v_rewards
    from (
      select r.name, count(*)::int as n, coalesce((v_costs ->> r.name)::int, 0) as unit
        from public.redemptions d join public.rewards r on r.id = d.reward_id
       where d.status = 'used' and d.used_at >= v_since
       group by r.name
    ) t;

  -- Premios de la tienda que se entregaron en la caja.
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', t.name, 'count', t.n, 'unit_cents', t.unit, 'total_cents', t.n * t.unit
    ) order by t.n desc), '[]'::jsonb)
    into v_shop
    from (
      select si.name, count(*)::int as n, coalesce((v_costs ->> si.slug)::int, 0) as unit
        from public.shop_orders o join public.shop_items si on si.id = o.item_id
       where o.status = 'used' and o.used_at >= v_since
       group by si.name, si.slug
    ) t;

  select coalesce(sum((x ->> 'total_cents')::bigint), 0) into v_cost
    from jsonb_array_elements(v_rewards || v_shop) x;

  return jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'revenue_cents', v_revenue,
    'purchases', v_purchases,
    'rewards', v_rewards,
    'shop', v_shop,
    'cost_cents', v_cost,
    'cost_percent', case when v_revenue > 0 then round(v_cost * 100.0 / v_revenue, 2) end,
    'points_spent', coalesce((select sum(amount) from public.point_spends where created_at >= v_since), 0),
    'coins_given', coalesce((select sum(amount) from public.coin_movements where kind = 'run' and created_at >= v_since), 0),
    'passes_given', (select count(*) from public.challenge_passes where created_at >= v_since),
    'passes_used', (select count(*) from public.challenge_passes where used_at >= v_since),
    'runs', (select count(*) from public.game_runs where started_at >= v_since and status in ('won', 'lost')),
    'players', (select count(distinct customer_id) from public.game_runs where started_at >= v_since)
  );
end;
$$;

grant execute on function public.admin_economy_stats(integer) to authenticated;
