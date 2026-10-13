import { PLAYER } from '../config/player.ts'
import type { NavEdge, Prism, World } from './build.ts'
import { distance, normalize, seededRandom, sub, type Bounds, type Vec2 } from './geometry2d.ts'
import { cellIndex, type WalkGrid } from './reachability.ts'

/**
 * Measurements of how the district plays at street level: how far you can see,
 * where the station can be seen from, and how a lost walker fares. Development
 * checks only.
 */

const EYE = 1.62
/** Anything this tall blocks the view at eye level. */
const TALL = 1.8
/** Height of the station sign band, the thing a player would spot first. */
const SIGN_HEIGHT = 8.5
const MAX_VIEW = 150

/** First-person sample points: reachable ground in the district, clear of the trunk road. */
export function samplePoints(world: World, grid: WalkGrid, step = 6): Vec2[] {
  const west = world.nodes.get('TW')?.at as Vec2
  const east = world.nodes.get('TE')?.at as Vec2
  const slope = (east[1] - west[1]) / (east[0] - west[0])
  const out: Vec2[] = []
  const b: Bounds = grid.bounds
  for (let x = Math.ceil(b.minX / step) * step; x < b.maxX; x += step) {
    for (let z = Math.ceil(b.minZ / step) * step; z < b.maxZ; z += step) {
      const trunkZ = west[1] + (x - west[0]) * slope
      if (z < trunkZ + 9) continue
      const i = cellIndex(grid, [x, z])
      if (i !== null && grid.state[i] === 2) out.push([x, z])
    }
  }
  return out
}

/** Distance along a ray to the first of the polygons' edges, or `max`. */
function rayDistance(from: Vec2, dir: Vec2, max: number, polys: readonly Vec2[][]): number {
  let best = max
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const t = rayEdge(from, dir, poly[i], poly[(i + 1) % poly.length])
      if (t !== null && t < best) best = t
    }
  }
  return best
}

function rayEdge(p: Vec2, d: Vec2, a: Vec2, b: Vec2): number | null {
  const ex = b[0] - a[0]
  const ez = b[1] - a[1]
  const denom = d[0] * ez - d[1] * ex
  if (Math.abs(denom) < 1e-9) return null
  const wx = a[0] - p[0]
  const wz = a[1] - p[1]
  const t = (wx * ez - wz * ex) / denom
  const u = (wx * d[1] - wz * d[0]) / denom
  return t >= 0 && u >= 0 && u <= 1 ? t : null
}

export interface SightlineReport {
  samples: number
  median: number
  p90: number
  max: number
  /** Share of positions that can see further than `far` metres along some line. */
  shareBeyondFar: number
  far: number
}

/** For each position, the longest straight unobstructed line of sight, over 24 directions. */
export function sightlines(world: World, points: readonly Vec2[], far = 80): SightlineReport {
  const polys = world.obstacles.filter((o) => o.top > TALL).map((o) => o.poly)
  const longest = points.map((p) => {
    let m = 0
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      m = Math.max(m, rayDistance(p, [Math.cos(a), Math.sin(a)], MAX_VIEW, polys))
    }
    return m
  })
  const sorted = [...longest].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return {
    samples: points.length,
    median: at(0.5),
    p90: at(0.9),
    max: sorted[sorted.length - 1],
    shareBeyondFar: longest.filter((d) => d > far).length / Math.max(1, longest.length),
    far,
  }
}

/** Parameter along a→b at which it first enters the polygon, or null. */
function entry(a: Vec2, b: Vec2, poly: readonly Vec2[]): number | null {
  const d = sub(b, a)
  let best: number | null = null
  for (let i = 0; i < poly.length; i++) {
    const t = rayEdge(a, d, poly[i], poly[(i + 1) % poly.length])
    if (t !== null && t <= 1 && (best === null || t < best)) best = t
  }
  return best
}

/** Can an eye-level viewer at `from` see a point `height` metres up at `to`? Buildings block by height. */
function canSee(from: Vec2, to: Vec2, height: number, prisms: readonly Prism[], eye = EYE): boolean {
  for (const p of prisms) {
    const t = entry(from, to, p.footprint)
    if (t === null || t >= 0.999) continue
    const rayHeight = eye + (height - eye) * t
    if (p.base + p.height > rayHeight) return false
  }
  return true
}

/** Whether the station's sign band can be seen from `from`. */
export function stationVisibleFrom(world: World, from: Vec2, eye = EYE): boolean {
  const prisms = world.prisms.filter((p) => p.kind !== 'station')
  return world.station.entrances.some(({ facade, at, outward }) => {
    const along = normalize(sub(facade[1], facade[0]))
    return [-5, 0, 5].some((k) => {
      const target: Vec2 = [at[0] + along[0] * k + outward[0] * 0.3, at[1] + along[1] * k + outward[1] * 0.3]
      return canSee(from, target, SIGN_HEIGHT, prisms, eye)
    })
  })
}

export function stationVisibility(world: World, points: readonly Vec2[]): { share: number; visibleFrom: Vec2[] } {
  const prisms = world.prisms.filter((p) => p.kind !== 'station')
  const visibleFrom = points.filter((p) =>
    world.station.entrances.some(({ facade, at, outward }) => {
      const along = normalize(sub(facade[1], facade[0]))
      return [-5, 0, 5].some((k) =>
        canSee(p, [at[0] + along[0] * k + outward[0] * 0.3, at[1] + along[1] * k + outward[1] * 0.3], SIGN_HEIGHT, prisms),
      )
    }),
  )
  return { share: visibleFrom.length / Math.max(1, points.length), visibleFrom }
}

export interface WandererReport {
  trials: number
  /** Metres walked, 25th / 50th / 75th / 90th percentile. */
  distance: { p25: number; p50: number; p75: number; p90: number }
}

/**
 * A lost walker on the street graph: at each junction picks a way other than
 * the one it came from, and walks into and back out of every dead-end nook.
 * With `northBias`, ways heading towards the trunk road are `northBias` times
 * as likely, like a player who has worked out the station is that way.
 */
export function wander(world: World, northBias: number, trials = 4000): WandererReport {
  const g = world.navigation
  const random = seededRandom(`wander:${northBias}`)
  const goals = new Set(world.goal.entrances.map((e) => e.node))

  interface Way {
    to: string
    length: number
    /** Extra metres for a nook: walk in and back out, then pick again. */
    nook: boolean
    key: string
  }
  const ways = new Map<string, Way[]>()
  const add = (from: string, way: Way) => ways.set(from, [...(ways.get(from) ?? []), way])
  g.edges.forEach((e: NavEdge, i) => {
    add(e.a, { to: e.b, length: e.length, nook: false, key: `e${i}` })
    add(e.b, { to: e.a, length: e.length, nook: false, key: `e${i}` })
  })
  world.layout.streets.forEach((s) => {
    if (!s.blocked) return
    const [a, b] = s.nodes
    const pa = world.nodes.get(a)?.at as Vec2
    const pb = world.nodes.get(b)?.at as Vec2
    const len = distance(pa, pb)
    // A nook is a dead end; the far side is only a nook if the player can reach it.
    if (g.nodes.has(a)) add(a, { to: a, length: 2 * len * s.blocked.at, nook: true, key: `n${s.id}a` })
    if (g.nodes.has(b)) add(b, { to: b, length: 2 * len * (1 - s.blocked.at), nook: true, key: `n${s.id}b` })
  })

  const results: number[] = []
  for (let t = 0; t < trials; t++) {
    let at = world.spawn.node
    let cameBy = ''
    let walked = 0
    for (let step = 0; step < 500 && !goals.has(at); step++) {
      const options = (ways.get(at) ?? []).filter((w) => w.key !== cameBy)
      const pool = options.length > 0 ? options : (ways.get(at) ?? [])
      const here = g.nodes.get(at)?.at as Vec2
      const weight = (w: Way) => {
        if (w.nook) return 1
        const there = g.nodes.get(w.to)?.at as Vec2
        return there[1] < here[1] - 5 ? northBias : 1
      }
      const total = pool.reduce((s, w) => s + weight(w), 0)
      let pick = random() * total
      let chosen = pool[pool.length - 1]
      for (const w of pool) {
        pick -= weight(w)
        if (pick <= 0) {
          chosen = w
          break
        }
      }
      walked += chosen.length
      cameBy = chosen.nook ? '' : chosen.key
      at = chosen.to
    }
    results.push(walked)
  }
  results.sort((a, b) => a - b)
  const q = (f: number) => results[Math.min(results.length - 1, Math.floor(f * results.length))]
  return { trials, distance: { p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) } }
}

export function seconds(metres: number): number {
  return metres / PLAYER.speed
}

/** Count of junction decisions (nodes with three or more ways on) along a route. */
export function decisionsAlong(world: World, nodes: readonly string[]): number {
  const g = world.navigation
  return nodes.slice(1, -1).filter((id) => g.edges.filter((e) => e.a === id || e.b === id).length >= 3).length
}
