-- RLS en todas las tablas. El cliente solo lee lo suyo; no escribe nada directamente.

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.rewards enable row level security;
alter table public.claims enable row level security;
alter table public.point_movements enable row level security;
alter table public.redemptions enable row level security;
alter table public.game_plays enable row level security;
alter table public.balance_events enable row level security;
alter table public.rate_limits enable row level security;

-- Partimos de cero: sin privilegios para los roles de la API.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles, public.claims, public.point_movements,
  public.redemptions, public.game_plays to authenticated;
grant select on public.rewards, public.settings to anon, authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy claims_select_own on public.claims
  for select to authenticated using (customer_id = (select auth.uid()));
create policy point_movements_select_own on public.point_movements
  for select to authenticated using (customer_id = (select auth.uid()));
create policy redemptions_select_own on public.redemptions
  for select to authenticated using (customer_id = (select auth.uid()));
create policy game_plays_select_own on public.game_plays
  for select to authenticated using (customer_id = (select auth.uid()));
create policy rewards_select_active on public.rewards
  for select to anon, authenticated using (active);
create policy settings_select_public on public.settings
  for select to anon, authenticated using (is_public);

-- balance_events y rate_limits: RLS activo y sin políticas = solo service role.

-- El libro de movimientos es solo de inserción, ni siquiera para el service role.
revoke update, delete on public.point_movements from service_role;

-- Lo que se cree más adelante en public tampoco se abre solo a la API.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- PUBLIC tiene EXECUTE por defecto en toda función nueva; hay que sacarlo fuera del schema.
-- Cada función que el cliente pueda llamar se habilita a mano con un grant explícito.
alter default privileges for role postgres revoke execute on functions from public;
