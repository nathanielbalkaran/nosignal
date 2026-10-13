import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * Low-poly pedestrians in the spirit of early 3D games: tapered torso, neck,
 * a small rounded head with hair, two-part arms and legs, hands and shoes.
 * Each body part is merged into one vertex-coloured mesh, so a figure is nine
 * meshes sharing one flat-shaded material. Three archetypes, each with its own
 * silhouette, clothes and gait.
 */

export type Archetype = 'commuter' | 'courier' | 'elder'

interface Spec {
  /** Overall height scale. */
  height: number
  /** Width scale of the body. */
  build: number
  top: string
  /** Sleeve colour; falls back to `top`. */
  sleeve?: string
  trousers: string
  shoes: string
  skin: string
  hair: string
  /** A long coat that falls over the thighs. */
  coat?: string
  cap?: string
  bag?: 'shoulder' | 'pack'
  stripe?: string
  shortSleeves?: boolean
  /** Forward lean of the upper body, radians. */
  lean: number
  /** Leg swing amplitude, radians. */
  swing: number
  /** Metres per step as a share of walking speed. */
  stride: number
}

const SPECS: Record<Archetype, Spec> = {
  commuter: { height: 1, build: 1, top: '#3a4352', trousers: '#25282d', shoes: '#16161a', skin: '#a98468', hair: '#17140f', bag: 'shoulder', lean: 0.05, swing: 0.4, stride: 0.5 },
  courier: { height: 1.02, build: 1.08, top: '#5d6650', trousers: '#4a4638', shoes: '#2b2a26', skin: '#9a7658', hair: '#17140f', cap: '#2f4a52', bag: 'pack', stripe: '#a9783a', shortSleeves: true, lean: 0.1, swing: 0.44, stride: 0.5 },
  elder: { height: 0.93, build: 0.94, top: '#6a5f4f', coat: '#7a6f5c', trousers: '#3a3c40', shoes: '#242220', skin: '#b08e72', hair: '#aaa8a2', lean: 0.2, swing: 0.28, stride: 0.42 },
}

const HIP = 0.9
const THIGH = 0.44
const SHIN = 0.4
const UPPER_ARM = 0.28
const FOREARM = 0.25

class Parts {
  private geos: BufferGeometry[] = []

  add(geo: BufferGeometry, color: string, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo
    g.deleteAttribute('uv')
    const m = new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationX(rx)).multiply(new Matrix4().makeScale(sx, sy, sz))
    g.applyMatrix4(m)
    const c = new Color(color)
    const n = g.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    this.geos.push(g)
  }

  build(): BufferGeometry {
    const out = mergeGeometries(this.geos)
    for (const g of this.geos) g.dispose()
    return out
  }
}

const cyl = (rt: number, rb: number, h: number, seg = 7) => new CylinderGeometry(rt, rb, h, seg, 1)
const ball = (r: number, w = 6, h = 5) => new SphereGeometry(r, w, h)

let material: MeshStandardMaterial | null = null
const cache = new Map<Archetype, { torso: BufferGeometry; thigh: BufferGeometry; shin: BufferGeometry; upper: BufferGeometry; fore: BufferGeometry }>()

function geometries(kind: Archetype) {
  const hit = cache.get(kind)
  if (hit) return hit
  const s = SPECS[kind]
  const sleeve = s.sleeve ?? s.top
  const garment = s.coat ?? s.top

  // Upper body, positioned relative to the hip pivot.
  const t = new Parts()
  const base = -HIP
  t.add(cyl(0.12 * s.build, 0.15 * s.build, 0.2, 8), s.coat ?? s.trousers, 0, base + 0.99, 0, 1.25, 1, 0.78) // pelvis (or coat skirt top)
  t.add(cyl(0.205 * s.build, 0.155 * s.build, 0.56, 8), garment, 0, base + 1.17, 0, 1, 1, 0.62) // chest tapering to the waist
  if (s.coat) t.add(cyl(0.165 * s.build, 0.23 * s.build, 0.5, 8), s.coat, 0, base + 0.76, 0, 1, 1, 0.74) // coat skirt
  if (s.stripe) t.add(cyl(0.19 * s.build, 0.185 * s.build, 0.05, 8), s.stripe, 0, base + 1.2, 0, 1, 1, 0.64) // reflective band
  if (!s.coat && !s.shortSleeves) t.add(cyl(0.16 * s.build, 0.165 * s.build, 0.12, 8), s.top, 0, base + 0.99, 0, 1, 1, 0.66) // jacket hem
  t.add(ball(0.075, 6, 4), garment, -0.215 * s.build, base + 1.4, 0, 1, 0.9, 1) // shoulders
  t.add(ball(0.075, 6, 4), garment, 0.215 * s.build, base + 1.4, 0, 1, 0.9, 1)
  t.add(cyl(0.055, 0.065, 0.12, 6), s.skin, 0, base + 1.5, 0) // neck
  t.add(cyl(0.085, 0.07, 0.04, 6), s.coat ?? s.top, 0, base + 1.46, 0.0, 1.2, 1, 1) // collar
  // Head: slightly narrow sphere, hair over the crown and back, two dark eyes.
  t.add(ball(0.098, 8, 6), s.skin, 0, base + 1.64, 0.005, 0.88, 1.08, 1)
  t.add(new SphereGeometry(0.106, 8, 5, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, 1.95), s.hair, 0, base + 1.645, 0, 0.9, 1.08, 1.02)
  t.add(new BoxGeometry(0.02, 0.02, 0.012), '#1a1512', -0.035, base + 1.65, 0.098)
  t.add(new BoxGeometry(0.02, 0.02, 0.012), '#1a1512', 0.035, base + 1.65, 0.098)
  t.add(new BoxGeometry(0.025, 0.04, 0.03), s.skin, 0, base + 1.61, 0.102) // nose
  if (s.cap) {
    t.add(new SphereGeometry(0.108, 8, 4, 0, Math.PI * 2, 0, 1.45), s.cap, 0, base + 1.66, 0, 0.9, 1, 1.02)
    t.add(new BoxGeometry(0.16, 0.012, 0.09), s.cap, 0, base + 1.685, 0.12)
  }
  if (s.bag === 'shoulder') {
    t.add(new BoxGeometry(0.07, 0.2, 0.28), '#2a2b2e', 0.25 * s.build, base + 0.93, 0)
    t.add(cyl(0.012, 0.012, 0.55, 4), '#2a2b2e', 0.1 * s.build, base + 1.2, 0, 1, 1, 1, 0.0)
  } else if (s.bag === 'pack') {
    t.add(new BoxGeometry(0.3, 0.4, 0.15), '#3d6a70', 0, base + 1.2, -0.16)
  }

  const th = new Parts()
  th.add(cyl(0.088, 0.062, THIGH, 7), s.trousers, 0, -THIGH / 2, 0, 1, 1, 1.05)
  const sh = new Parts()
  sh.add(cyl(0.062, 0.045, SHIN, 7), s.trousers, 0, -SHIN / 2, 0, 1, 1, 1.05)
  sh.add(new BoxGeometry(0.1, 0.07, 0.26), s.shoes, 0, -SHIN - 0.005, 0.06)
  sh.add(ball(0.05, 6, 4), s.shoes, 0, -SHIN + 0.005, 0.14, 1, 0.7, 1)

  const up = new Parts()
  up.add(cyl(0.058, 0.048, UPPER_ARM, 6), sleeve, 0, -UPPER_ARM / 2, 0)
  const fo = new Parts()
  fo.add(cyl(0.047, 0.036, FOREARM, 6), s.shortSleeves ? s.skin : sleeve, 0, -FOREARM / 2, 0)
  fo.add(ball(0.043, 5, 4), s.skin, 0, -FOREARM - 0.02, 0.005, 0.9, 1.2, 0.8)

  const out = { torso: t.build(), thigh: th.build(), shin: sh.build(), upper: up.build(), fore: fo.build() }
  cache.set(kind, out)
  return out
}

export interface Figure {
  group: Group
  /** Place and turn this; it holds the scaled body. */
  /** Pose the figure for a distance walked, at a given speed. */
  pose(distance: number, speed: number): void
}

export function makeFigure(kind: Archetype, seed: number): Figure {
  const s = SPECS[kind]
  const g = geometries(kind)
  material ??= new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 })
  const mesh = (geo: BufferGeometry) => new Mesh(geo, material!)

  const root = new Group()
  const group = new Group()
  group.scale.setScalar(s.height)
  root.add(group)
  const body = new Group()
  body.position.y = HIP
  body.add(mesh(g.torso))
  group.add(body)

  const limb = (x: number, y: number, parent: Group, upper: BufferGeometry, lower: BufferGeometry, length: number) => {
    const joint = new Group()
    joint.position.set(x, y, 0)
    joint.add(mesh(upper))
    const knee = new Group()
    knee.position.y = -length
    knee.add(mesh(lower))
    joint.add(knee)
    parent.add(joint)
    return { joint, knee }
  }
  const legL = limb(-0.095 * s.build, HIP, group, g.thigh, g.shin, THIGH)
  const legR = limb(0.095 * s.build, HIP, group, g.thigh, g.shin, THIGH)
  const armL = limb(-0.235 * s.build, 0.5, body, g.upper, g.fore, UPPER_ARM)
  const armR = limb(0.235 * s.build, 0.5, body, g.upper, g.fore, UPPER_ARM)
  // Slight arm splay, so the sleeves clear the coat.
  armL.joint.rotation.z = 0.05
  armR.joint.rotation.z = -0.05

  const asym = 0.9 + (seed % 7) * 0.02
  const amp = s.swing

  return {
    group: root,
    pose(distance, speed) {
      const step = Math.max(0.3, speed * s.stride)
      const phase = (distance / step) * Math.PI
      const irregular = 0.05 * Math.sin(phase * 0.37 + seed)
      const a = Math.sin(phase + irregular)
      const b = Math.sin(phase + Math.PI + irregular)
      const c = Math.cos(phase + irregular)
      // Hip swing; positive x rotation carries a foot backwards.
      legL.joint.rotation.x = -amp * a
      legR.joint.rotation.x = -amp * b
      // The knee bends while a leg swings forward, and a little on landing.
      legL.knee.rotation.x = 0.08 + 0.75 * amp * Math.max(0, c)
      legR.knee.rotation.x = 0.08 + 0.75 * amp * Math.max(0, -c)
      // Arms oppose the legs, with a soft, slightly different swing each side.
      const arm = amp * 0.75
      armL.joint.rotation.x = arm * a * asym
      armR.joint.rotation.x = arm * b
      armL.knee.rotation.x = -(0.2 + 0.25 * Math.max(0, -a))
      armR.knee.rotation.x = -(0.2 + 0.25 * Math.max(0, -b))
      // The pelvis drops as the stride opens, so the planted foot stays at ground level.
      const drop = HIP * (1 - Math.cos(amp * Math.max(Math.abs(a), Math.abs(b)) * 0.95))
      group.position.y = (0.02 - drop * 0.55) * s.height
      // Shoulders counter-twist the hips, with a small sway and the archetype's lean.
      body.rotation.set(s.lean + 0.015 * Math.cos(phase * 2), -0.1 * a, 0.02 * a)
    },
  }
}

export function disposeFigures() {
  for (const set of cache.values()) for (const geo of Object.values(set)) geo.dispose()
  cache.clear()
  material?.dispose()
  material = null
}
