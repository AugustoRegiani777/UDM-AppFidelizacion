-- Modelo de datos de la app de fidelización (docs/02).
-- Regla de oro: los puntos son un libro de movimientos (point_movements); el saldo se calcula.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  program_consent_at timestamptz,
  promo_consent boolean not null default false,
  promo_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  kind text not null check (kind in ('points', 'purchases')),
  threshold integer not null check (threshold > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  image_url text
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  sale_uuid uuid not null unique,
  status text not null check (status in ('pending', 'confirmed', 'rejected', 'reversed')),
  reject_reason text,
  sale_total_cents integer check (sale_total_cents >= 0),
  sale_at timestamptz,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index claims_customer_idx on public.claims (customer_id, created_at desc);
create index claims_pending_idx on public.claims (created_at) where status = 'pending';

create table public.point_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('purchase', 'redeem', 'game', 'adjustment', 'reversal')),
  points integer not null check (points <> 0),
  ref_table text,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index point_movements_customer_idx on public.point_movements (customer_id, created_at desc);
-- Un mismo origen no puede generar dos movimientos del mismo tipo (idempotencia).
create unique index point_movements_ref_uniq
  on public.point_movements (kind, ref_table, ref_id) where ref_id is not null;

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id),
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'used', 'expired')),
  points_spent integer not null default 0 check (points_spent >= 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index redemptions_customer_idx on public.redemptions (customer_id, created_at desc);
-- Un solo código activo por cliente y premio.
create unique index redemptions_one_active_uniq
  on public.redemptions (customer_id, reward_id) where status = 'active';

create table public.game_plays (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  game text not null,
  result jsonb not null default '{}'::jsonb,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);
create index game_plays_customer_idx on public.game_plays (customer_id, game, created_at desc);

-- Salida de eventos de saldo: un futuro worker de Wallet (Apple/Google) lee de acá.
create table public.balance_events (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  balance integer not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index balance_events_unprocessed_idx on public.balance_events (id) where processed_at is null;

-- Límite de ritmo por cliente y acción (claim-sale, play-game).
create table public.rate_limits (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (customer_id, action, window_start)
);
