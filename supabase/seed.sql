-- Datos SOLO de desarrollo (supabase db reset). Nunca se aplica en producción.

-- Ventas falsas del POS para probar todos los casos con POS_MODE=mock (docs/03).
create table if not exists public.dev_mock_sales (
  uuid uuid primary key default gen_random_uuid(),
  total_cents integer not null,
  sold_at timestamptz not null default now(),
  voided boolean not null default false,
  channel text not null default 'local' check (channel in ('local', 'glovo', 'togoo')),
  -- La venta "aparece" recién cuando visible_from <= now() (simula la tablet offline).
  visible_from timestamptz not null default now()
);
alter table public.dev_mock_sales enable row level security;
revoke all on public.dev_mock_sales from anon, authenticated;

insert into public.dev_mock_sales (uuid, total_cents, sold_at, voided, channel, visible_from) values
  ('00000000-0000-4000-8000-000000000001', 6200, now(), false, 'local', now()),
  ('00000000-0000-4000-8000-000000000002', 4500, now(), true, 'local', now()),
  ('00000000-0000-4000-8000-000000000003', 3000, now(), false, 'glovo', now()),
  ('00000000-0000-4000-8000-000000000004', 2800, now(), false, 'togoo', now()),
  ('00000000-0000-4000-8000-000000000005', 5000, now() - interval '3 days', false, 'local', now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000006', 1240, now(), false, 'local', now() + interval '10 years')
on conflict do nothing;

-- Reconciliación local: pg_cron llama a la Edge Function por la red interna de Docker.
select public.schedule_reconcile('http://kong:8000/functions/v1/reconcile', 'dev-secret-reconcile');
