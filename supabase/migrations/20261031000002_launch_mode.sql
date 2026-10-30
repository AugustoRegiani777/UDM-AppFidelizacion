-- Lanzamiento: la app se abre al público y se entra solo con Google.
-- Se apagan los puntos de entrada del modo de prueba (los invitados ya no existen como puerta de entrada).
-- Los inicios de sesión anónimos se desactivan aparte, en el panel de Supabase (Authentication > Sign In / Providers).
update public.settings
   set value = '{"welcome_points": 0}'::jsonb
 where key = 'demo';
