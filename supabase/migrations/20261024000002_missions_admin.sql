-- Misiones de puntos extra (seguir en Instagram, reseña en Google Maps) y rol de administrador.
-- Los puntos los decide siempre el servidor desde settings.missions; el cliente solo avisa que hizo la misión.

alter table public.profiles add column is_admin boolean not null default false;

alter table public.point_movements drop constraint point_movements_kind_check;
alter table public.point_movements
  add constraint point_movements_kind_check
  check (kind in ('purchase', 'game', 'adjustment', 'reversal', 'bonus', 'community'));

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to authenticated;

-- Misiones configurables. `auto` = se acredita al instante (sin verificación); si no, queda para aprobar.
insert into public.settings (key, value, is_public) values
  ('missions', $json$
  {
    "instagram_follow": {"points": 15, "auto": true, "url": "https://www.instagram.com/"},
    "google_review": {"points": 50, "auto": false, "url": "https://g.page/r/CQAymNidEqlsEBE/review"}
  }
  $json$::jsonb, true)
on conflict (key) do nothing;

create table public.bonus_claims (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  mission text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  /** Dato que ayuda a verificar (ej. el nombre que usa el cliente en Google). */
  note text check (char_length(note) <= 120),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id)
);
-- Una misión por cliente mientras esté pendiente o aprobada (si la rechazan, puede volver a intentar).
create unique index bonus_claims_one_active on public.bonus_claims (customer_id, mission)
  where status in ('pending', 'approved');
create index bonus_claims_pending_idx on public.bonus_claims (created_at) where status = 'pending';

alter table public.bonus_claims enable row level security;
grant select on public.bonus_claims to authenticated;
create policy bonus_claims_select_own on public.bonus_claims
  for select to authenticated using (customer_id = (select auth.uid()));

create function public.claim_mission(p_mission text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb := public.setting_json('missions') -> p_mission;
  v_points integer;
  v_auto boolean;
  v_claim public.bonus_claims;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_cfg is null then
    raise exception 'mission_not_found' using errcode = 'P0002';
  end if;
  v_points := (v_cfg ->> 'points')::integer;
  v_auto := coalesce((v_cfg ->> 'auto')::boolean, false);

  if exists (select 1 from public.bonus_claims
              where customer_id = v_uid and mission = p_mission and status in ('pending', 'approved')) then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;

  insert into public.bonus_claims (customer_id, mission, status, note, points, decided_at)
  values (
    v_uid, p_mission, case when v_auto then 'approved' else 'pending' end,
    nullif(left(trim(coalesce(p_note, '')), 120), ''),
    case when v_auto then v_points else 0 end,
    case when v_auto then now() else null end
  )
  returning * into v_claim;

  if v_auto then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (v_uid, 'bonus', v_points, 'bonus_claims', v_claim.id);
  end if;

  return jsonb_build_object('status', v_claim.status, 'points', v_claim.points,
    'balance', public.customer_balance(v_uid));
end;
$$;
grant execute on function public.claim_mission(text, text) to authenticated;

-- Pendientes para el administrador (con el nombre del cliente para poder verificar).
create function public.admin_pending_missions()
returns table (id uuid, mission text, note text, display_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select b.id, b.mission, b.note, p.display_name, b.created_at
      from public.bonus_claims b join public.profiles p on p.id = b.customer_id
     where b.status = 'pending'
     order by b.created_at;
end;
$$;
grant execute on function public.admin_pending_missions() to authenticated;

create function public.admin_review_mission(p_claim uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.bonus_claims;
  v_points integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_claim from public.bonus_claims where id = p_claim and status = 'pending' for update;
  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  v_points := coalesce((public.setting_json('missions') -> v_claim.mission ->> 'points')::integer, 0);

  update public.bonus_claims
     set status = case when p_approve then 'approved' else 'rejected' end,
         points = case when p_approve then v_points else 0 end,
         decided_at = now(), decided_by = auth.uid()
   where id = v_claim.id;

  if p_approve and v_points > 0 then
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (v_claim.customer_id, 'bonus', v_points, 'bonus_claims', v_claim.id);
  end if;
end;
$$;
grant execute on function public.admin_review_mission(uuid, boolean) to authenticated;
