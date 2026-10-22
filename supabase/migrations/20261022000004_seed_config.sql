-- Configuración y premios iniciales (docs/01). Se aplica también en producción;
-- se edita después desde el panel de Supabase (tablas settings y rewards).

insert into public.settings (key, value, is_public) values
  ('points_per_euro', '1', true),
  ('claim_window_hours', '2', true),
  ('redeem_code_minutes', '15', true),
  ('excluded_channels', '["glovo", "togoo"]', false),
  ('timezone', '"Europe/Madrid"', false)
on conflict (key) do nothing;

insert into public.rewards (name, description, kind, threshold, sort_order) values
  ('Un café', 'Un café a elección, va por la casa.', 'points', 150, 1),
  ('Un sanguche de miga', 'El sanguche de miga que quieras.', 'points', 300, 2),
  ('Gorra Uno de Miga', 'La gorra oficial para llevar la miga puesta.', 'points', 1000, 3),
  ('Media docena de migas', 'Seis sanguchitos de miga, cada 50 compras.', 'purchases', 50, 4);
