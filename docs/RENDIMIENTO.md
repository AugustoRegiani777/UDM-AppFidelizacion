# Cómo probar el rendimiento en tu Android

Objetivo: animaciones fluidas (60 fps) en un Android de gama media.

## Lo que ya cuidamos

- Solo se animan `transform` y `opacity` (nunca ancho, alto ni sombras).
- Con "Reducir movimiento" activado en el celular, las animaciones pasan a fundidos simples y no hay confetti ni vibración.
- Confetti, escáner (jsQR) y las pantallas secundarias se descargan recién cuando se usan.

## Prueba paso a paso (sin conocimientos técnicos)

1. En la compu: `npm run dev:https`. La terminal muestra una dirección "Network", por ejemplo `https://192.168.1.20:5173`.
2. En el celular (mismo Wi-Fi) abrí esa dirección en Chrome. Va a avisar que el certificado no es de confianza: tocá "Avanzado" → "Continuar". Es solo para pruebas locales.
3. Entrá con el login por email de desarrollo. En la compu abrí `/dev` para crear ventas y mostrar el QR.
4. Probá: escanear el QR, ver el saldo contar hacia arriba, el confetti, abrir el regalo, canjear y ver el código "imprimirse".
5. Si algo se ve con tirones, activá en Chrome del celular: Ajustes → Opciones de desarrollador → "Mostrar uso de GPU / Perfil de renderizado" (si no ves esa opción, avisame qué modelo es).
6. Probalo también con "Quitar animaciones" activado (Ajustes → Accesibilidad): tiene que verse todo bien, sin movimiento.

## Para medir en la compu

Chrome → F12 → pestaña "Performance" → botón de grabar → hacé la acción → detené. Buscá barras rojas de "Long task" o cuadros por debajo de 60 fps. En "Rendering" activá "Frame Rendering Stats".
