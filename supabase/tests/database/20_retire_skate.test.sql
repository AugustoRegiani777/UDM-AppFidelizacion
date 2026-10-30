-- El skate sale del cofre: la configuración del cofre solo sortea "Sobreviví a las migas".
-- Las tablas y las partidas de skate ya jugadas no se tocan.
begin;
select plan(3);

select is(
  (select value -> 'games' from public.settings where key = 'chest_game'),
  '["survivors"]'::jsonb,
  'el cofre solo sortea survivors'
);
select is(
  (select value ->> 'grace_seconds' from public.settings where key = 'chest_game'),
  '300',
  'el resto de las reglas del cofre sigue igual'
);
select has_table('public', 'game_runs', 'las partidas oficiales (con las de skate ya jugadas) siguen en su tabla');

select * from finish();
rollback;
