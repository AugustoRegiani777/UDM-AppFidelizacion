import { RigidBody } from './rigidbody.ts'
import { qFromAxisAngle, qIdentity, qRotate, v3, vLen } from './vec.ts'

const make = () =>
  new RigidBody({
    mass: 4,
    inertia: v3(0.28, 0.3, 0.05),
    comLocal: v3(0, -0.05, 0),
    linearDrag: 0,
    angularDrag: 0,
  })

describe('cuerpo rigido', () => {
  it('cae con la gravedad aplicada como fuerza (v = g t)', () => {
    const b = make()
    b.setPose(v3(0, 10, 0), qIdentity())
    for (let i = 0; i < 120; i++) {
      b.addForce(v3(0, -4 * 10, 0))
      b.integrate(1 / 120)
    }
    expect(b.velocity.y).toBeCloseTo(-10, 6)
    expect(b.origin.y).toBeCloseTo(10 - 5 - 0.5 * 10 * (1 / 120), 1)
  })

  it('el origen sale del centro de masa y de la orientacion (com desplazado -0.05 en Y)', () => {
    const b = make()
    b.setPose(v3(1, 2, 3), qFromAxisAngle(v3(0, 0, 1), Math.PI))
    expect(b.com.y).toBeCloseTo(2.05, 9) // dado vuelta, el centro de masa queda arriba
    expect(b.origin.x).toBeCloseTo(1, 9)
    expect(b.origin.y).toBeCloseTo(2, 9)
  })

  it('una fuerza fuera del centro de masa genera torque; una fuerza en el centro no', () => {
    const b = make()
    b.setPose(v3(0, 0, 0), qIdentity())
    b.addForceAtPoint(v3(0, 10, 0), b.toWorld(v3(0, -0.05, 0)))
    b.integrate(0.01)
    expect(vLen(b.angularVelocity)).toBeLessThan(1e-9)
    const c = make()
    c.setPose(v3(0, 0, 0), qIdentity())
    c.addForceAtPoint(v3(0, 10, 0), c.toWorld(v3(0, -0.05, 0.27)))
    c.integrate(0.01)
    // Empujar hacia arriba delante del centro de masa levanta la nariz: giro negativo sobre X.
    expect(c.angularVelocity.x).toBeLessThan(0)
  })

  it('AddRelativeTorque gira sobre los ejes locales y el impulso angular divide por la inercia', () => {
    const b = make()
    b.setPose(v3(0, 0, 0), qFromAxisAngle(v3(0, 1, 0), Math.PI / 2))
    b.addRelativeAngularImpulse(v3(0, 0, 0.05 * 7))
    // Z local apunta a +X en el mundo: la velocidad angular de mundo va por +X con 7 rad/s.
    expect(b.angularVelocity.x).toBeCloseTo(7, 9)
    expect(b.localAngularVelocity.z).toBeCloseTo(7, 9)
  })

  it('el angularDrag apaga la rotacion mas rapido cuanto mas alto', () => {
    const spin = (drag: number) => {
      const b = make()
      b.angularDrag = drag
      b.setPose(v3(0, 0, 0), qIdentity())
      b.angularVelocity = v3(0, 0, 10)
      for (let i = 0; i < 60; i++) b.integrate(1 / 120)
      return b.angularVelocity.z
    }
    expect(spin(20)).toBeLessThan(spin(0.4) * 0.1)
    expect(spin(0)).toBeCloseTo(10, 9)
  })

  it('InverseTransformDirection y TransformDirection son inversas', () => {
    const b = make()
    b.setPose(v3(0, 0, 0), qFromAxisAngle(v3(1, 2, 3), 1.1))
    const w = v3(0.3, -2, 5)
    const back = b.toWorldDirection(b.toLocalDirection(w))
    expect(back.x).toBeCloseTo(w.x, 9)
    expect(back.y).toBeCloseTo(w.y, 9)
    expect(back.z).toBeCloseTo(w.z, 9)
    expect(vLen(qRotate(b.rotation, v3(0, 0, 1)))).toBeCloseTo(1, 9)
  })

  it('interpola la pose entre el paso anterior y el actual', () => {
    const b = make()
    b.setPose(v3(0, 0, 0), qIdentity())
    b.velocity = v3(0, 0, 6)
    b.snapshot()
    b.integrate(0.1)
    expect(b.interpolated(0).position.z).toBeCloseTo(0, 9)
    expect(b.interpolated(1).position.z).toBeCloseTo(0.6, 9)
    expect(b.interpolated(0.5).position.z).toBeCloseTo(0.3, 9)
  })

  it('el cuaternion se mantiene unitario tras muchos pasos', () => {
    const b = make()
    b.setPose(v3(0, 0, 0), qIdentity())
    b.angularVelocity = v3(7, -9, 13)
    for (let i = 0; i < 5000; i++) b.integrate(1 / 120)
    const q = b.rotation
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 9)
  })
})
