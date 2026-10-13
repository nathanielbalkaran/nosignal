import { BufferAttribute, Color, DoubleSide, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three'
import type { World } from '../../world/build.ts'
import { Rng } from '../../world/rng.ts'
import { windowLog } from '../facade/windowLog.ts'
import { dist, frameOf, toWorld, type Ambient, type Frame } from './common.ts'

/*
 * Apartment windows that light up and go dark. A fixed set of dark windows,
 * spread evenly over the district, is covered by one instanced quad each. A
 * quad is invisible while its window is off, so the original glass shows.
 * Only one window changes every half minute or so, and a few glow blue like a
 * television. One draw call, no lights.
 */

const COUNT = 96
const PER_CELL = 3
const CELL = 36
const START_LIT = 20
const TV_SHARE = 0.22
const MIN_LIT = 12
const MAX_LIT = 30
const FADE = 0.9

const WARM = new Color('#b98a4c')
const TV = new Color('#6f93c9')
const HIDDEN = new Object3D()
HIDDEN.scale.set(0, 0, 0)
HIDDEN.updateMatrix()

type State = 'off' | 'warm' | 'tv'

interface Slot {
  x: number
  z: number
  matrix: Matrix4
  state: State
  level: number
  tvSeed: number
}

export function createWindows(world: World): Ambient {
  const rng = new Rng('ambient:windows')
  const frames = new Map<string, Frame>()
  for (const s of world.facades) frames.set(s.id, frameOf(s))

  // Take windows from the upper floors, a few per grid cell so they are spread out.
  const records = windowLog.filter((w) => w.y0 > 4.5 && frames.has(w.facade))
  for (let i = records.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[records[i], records[j]] = [records[j], records[i]]
  }
  const perCell = new Map<string, number>()
  const slots: Slot[] = []
  const dummy = new Object3D()
  for (const w of records) {
    if (slots.length >= COUNT) break
    const f = frames.get(w.facade)!
    const cx = (w.x0 + w.x1) / 2
    const [wx, wz] = toWorld(f, cx, w.z + 0.003)
    const key = `${Math.floor(wx / CELL)}:${Math.floor(wz / CELL)}`
    const n = perCell.get(key) ?? 0
    if (n >= PER_CELL) continue
    perCell.set(key, n + 1)
    dummy.position.set(wx, (w.y0 + w.y1) / 2, wz)
    dummy.rotation.set(0, f.yaw, 0)
    dummy.scale.set(w.x1 - w.x0, w.y1 - w.y0, 1)
    dummy.updateMatrix()
    slots.push({ x: wx, z: wz, matrix: dummy.matrix.clone(), state: 'off', level: 0, tvSeed: rng.range(0, 50) })
  }

  const geometry = new PlaneGeometry(1, 1)
  // A brighter top edge, like the windows around it. Plane vertices run top-left, top-right, bottom-left, bottom-right.
  geometry.setAttribute('color', new BufferAttribute(new Float32Array([1, 1, 1, 1, 1, 1, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72]), 3))
  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const mesh = new InstancedMesh(geometry, material, slots.length)
  mesh.frustumCulled = false

  const lit = () => slots.filter((s) => s.state !== 'off').length
  const set = (s: Slot, state: State) => {
    s.state = state
  }
  // Starting set: a spread of lit windows, a few of them televisions.
  const order = slots.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (const i of order.slice(0, START_LIT)) {
    set(slots[i], rng.chance(TV_SHARE) ? 'tv' : 'warm')
    slots[i].level = 1
  }

  const colour = new Color()
  const apply = (i: number, tvFlicker: number) => {
    const s = slots[i]
    if (s.level <= 0.001) {
      mesh.setMatrixAt(i, HIDDEN.matrix)
      return
    }
    mesh.setMatrixAt(i, s.matrix)
    colour.copy(s.state === 'tv' ? TV : WARM).multiplyScalar(s.level * (s.state === 'tv' ? tvFlicker : 1))
    mesh.setColorAt(i, colour)
  }
  let nextChange = 14
  let nextTv = 0

  const root = new Object3D()
  root.add(mesh)
  slots.forEach((_, i) => apply(i, 1))

  return {
    object: root,
    update(time, dt, p) {
      let dirty = false

      if (time >= nextChange) {
        nextChange = time + rng.range(22, 48)
        // Change a window the player could plausibly notice: not too near, not lost in the haze.
        const candidates = slots.filter((s) => {
          const d = dist(p.x, p.z, s.x, s.z)
          return d > 14 && d < 85
        })
        if (candidates.length) {
          const target = rng.pick(candidates)
          const count = lit()
          if (target.state !== 'off' && count > MIN_LIT) set(target, 'off')
          else if (target.state === 'off' && count < MAX_LIT) set(target, rng.chance(TV_SHARE) ? 'tv' : 'warm')
        }
      }

      for (const s of slots) {
        const goal = s.state === 'off' ? 0 : 1
        if (s.level !== goal) {
          s.level = goal > s.level ? Math.min(goal, s.level + dt / FADE) : Math.max(goal, s.level - dt / FADE)
          dirty = true
        }
      }

      // Television light wanders a few times a second.
      if (time >= nextTv) {
        nextTv = time + 0.18
        dirty = true
      }
      if (dirty) {
        slots.forEach((s, i) => {
          const flicker = s.state === 'tv' ? 0.62 + 0.38 * Math.abs(Math.sin(time * 2.3 + s.tvSeed) * Math.sin(time * 5.1 + s.tvSeed * 1.7)) : 1
          apply(i, flicker)
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      mesh.dispose()
    },
  }
}
