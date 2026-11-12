// Vocabulario de gestos de "Miga Skate": lo que el control tactil (touchController.ts) le pide a la
// fisica (skatePhysics.ts). Solo tipos y constantes de la tabla; no hay logica aca.

export type GrabName = 'indy' | 'melon' | 'nose' | 'tail'

export type Gesture =
  /** Salto: deslizar en la cola (o del centro hacia la cola). `nollie` = salto desde la nariz. */
  | { k: 'ollie'; power: number; nollie: boolean }
  /** Pop shove-it: salto con giro de la tabla sobre Y. */
  | { k: 'popShuvit'; power: number; dir: 1 | -1; nollie: boolean }
  /** Kickflip (dir 1) o heelflip (dir -1): torque en el eje local Z. */
  | { k: 'flip'; power: number; dir: 1 | -1 }
  /** Shove-it: torque en el eje local Y (dir 1 = la cola se va hacia la derecha de la pantalla). */
  | { k: 'shuvit'; power: number; dir: 1 | -1 }
  /** Giro del cuerpo (180 / 360) en el aire; sobre un riel cambia entre 50-50 y boardslide. */
  | { k: 'spin'; power: number; dir: 1 | -1 }
  /** Empujon del segundo dedo: acelera. */
  | { k: 'push'; power: number }
  | { k: 'grab'; name: GrabName }
  | { k: 'grabEnd' }
  | { k: 'manual'; nose: boolean }
  | { k: 'manualEnd' }
  /** Dedo apoyado sobre la tabla en el aire: angularDrag alto y nivelacion. */
  | { k: 'catch' }
  | { k: 'catchEnd' }

/** Tabla: 0.82 m de largo, 0.22 m de ancho. */
export const BOARD_HALF_LENGTH = 0.41
export const BOARD_HALF_WIDTH = 0.11
