import { AdditiveBlending, Color, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three'
import { ambientAudio } from '../../audio/ambient.ts'
import { attenuate } from '../../audio/zones.ts'
import type { World } from '../../world/build.ts'
import type { Vec2 } from '../../world/geometry2d.ts'
import { Rng } from '../../world/rng.ts'
import { makeGlowTexture } from '../geo/textures.ts'
import { anchorTo, basic, canvasTexture, dist, frameOf, hiddenFrom, lit, roundCorners, toWorld, unitBox, type Ambient, type PlayerPose } from './common.ts'

/*
 * Two one-time city events, both proximity triggered and both short.
 *
 *  A. A roller shutter on Shun Hing Street rises and shows a dimly lit shop.
 *  B. A delivery van comes down Ching Wan Road, turns onto Hoi Pong Road, then
 *     off into Chung Wo Street. It slows and waits if the player is near it.
 *
 * Neither does anything to gameplay, and neither runs again.
 */

const OH = 2.65
const SLATS = 17

// ---------------------------------------------------------------- A. shutter

const SHUTTER_FACADE = 'F2.6'
const SHUTTER_RANGE = 30
const SHUTTER_SECONDS = 3.5
const SHUTTER_DELAY = 1.2

function shopTexture(rng: Rng) {
  return canvasTexture([64, 64], (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#d9a85f')
    g.addColorStop(1, '#8e6535')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const products = ['#a4423b', '#4f7a5c', '#c9b66e', '#5a7fa0', '#d8d2c0', '#7a4f3a']
    for (let row = 0; row < 4; row++) {
      const y = 8 + row * 13
      ctx.fillStyle = '#3a2a1c'
      ctx.fillRect(0, y + 8, w, 2)
      let x = 2
      while (x < w - 4) {
        const bw = rng.int(4, 8)
        ctx.fillStyle = products[rng.int(0, products.length - 1)]
        ctx.fillRect(x, y + 8 - rng.int(4, 7), bw, 7)
        x += bw + rng.int(1, 3)
      }
    }
    // A counter and a dark figure-shaped shadow of a shop owner.
    ctx.fillStyle = '#2a1e14'
    ctx.fillRect(0, 54, w, 10)
  })
}

function createShutter(world: World): Ambient & { centre: Vec2 } {
  const root = new Group()
  const spec = world.facades.find((s) => s.id === SHUTTER_FACADE)
  if (!spec) return { object: root, update() {}, dispose() {}, centre: [0, 0] }
  const f = frameOf(spec)
  const x0 = spec.ground.door === 'left' ? 2.0 : 0.4
  const x1 = spec.ground.door === 'right' ? f.width - 2.0 : f.width - 0.4
  const anchor = anchorTo(f)
  root.add(anchor)

  const rng = new Rng('ambient:shutter')
  const texture = shopTexture(rng)
  const shop = new Mesh(new PlaneGeometry(x1 - x0, OH - 0.1), new MeshBasicMaterial({ map: texture, color: '#9a9a9a', side: DoubleSide }))
  shop.position.set((x0 + x1) / 2, (OH + 0.1) / 2, 0.086)
  anchor.add(shop)

  const glowTexture = makeGlowTexture()
  const poolMaterial = new MeshBasicMaterial({ map: glowTexture, color: '#000000', blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const pool = new Mesh(new PlaneGeometry(x1 - x0, 3.6), poolMaterial)
  pool.rotation.x = -Math.PI / 2
  pool.position.set((x0 + x1) / 2, 0.05, 2.0)
  anchor.add(pool)

  const slatMaterial = lit('#ffffff')
  const slats = new InstancedMesh(unitBox, slatMaterial, SLATS)
  slats.frustumCulled = false
  const base = new Color(spec.ground.shutterColor)
  const tint = new Color()
  const rise = new Object3D()
  const h = OH / SLATS
  for (let i = 0; i < SLATS; i++) {
    const dirt = 0.62 + 0.38 * Math.min(1, (i * h + 0.4) / 1.8)
    tint.copy(base).multiplyScalar((i % 2 === 0 ? 1 : 0.92) * dirt * 1.05)
    slats.setColorAt(i, tint)
  }
  anchor.add(slats)

  const layout = (lift: number) => {
    for (let i = 0; i < SLATS; i++) {
      const y = i * h + lift
      rise.position.set((x0 + x1) / 2, y + h / 2, 0.095)
      // Slats that have gone up into the housing are hidden behind the header.
      rise.scale.set(x1 - x0, y > OH - 0.02 ? 0 : h - 0.012, 0.03)
      rise.updateMatrix()
      slats.setMatrixAt(i, rise.matrix)
    }
    slats.instanceMatrix.needsUpdate = true
  }
  layout(0)

  const centre = toWorld(f, (x0 + x1) / 2, 1)
  let state: 'idle' | 'waiting' | 'opening' | 'done' = 'idle'
  let clock = 0
  const glowColor = new Color('#5c4126')

  return {
    object: root,
    centre,
    update(_time, dt, p) {
      if (state === 'done') return
      if (state === 'idle') {
        const d = dist(p.x, p.z, centre[0], centre[1])
        if (d < SHUTTER_RANGE && d > 5) {
          state = 'waiting'
          clock = 0
        }
        return
      }
      clock += dt
      if (state === 'waiting') {
        if (clock < SHUTTER_DELAY) return
        state = 'opening'
        clock = 0
        ambientAudio.playAt('shutterRise', dist(p.x, p.z, centre[0], centre[1]), 50, 0.9, 1, 3000)
      }
      const u = Math.min(1, clock / SHUTTER_SECONDS)
      // Hand-cranked: a stuttering rise that slows towards the top.
      const eased = 1 - (1 - u) ** 1.6
      const stutter = Math.floor(eased * 18) / 18 * 0.55 + eased * 0.45
      layout(stutter * (OH + 0.1))
      poolMaterial.color.copy(glowColor).multiplyScalar(Math.min(1, stutter * 1.3))
      if (u >= 1) state = 'done'
    },
    dispose() {
      texture.dispose()
      glowTexture.dispose()
      shop.geometry.dispose()
      ;(shop.material as MeshBasicMaterial).dispose()
      pool.geometry.dispose()
      poolMaterial.dispose()
      slats.dispose()
    },
  }
}

// ---------------------------------------------------------------- B. van

const VAN_SPEED = 7
const VAN_YIELD = 9

function createVan(world: World): Ambient {
  const root = new Group()
  const node = (id: string): Vec2 => world.nodes.get(id)!.at
  const mix = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

  // Southern lane of the trunk road, at the two side-street mouths.
  const tw = node('TW')
  const te = node('TE')
  const len = dist(tw[0], tw[1], te[0], te[1])
  const south: Vec2 = [-(te[1] - tw[1]) / len, (te[0] - tw[0]) / len]
  const lane = (id: string): Vec2 => [node(id)[0] + south[0] * 3.6, node(id)[1] + south[1] * 3.6]
  const j4 = node('J4')
  const j3 = node('J3')
  const raw: Vec2[] = [mix(node('E3'), node('E2'), 0.4), node('E2'), node('M5'), mix(node('M5'), lane('T5'), 0.9), lane('T5'), lane('T4'), mix(lane('T4'), j4, 0.55), j4, mix(j4, j3, 0.45)]
  const path = roundCorners(raw, 5, 2)
  const cumulative: number[] = [0]
  for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + dist(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]))
  const total = cumulative[cumulative.length - 1]

  // A box van: dirty white body, dark glass, wheels, lamps.
  const van = new Group()
  const box = (w: number, h: number, d: number, material: Mesh['material'], x: number, y: number, z: number) => {
    const m = new Mesh(unitBox, material)
    m.scale.set(w, h, d)
    m.position.set(x, y, z)
    van.add(m)
    return m
  }
  box(1.9, 1.75, 2.8, lit('#b8b5a6'), 0, 1.35, -0.7)
  box(1.9, 1.2, 1.3, lit('#9fa297'), 0, 1.1, 1.35)
  box(1.7, 0.5, 0.05, basic('#1b2229'), 0, 1.45, 2.02)
  box(1.93, 0.18, 2.6, lit('#7a2f2a'), 0, 0.82, -0.7)
  for (const x of [-0.98, 0.98]) for (const z of [-1.4, 1.35]) box(0.2, 0.6, 0.6, lit('#17181a'), x, 0.3, z)
  for (const x of [-0.65, 0.65]) {
    box(0.22, 0.14, 0.05, basic('#ffe2a0'), x, 0.85, 2.03)
    box(0.18, 0.14, 0.05, basic('#a02a24'), x, 0.95, -2.12)
  }
  const glowTexture = makeGlowTexture()
  const beamMaterial = new MeshBasicMaterial({ map: glowTexture, color: '#6b5a3a', blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const beam = new Mesh(new PlaneGeometry(3.2, 6), beamMaterial)
  beam.rotation.x = -Math.PI / 2
  beam.position.set(0, 0.06, 5.2)
  van.add(beam)
  van.visible = false
  root.add(van)

  let state: 'idle' | 'waiting' | 'driving' | 'done' = 'idle'
  let s = 0
  let speed = 0
  let waitCheck = 0
  const trigger: Vec2 = mix(node('T4'), node('T5'), 0.5)

  const place = () => {
    let i = 1
    while (i < cumulative.length - 1 && cumulative[i] < s) i++
    const a = path[i - 1]
    const b = path[i]
    const t = (s - cumulative[i - 1]) / Math.max(1e-6, cumulative[i] - cumulative[i - 1])
    van.position.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t)
    van.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1])
  }

  return {
    object: root,
    update(_time, dt, p: PlayerPose) {
      if (state === 'idle') {
        if (dist(p.x, p.z, trigger[0], trigger[1]) < 60) state = 'waiting'
      } else if (state === 'waiting') {
        waitCheck -= dt
        if (waitCheck > 0) return
        waitCheck = 0.4
        const start = path[0]
        if (dist(p.x, p.z, start[0], start[1]) > 30 && hiddenFrom(world, p, start[0], start[1])) {
          state = 'driving'
          van.visible = true
          place()
        }
      } else if (state === 'driving') {
        const d = dist(p.x, p.z, van.position.x, van.position.z)
        // Slow to a stop for a player who is close, otherwise cruise.
        const goal = d < VAN_YIELD ? 0 : VAN_SPEED
        speed += Math.max(-9 * dt, Math.min(2.5 * dt, goal - speed))
        s += speed * dt
        if (s >= total) {
          state = 'done'
          van.visible = false
          ambientAudio.setVehicle(0)
          return
        }
        place()
        ambientAudio.setVehicle(attenuate(d, 95) * (speed / VAN_SPEED))
      }
    },
    dispose() {
      glowTexture.dispose()
      beamMaterial.dispose()
      beam.geometry.dispose()
      ambientAudio.setVehicle(0)
    },
  }
}

export function createEvents(world: World): Ambient {
  const root = new Group()
  const parts = [createShutter(world), createVan(world)]
  for (const p of parts) root.add(p.object)
  return {
    object: root,
    update: (time, dt, p) => parts.forEach((q) => q.update(time, dt, p)),
    dispose: () => parts.forEach((q) => q.dispose()),
  }
}
