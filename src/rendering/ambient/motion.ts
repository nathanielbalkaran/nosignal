import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { World } from '../../world/build.ts'
import type { FacadeSpec } from '../../world/facades.ts'
import { Rng } from '../../world/rng.ts'
import { anchorTo, basic, canvasTexture, dist, frameOf, lit, toWorld, unitBox, type Ambient } from './common.ts'

/*
 * Small, separate bits of movement on the street: a few wall fans in the
 * backstreets, shop signs swinging a little on the commercial streets, and two
 * shops with a tired fluorescent tube. Everything is a handful of meshes,
 * animated by transform or colour only, and only while the player is near.
 */

/** Streets with an exhaust fan on one wall, at most one per street. */
const FAN_STREETS = ['po-sin-lane', 'hing-wah-alley', 'fuk-tai-alley', 'tak-shing-alley', 'kam-fung-south', 'fuk-wing-lane', 'lung-hing-alley', 'man-yuen-alley', 'cheung-fat-lane', 'tung-lok-street']
/** Streets that carry swinging shop signs, and how many. */
const SIGN_STREETS: readonly (readonly [string, number])[] = [
  ['shun-hing-street', 3],
  ['kam-fung-market', 1],
  ['shun-hing-west', 2],
  ['chung-wo-street', 1],
  ['ching-wan-road', 1],
]
const NEAR = 70
const FLICKER_SHOPS = ['F14.0', 'OUTER.54']

const OH = 2.65

function pickFacade(world: World, streetId: string, rng: Rng, ok: (s: FacadeSpec) => boolean): FacadeSpec | null {
  const pool = world.facades.filter((s) => s.streetId === streetId && s.source !== 'restaurant' && s.source !== 'corner-building' && s.width > 3.6 && ok(s))
  return pool.length ? rng.pick(pool) : null
}

const SIGN_COLORS = ['#a4423b', '#2f6b69', '#c9a84e', '#38587c', '#cbbf9c'] as const

function signTexture(color: string) {
  return canvasTexture([32, 64], (ctx, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(20,20,20,0.7)'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, w - 4, h - 4)
    // Three blocks of dark "characters", stacked.
    ctx.fillStyle = 'rgba(25,22,20,0.82)'
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(8, 8 + i * 17, 16, 12)
      ctx.clearRect(11, 11 + i * 17, 4, 3)
      ctx.fillStyle = 'rgba(25,22,20,0.82)'
    }
  })
}

export function createMotion(world: World): Ambient {
  const root = new Group()
  const rng = new Rng('ambient:motion')

  // ----- wall fans -----
  const fans: { x: number; y: number; z: number; yaw: number; speed: number; phase: number }[] = []
  for (const id of FAN_STREETS) {
    const s = pickFacade(world, id, rng, (f) => !f.fascia && f.vertical.length === 0 && f.ground.kind !== 'entranceOnly')
    if (!s) continue
    const f = frameOf(s)
    const lx = rng.range(1, f.width - 1)
    const [wx, wz] = toWorld(f, lx, 0.14)
    fans.push({ x: wx, y: 3.75, z: wz, yaw: f.yaw, speed: rng.range(1.6, 4.2) * rng.sign(), phase: rng.range(0, 6) })
  }
  const plates = new InstancedMesh(unitBox, lit('#3a3e40'), fans.length)
  const bladeGeo = mergeGeometries([new BoxGeometry(0.46, 0.06, 0.02), new BoxGeometry(0.46, 0.06, 0.02).rotateZ(Math.PI / 2)])
  const blades = new InstancedMesh(bladeGeo, lit('#8e9390'), fans.length)
  const dummy = new Object3D()
  fans.forEach((f, i) => {
    dummy.position.set(f.x, f.y, f.z)
    dummy.rotation.set(0, f.yaw, 0, 'YXZ')
    dummy.scale.set(0.58, 0.58, 0.1)
    dummy.updateMatrix()
    plates.setMatrixAt(i, dummy.matrix)
  })
  const mat4 = new Matrix4()
  const pos = new Vector3()
  const placeBlade = (i: number, angle: number) => {
    const f = fans[i]
    // Blades sit a little in front of the plate.
    pos.set(0, 0, 0.07).applyMatrix4(mat4.makeRotationY(f.yaw))
    dummy.position.set(f.x + pos.x, f.y, f.z + pos.z)
    dummy.rotation.set(0, f.yaw, angle, 'YXZ')
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    blades.setMatrixAt(i, dummy.matrix)
  }
  fans.forEach((f, i) => placeBlade(i, f.phase))
  plates.frustumCulled = false
  blades.frustumCulled = false
  root.add(plates, blades)

  // ----- swinging signs -----
  const signs: { pivot: Group; amp: number; period: number; phase: number; x: number; z: number }[] = []
  const textures = SIGN_COLORS.map(signTexture)
  const signMats = textures.map((t) => new MeshBasicMaterial({ map: t, color: '#c4c4c4' }))
  for (const [id, count] of SIGN_STREETS) {
    for (let n = 0; n < count; n++) {
      const s = pickFacade(world, id, rng, (f) => f.vertical.length === 0 && f.ground.kind !== 'entranceOnly' && !signs.some((q) => Math.hypot(q.x - f.a[0], q.z - f.a[1]) < 10))
      if (!s) continue
      const f = frameOf(s)
      const lx = rng.range(1.2, f.width - 1.2)
      const anchor = anchorTo(f)
      const pivot = new Group()
      pivot.position.set(lx, 4.15, 0.02)
      const rod = new Mesh(unitBox, basic('#2a2c2e'))
      rod.scale.set(0.04, 0.04, 0.62)
      rod.position.set(0, 0, 0.31)
      const panel = new Mesh(unitBox, signMats[rng.int(0, signMats.length - 1)])
      panel.scale.set(0.05, 1.05, 0.5)
      panel.position.set(0, -0.62, 0.36)
      pivot.add(rod, panel)
      anchor.add(pivot)
      root.add(anchor)
      const [wx, wz] = toWorld(f, lx, 0)
      signs.push({ pivot, amp: rng.range(0.035, 0.08), period: rng.range(4.6, 8.2), phase: rng.range(0, 6.28), x: wx, z: wz })
    }
  }

  // ----- fluorescent tubes -----
  const tubes: { mat: MeshBasicMaterial; x: number; z: number; next: number; until: number; seed: number }[] = []
  for (const id of FLICKER_SHOPS) {
    const s = world.facades.find((q) => q.id === id)
    if (!s) continue
    const f = frameOf(s)
    const g = s.ground
    const x0 = g.door === 'left' ? 2.0 : 0.4
    const x1 = g.door === 'right' ? f.width - 2.0 : f.width - 0.4
    const cx = (x0 + x1) / 2
    const mat = new MeshBasicMaterial({ color: '#f2fbee' })
    const m = new Mesh(unitBox, mat)
    m.scale.set(Math.min(1.5, x1 - x0 - 0.4), 0.07, 0.02)
    m.position.set(cx, OH - 0.17, 0.056)
    const anchor = anchorTo(f)
    anchor.add(m)
    root.add(anchor)
    const [wx, wz] = toWorld(f, cx, 0)
    tubes.push({ mat, x: wx, z: wz, next: rng.range(8, 20), until: 0, seed: rng.range(0, 100) })
  }

  const on = new Color('#f2fbee')
  const off = new Color('#6d7a6f')
  return {
    object: root,
    update(time, _dt, p) {
      // Fans: only those near enough to be seen.
      let moved = false
      fans.forEach((f, i) => {
        if (dist(p.x, p.z, f.x, f.z) > NEAR) return
        moved = true
        placeBlade(i, f.phase + time * f.speed)
      })
      if (moved) blades.instanceMatrix.needsUpdate = true

      for (const s of signs) {
        if (dist(p.x, p.z, s.x, s.z) > NEAR) continue
        const t = time / s.period * Math.PI * 2 + s.phase
        // Two beating swings plus a slow gust, so no sign repeats exactly.
        s.pivot.rotation.z = s.amp * (Math.sin(t) * 0.7 + Math.sin(t * 0.37 + 1.1) * 0.5) * (0.6 + 0.4 * Math.sin(time * 0.11 + s.phase))
      }

      for (const t of tubes) {
        if (dist(p.x, p.z, t.x, t.z) > NEAR) continue
        if (time >= t.next && time > t.until) {
          t.until = time + 0.55
          t.next = time + 9 + ((Math.sin(t.seed + time) + 1) * 0.5) * 18
        }
        const flickering = time < t.until
        const k = flickering ? Math.floor((time - (t.until - 0.55)) * 18) : 0
        const dim = flickering && (k % 3 === 0 || k % 5 === 2)
        t.mat.color.copy(dim ? off : on)
      }
    },
    dispose() {
      plates.dispose()
      blades.dispose()
      bladeGeo.dispose()
      for (const m of signMats) m.dispose()
      for (const t of textures) t.dispose()
      for (const t of tubes) t.mat.dispose()
    },
  }
}
