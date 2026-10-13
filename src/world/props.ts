import { ENVIRONMENT } from '../config/environment.ts'
import { PLAYER_RADIUS, isBlocked } from './collision.ts'
import type { Obstacle, StallKind, World } from './build.ts'
import {
  add,
  boundsOf,
  centroid,
  convexOverlap,
  distance,
  dot,
  normalize,
  perp,
  scale,
  sub,
  type Bounds,
  type Vec2,
} from './geometry2d.ts'
import { Rng, valueNoise } from './rng.ts'
import type { LayoutStreet } from './types.ts'
import { CONSTRUCTION_STREET, characterOf, zoneOf, type Zone } from './zones.ts'

/*
 * Deterministic prop placement.
 *
 * Every street is cut into stretches (8-13 m). Each stretch has a "heavy" side
 * that receives the large obstructions (vans, trees, scaffolding) and a light
 * side that only gets small props. A walkable corridor, at least
 * 2 x (player radius + margin) wide, slaloms away from the heavy side, so large
 * obstructions alternate from side to side and chop up long views without ever
 * closing the street. Props are placed by rejection: a candidate that touches a
 * building, another prop, a landmark keep-out or the corridor is dropped.
 */

export type PropType =
  | 'car'
  | 'van'
  | 'truck'
  | 'scooter'
  | 'motorcycle'
  | 'bicycle'
  | 'bench'
  | 'stool'
  | 'streetlight'
  | 'bollard'
  | 'trafficSign'
  | 'cabinet'
  | 'bin'
  | 'barrier'
  | 'tree'
  | 'pottedPlant'
  | 'shrub'
  | 'planter'
  | 'bambooScaffold'
  | 'metalScaffold'
  | 'hoarding'
  | 'coveredWalkway'
  | 'materials'
  | 'pipesStack'
  | 'tempFence'
  | 'cone'
  | 'crates'
  | 'foldedStall'
  | 'boxes'
  | 'diningSet'
  | 'display'
  | 'cart'

interface PropDef {
  /** Size along the prop's own x axis and across it (z), and height, in metres. */
  len: number
  wid: number
  height: number
  collider: 'rect' | 'round' | 'none'
  /** Radius of a round collider. */
  radius?: number
  /** Height below which the collider blocks. Defaults to `height`. */
  colliderTop?: number
}

export const PROP_DEFS: Readonly<Record<PropType, PropDef>> = {
  car: { len: 4.3, wid: 1.8, height: 1.45, collider: 'rect' },
  van: { len: 5.0, wid: 1.95, height: 2.15, collider: 'rect' },
  truck: { len: 5.8, wid: 2.15, height: 2.75, collider: 'rect' },
  scooter: { len: 1.7, wid: 0.65, height: 1.15, collider: 'rect' },
  motorcycle: { len: 2.0, wid: 0.72, height: 1.1, collider: 'rect' },
  bicycle: { len: 1.7, wid: 0.5, height: 1.0, collider: 'none' },
  bench: { len: 1.6, wid: 0.5, height: 0.85, collider: 'rect' },
  stool: { len: 0.34, wid: 0.34, height: 0.42, collider: 'none' },
  streetlight: { len: 0.5, wid: 0.5, height: 7, collider: 'round', radius: 0.14 },
  bollard: { len: 0.25, wid: 0.25, height: 0.9, collider: 'round', radius: 0.11 },
  trafficSign: { len: 0.4, wid: 0.4, height: 2.7, collider: 'round', radius: 0.08 },
  cabinet: { len: 1.0, wid: 0.5, height: 1.45, collider: 'rect' },
  bin: { len: 0.72, wid: 0.62, height: 1.1, collider: 'rect' },
  barrier: { len: 1.7, wid: 0.4, height: 0.95, collider: 'rect' },
  tree: { len: 1.0, wid: 1.0, height: 6.5, collider: 'round', radius: 0.28, colliderTop: 6.5 },
  pottedPlant: { len: 0.55, wid: 0.55, height: 0.95, collider: 'round', radius: 0.22 },
  shrub: { len: 0.95, wid: 0.95, height: 0.8, collider: 'none' },
  planter: { len: 1.7, wid: 0.75, height: 1.0, collider: 'rect' },
  bambooScaffold: { len: 8, wid: 1.2, height: 8, collider: 'rect' },
  metalScaffold: { len: 8, wid: 1.1, height: 8, collider: 'rect' },
  hoarding: { len: 3.2, wid: 0.14, height: 2.2, collider: 'rect' },
  coveredWalkway: { len: 8, wid: 3, height: 2.8, collider: 'none' },
  materials: { len: 1.7, wid: 1.2, height: 1.0, collider: 'rect' },
  pipesStack: { len: 2.4, wid: 0.8, height: 0.7, collider: 'rect' },
  tempFence: { len: 2.5, wid: 0.12, height: 2.0, collider: 'rect' },
  cone: { len: 0.32, wid: 0.32, height: 0.7, collider: 'none' },
  crates: { len: 0.85, wid: 0.6, height: 0.9, collider: 'rect' },
  foldedStall: { len: 2.0, wid: 0.75, height: 1.15, collider: 'rect' },
  boxes: { len: 0.75, wid: 0.62, height: 0.95, collider: 'rect' },
  diningSet: { len: 1.4, wid: 1.0, height: 0.75, collider: 'rect' },
  display: { len: 0.95, wid: 0.5, height: 1.5, collider: 'rect' },
  cart: { len: 1.25, wid: 0.72, height: 1.05, collider: 'rect' },
}

/**
 * District-wide ceilings for the props that read as repetitive when scattered:
 * the clusters below place most of these on purpose, and everything else only
 * fills what is left. Props not listed are unlimited.
 */
const LIMITS: Readonly<Partial<Record<PropType, number>>> = {
  scooter: 14,
  motorcycle: 4,
  bicycle: 8,
  bench: 3,
  planter: 6,
  cart: 8,
  crates: 18,
  boxes: 12,
  stool: 12,
  bin: 28,
  cabinet: 12,
  pottedPlant: 22,
  shrub: 10,
  display: 6,
  car: 14,
  van: 8,
  truck: 3,
}

export interface Collider {
  poly: Vec2[]
  top: number
}

export interface PropInstance {
  id: number
  type: PropType
  /** Footprint centre on the ground. */
  at: Vec2
  /** Rotation about +y. The prop's local +x maps to (cos yaw, -sin yaw) on the ground. */
  yaw: number
  /** Final length (local x) and width (local z), after scaling. */
  size: [number, number]
  height: number
  /** Stable per-prop number for colour and shape choices. */
  variant: number
  zone: Zone
  colliders: Collider[]
}

export interface Corridor {
  poly: Vec2[]
  bounds: Bounds
}

/** A street name plate (or subtle transit plate) fixed to a wall. */
export interface StreetPlate {
  at: Vec2
  /** Unit vector from the wall into the street. */
  outward: Vec2
  height: number
  kind: 'street' | 'transit'
  /** Street id, or the index into TRANSIT_LABELS. */
  ref: string
}

/** A cable bundle between two facades. */
export interface Cable {
  a: Vec2
  b: Vec2
  ya: number
  yb: number
  sag: number
}

export interface PlacementReport {
  attempts: number
  rejected: number
  /** Why candidates were dropped: walkway corridor, landmark keep-out, building or obstacle, other prop. */
  rejectedBy: Record<string, number>
  byType: Record<string, number>
  /** Collidable props tall enough to block a standing view. */
  occluders: number
}

const axisOf = (yaw: number): Vec2 => [Math.cos(yaw), -Math.sin(yaw)]
const yawFromDir = (d: Vec2): number => Math.atan2(-d[1], d[0])

export function rectPoly(c: Vec2, yaw: number, len: number, wid: number): Vec2[] {
  const ax = axisOf(yaw)
  const nz = perp(ax)
  const hx = scale(ax, len / 2)
  const hz = scale(nz, wid / 2)
  return [add(add(c, hx), hz), add(sub(c, hx), hz), sub(sub(c, hx), hz), sub(add(c, hx), hz)]
}

function roundPoly(c: Vec2, r: number): Vec2[] {
  return Array.from({ length: 8 }, (_, i) => {
    const t = ((i + 0.5) / 8) * Math.PI * 2
    return [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r] as Vec2
  })
}

function samplePoly(poly: readonly Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [centroid(poly)]
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const n = Math.max(1, Math.ceil(distance(a, b) / step))
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

function boundsOverlap(a: Bounds, b: Bounds, pad = 0): boolean {
  return a.minX < b.maxX + pad && a.maxX > b.minX - pad && a.minZ < b.maxZ + pad && a.maxZ > b.minZ - pad
}

function inflate(poly: readonly Vec2[], by: number): Vec2[] {
  const c = centroid(poly)
  return poly.map((p) => {
    const d = normalize(sub(p, c))
    return add(p, scale(d, by))
  })
}

/** Corridor half width: the player circle plus the configured margin plus a little comfort. */
function corridorHalf(street: LayoutStreet): number {
  const base = PLAYER_RADIUS + ENVIRONMENT.clearance.margin
  switch (street.kind) {
    case 'alley':
      return base + 0.2
    case 'lane':
      return base + 0.35
    case 'main':
      return base + 0.85
    default:
      return base + 0.6
  }
}

interface Stretch {
  t0: number
  t1: number
  /** Side (+1 / -1 along the segment normal) that takes the large obstructions; 0 for none. */
  heavy: -1 | 0 | 1
}

interface Seg {
  key: string
  street: LayoutStreet
  zone: Zone
  a: Vec2
  b: Vec2
  nodeA: string
  nodeB: string
  dir: Vec2
  n: Vec2
  len: number
  m0: number
  m1: number
  half: number
  amp: number
  sidewalk: number
  stretches: Stretch[]
  /** Corridor centre offset along the normal, sampled every `STEP` metres. */
  offsets: number[]
}

const STEP = 1.2

interface PlaceOptions {
  /** Prop-type-specific size override (length, width). */
  size?: [number, number]
  height?: number
  /** Extra clearance from other props. */
  gap?: number
  colliders?: Collider[]
}

export function placeProps(world: World): void {
  const rngFor = (...parts: (string | number)[]) => new Rng([ENVIRONMENT.seed, ...parts].join(':'))
  const D = ENVIRONMENT.density
  const report: PlacementReport = { attempts: 0, rejected: 0, rejectedBy: {}, byType: {}, occluders: 0 }
  const props: PropInstance[] = []
  const footprints: { poly: Vec2[]; bounds: Bounds }[] = []
  let nextId = 1

  // ---------------------------------------------------------------- geometry queries

  const blockPolys = world.blocks.map((b) => b.footprint)

  /** Distance along a ray to the nearest building wall, with the wall's direction. */
  function wallHit(from: Vec2, dir: Vec2, max: number): { t: number; edge: Vec2 } | null {
    let best: { t: number; edge: Vec2 } | null = null
    for (const poly of blockPolys) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]
        const b = poly[(i + 1) % poly.length]
        const ex = b[0] - a[0]
        const ez = b[1] - a[1]
        const denom = dir[0] * ez - dir[1] * ex
        if (Math.abs(denom) < 1e-9) continue
        const wx = a[0] - from[0]
        const wz = a[1] - from[1]
        const t = (wx * ez - wz * ex) / denom
        const u = (wx * dir[1] - wz * dir[0]) / denom
        if (t > 0 && t < max && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, edge: normalize([ex, ez]) }
      }
    }
    return best
  }

  // ---------------------------------------------------------------- junctions

  const nodeStreets = new Map<string, LayoutStreet[]>()
  for (const s of world.layout.streets) {
    if (s.fenced) continue
    for (const id of s.nodes) nodeStreets.set(id, [...(nodeStreets.get(id) ?? []), s])
  }
  const nodeDisc = new Map<string, number>()
  for (const [id, streets] of nodeStreets) {
    const widest = Math.max(...streets.map((s) => s.width))
    nodeDisc.set(id, Math.min(3.6, Math.max(2.2, widest * 0.28)))
  }

  // ---------------------------------------------------------------- keep-outs

  const keepouts: Vec2[][] = []
  const keep = (poly: Vec2[]) => keepouts.push(poly)
  const circle = (c: Vec2, r: number) => roundPoly(c, r)

  for (const e of world.station.entrances) {
    // The forecourt and the doorway are never obstructed.
    keep(rectPoly(add(e.at, scale(e.outward, 7)), yawFromDir(perp(e.outward)), e.width + 10, 16))
  }
  for (const r of world.ramps) {
    const ext = scale(r.axis, -3)
    keep(inflate([add(r.poly[0], ext), add(r.poly[1], ext), r.poly[2], r.poly[3]], 1.2))
  }
  for (const c of world.crossings) keep(inflate(c.rect.poly, 3))
  for (const d of world.decks) keep(inflate(d.poly, 1.5))
  keep(circle(world.spawn.at, 4.5))
  for (const g of world.gates) keep(inflate(g.rect.poly, 0.8))
  for (const n of world.navigation.nodes.values()) keep(circle(n.at, 1.6))
  for (const [id, r] of nodeDisc) {
    const at = world.nodes.get(id)?.at
    if (at) keep(circle(at, r))
  }
  for (const l of world.landmarks.filter((x) => x.id === 'restaurant')) keep(circle(l.at, 0.5))

  // ---------------------------------------------------------------- street segments and stretches

  const segs: Seg[] = []
  const occlusion = Math.max(0, D.occlusion)
  for (const street of world.layout.streets) {
    if (street.fenced) continue
    const zone = zoneOf(street)
    for (let i = 0; i < street.nodes.length - 1; i++) {
      const nodeA = street.nodes[i]
      const nodeB = street.nodes[i + 1]
      const a = world.nodes.get(nodeA)?.at as Vec2
      const b = world.nodes.get(nodeB)?.at as Vec2
      const len = distance(a, b)
      const dir = normalize(sub(b, a))
      const half = corridorHalf(street)
      const sidewalk = street.carriageway > 0 ? (street.width - street.carriageway) / 2 : 0.9
      const maxAmp = { main: 3, street: 1.7, market: 0.5, lane: 0.5, alley: 0, trunk: 0 }[street.kind]
      const amp = Math.max(0, Math.min(maxAmp, street.width / 2 - half - 1.0))
      const m0 = (nodeDisc.get(nodeA) ?? 2.2) + 0.5
      const m1 = (nodeDisc.get(nodeB) ?? 2.2) + 0.5
      const seg: Seg = {
        key: `${street.id}#${i}`,
        street,
        zone,
        a,
        b,
        nodeA,
        nodeB,
        dir,
        n: perp(dir),
        len,
        m0,
        m1,
        half,
        amp,
        sidewalk,
        stretches: [],
        offsets: [],
      }
      const rng = rngFor('stretch', seg.key)
      const openChance = 0.22
      let t = m0
      let prev: -1 | 0 | 1 = 0
      while (t < len - m1 - 0.5) {
        let l = rng.range(8, 13)
        if (len - m1 - (t + l) < 5) l = len - m1 - t
        const slalom = amp > 0.1 && !rng.chance(openChance / Math.max(0.3, occlusion))
        let heavy: -1 | 0 | 1 = 0
        if (amp > 0.1 && slalom && occlusion > 0) heavy = prev === 0 ? rng.sign() : rng.chance(0.78) ? (-prev as -1 | 1) : prev
        // Alleys and lanes have no heavy side, but still get small clutter on both.
        seg.stretches.push({ t0: t, t1: t + l, heavy })
        if (heavy !== 0) prev = heavy
        t += l
      }
      segs.push(seg)
    }
  }

  // Junction approaches: parked vans and the like hide the mouths of side streets from some directions.
  interface BlockerRequest {
    seg: Seg
    end: 'start' | 'end'
    side: -1 | 1
  }
  const blockerRequests: BlockerRequest[] = []
  {
    const rng = rngFor('junctions')
    const perNode = new Map<string, number>()
    for (const seg of segs) {
      if (seg.street.width < 6.5 || seg.stretches.length === 0 || seg.zone === 'construction') continue
      for (const end of ['start', 'end'] as const) {
        const nodeId = end === 'start' ? seg.nodeA : seg.nodeB
        const others = (nodeStreets.get(nodeId) ?? []).filter((s) => s !== seg.street)
        if (others.length < 1 || (nodeStreets.get(nodeId)?.length ?? 0) < 3) continue
        if ((perNode.get(nodeId) ?? 0) >= 2 || !rng.chance(0.55 * Math.min(1.5, occlusion))) continue
        // Which side has a street leaving? Its mouth is what gets hidden.
        const here = world.nodes.get(nodeId)?.at as Vec2
        const sides = new Set<number>()
        for (const o of others) {
          const idx = o.nodes.indexOf(nodeId)
          for (const nb of [o.nodes[idx - 1], o.nodes[idx + 1]]) {
            const at = nb ? world.nodes.get(nb)?.at : undefined
            if (!at) continue
            const d = sub(at, here)
            if (Math.abs(dot(normalize(d), seg.dir)) > 0.85) continue
            sides.add(Math.sign(dot(d, seg.n)))
          }
        }
        if (sides.size === 0) continue
        const list = [...sides]
        const side = (list.length === 1 ? list[0] : rng.sign()) as -1 | 1
        const st = end === 'start' ? seg.stretches[0] : seg.stretches[seg.stretches.length - 1]
        st.heavy = side
        blockerRequests.push({ seg, end, side })
        perNode.set(nodeId, (perNode.get(nodeId) ?? 0) + 1)
      }
    }
  }

  // ---------------------------------------------------------------- corridors

  const corridors: Corridor[] = []
  const addCorridor = (poly: Vec2[]) => corridors.push({ poly, bounds: boundsOf(poly) })

  for (const seg of segs) {
    const count = Math.max(2, Math.ceil(seg.len / STEP) + 1)
    const raw: number[] = []
    for (let j = 0; j < count; j++) {
      const t = (j / (count - 1)) * seg.len
      const st = seg.stretches.find((s) => t >= s.t0 && t <= s.t1)
      raw.push(st && st.heavy !== 0 ? -st.heavy * seg.amp : 0)
    }
    // Smooth, and always return to the street's centre line at both nodes.
    const smooth = raw.map((_, j) => {
      let sum = 0
      let cnt = 0
      for (let k = -2; k <= 2; k++) {
        const v = raw[j + k]
        if (v !== undefined) {
          sum += v
          cnt++
        }
      }
      const t = (j / (count - 1)) * seg.len
      const ends = Math.min(1, Math.min(t, seg.len - t) / Math.max(1, seg.m0 - 0.5))
      return (sum / cnt) * Math.max(0, ends)
    })
    seg.offsets = smooth
    for (let j = 0; j < count - 1; j++) {
      const t0 = (j / (count - 1)) * seg.len
      const t1 = ((j + 1) / (count - 1)) * seg.len
      const p0 = add(add(seg.a, scale(seg.dir, t0)), scale(seg.n, smooth[j]))
      const p1 = add(add(seg.a, scale(seg.dir, t1)), scale(seg.n, smooth[j + 1]))
      const e0 = scale(seg.n, seg.half)
      addCorridor([add(p0, e0), add(p1, e0), sub(p1, e0), sub(p0, e0)])
    }
  }
  for (const [id, r] of nodeDisc) {
    const at = world.nodes.get(id)?.at
    if (at) addCorridor(circle(at, r))
  }

  const corridorAt = (seg: Seg, t: number): number => {
    const f = Math.max(0, Math.min(seg.offsets.length - 1, (t / seg.len) * (seg.offsets.length - 1)))
    const i = Math.min(seg.offsets.length - 2, Math.floor(f))
    return seg.offsets[i] + (seg.offsets[i + 1] - seg.offsets[i]) * (f - i)
  }

  // ---------------------------------------------------------------- placing

  const tooCloseToCorridor = (poly: Vec2[]): boolean => {
    const b = boundsOf(poly)
    return corridors.some((c) => boundsOverlap(b, c.bounds) && convexOverlap(poly, c.poly))
  }

  function intrudesIntoWorld(poly: Vec2[], gap: number): boolean {
    for (const p of samplePoly(poly, 0.6)) if (isBlocked(world, p, 0, gap)) return true
    const b = boundsOf(poly)
    for (const o of world.obstacles) {
      if (o.kind === 'block' || o.top < 0.05) continue
      if (boundsOverlap(b, o.bounds, gap) && convexOverlap(poly, inflate(o.poly, gap))) return true
    }
    return false
  }

  function tryPlace(type: PropType, at: Vec2, yaw: number, zone: Zone, rng: Rng, opt: PlaceOptions = {}): PropInstance | null {
    const def = PROP_DEFS[type]
    const [len, wid] = opt.size ?? [def.len, def.wid]
    const height = opt.height ?? def.height
    const gap = opt.gap ?? 0.12
    report.attempts++
    const footprint = rectPoly(at, yaw, len, wid)
    let colliders: Collider[]
    if (opt.colliders) colliders = opt.colliders
    else if (def.collider === 'rect') colliders = [{ poly: footprint, top: def.colliderTop ?? height }]
    else if (def.collider === 'round') colliders = [{ poly: roundPoly(at, def.radius ?? 0.2), top: def.colliderTop ?? height }]
    else colliders = []

    const limit = LIMITS[type]
    if (limit !== undefined && (report.byType[type] ?? 0) >= limit) {
      report.rejected++
      report.rejectedBy.limit = (report.rejectedBy.limit ?? 0) + 1
      return null
    }
    const reject = (why: string) => {
      report.rejected++
      report.rejectedBy[why] = (report.rejectedBy[why] ?? 0) + 1
      return null
    }
    // Only the colliders may touch the walkway corridor; a roof or canopy can overhang it.
    for (const c of colliders.length > 0 ? colliders.map((x) => x.poly) : [footprint]) {
      if (tooCloseToCorridor(c)) return reject('corridor')
    }
    for (const k of keepouts) if (convexOverlap(footprint, k)) return reject('keepout')
    if (intrudesIntoWorld(footprint, 0.04)) return reject('world')
    const fb = boundsOf(footprint)
    const padded = inflate(footprint, gap)
    for (const f of footprints) if (boundsOverlap(fb, f.bounds, gap) && convexOverlap(padded, f.poly)) return reject('prop')

    const prop: PropInstance = {
      id: nextId++,
      type,
      at,
      yaw,
      size: [len, wid],
      height,
      variant: Math.floor(rng.float() * 1e6),
      zone,
      colliders,
    }
    props.push(prop)
    footprints.push({ poly: footprint, bounds: fb })
    for (const c of colliders) {
      const obstacle: Obstacle = { poly: c.poly, bounds: boundsOf(c.poly), top: c.top, kind: 'prop' }
      world.obstacles.push(obstacle)
    }
    report.byType[type] = (report.byType[type] ?? 0) + 1
    if (colliders.length > 0 && colliders.some((c) => c.top >= 1.8)) report.occluders++
    return prop
  }

  const sizeFor = (type: PropType, rng: Rng): [number, number] => {
    const d = PROP_DEFS[type]
    const vehicle = type === 'car' || type === 'van' || type === 'truck'
    const s = vehicle ? rng.range(0.97, 1.04) : rng.range(0.9, 1.1)
    return [d.len * s, d.wid * s]
  }

  type Style = 'wall' | 'kerb'

  /** Positions a prop against the wall (or kerb) of a segment and tries to place it. */
  function placeOnSide(
    seg: Seg,
    side: -1 | 1,
    t: number,
    type: PropType,
    style: Style,
    rng: Rng,
    o: { perpendicular?: boolean; gap?: number; size?: [number, number]; flip?: boolean; extraInset?: number; height?: number } = {},
  ): PropInstance | null {
    const origin = add(seg.a, scale(seg.dir, t))
    const hit = wallHit(origin, scale(seg.n, side), seg.street.width / 2 + 2.5)
    if (!hit) return null
    const size = o.size ?? sizeFor(type, rng)
    const across = o.perpendicular ? size[0] : size[1]
    let fromWall: number
    if (style === 'wall') fromWall = (o.gap ?? 0.07) + across / 2 + (o.extraInset ?? 0)
    else fromWall = Math.max(0.3, seg.sidewalk - 0.12) + across / 2 + (o.extraInset ?? 0)
    if (hit.t - fromWall < across / 2 + 0.2) return null
    const centre = add(origin, scale(seg.n, side * (hit.t - fromWall)))
    // Local +z faces away from the wall.
    const tangent = style === 'wall' ? hit.edge : seg.dir
    let yaw = yawFromDir(tangent)
    const outward = scale(seg.n, -side)
    if (dot(perp(axisOf(yaw)), outward) < 0) yaw += Math.PI
    if (o.perpendicular) yaw += Math.PI / 2
    if (o.flip ?? (style === 'kerb' && rng.chance(0.5))) yaw += Math.PI
    yaw += rng.range(-0.04, 0.04)
    return tryPlace(type, centre, yaw, seg.zone, rng, { size, height: o.height })
  }

  // ---------------------------------------------------------------- 1. junction blockers

  {
    const rng = rngFor('blockers')
    for (const req of blockerRequests) {
      const { seg } = req
      const options: [PropType, number][] =
        seg.zone === 'market'
          ? [['foldedStall', 2], ['cart', 2], ['crates', 1]]
          : seg.street.width >= 9.5 && seg.zone === 'avenue'
            ? [['tree', 3], ['van', 2], ['truck', 1.5]]
            : seg.zone === 'commercial'
              ? [['van', 3], ['truck', 2], ['car', 1]]
              : [['van', 2], ['car', 2], ['truck', 0.6]]
      const filtered = options
      for (let attempt = 0; attempt < 6; attempt++) {
        const type = rng.weighted(filtered)
        const reach = req.end === 'start' ? seg.m0 : seg.len - seg.m1
        const dist = (type === 'tree' ? 1.4 : 3.2) + rng.range(0, 3.5)
        const t = req.end === 'start' ? reach + dist : reach - dist
        if (placeOnSide(seg, req.side, t, type, 'kerb', rng, type === 'tree' ? { flip: false } : {})) break
      }
    }
  }

  // ---------------------------------------------------------------- 2. construction area

  {
    const rng = rngFor('construction')
    const k = D.construction
    for (const seg of segs.filter((s) => s.street.id === CONSTRUCTION_STREET)) {
      if (k <= 0) continue
      const sideOf = (st: Stretch) => (st.heavy === 0 ? 1 : st.heavy) as -1 | 1
      // Scaffold clad in mesh against the heavy-side wall, bamboo and metal alternating.
      seg.stretches.forEach((st, si) => {
        const len = st.t1 - st.t0
        const type: PropType = si % 2 === 0 ? 'bambooScaffold' : 'metalScaffold'
        const scaffoldHeight = rng.range(7, 11)
        const depth = type === 'bambooScaffold' ? 1.25 : 1.1
        // Walls bend near junctions, so shorten the scaffold until it fits.
        let length = Math.min(len - 0.6, rng.range(6.5, 9.5))
        for (let attempt = 0; attempt < 8; attempt++) {
          const mid = st.t0 + len / 2 + rng.range(-0.6, 0.6)
          if (placeOnSide(seg, sideOf(st), mid, type, 'wall', rng, { size: [length, depth], gap: 0.06, height: scaffoldHeight })) break
          length *= 0.88
        }
      })
      // A covered walkway over the route on alternating stretches.
      seg.stretches.forEach((st, si) => {
        const len = st.t1 - st.t0
        if (si % 2 === 0 || len < 7) return
        const tm = st.t0 + len / 2
        const centre = add(add(seg.a, scale(seg.dir, tm)), scale(seg.n, corridorAt(seg, tm)))
        const w = seg.half * 2 + 0.7
        const l = Math.min(len - 3, 7.5)
        const posts: Collider[] = []
        for (const s of [-1, 1]) {
          for (let p = 0; p <= 2; p++) {
            const pc = add(add(centre, scale(seg.dir, (p - 1) * (l / 2 - 0.2))), scale(seg.n, s * (seg.half + 0.2)))
            posts.push({ poly: roundPoly(pc, 0.07), top: 2.7 })
          }
        }
        tryPlace('coveredWalkway', centre, yawFromDir(seg.dir), seg.zone, rng, { size: [l, w], colliders: posts })
      })
      // Hoarding runs from each scaffold towards the walkway to funnel pedestrians.
      seg.stretches.forEach((st) => {
        const side = sideOf(st)
        const th = st.t0 + 0.7
        const edge = corridorAt(seg, th) + side * (seg.half + 0.15)
        const faceOfScaffold = side * (seg.street.width / 2 - 1.3)
        const run = side * (faceOfScaffold - edge)
        if (run > 0.6) {
          const hp = add(add(seg.a, scale(seg.dir, th)), scale(seg.n, (edge + faceOfScaffold) / 2))
          tryPlace('hoarding', hp, yawFromDir(seg.n), seg.zone, rng, { size: [run, 0.14], height: 2.3 })
        }
      })
      // Site clutter on the heavy side.
      seg.stretches.forEach((st) => {
        const len = st.t1 - st.t0
        const side = sideOf(st)
        const items: PropType[] = ['pipesStack', 'materials', 'barrier', 'cone', 'cone', 'cone', 'crates', 'bin']
        const count = Math.round((len / 3.2) * k)
        for (let n = 0; n < count; n++) {
          const type2 = rng.pick(items)
          const t = rng.range(st.t0 + 0.8, st.t1 - 0.8)
          const style = type2 === 'cone' ? 'kerb' : 'wall'
          placeOnSide(seg, side, t, type2, style, rng, { extraInset: style === 'wall' ? 1.4 : 0 })
        }
      })
    }
  }

  // ---------------------------------------------------------------- 3. trees and streetlights

  {
    const rng = rngFor('trees')
    for (const seg of segs) {
      const wide = seg.street.width >= 9
      if (!wide || seg.zone === 'market' || seg.zone === 'construction') continue
      const veg = D.vegetation
      if (veg <= 0) continue
      const spacing = seg.zone === 'avenue' ? 11 : 24
      let t = seg.m0 + rng.range(2, 8)
      while (t < seg.len - seg.m1 - 2) {
        const st = seg.stretches.find((s) => t >= s.t0 && t <= s.t1)
        const side = (st && st.heavy !== 0 ? st.heavy : rng.sign()) as -1 | 1
        if (rng.chance(Math.min(0.95, 0.65 * veg))) {
          placeOnSide(seg, side, t, 'tree', 'kerb', rng, { flip: false })
        }
        t += spacing * rng.range(0.8, 1.7)
      }
    }
    // Streetlights on poles, kept to the main roads.
    const lights = rngFor('lights')
    for (const seg of segs) {
      if (seg.street.carriageway <= 0 || seg.zone === 'construction') continue
      let t = seg.m0 + lights.range(1, 6)
      while (t < seg.len - seg.m1 - 1) {
        const st = seg.stretches.find((s) => t >= s.t0 && t <= s.t1)
        const side = (st && st.heavy !== 0 ? (-st.heavy as -1 | 1) : lights.sign()) as -1 | 1
        placeOnSide(seg, side, t, 'streetlight', 'kerb', lights, { flip: false, extraInset: -0.35 })
        t += lights.range(20, 30)
      }
    }
    // Median lamp posts along the trunk road, a distant rhythm.
    const trunk = world.layout.streets.find((s) => s.fenced)
    if (trunk) {
      for (let i = 0; i < trunk.nodes.length - 1; i++) {
        const a = world.nodes.get(trunk.nodes[i])?.at as Vec2
        const b = world.nodes.get(trunk.nodes[i + 1])?.at as Vec2
        const len = distance(a, b)
        const dir = normalize(sub(b, a))
        for (let t = 8; t < len - 4; t += 26) {
          const p = add(a, scale(dir, t))
          const yaw = yawFromDir(dir)
          tryPlace('streetlight', p, yaw, 'trunk', lights, { gap: 0.6 })
        }
      }
    }
  }

  // ---------------------------------------------------------------- 3b. clusters

  // The repeated props of daily life are placed where they make sense and nowhere else: bicycles by a
  // residential entrance, a row of scooters at one kerb, crates round a delivery van. Authored by street
  // and position (segment index, fraction of the way along it), so the district reads as having local
  // habits rather than one scatter rule. A cluster that does not fit is simply skipped.
  {
    const rng = rngFor('clusters')
    const segAt = (streetId: string, index: number) => segs.find((s) => s.key === `${streetId}#${index}`)
    const spot = (streetId: string, index: number, frac: number, side: -1 | 1) => {
      const seg = segAt(streetId, index)
      if (!seg) return null
      const usable = seg.len - seg.m0 - seg.m1
      return usable > 4 ? { seg, t: seg.m0 + usable * frac, side } : null
    }
    // Bicycles chained together near a doorway.
    const bikes: [string, number, number, -1 | 1, number][] = [
      ['po-sin-street', 0, 0.55, 1, 3],
      ['tung-lok-street', 1, 0.4, -1, 2],
      ['lok-wo-lane', 1, 0.5, -1, 3],
    ]
    for (const [id, i, f, side, n] of bikes) {
      const at = spot(id, i, f, side)
      if (!at) continue
      for (let k = 0; k < n; k++) placeOnSide(at.seg, at.side, at.t + k * 1.9, 'bicycle', 'wall', rng, { extraInset: 0.05 })
    }
    // One row of scooters at a kerb, one in a lane, one motorcycle pair.
    const rows: [string, number, number, -1 | 1, PropType, number][] = [
      ['shun-hing-west', 0, 0.5, -1, 'scooter', 4],
      ['san-tai-street', 0, 0.5, 1, 'scooter', 3],
      ['lok-wo-lane', 2, 0.5, 1, 'scooter', 4],
      ['tak-on-street', 1, 0.5, -1, 'motorcycle', 2],
    ]
    for (const [id, i, f, side, type, n] of rows) {
      const at = spot(id, i, f, side)
      if (!at) continue
      const pedestrian = at.seg.street.carriageway <= 0
      // Parked side by side, nose to the kerb or wall.
      const step = PROP_DEFS[type].wid + 0.25
      for (let k = 0; k < n; k++) placeOnSide(at.seg, at.side, at.t + k * step, type, pedestrian ? 'wall' : 'kerb', rng, { perpendicular: true, extraInset: pedestrian ? 0.1 : 0 })
    }
    // Delivery areas: a commercial vehicle at the kerb and a few crates stacked against the wall opposite.
    const deliveries: [string, number, number, -1 | 1, PropType][] = [
      ['shun-hing-street', 2, 0.5, 1, 'van'],
      ['chung-wo-street', 0, 0.45, -1, 'truck'],
      ['kam-fung-south', 1, 0.5, 1, 'van'],
    ]
    for (const [id, i, f, side, type] of deliveries) {
      const at = spot(id, i, f, side)
      if (!at) continue
      placeOnSide(at.seg, at.side, at.t, type, 'kerb', rng)
      const stack: PropType[] = ['crates', 'crates', 'boxes', 'crates', 'boxes']
      stack.forEach((c, k) => placeOnSide(at.seg, (-at.side) as -1 | 1, at.t - 3 + k * 0.95, c, 'wall', rng))
    }
  }

  // ---------------------------------------------------------------- 4. vehicles and kerbside furniture

  const PROFILES: Record<Zone, { kerb: readonly (readonly [PropType, number])[]; kerbPerMetre: number }> = {
    // Scooters, motorcycles and bicycles are placed as deliberate clusters (see "clusters"), not scattered here.
    commercial: { kerb: [['van', 3], ['car', 2.4], ['truck', 1.2], ['barrier', 0.5], ['bollard', 0.8]], kerbPerMetre: 0.27 },
    avenue: { kerb: [['car', 3], ['van', 2], ['bench', 0.6], ['planter', 1], ['truck', 0.8], ['bollard', 1]], kerbPerMetre: 0.2 },
    residential: { kerb: [['car', 2], ['van', 0.7], ['planter', 0.7]], kerbPerMetre: 0.15 },
    market: { kerb: [['cart', 3], ['crates', 3], ['boxes', 2.5], ['foldedStall', 1.8]], kerbPerMetre: 0.22 },
    construction: { kerb: [['cone', 2], ['barrier', 1.4]], kerbPerMetre: 0.1 },
    trunk: { kerb: [], kerbPerMetre: 0 },
  }

  {
    const rng = rngFor('kerb')
    for (const seg of segs) {
      const profile = PROFILES[seg.zone]
      if (profile.kerb.length === 0) continue
      const ch = characterOf(seg.street)
      const pedestrian = seg.street.carriageway <= 0
      for (const st of seg.stretches) {
        const len = st.t1 - st.t0
        const mid = add(seg.a, scale(seg.dir, (st.t0 + st.t1) / 2))
        const density = 0.2 + 1.6 * valueNoise('density', mid[0] / 22, mid[1] / 22)
        const sides: (-1 | 1)[] = st.heavy !== 0 ? [st.heavy] : seg.street.kind === 'alley' ? [] : [rng.sign()]
        for (const side of sides) {
          const heavy = st.heavy === side
          const base = profile.kerbPerMetre * len * density * D.vehicles * ch.vehicles * (heavy ? 1 : 0.35)
          const count = Math.floor(base + rng.float())
          for (let c = 0; c < count; c++) {
            let type = rng.weighted(profile.kerb)
            // Pedestrian streets only take things a person could push or park.
            if (pedestrian && (type === 'car' || type === 'van' || type === 'truck')) continue
            if (seg.street.width < 7 && (type === 'van' || type === 'truck')) type = 'car'
            const vegetation = type === 'planter' || type === 'bench'
            if (vegetation && rng.float() > D.vegetation) continue
            const t = rng.range(st.t0 + 1, st.t1 - 1)
            placeOnSide(seg, side, t, type, pedestrian ? 'wall' : 'kerb', rng, pedestrian ? { extraInset: 0.2 } : {})
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- 5. wall clutter

  const WALL: Record<Zone, readonly (readonly [PropType, number])[]> = {
    commercial: [['crates', 2], ['boxes', 2], ['cart', 1], ['bin', 2.2], ['cabinet', 1], ['stool', 1], ['display', 1.4], ['pottedPlant', 1], ['foldedStall', 0.6]],
    avenue: [['bin', 2], ['pottedPlant', 1.5], ['planter', 1], ['cabinet', 1.2], ['boxes', 0.8], ['bench', 0.4], ['shrub', 1]],
    residential: [['pottedPlant', 3], ['bin', 3], ['crates', 0.5], ['cabinet', 1.2], ['stool', 1], ['shrub', 1.6], ['boxes', 0.5]],
    market: [['crates', 3], ['boxes', 3], ['cart', 2], ['foldedStall', 2.5], ['stool', 1], ['display', 1.5]],
    construction: [['barrier', 1], ['pipesStack', 1], ['materials', 1], ['cone', 1.5], ['bin', 0.5]],
    trunk: [],
  }

  {
    const rng = rngFor('wall')
    for (const seg of segs) {
      const table = WALL[seg.zone]
      if (table.length === 0) continue
      const ch = characterOf(seg.street)
      const pedestrian = seg.street.carriageway <= 0
      for (const st of seg.stretches) {
        const len = st.t1 - st.t0
        const mid = add(seg.a, scale(seg.dir, (st.t0 + st.t1) / 2))
        // Large-scale noise gives cluttered pockets and quiet gaps.
        const density = 0.1 + 1.9 * valueNoise('clutter', mid[0] / 16 + 7.3, mid[1] / 16 - 3.1)
        const perMetre = seg.zone === 'residential' ? 0.3 : seg.zone === 'market' ? 0.34 : 0.26
        for (const side of [-1, 1] as const) {
          const heavy = st.heavy === side
          const count = Math.floor(perMetre * len * density * D.clutter * ch.clutter * (heavy ? 0.7 : 1) + rng.float())
          for (let c = 0; c < count; c++) {
            const type = rng.weighted(table)
            if ((type === 'pottedPlant' || type === 'shrub' || type === 'planter') && rng.float() > D.vegetation) continue
            const t = rng.range(st.t0 + 0.6, st.t1 - 0.6)
            const placed = placeOnSide(seg, side, t, type, 'wall', rng, { perpendicular: type === 'cart' && pedestrian && rng.chance(0.3) })
            if (!placed) continue
            // Related clutter gathers in small groups.
            if (type === 'crates' || type === 'boxes') {
              if (rng.chance(0.5)) placeOnSide(seg, side, t + rng.range(0.7, 1.1) * rng.sign(), type, 'wall', rng)
            } else if (type === 'bin') {
              if (rng.chance(0.45)) placeOnSide(seg, side, t + 0.85 * rng.sign(), 'bin', 'wall', rng)
            } else if (type === 'stool') {
              for (let k = 1; k <= rng.int(1, 2); k++) placeOnSide(seg, side, t + k * 0.5, 'stool', 'wall', rng, { extraInset: rng.range(0, 0.15) })
            } else if (type === 'pottedPlant') {
              if (rng.chance(0.6)) placeOnSide(seg, side, t + rng.range(0.55, 0.9) * rng.sign(), rng.chance(0.6) ? 'pottedPlant' : 'shrub', 'wall', rng)
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- 6. market aisle
  // Loose goods belong to the stall they stand in front of; closed and kiosk stalls get little or nothing.

  {
    const rng = rngFor('market')
    const seg = segs.find((s) => s.street.kind === 'market' && s.nodeA === world.layout.market.from && s.nodeB === world.layout.market.to)
    const pools: Partial<Record<StallKind, [PropType, number][]>> = {
      produce: [['crates', 0.5]],
      storage: [['crates', 0.8], ['boxes', 0.7], ['cart', 0.45]],
      open: [['crates', 0.6]],
      tarp: [['boxes', 0.3]],
      shutter: [['boxes', 0.35]],
    }
    if (seg) {
      for (const stall of world.stalls) {
        for (const [type, chance] of pools[stall.kind] ?? []) {
          if (!rng.chance(chance)) continue
          const size = sizeFor(type, rng)
          const along = rng.range(-stall.rect.halfLength * 0.6, stall.rect.halfLength * 0.6)
          const centre = add(add(stall.rect.center, scale(stall.rect.axis, along)), scale(stall.out, stall.rect.halfWidth + stall.proj * 0.3 + size[1] / 2 + 0.1))
          tryPlace(type, centre, yawFromDir(seg.dir) + rng.range(-0.05, 0.05), 'market', rng, { size })
        }
      }
    }
  }

  // ---------------------------------------------------------------- cables across streets

  const cables: Cable[] = []
  {
    const rng = rngFor('cables')
    for (const seg of segs) {
      if (seg.street.width > 12.5 || seg.len < 8) continue
      const spacing = seg.zone === 'residential' ? 12 : 17
      for (let t = seg.m0 + rng.range(1, 6); t < seg.len - seg.m1; t += spacing * rng.range(0.7, 1.5)) {
        const origin = add(seg.a, scale(seg.dir, t))
        const h1 = wallHit(origin, seg.n, seg.street.width / 2 + 2.5)
        const h2 = wallHit(origin, scale(seg.n, -1), seg.street.width / 2 + 2.5)
        if (!h1 || !h2) continue
        const y = rng.range(5.2, 8.2)
        cables.push({
          a: add(origin, scale(seg.n, h1.t - 0.05)),
          b: add(origin, scale(seg.n, -(h2.t - 0.05))),
          ya: y + rng.range(-0.3, 0.3),
          yb: y + rng.range(-0.3, 0.3),
          sag: rng.range(0.25, 0.55),
        })
      }
    }
  }

  // ---------------------------------------------------------------- name plates

  const plates: StreetPlate[] = []
  {
    const rng = rngFor('plates')
    const seen = new Set<string>()
    for (const seg of segs) {
      for (const end of ['start', 'end'] as const) {
        const nodeId = end === 'start' ? seg.nodeA : seg.nodeB
        if ((nodeStreets.get(nodeId)?.length ?? 0) < 3) continue
        const key = `${seg.street.id}@${nodeId}`
        if (seen.has(key)) continue
        seen.add(key)
        const reach = end === 'start' ? seg.m0 + 1 : seg.len - seg.m1 - 1
        const origin = add(seg.a, scale(seg.dir, reach))
        const side = rng.sign()
        const hit = wallHit(origin, scale(seg.n, side), seg.street.width / 2 + 2.5)
        if (!hit) continue
        plates.push({
          at: add(origin, scale(seg.n, side * (hit.t - 0.02))),
          outward: scale(seg.n, -side),
          height: 2.7 + rng.range(0, 0.3),
          kind: 'street',
          ref: seg.street.id,
        })
      }
    }
    // A few small transit hints right beside the trunk road, never along the district.
    const hints: [string, number][] = [['T3', 0], ['T4', 1], ['T5', 2]]
    for (const [nodeId, idx] of hints) {
      const at = world.nodes.get(nodeId)?.at
      if (!at) continue
      const south: Vec2 = normalize([0.05, 1])
      const hit = wallHit(add(at, scale(south, 7.7)), [-1, 0], 14) ?? wallHit(add(at, scale(south, 7.7)), [1, 0], 14)
      if (!hit) continue
      const dirX = wallHit(add(at, scale(south, 7.7)), [-1, 0], 14) ? -1 : 1
      plates.push({
        at: add(add(at, scale(south, 7.7)), [dirX * (hit.t - 0.02), 0]),
        outward: [-dirX, 0],
        height: 2.5,
        kind: 'transit',
        ref: String(idx),
      })
    }
  }

  // A restrained transit plate on the wall just inside each station pocket: you see it as you reach the mouth.
  for (const e of world.station.entrances) {
    const side = perp(e.outward)
    const wall = add(add(e.at, scale(e.outward, 3.4)), scale(side, e.width / 2 - 0.02))
    plates.push({ at: wall, outward: scale(side, -1), height: 2.5, kind: 'transit', ref: '0' })
  }

  world.props = props
  world.plates = plates
  world.cables = cables
  world.corridors = corridors
  world.keepouts = keepouts
  world.placement = report
}
