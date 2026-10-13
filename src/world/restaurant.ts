import type { World } from './build.ts'
import { distance, type Vec2 } from './geometry2d.ts'
import { shortestRoute } from './navigation.ts'

/*
 * The cha chaan teng's door, and the walk from it to the station. Both are read
 * from the built world (the restaurant's facade and the navigation graph), so
 * the directions on the receipt can never drift away from the real streets.
 * Pure data and logic; the renderer and the receipt only consume it.
 */

export interface RestaurantDoor {
  /** The doorway on the facade. */
  at: Vec2
  /** Unit vector out into the street. */
  outward: Vec2
  /** A spot on the street, a pace or two from the door. */
  front: Vec2
  /** View yaw that looks straight at the door. */
  yaw: number
}

/** The player is offered the door within this distance, on the street side, looking at it. */
export const DOOR_DISTANCE = 4
const DOOR_ACROSS = 1.8
const DOOR_FACING_DEG = 55
const DOOR_FRONT = 1.7

const doors = new WeakMap<World, RestaurantDoor>()

/** The facade with the door: the widest restaurant front. Same local frame as the facade builder. */
export function restaurantDoor(world: World): RestaurantDoor {
  const hit = doors.get(world)
  if (hit) return hit
  const specs = world.facades.filter((f) => f.source === 'restaurant' && f.kind === 'restaurant')
  const spec = specs.sort((a, b) => b.width - a.width)[0]
  if (!spec) throw new Error('The restaurant has no facade')
  const W = distance(spec.a, spec.b)
  let ux = (spec.b[0] - spec.a[0]) / W
  let uz = (spec.b[1] - spec.a[1]) / W
  let ox = spec.a[0]
  let oz = spec.a[1]
  if (-uz * spec.outward[0] + ux * spec.outward[1] < 0) {
    ux = -ux
    uz = -uz
    ox = spec.b[0]
    oz = spec.b[1]
  }
  const nx = -uz
  const nz = ux
  // The same rule as `drawGround`: 'right' sits 0.9 m from the far end, 'left' 0.9 m from the near end.
  const x = spec.ground.door === 'left' ? 0.9 : spec.ground.door === 'right' ? W - 0.9 : W / 2
  const at: Vec2 = [ox + ux * x, oz + uz * x]
  const door: RestaurantDoor = {
    at,
    outward: [nx, nz],
    front: [at[0] + nx * DOOR_FRONT, at[1] + nz * DOOR_FRONT],
    yaw: Math.atan2(nx, nz),
  }
  doors.set(world, door)
  return door
}

export interface DoorView {
  x: number
  z: number
  y: number
  yaw: number
}

/** Whether the player is close to the door, in front of it and looking at it. */
export function nearRestaurantDoor(world: World, p: DoorView): boolean {
  if (Math.abs(p.y) > 1) return false
  const d = restaurantDoor(world)
  const dx = p.x - d.at[0]
  const dz = p.z - d.at[1]
  const dist = Math.hypot(dx, dz)
  if (dist > DOOR_DISTANCE) return false
  const along = dx * d.outward[0] + dz * d.outward[1]
  const across = Math.abs(dx * -d.outward[1] + dz * d.outward[0])
  if (along < 0.2 || across > DOOR_ACROSS) return false
  const fx = -Math.sin(p.yaw)
  const fz = -Math.cos(p.yaw)
  const toward = dist < 1e-6 ? 1 : (-dx * fx + -dz * fz) / dist
  return toward >= Math.cos((DOOR_FACING_DEG * Math.PI) / 180)
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

export interface RouteTurn {
  /** Index into `points` of the corner. */
  at: number
  /** Degrees; positive is a right turn. */
  degrees: number
}

export type LandmarkKind = 'roadworks' | 'tower' | 'crossing'

export interface RouteLandmark {
  kind: LandmarkKind
  /** Distance walked along the route when it is passed. */
  s: number
  /** Which side of the walker it stands on at that point. */
  side: 'left' | 'right'
  /** How far it stands from the route, metres. */
  offset: number
  at: Vec2
}

export interface DirectionsRoute {
  /** Door front, each street junction, the station entrance. */
  points: Vec2[]
  nodes: string[]
  entrance: string
  length: number
  /** Heading of each leg, degrees clockwise from north. */
  bearings: number[]
  /** The first heading is out of the door; each turn is the change at a corner. */
  turns: RouteTurn[]
  landmarks: RouteLandmark[]
}

const bearingOf = (a: Vec2, b: Vec2) => (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

function nearestOnPath(points: readonly Vec2[], p: Vec2): { s: number; d: number; side: 'left' | 'right' } {
  let best = { s: 0, d: Infinity, side: 'right' as 'left' | 'right' }
  let walked = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = distance(a, b)
    const abx = b[0] - a[0]
    const abz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / (len * len)))
    const d = Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - abz * t)
    if (d < best.d) {
      // Walking along (abx, abz): the right-hand side is the one where the cross product is positive.
      const cross = abx * (p[1] - a[1]) - abz * (p[0] - a[0])
      best = { s: walked + len * t, d, side: cross >= 0 ? 'right' : 'left' }
    }
    walked += len
  }
  return best
}

let route: WeakMap<World, DirectionsRoute> | null = null

/** The shortest walk from the restaurant door to either station entrance, along the real street graph. */
export function directionsRoute(world: World): DirectionsRoute {
  route ??= new WeakMap()
  const hit = route.get(world)
  if (hit) return hit

  const door = restaurantDoor(world)
  // The street in front of the door, and the junctions at either end of it.
  let street = world.segments[0].street
  let bestD = Infinity
  for (const s of world.segments) {
    const ab: Vec2 = [s.b[0] - s.a[0], s.b[1] - s.a[1]]
    const t = Math.max(0, Math.min(1, ((door.front[0] - s.a[0]) * ab[0] + (door.front[1] - s.a[1]) * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1])))
    const d = Math.hypot(door.front[0] - s.a[0] - ab[0] * t, door.front[1] - s.a[1] - ab[1] * t)
    if (d < bestD) {
      bestD = d
      street = s.street
    }
  }
  const ends = [street.nodes[0], street.nodes[street.nodes.length - 1]]
  const nav = (id: string): Vec2 => world.navigation.nodes.get(id)!.at

  let best: { nodes: string[]; length: number; entrance: string } | null = null
  for (const first of ends) {
    for (const e of world.goal.entrances) {
      const r = shortestRoute(world.navigation, first, e.node)
      if (!r) continue
      const length = distance(door.front, nav(first)) + r.length
      if (!best || length < best.length) best = { nodes: r.nodes, length, entrance: e.node }
    }
  }
  if (!best) throw new Error('No walkable route from the restaurant to the station')

  const points: Vec2[] = [door.front, ...best.nodes.map(nav)]
  const bearings: number[] = []
  for (let i = 0; i < points.length - 1; i++) bearings.push(bearingOf(points[i], points[i + 1]))
  // Walking out of the door means walking along `outward`.
  const heading0 = (Math.atan2(door.outward[0], -door.outward[1]) * 180) / Math.PI
  const turns: RouteTurn[] = []
  turns.push({ at: 0, degrees: wrap(bearings[0] - heading0) })
  for (let i = 1; i < bearings.length; i++) {
    const degrees = wrap(bearings[i] - bearings[i - 1])
    if (Math.abs(degrees) >= 12) turns.push({ at: i, degrees })
  }

  const landmarks: RouteLandmark[] = []
  const place = (kind: LandmarkKind, at: Vec2) => {
    const n = nearestOnPath(points, at)
    landmarks.push({ kind, s: n.s, side: n.side, offset: n.d, at })
  }

  // Roadworks: the closest barrier or hoarding to any corner on the route.
  let work: { at: Vec2; d: number } | null = null
  for (const p of world.props) {
    if (p.type !== 'barrier' && p.type !== 'hoarding') continue
    for (let i = 1; i < points.length - 1; i++) {
      const d = distance(p.at, points[i])
      if (d < 8 && (!work || d < work.d)) work = { at: p.at, d }
    }
  }
  if (work) place('roadworks', work.at)

  // A tall building at a junction in the middle stretch of the walk: a marker that cannot be mistaken.
  const total = best.length
  let tower: { at: Vec2; h: number; d: number } | null = null
  for (let i = 1; i < points.length - 1; i++) {
    const s = nearestOnPath(points, points[i]).s
    if (s < total * 0.15 || s > total * 0.65) continue
    for (const f of world.facades) {
      if (f.height < 30) continue
      const mid: Vec2 = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2]
      const d = distance(mid, points[i])
      if (d > 20) continue
      if (!tower || f.height > tower.h + 1 || (Math.abs(f.height - tower.h) <= 1 && d < tower.d)) tower = { at: mid, h: f.height, d }
    }
  }
  if (tower) place('tower', tower.at)

  // The zebra crossing on the trunk road that the route uses.
  for (const c of world.crossings) {
    const at: Vec2 = c.rect.center
    if (nearestOnPath(points, at).d < 3) place('crossing', at)
  }

  landmarks.sort((a, b) => a.s - b.s)
  const result: DirectionsRoute = { points, nodes: best.nodes, entrance: best.entrance, length: best.length, bearings, turns, landmarks }
  route.set(world, result)
  return result
}
