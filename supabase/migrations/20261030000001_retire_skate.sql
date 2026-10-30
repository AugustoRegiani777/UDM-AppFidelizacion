-- Los juegos de skate salen de la sala y del cofre: el cofre solo sortea "Sobreviví a las migas".
-- No se borra nada: las tablas, las partidas y los rankings de skate ya jugados quedan intactos.
update public.settings
   set value = value || '{"games": ["survivors"]}'::jsonb
 where key = 'chest_game';
