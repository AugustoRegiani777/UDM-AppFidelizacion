-- Economía de puntos (docs/06): la escala se calibra con la tarjeta de papel del local.
--   Tarjeta: 5 compras = 1 café, 10 compras = 1 sanguche, ticket promedio 8 EUR.
--   Acá:     10 puntos por euro  ->  ticket de 8 EUR = 80 puntos
--            café cada 400 puntos (~5 compras), sanguche cada 800 (~10 compras).
-- Todo sigue siendo configurable desde las tablas settings y rewards.

update public.settings set value = '10' where key = 'points_per_euro';

update public.rewards set threshold = 400
  where kind = 'points' and name = 'Un café';
update public.rewards set threshold = 800
  where kind = 'points' and name = 'Un sanguche de miga';
update public.rewards set threshold = 2500
  where kind = 'points' and name = 'Gorra Uno de Miga';
