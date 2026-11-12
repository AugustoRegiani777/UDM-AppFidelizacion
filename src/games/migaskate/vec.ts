// Matematica minima de vectores y cuaterniones para el motor de "Miga Skate". Sin three.js ni DOM: asi
// el nucleo fisico corre igual en Vitest, en el navegador y en cualquier worker.
// Convencion (la misma de three.js): mano derecha, Y arriba, el frente de la tabla es +Z.

export interface V3 {
  x: number
  y: number
  z: number
}

export interface Q {
  x: number
  y: number
  z: number
  w: number
}

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z })
export const vAdd = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const vSub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
export const vScale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
export const vDot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z
export const vCross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
export const vLen = (a: V3) => Math.hypot(a.x, a.y, a.z)
export const vNorm = (a: V3): V3 => {
  const l = vLen(a)
  return l < 1e-9 ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l }
}
export const vLerp = (a: V3, b: V3, t: number): V3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
})

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const TAU = Math.PI * 2

/** Lleva un angulo al rango (-PI, PI]. */
export const wrapPi = (a: number) => {
  let r = (a + Math.PI) % TAU
  if (r < 0) r += TAU
  return r - Math.PI
}

export const qIdentity = (): Q => ({ x: 0, y: 0, z: 0, w: 1 })

export function qMul(a: Q, b: Q): Q {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

export const qConj = (q: Q): Q => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w })

export function qNormalize(q: Q): Q {
  const l = Math.hypot(q.x, q.y, q.z, q.w)
  return l < 1e-12 ? qIdentity() : { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l }
}

export function qFromAxisAngle(axis: V3, angle: number): Q {
  const n = vNorm(axis)
  const s = Math.sin(angle / 2)
  return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(angle / 2) }
}

/** Rota un vector local a mundo (Transform.TransformDirection de Unity). */
export function qRotate(q: Q, v: V3): V3 {
  // v' = v + 2w(q x v) + 2 q x (q x v)
  const tx = 2 * (q.y * v.z - q.z * v.y)
  const ty = 2 * (q.z * v.x - q.x * v.z)
  const tz = 2 * (q.x * v.y - q.y * v.x)
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  }
}

/** Lleva un vector de mundo a local (Transform.InverseTransformDirection de Unity). */
export const qInvRotate = (q: Q, v: V3): V3 => qRotate(qConj(q), v)

/** Integra una velocidad angular de mundo `w` durante `dt` (q' = q + 0.5 * (0,w) * q * dt). */
export function qIntegrate(q: Q, w: V3, dt: number): Q {
  const h = 0.5 * dt
  const dq = qMul({ x: w.x, y: w.y, z: w.z, w: 0 }, q)
  return qNormalize({ x: q.x + dq.x * h, y: q.y + dq.y * h, z: q.z + dq.z * h, w: q.w + dq.w * h })
}

/** Cuaternion de la rotacion mas corta que lleva el vector `a` al `b` (ambos unitarios). */
export function qFromUnitVectors(a: V3, b: V3): Q {
  const d = vDot(a, b)
  if (d > 0.999999) return qIdentity()
  if (d < -0.999999) {
    const axis = Math.abs(a.x) < 0.9 ? vCross(a, v3(1, 0, 0)) : vCross(a, v3(0, 1, 0))
    return qFromAxisAngle(axis, Math.PI)
  }
  const c = vCross(a, b)
  return qNormalize({ x: c.x, y: c.y, z: c.z, w: 1 + d })
}

export function qSlerp(a: Q, b: Q, t: number): Q {
  let bx = b.x
  let by = b.y
  let bz = b.z
  let bw = b.w
  let cos = a.x * bx + a.y * by + a.z * bz + a.w * bw
  if (cos < 0) {
    cos = -cos
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }
  if (cos > 0.9995) {
    return qNormalize({
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    })
  }
  const theta = Math.acos(cos)
  const sin = Math.sin(theta)
  const wa = Math.sin((1 - t) * theta) / sin
  const wb = Math.sin(t * theta) / sin
  return {
    x: a.x * wa + bx * wb,
    y: a.y * wa + by * wb,
    z: a.z * wa + bz * wb,
    w: a.w * wa + bw * wb,
  }
}

/** Rotacion de la tabla con el frente (+Z local) hacia `forward` (horizontal) y el arriba hacia `up`. */
export function qLookUp(forward: V3, up: V3): Q {
  const u = vNorm(up)
  let f = vSub(forward, vScale(u, vDot(forward, u)))
  if (vLen(f) < 1e-6) f = Math.abs(u.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0)
  f = vNorm(f)
  const x = vCross(u, f) // +X local = arriba x frente
  // Matriz con columnas (x, u, f) a cuaternion.
  const m00 = x.x
  const m10 = x.y
  const m20 = x.z
  const m01 = u.x
  const m11 = u.y
  const m21 = u.z
  const m02 = f.x
  const m12 = f.y
  const m22 = f.z
  const tr = m00 + m11 + m22
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    return qNormalize({ w: 0.25 * s, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s })
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    return qNormalize({ w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s })
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    return qNormalize({ w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s })
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2
  return qNormalize({ w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s })
}

/** Giro (yaw) de un vector horizontal: 0 = hacia +Z, crece hacia la izquierda (hacia +X). */
export const yawOf = (x: number, z: number) => Math.atan2(x, z)
