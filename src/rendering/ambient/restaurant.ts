import { CircleGeometry, Group, Mesh, PlaneGeometry, Sprite, SpriteMaterial } from 'three'
import type { World } from '../../world/build.ts'
import { Rng } from '../../world/rng.ts'
import { makeGlowTexture } from '../geo/textures.ts'
import { anchorTo, basic, dist, frameOf, halfPlane, lit, toWorld, unitBox, unitPlane, type Ambient } from './common.ts'

/*
 * The cha chaan teng is open. Behind its glass (a flat, lit interior drawn by
 * the facade builder) there is now a ceiling fan turning slowly, a fluorescent
 * tube that stutters once in a while, and a cook behind the counter who
 * sometimes stirs or wipes. Steam leaks from a kitchen vent on the alley side.
 * No interaction, no collision, nothing the player can reach.
 */

const OH = 2.65
const NEAR = 55
const STEAM_PUFFS = 5

export function createRestaurant(world: World): Ambient {
  const root = new Group()
  const rng = new Rng('ambient:restaurant')
  const front = world.facades.find((s) => s.id === 'restaurant.2')
  const side = world.facades.find((s) => s.id === 'restaurant.3')
  if (!front || !side) return { object: root, update() {}, dispose() {} }

  const f = frameOf(front)
  const anchor = anchorTo(f)
  root.add(anchor)
  const [cx, cz] = toWorld(f, f.width / 2, 2)

  // ----- ceiling fan (seen edge-on: each blade's length shrinks as it turns) -----
  const fanX = 3.9
  const fanY = OH - 0.4
  const fan = new Group()
  fan.position.set(fanX, fanY, 0.056)
  const rod = new Mesh(unitBox, basic('#1c1713'))
  rod.scale.set(0.025, 0.2, 0.02)
  rod.position.set(0, 0.12, 0)
  const motor = new Mesh(unitBox, basic('#1c1713'))
  motor.scale.set(0.16, 0.09, 0.03)
  const blades = [0, 1, 2].map(() => {
    const b = new Mesh(halfPlane, basic('#2a211b'))
    b.scale.set(0.5, 0.045, 1)
    b.position.set(0, -0.06, 0.012)
    return b
  })
  fan.add(rod, motor, ...blades)
  anchor.add(fan)

  // ----- fluorescent tube -----
  const tubeMat = basic('#fbf4dc').clone()
  const tube = new Mesh(unitBox, tubeMat)
  tube.scale.set(1.15, 0.07, 0.02)
  tube.position.set(8.1, OH - 0.17, 0.056)
  anchor.add(tube)

  // ----- cook behind the counter -----
  const cook = new Group()
  cook.position.set(6.7, 0, 0.052)
  const dark = basic('#15100d')
  const torso = new Mesh(unitPlane, dark)
  torso.scale.set(0.46, 0.58, 1)
  torso.position.set(0, 1.3, 0)
  const apron = new Mesh(unitPlane, basic('#8d877a'))
  apron.scale.set(0.27, 0.34, 1)
  apron.position.set(0, 1.2, 0.002)
  const head = new Mesh(new CircleGeometry(0.115, 10), dark)
  head.position.set(0, 1.74, 0)
  const cap = new Mesh(unitPlane, basic('#b9b4a8'))
  cap.scale.set(0.24, 0.07, 1)
  cap.position.set(0, 1.83, 0.002)
  const armPivot = new Group()
  armPivot.position.set(0.22, 1.54, 0.003)
  const arm = new Mesh(new PlaneGeometry(0.1, 0.42).translate(0, -0.21, 0), dark)
  armPivot.add(arm)
  cook.add(torso, apron, head, cap, armPivot)
  anchor.add(cook)

  // ----- kitchen vent and steam, on the alley side -----
  const sf = frameOf(side)
  const sAnchor = anchorTo(sf)
  root.add(sAnchor)
  const vx = sf.width - 0.9
  const vent = new Mesh(unitBox, lit('#4a4e50'))
  vent.scale.set(0.5, 0.3, 0.3)
  vent.position.set(vx, 3.2, 0.17)
  const hood = new Mesh(unitBox, lit('#363a3c'))
  hood.scale.set(0.58, 0.05, 0.38)
  hood.position.set(vx, 3.38, 0.19)
  sAnchor.add(vent, hood)
  const [sx, sz] = toWorld(sf, vx, 0.55)
  const glow = makeGlowTexture()
  const puffs = Array.from({ length: STEAM_PUFFS }, (_, i) => {
    const material = new SpriteMaterial({ map: glow, color: '#d9d6cd', transparent: true, opacity: 0, depthWrite: false })
    const sprite = new Sprite(material)
    sprite.visible = false
    root.add(sprite)
    return { sprite, material, offset: i / STEAM_PUFFS, sway: rng.range(0, 6), drift: rng.range(-0.3, 0.3) }
  })

  // ----- timing -----
  let nextAction = 4
  let actionStart = -10
  let nextFlicker = 18
  let flickerUntil = 0

  return {
    object: root,
    update(time, _dt, p) {
      if (dist(p.x, p.z, cx, cz) > NEAR) {
        for (const q of puffs) q.sprite.visible = false
        return
      }

      // Fan: slow, 2.4 rad/s.
      const a = time * 2.4
      blades.forEach((b, i) => {
        b.scale.x = 0.5 * Math.cos(a + (i * Math.PI * 2) / 3)
      })

      // Cook: an occasional stir or wipe.
      if (time >= nextAction) {
        actionStart = time
        nextAction = time + rng.range(8, 17)
      }
      const t = time - actionStart
      const busy = t >= 0 && t < 2.6
      armPivot.rotation.z = busy ? -0.55 + Math.sin(t * 7.5) * 0.4 : -0.05
      head.position.x = busy ? Math.sin(t * 2.4) * 0.025 : 0
      cook.position.y = busy ? Math.abs(Math.sin(t * 7.5)) * 0.008 : 0

      // Tube: a short stutter now and then.
      if (time >= nextFlicker) {
        nextFlicker = time + rng.range(30, 60)
        flickerUntil = time + 0.5
      }
      const k = Math.floor((flickerUntil - time) * 16)
      tubeMat.color.set(time < flickerUntil && k % 3 !== 1 ? '#8f8a78' : '#fbf4dc')

      // Steam: a few soft puffs rising and thinning out along the wall.
      for (const q of puffs) {
        const u = (time * 0.16 + q.offset) % 1
        q.sprite.visible = true
        q.sprite.position.set(sx + sf.nx * 0.2 * u + Math.sin(time * 0.7 + q.sway) * 0.1 + q.drift * u, 3.5 + u * 1.7, sz + sf.nz * 0.2 * u)
        const size = 0.4 + u * 0.9
        q.sprite.scale.set(size, size, 1)
        q.material.opacity = 0.2 * Math.sin(Math.PI * u) ** 1.5
      }
    },
    dispose() {
      glow.dispose()
      for (const q of puffs) q.material.dispose()
      tubeMat.dispose()
    },
  }
}
