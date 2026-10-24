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

-- Usuario de prueba para desarrollo (login por email): augusto@unodemiga.test / miga1234.
-- Ya pasó la bienvenida y es administrador, así se puede probar todo sin registrarse.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'augusto@unodemiga.test',
  extensions.crypt('miga1234', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{"full_name": "Augusto"}', now(), now(),
  '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), 'dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001',
  jsonb_build_object('sub', 'dddddddd-0000-4000-8000-000000000001', 'email', 'augusto@unodemiga.test'),
  'email', now(), now(), now()
) on conflict do nothing;

update public.profiles set program_consent_at = now(), is_admin = true
 where id = 'dddddddd-0000-4000-8000-000000000001';

select public.schedule_google_sync('http://kong:8000/functions/v1/sync-google-reviews', 'dev-secret-reconcile');
