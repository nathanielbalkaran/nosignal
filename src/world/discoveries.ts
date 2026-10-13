import type { Obstacle, World } from './build.ts'
import { PLAYER_RADIUS, isBlocked, obstaclesNear } from './collision.ts'
import type { FacadeSpec } from './facades.ts'
import { boundsOf, convexOverlap, normalize, pointInPolygon, type Vec2 } from './geometry2d.ts'
import { rectPoly } from './props.ts'

/*
 * The five optional discoveries: a stray cat, a vending machine, a payphone, a
 * stairwell to the roof and an arcade cabinet. Pure data and logic.
 *
 * Each one stands against a real ground-floor wall. Its spot is found by a fixed
 * search along named facades (never random), after every prop is placed, and only
 * accepted when the footprint is clear of buildings, props and the walkable
 * corridors, and the player can stand in front of it. So the existing props,
 * streets and collision are untouched; the discoveries fit in around them.
 */

export type DiscoveryKind = 'cat' | 'vending' | 'phone' | 'roof' | 'arcade'

export interface Discovery {
  kind: DiscoveryKind
  facadeId: string
  streetId: string
  /** The point on the wall the object stands against. */
  wall: Vec2
  /** Unit vector from the wall into the street. */
  outward: Vec2
  /** Unit vector along the wall, to the viewer's right when facing it. */
  right: Vec2
  /** Footprint centre. */
  at: Vec2
  /** Rotation about +y that turns the object's local +z (its front) to face `outward`. */
  yaw: number
  /** Width along the wall and depth out from it. */
  size: readonly [number, number]
  /** A spot on the street in front of it where the player is invited to stand. */
  front: Vec2
}

interface Spec {
  kind: DiscoveryKind
  street: string
  /** Facade ids to try first, in order; any other facade on the street is tried after. */
  prefer: readonly string[]
  /** Width along the wall, depth out from it, and collision height (0 for none). */
  w: number
  d: number
  top: number
  /** Which ground floors are acceptable. */
  accept: (f: FacadeSpec) => boolean
}

const noAwning = (f: FacadeSpec) => !f.ground.awning
const SPECS: readonly Spec[] = [
  // East, in a narrow residential alley off Ching Wan Road: a cat on an old utility box.
  { kind: 'cat', street: 'kam-yuen-alley', prefer: ['F8.5', 'F7.3'], w: 0.9, d: 0.5, top: 0.52, accept: noAwning },
  // North-centre, against a shuttered shop on the commercial street.
  { kind: 'vending', street: 'shun-hing-street', prefer: ['F3.6', 'F15.3', 'F15.0'], w: 0.95, d: 0.8, top: 1.9, accept: (f) => f.ground.shutter === 'closed' && noAwning(f) },
  // North-west, on a closed shopfront at Shun Hing Street's west end.
  { kind: 'phone', street: 'shun-hing-west', prefer: ['OUTER.11', 'infill.144', 'infill.148'], w: 0.85, d: 0.55, top: 2.2, accept: (f) => f.ground.shutter === 'closed' && noAwning(f) },
  // South-centre, a tenement on Tung Lok Street with a second, plainer door beside the entrance.
  { kind: 'roof', street: 'tung-lok-street', prefer: ['F18.5', 'F17.1', 'F11.4'], w: 1.2, d: 0.12, top: 0, accept: (f) => f.kind === 'tenement' || f.kind === 'slab' },
  // West-centre, just south of the market: a small shop with its shutter half up.
  { kind: 'arcade', street: 'kam-fung-south', prefer: ['F6.4', 'F6.3'], w: 0.9, d: 0.95, top: 1.85, accept: (f) => f.ground.kind === 'shop' && f.ground.shutter !== 'closed' && noAwning(f) },
]

/** Walkable room the player needs in front of an object, beyond its own depth. */
const STAND_OFF = 1.1
const WALL_GAP = 0.04
/** How far a shop door (or the stairwell's neighbour) must be from the object's centre. */
const DOOR_CLEAR = 1.7

const cache = new WeakMap<World, Discovery[]>()

/** The facade's left-to-right frame as seen from the street, matching how the ground floor is drawn. */
function frameOf(f: FacadeSpec): { origin: Vec2; u: Vec2; width: number } {
  const W = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1])
  let ux = (f.b[0] - f.a[0]) / W
  let uz = (f.b[1] - f.a[1]) / W
  let origin = f.a
  if (-uz * f.outward[0] + ux * f.outward[1] < 0) {
    ux = -ux
    uz = -uz
    origin = f.b
  }
  return { origin, u: [ux, uz], width: W }
}

function doorAlong(f: FacadeSpec, width: number): number | null {
  if (f.ground.door === 'none') return null
  return f.ground.door === 'left' ? 0.9 : f.ground.door === 'right' ? width - 0.9 : width / 2
}

/** Finds and registers every discovery. Adds their colliders to the world; call once, after props and facades. */
export function placeDiscoveries(world: World): Discovery[] {
  const hit = cache.get(world)
  if (hit) return hit
  const placed: Discovery[] = []
  const blockPolys = world.blocks.map((b) => b.footprint)
  const taken: Vec2[][] = []

  for (const spec of SPECS) {
    const all = world.facades.filter((f) => f.streetId === spec.street && f.source === 'lot' && f.width >= spec.w + 2 * DOOR_CLEAR * 0.5 && spec.accept(f))
    const order = [...spec.prefer.map((id) => all.find((f) => f.id === id)).filter((f): f is FacadeSpec => !!f), ...all.filter((f) => !spec.prefer.includes(f.id))]
    let found: Discovery | null = null
    for (const f of order) {
      const { origin, u, width } = frameOf(f)
      const outward = normalize(f.outward)
      const door = doorAlong(f, width)
      // Start at the middle and work outwards, so the object sits where a person would put it.
      const candidates: number[] = []
      for (let s = spec.w / 2 + 0.5; s <= width - spec.w / 2 - 0.5; s += 0.25) candidates.push(s)
      candidates.sort((p, q) => Math.abs(p - width / 2) - Math.abs(q - width / 2))
      for (const s of candidates) {
        if (door !== null && Math.abs(s - door) < DOOR_CLEAR) continue
        const wall: Vec2 = [origin[0] + u[0] * s, origin[1] + u[1] * s]
        const centre: Vec2 = [wall[0] + outward[0] * (spec.d / 2 + WALL_GAP), wall[1] + outward[1] * (spec.d / 2 + WALL_GAP)]
        const hw = spec.w / 2
        const hd = spec.d / 2
        const poly: Vec2[] = [
          [centre[0] + u[0] * hw + outward[0] * hd, centre[1] + u[1] * hw + outward[1] * hd],
          [centre[0] - u[0] * hw + outward[0] * hd, centre[1] - u[1] * hw + outward[1] * hd],
          [centre[0] - u[0] * hw - outward[0] * hd, centre[1] - u[1] * hw - outward[1] * hd],
          [centre[0] + u[0] * hw - outward[0] * hd, centre[1] + u[1] * hw - outward[1] * hd],
        ]
        // A little extra room all round, and a path to the front.
        const pad = 0.2
        const wide: Vec2[] = poly.map((p, i) => {
          const sx = i === 0 || i === 3 ? 1 : -1
          const sy = i < 2 ? 1 : -1
          return [p[0] + u[0] * sx * pad + outward[0] * sy * pad, p[1] + u[1] * sx * pad + outward[1] * sy * pad] as Vec2
        })
        const front: Vec2 = [centre[0] + outward[0] * (hd + STAND_OFF), centre[1] + outward[1] * (hd + STAND_OFF)]

        if (poly.some((p) => blockPolys.some((b) => pointInPolygon(p, b)))) continue
        const b = boundsOf(wide)
        if (obstaclesNear(world, centre, spec.w + 1).some((o) => o.kind !== 'block' && o.top > 0.05 && o.bounds.minX < b.maxX && o.bounds.maxX > b.minX && o.bounds.minZ < b.maxZ && o.bounds.maxZ > b.minZ && convexOverlap(wide, o.poly))) continue
        if (world.props.some((p) => Math.hypot(p.at[0] - centre[0], p.at[1] - centre[1]) < 3 && convexOverlap(wide, rectPoly(p.at, p.yaw, p.size[0], p.size[1])))) continue
        if (taken.some((t) => convexOverlap(wide, t))) continue
        if (world.keepouts.some((k) => convexOverlap(poly, k))) continue
        if (world.corridors.some((c) => c.bounds.minX < b.maxX && c.bounds.maxX > b.minX && c.bounds.minZ < b.maxZ && c.bounds.maxZ > b.minZ && convexOverlap(poly, c.poly))) continue
        // Somewhere to stand, with room beside it, that the player can actually be.
        const room: Vec2[] = [front, [front[0] + u[0] * 0.5, front[1] + u[1] * 0.5], [front[0] - u[0] * 0.5, front[1] - u[1] * 0.5], [centre[0] + outward[0] * (hd + 0.6), centre[1] + outward[1] * (hd + 0.6)]]
        if (room.some((p) => isBlocked(world, p, 0, PLAYER_RADIUS + 0.1))) continue

        found = {
          kind: spec.kind,
          facadeId: f.id,
          streetId: f.streetId,
          wall,
          outward,
          right: u,
          at: centre,
          yaw: Math.atan2(outward[0], outward[1]),
          size: [spec.w, spec.d],
          front,
        }
        taken.push(wide)
        if (spec.top > 0) {
          const o: Obstacle = { poly, bounds: boundsOf(poly), top: spec.top, kind: 'prop' }
          world.obstacles.push(o)
        }
        break
      }
      if (found) break
    }
    if (!found) throw new Error(`No place found for the ${spec.kind} on ${spec.street}`)
    placed.push(found)
  }
  cache.set(world, placed)
  return placed
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export interface PlayerView {
  x: number
  z: number
  y: number
  yaw: number
}

/** How close the player must be, and how directly they must face the object, for each kind. */
const REACH: Record<DiscoveryKind, { dist: number; facing: number }> = {
  cat: { dist: 3.5, facing: 75 },
  vending: { dist: 3.2, facing: 65 },
  phone: { dist: 3.0, facing: 65 },
  roof: { dist: 3.5, facing: 65 },
  arcade: { dist: 3.5, facing: 70 },
}

/**
 * The discovery the player could use right now: in front of it (on the street side of its wall), close,
 * and looking its way. Returns the nearest, so two prompts can never compete.
 */
export function nearbyDiscovery(world: World, p: PlayerView): Discovery | null {
  if (Math.abs(p.y) > 1) return null
  // Looking direction for a yaw applied as a Y rotation with Y-up: (sin yaw, cos yaw).
  const fx = Math.sin(p.yaw)
  const fz = Math.cos(p.yaw)
  let best: Discovery | null = null
  let bestDist = Infinity
  for (const d of placeDiscoveries(world)) {
    const reach = REACH[d.kind]
    const dx = p.x - d.at[0]
    const dz = p.z - d.at[1]
    const dist = Math.hypot(dx, dz)
    if (dist > reach.dist || dist >= bestDist) continue
    const along = dx * d.outward[0] + dz * d.outward[1]
    const across = Math.abs(dx * d.right[0] + dz * d.right[1])
    if (along < d.size[1] / 2 + 0.2 || across > d.size[0] / 2 + 1.1) continue
    // (fx, fz) is the way the player is looking; (dx, dz) points from the player to the object.
    const toward = dist < 1e-6 ? 1 : (dx * fx + dz * fz) / dist
    if (toward < Math.cos((reach.facing * Math.PI) / 180)) continue
    best = d
    bestDist = dist
  }
  return best
}

export function discoveryOf(world: World, kind: DiscoveryKind): Discovery {
  const d = placeDiscoveries(world).find((x) => x.kind === kind)
  if (!d) throw new Error(`No ${kind} discovery`)
  return d
}
