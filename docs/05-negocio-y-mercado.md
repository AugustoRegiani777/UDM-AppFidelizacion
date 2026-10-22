# 05 · Negocio, clientes, marca y mercado

Este documento explica **para quién** es la app. Usalo para decidir textos, premios, juegos y prioridades.

## La tienda

- **Uno de Miga Valencia:** sandwichería y catering de sándwiches de miga al estilo argentino.
- **Ubicación:** Carrer Llop 1, a media cuadra del Ayuntamiento de Valencia. Zona céntrica y muy turística.
- **Edad:** abrió hace pocos meses. Es un negocio joven que todavía está construyendo su clientela.
- **Operación:** una sola persona maneja caja, producción y stock desde la tablet del POS.
- **Volumen:** unos 113 sándwiches por día, 8 variedades, más bollería y cafetería. Catálogo de unos 40 productos.
- **Gancho actual:** el ice caramel latte a 3 €, anunciado como el más barato del centro, es lo que más gente atrae hoy.
- **Canal de pedidos actual:** WhatsApp.
- **Foco de crecimiento:** el catering para oficinas, eventos y cumpleaños ("Las 3 Mesas": Oficina, Eventos, Cumpleaños).

## Los clientes (y qué significa cada uno para la app)

| Segmento                   | Cómo se comporta                                                            | Qué implica para la app                                                                                          |
| -------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Argentinos en Valencia** | Reconocen el producto y entran directo. Son el núcleo fiel.                 | Son los primeros usuarios. El humor y la identidad argentina les hablan directo.                                 |
| **Oficinas cercanas**      | Potencial de compra diaria (café, almuerzo) y de catering.                  | El premio del café y las rachas semanales son clave. Es el segmento donde la fidelización más rinde.             |
| **Españoles que pasan**    | Muchos pasan de largo porque no conocen la miga.                            | La app puede ser la excusa para probar: primera compra con sorpresa, álbum de sabores para descubrir variedades. |
| **Turistas**               | Les atrae el diseño del local, pero no suelen entrar, y casi nunca vuelven. | No son el objetivo de la fidelización. Igual, dejar la app preparada para inglés (i18n) sin traducir todo ahora. |

**Conclusión:** la app está hecha para el cliente que **vuelve**: argentinos, gente que trabaja en la zona y vecinos. Todo debe empujar a la segunda, tercera y décima visita.

## La marca

- **Voz:** cálida, informal, español rioplatense, con humor y emojis con medida. Cercana, como el que te atiende en el mostrador.
- **Paleta oficial:** crema y rojo.
- **Tipografía oficial:** bold y grande (Poppins Bold, Bebas Neue).
- **Existe un brandbook oficial.** Si está en `docs/marca/`, es la fuente de verdad: los colores exactos y las tipografías del brandbook **reemplazan** a los tokens de docs/04. Si no está, preguntar a Augusto los valores exactos antes de la fase de diseño y anotarlo en PENDIENTES-AUGUSTO.md.
- **Estética:** limpia y minimalista, tipografía grande, nada recargado. La diversión sale del movimiento, no del amontonamiento.
- Series de Instagram con las que la app puede conectar en textos o logros: "Lo Que Nos Hace" (cultura argentina) y "Nos Quedó en el Cuerpo" (recuerdos de eventos).

### Tono de los textos (ejemplos)

- Compra sumada: "¡Sumaste 62 puntos! Ya casi tenés tu miga 🥪"
- Premio desbloqueado: "Che, este café va por la casa ☕"
- Cliente nuevo: "Tu primera compra ya cuenta. Escaneá el QR de la caja."
- Error amable: "Uy, no encontramos esa compra todavía. Te la sumamos apenas aparezca."

## El mercado: cómo se hace la fidelización hoy (investigación, octubre 2026)

- **Nadie obliga a descargar una app.** Cada vez más consumidores rechazan bajar apps de restaurantes; las apps propias se borran rápido. Por eso esta es una **web instalable**.
- **Alta en segundos.** Los programas que funcionan piden lo mínimo (nombre y teléfono o email). Cada paso extra hace perder gente.
- **El personal de caja es clave.** El error más común es no involucrar a quien atiende. En Uno de Miga atiende una sola persona, así que todo lo que pase en la caja tiene que ser de **un toque**.
- **El Wallet crece en España.** Varias cadenas de restauración usan tarjetas en Apple/Google Wallet (proveedores como Cheerfy, Zerosix, Loyicard o Cegid Revo Intouch). Está planificado para una fase posterior.
- **Premios simples y alcanzables** funcionan mejor que esquemas de puntos confusos. El primer premio tiene que sentirse cerca.
- **Verificar teléfono cuesta dinero** (SMS o WhatsApp por mensaje). Por eso arrancamos con Google, que es gratis.

## Qué significa todo esto para las decisiones de la app

1. **El primer premio tiene que llegar rápido** (el café a 150 puntos va en esa línea). Si el primer logro tarda un mes, la gente abandona.
2. **Las rachas y el café diario** son el motor para las oficinas.
3. **El álbum de sabores** sirve para que los españoles descubran las 8 variedades.
4. **Copy en rioplatense con calidez,** respetando la voz de marca. Preparado para inglés más adelante.
5. **En caja, cero fricción:** el empleado solo gira la tablet o carga un código.
