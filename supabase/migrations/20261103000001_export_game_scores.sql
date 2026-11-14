-- export_my_data() incluye los puntajes de los rankings no oficiales (game_scores).
-- La baja de cuenta ya los borra: game_scores.customer_id -> profiles(id) on delete cascade, y profiles.id -> auth.users on delete cascade.

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                                            'is_guest', coalesce(u.is_anonymous, false))
                  from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'claims', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.claims c where c.customer_id = v_uid), '[]'),
    'point_movements', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.point_movements m where m.customer_id = v_uid), '[]'),
    'point_spends', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from public.point_spends s where s.customer_id = v_uid), '[]'),
    'coin_movements', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.coin_movements m where m.customer_id = v_uid), '[]'),
    'redemptions', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.redemptions r where r.customer_id = v_uid), '[]'),
    'game_plays', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from public.game_plays g where g.customer_id = v_uid), '[]'),
    'game_runs', coalesce((select jsonb_agg(to_jsonb(g) order by g.started_at) from public.game_runs g where g.customer_id = v_uid), '[]'),
    'challenge_passes', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from public.challenge_passes g where g.customer_id = v_uid), '[]'),
    'shop_orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.shop_orders o where o.customer_id = v_uid), '[]'),
    'shop_items_owned', coalesce((select jsonb_agg(to_jsonb(i)) from public.customer_items i where i.customer_id = v_uid), '[]'),
    'bonus_claims', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from public.bonus_claims b where b.customer_id = v_uid), '[]'),
    'places_submitted', coalesce((select jsonb_agg(to_jsonb(pl) order by pl.created_at) from public.places pl where pl.submitted_by = v_uid), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(cm) order by cm.created_at) from public.place_comments cm where cm.customer_id = v_uid), '[]'),
    'place_likes', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.place_likes l where l.customer_id = v_uid), '[]'),
    'comment_likes', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.comment_likes l where l.customer_id = v_uid), '[]'),
    'game_scores', coalesce((select jsonb_agg(to_jsonb(g) order by g.game) from public.game_scores g where g.customer_id = v_uid), '[]')
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
