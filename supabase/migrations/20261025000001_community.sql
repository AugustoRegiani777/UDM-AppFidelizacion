-- Comunidad de recomendaciones de Valencia: lugares (moderados), comentarios y likes anónimos.
-- Todo el acceso es por funciones `security definer` (el cliente no toca las tablas); las reglas de puntos
-- viven en settings.community. Los likes y comentarios muestran un alias, nunca el nombre real.

insert into public.settings (key, value, is_public) values
  ('community', $json$
  {
    "place_points": 30,
    "comment_points": 3,
    "like_points": 1,
    "daily_cap": 12,
    "max_comments_per_day": 5,
    "max_places_per_day": 3
  }
  $json$::jsonb, true)
on conflict (key) do nothing;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (category in ('pizzeria', 'medialunas', 'cafe', 'helado', 'otro')),
  maps_url text check (char_length(maps_url) <= 500),
  address text check (char_length(address) <= 160),
  note text not null default '' check (char_length(note) <= 280),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id)
);
create unique index places_unique_name on public.places (lower(name)) where status in ('pending', 'approved');
create index places_status_idx on public.places (status, created_at);

create table public.place_likes (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (place_id, customer_id)
);

create table public.place_comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 280),
  status text not null default 'approved' check (status in ('approved', 'rejected')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index place_comments_place_idx on public.place_comments (place_id, created_at);

create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.place_comments (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (comment_id, customer_id)
);

create table public.comment_reports (
  comment_id uuid not null references public.place_comments (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, customer_id)
);

alter table public.places enable row level security;
alter table public.place_likes enable row level security;
alter table public.place_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_reports enable row level security;
-- Sin políticas: solo se accede con las funciones de abajo.

-- Alias anónimo y estable de cada cliente dentro de la comunidad.
create function public.community_alias(p_customer uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Miguero ' || upper(substr(md5('miga-' || p_customer::text), 1, 4));
$$;

-- Suma puntos de comunidad respetando el tope diario. Devuelve los puntos realmente sumados
-- (0 si ya se había premiado ese origen o si se llegó al tope).
create function public.award_community(p_customer uuid, p_points integer, p_table text, p_ref uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer := coalesce((public.setting_json('community') ->> 'daily_cap')::integer, 12);
  v_used integer;
  v_award integer;
  v_inserted integer;
begin
  select coalesce(sum(points), 0) into v_used from public.point_movements
   where customer_id = p_customer and kind = 'community' and created_at >= public.local_day_start()
     and ref_table in ('place_comments', 'place_likes', 'comment_likes');
  v_award := least(p_points, greatest(v_cap - v_used, 0));
  if v_award <= 0 then
    return 0;
  end if;
  insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
  values (p_customer, 'community', v_award, p_table, p_ref)
  on conflict (kind, ref_table, ref_id) where ref_id is not null do nothing;
  get diagnostics v_inserted = row_count;
  return case when v_inserted > 0 then v_award else 0 end;
end;
$$;

create function public.require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return auth.uid();
end;
$$;

-- Lugares aprobados, los más queridos primero.
create function public.community_places(p_category text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  return coalesce((
    select jsonb_agg(item order by likes desc, created_at desc)
      from (
        select
          p.created_at,
          (select count(*) from public.place_likes l where l.place_id = p.id and l.active) as likes,
          jsonb_build_object(
            'id', p.id, 'name', p.name, 'category', p.category, 'maps_url', p.maps_url,
            'address', p.address, 'note', p.note,
            'likes', (select count(*) from public.place_likes l where l.place_id = p.id and l.active),
            'liked', exists (select 1 from public.place_likes l where l.place_id = p.id and l.customer_id = v_uid and l.active),
            'comments', (select count(*) from public.place_comments c
                          where c.place_id = p.id and c.status = 'approved' and not c.hidden),
            'mine', p.submitted_by = v_uid
          ) as item
        from public.places p
        where p.status = 'approved' and (p_category is null or p.category = p_category)
      ) t
  ), '[]'::jsonb);
end;
$$;

create function public.submit_place(p_name text, p_category text, p_maps_url text, p_address text, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_max integer := coalesce((public.setting_json('community') ->> 'max_places_per_day')::integer, 3);
  v_url text := nullif(trim(coalesce(p_maps_url, '')), '');
  v_id uuid;
begin
  if (select count(*) from public.places where submitted_by = v_uid and created_at >= public.local_day_start()) >= v_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if v_url is not null and v_url !~* '^https://((www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)' then
    raise exception 'invalid_maps_url' using errcode = '22023';
  end if;
  insert into public.places (name, category, maps_url, address, note, submitted_by)
  values (trim(p_name), p_category, v_url, nullif(trim(coalesce(p_address, '')), ''), trim(coalesce(p_note, '')), v_uid)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'duplicate_place' using errcode = 'P0001';
  when check_violation then
    raise exception 'invalid_place' using errcode = '22023';
end;
$$;

create function public.toggle_place_like(p_place uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_place public.places;
  v_like public.place_likes;
  v_points integer := 0;
begin
  select * into v_place from public.places where id = p_place and status = 'approved';
  if not found then
    raise exception 'place_not_found' using errcode = 'P0002';
  end if;
  if v_place.submitted_by = v_uid then
    raise exception 'own_content' using errcode = 'P0001';
  end if;

  select * into v_like from public.place_likes where place_id = p_place and customer_id = v_uid for update;
  if not found then
    insert into public.place_likes (place_id, customer_id) values (p_place, v_uid) returning * into v_like;
    -- Los puntos se dan una sola vez por lugar (aunque después quite y vuelva a poner el like).
    v_points := public.award_community(v_uid, coalesce((public.setting_json('community') ->> 'like_points')::integer, 1), 'place_likes', v_like.id);
  else
    update public.place_likes set active = not active where id = v_like.id returning * into v_like;
  end if;
  return jsonb_build_object('liked', v_like.active, 'points', v_points,
    'likes', (select count(*) from public.place_likes where place_id = p_place and active));
end;
$$;

create function public.place_comments_list(p_place uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'body', c.body, 'created_at', c.created_at,
      'alias', case when c.customer_id = v_uid then 'Vos' else public.community_alias(c.customer_id) end,
      'mine', c.customer_id = v_uid,
      'likes', (select count(*) from public.comment_likes l where l.comment_id = c.id and l.active),
      'liked', exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.customer_id = v_uid and l.active)
    ) order by c.created_at)
    from public.place_comments c
    where c.place_id = p_place and c.status = 'approved' and not c.hidden
  ), '[]'::jsonb);
end;
$$;

create function public.add_comment(p_place uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_max integer := coalesce((public.setting_json('community') ->> 'max_comments_per_day')::integer, 5);
  v_body text := regexp_replace(trim(coalesce(p_body, '')), '[[:cntrl:]]', ' ', 'g');
  v_comment public.place_comments;
  v_points integer;
begin
  if not exists (select 1 from public.places where id = p_place and status = 'approved') then
    raise exception 'place_not_found' using errcode = 'P0002';
  end if;
  if char_length(v_body) not between 2 and 280 then
    raise exception 'invalid_comment' using errcode = '22023';
  end if;
  if (select count(*) from public.place_comments where customer_id = v_uid and created_at >= public.local_day_start()) >= v_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.place_comments (place_id, customer_id, body) values (p_place, v_uid, v_body)
  returning * into v_comment;
  v_points := public.award_community(v_uid, coalesce((public.setting_json('community') ->> 'comment_points')::integer, 3), 'place_comments', v_comment.id);
  return jsonb_build_object('id', v_comment.id, 'points', v_points);
end;
$$;

create function public.toggle_comment_like(p_comment uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_comment public.place_comments;
  v_like public.comment_likes;
  v_points integer := 0;
begin
  select * into v_comment from public.place_comments where id = p_comment and status = 'approved' and not hidden;
  if not found then
    raise exception 'comment_not_found' using errcode = 'P0002';
  end if;
  if v_comment.customer_id = v_uid then
    raise exception 'own_content' using errcode = 'P0001';
  end if;
  select * into v_like from public.comment_likes where comment_id = p_comment and customer_id = v_uid for update;
  if not found then
    insert into public.comment_likes (comment_id, customer_id) values (p_comment, v_uid) returning * into v_like;
    v_points := public.award_community(v_uid, coalesce((public.setting_json('community') ->> 'like_points')::integer, 1), 'comment_likes', v_like.id);
  else
    update public.comment_likes set active = not active where id = v_like.id returning * into v_like;
  end if;
  return jsonb_build_object('liked', v_like.active, 'points', v_points,
    'likes', (select count(*) from public.comment_likes where comment_id = p_comment and active));
end;
$$;

-- Reportar oculta el comentario hasta que el administrador lo revise.
create function public.report_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  if not exists (select 1 from public.place_comments where id = p_comment and status = 'approved') then
    raise exception 'comment_not_found' using errcode = 'P0002';
  end if;
  insert into public.comment_reports (comment_id, customer_id) values (p_comment, v_uid)
  on conflict do nothing;
  update public.place_comments set hidden = true where id = p_comment;
end;
$$;

-- --- Administración -------------------------------------------------------------------------------------

create function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create function public.admin_pending_places()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'category', p.category, 'maps_url', p.maps_url,
      'address', p.address, 'note', p.note, 'display_name', pr.display_name, 'created_at', p.created_at
    ) order by p.created_at)
    from public.places p join public.profiles pr on pr.id = p.submitted_by
    where p.status = 'pending'
  ), '[]'::jsonb);
end;
$$;

create function public.admin_review_place(p_place uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_place public.places;
  v_points integer := coalesce((public.setting_json('community') ->> 'place_points')::integer, 30);
begin
  perform public.require_admin();
  select * into v_place from public.places where id = p_place and status = 'pending' for update;
  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  update public.places
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_at = now(), decided_by = auth.uid()
   where id = p_place;
  if p_approve and v_points > 0 then
    -- Premio por proponer un lugar: lo decide el admin, así que no cuenta para el tope diario.
    insert into public.point_movements (customer_id, kind, points, ref_table, ref_id)
    values (v_place.submitted_by, 'community', v_points, 'places', v_place.id)
    on conflict (kind, ref_table, ref_id) where ref_id is not null do nothing;
  end if;
end;
$$;

create function public.admin_create_place(p_name text, p_category text, p_maps_url text, p_address text, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_admin();
  insert into public.places (name, category, maps_url, address, note, submitted_by, status, decided_at, decided_by)
  values (trim(p_name), p_category, nullif(trim(coalesce(p_maps_url, '')), ''),
          nullif(trim(coalesce(p_address, '')), ''), trim(coalesce(p_note, '')),
          auth.uid(), 'approved', now(), auth.uid())
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'duplicate_place' using errcode = 'P0001';
  when check_violation then
    raise exception 'invalid_place' using errcode = '22023';
end;
$$;

create function public.admin_reported_comments()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'body', c.body, 'place', p.name,
      'reports', (select count(*) from public.comment_reports r where r.comment_id = c.id),
      'created_at', c.created_at
    ) order by c.created_at)
    from public.place_comments c join public.places p on p.id = c.place_id
    where c.hidden and c.status = 'approved'
  ), '[]'::jsonb);
end;
$$;

-- p_keep = true: el comentario estaba bien (vuelve a mostrarse). false: se elimina.
create function public.admin_review_comment(p_comment uuid, p_keep boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_keep then
    update public.place_comments set hidden = false where id = p_comment;
    delete from public.comment_reports where comment_id = p_comment;
  else
    update public.place_comments set status = 'rejected', hidden = true where id = p_comment;
  end if;
end;
$$;

grant execute on function
  public.community_places(text), public.submit_place(text, text, text, text, text),
  public.toggle_place_like(uuid), public.place_comments_list(uuid), public.add_comment(uuid, text),
  public.toggle_comment_like(uuid), public.report_comment(uuid),
  public.admin_pending_places(), public.admin_review_place(uuid, boolean),
  public.admin_create_place(text, text, text, text, text),
  public.admin_reported_comments(), public.admin_review_comment(uuid, boolean)
to authenticated;
