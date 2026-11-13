-- Panel del dueño: resumen general (usuarios, puntos, ventas, juegos, premios), todo agregado en SQL.
-- Notas: no existe tabla de escaneos de QR, por eso sales.qr_scans_by_day devuelve [].
-- limit_hits = veces que un cliente llegó al tope diario en la ruleta (días-cliente con partidas >= daily_limit);
-- los demás juegos no registran el rechazo por tope, así que devuelven 0.

create function public.admin_overview(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_roulette_limit integer := coalesce((public.setting_json('games') -> 'roulette' ->> 'daily_limit')::integer, 1);
  v_issued bigint;
  v_neg bigint;
  v_spent bigint;
  v_result jsonb;
begin
  perform public.require_admin();

  select coalesce(sum(points) filter (where points > 0), 0), coalesce(-sum(points) filter (where points < 0), 0)
    into v_issued, v_neg from public.point_movements;
  select coalesce(sum(amount), 0) into v_spent from public.point_spends;

  select jsonb_build_object(
    'days', v_days,
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d), '[]'::jsonb)
        from (select created_at::date as d, count(*)::int as n from public.profiles
               where created_at >= v_since group by 1) t),
      'active_7d', (select count(distinct c) from (
          select customer_id c from public.claims where created_at >= now() - interval '7 days'
          union all select customer_id from public.game_plays where created_at >= now() - interval '7 days'
          union all select customer_id from public.game_runs where started_at >= now() - interval '7 days') a),
      'active_30d', (select count(distinct c) from (
          select customer_id c from public.claims where created_at >= now() - interval '30 days'
          union all select customer_id from public.game_plays where created_at >= now() - interval '30 days'
          union all select customer_id from public.game_runs where started_at >= now() - interval '30 days') a)
    ),
    'points', jsonb_build_object(
      'issued', v_issued,
      'redeemed', v_neg + v_spent,
      'circulating', v_issued - v_neg - v_spent,
      'top_customers', (select coalesce(jsonb_agg(jsonb_build_object('display_name', t.display_name, 'balance', t.bal) order by t.bal desc), '[]'::jsonb)
        from (select p.display_name, coalesce(m.s, 0) - coalesce(sp.s, 0) as bal
                from public.profiles p
                left join (select customer_id, sum(points) s from public.point_movements group by 1) m on m.customer_id = p.id
                left join (select customer_id, sum(amount) s from public.point_spends group by 1) sp on sp.customer_id = p.id
               where coalesce(m.s, 0) - coalesce(sp.s, 0) > 0
               order by bal desc limit 10) t)
    ),
    'sales', jsonb_build_object(
      'claimed_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d), '[]'::jsonb)
        from (select created_at::date as d, count(*)::int as n from public.claims
               where status = 'confirmed' and created_at >= v_since group by 1) t),
      'qr_scans_by_day', '[]'::jsonb
    ),
    'games', (select coalesce(jsonb_agg(jsonb_build_object(
        'game', g.game,
        'plays_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', e.d, 'count', e.n) order by e.d), '[]'::jsonb)
                           from (select x.d, count(*)::int as n from (
                                   select created_at::date d from public.game_plays where game = g.game and created_at >= v_since
                                   union all
                                   select started_at::date from public.game_runs
                                    where game = g.game and status in ('won', 'lost') and started_at >= v_since) x
                                  group by 1) e),
        'plays_total', g.plays,
        'rewards_given', g.rewards,
        'limit_hits', g.limit_hits
      ) order by g.plays desc), '[]'::jsonb)
      from (
        select game, count(*)::int as plays, count(*) filter (where points > 0)::int as rewards,
               case when game = 'roulette' then (
                 select count(*)::int from (
                   select 1 from public.game_plays r where r.game = 'roulette' and r.created_at >= v_since
                    group by r.customer_id, r.created_at::date having count(*) >= v_roulette_limit) z) else 0 end as limit_hits
          from public.game_plays where created_at >= v_since group by game
        union all
        select game, count(*)::int, count(*) filter (where pass_granted or coins > 0)::int, 0
          from public.game_runs where status in ('won', 'lost') and started_at >= v_since group by game
      ) g),
    'rewards', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'redemptions', t.n) order by t.n desc), '[]'::jsonb)
        from (select r.name, count(*)::int as n from public.redemptions d join public.rewards r on r.id = d.reward_id
               where d.created_at >= v_since group by r.name) t)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_overview(integer) from public, anon;
grant execute on function public.admin_overview(integer) to authenticated;
