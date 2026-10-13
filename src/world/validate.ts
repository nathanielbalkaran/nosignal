import { PLAYER } from '../config/player.ts'
import type { World } from './build.ts'
import { STEP_HEIGHT } from './collision.ts'
import { SHOP_LABELS, WAYFINDING } from './signage.ts'
import { decisionsAlong, samplePoints, sightlines, stationVisibility, stationVisibleFrom } from './analysis.ts'
import { distance, lerp, pointInPolygon, segmentHitsPolygon, segmentsIntersect, signedArea, type Vec2 } from './geometry2d.ts'
import { degree, diverseRoutes, edgeDisjointRouteCount, loopCount, mergeNodes, shortestRoute, type Route } from './navigation.ts'
import { buildWalkGrid, isReachable, leaksToEdge, walkingDistance, type WalkGrid } from './reachability.ts'

/** Layout checks run by `npm run check:world` and shown in the dev map. */

export interface Check {
  label: string
  ok: boolean
  detail: string
}

export interface ValidationReport {
  checks: Check[]
  routes: Route[]
  grid: WalkGrid
}

/** A navigation edge may be at most this much longer on foot than in a straight line. */
const MAX_DETOUR = 1.6

/** Views longer than this count as a long sightline. */
const SIGHT_FAR = 80

export function validateWorld(world: World): ValidationReport {
  const checks: Check[] = []
  const check = (label: string, ok: boolean, detail: string) => checks.push({ label, ok, detail })
  const g = world.navigation
  const from = world.spawn.node
  const entranceIds = world.goal.entrances.map((e) => e.node)
  // Topology checks treat every station entrance as one destination.
  const to = 'STATION'
  const merged = mergeNodes(g, entranceIds, to)

  const intersections = [...merged.nodes.keys()].filter((id) => id !== to && degree(merged, id) >= 3)
  check('15–20 meaningful intersections', intersections.length >= 15 && intersections.length <= 20, `${intersections.length}: ${intersections.join(', ')}`)

  const deadEnds = [...merged.nodes.keys()].filter((id) => degree(merged, id) < 2)
  check('No accidental dead ends in the street network', deadEnds.length === 0, deadEnds.length ? deadEnds.join(', ') : 'none')

  // Deliberate dead ends: locked alleys. Each open end is a nook the player can walk into.
  const blockedStreets = world.layout.streets.filter((s) => s.blocked)
  const nooks = blockedStreets.reduce((sum, s) => sum + s.nodes.filter((id) => g.nodes.has(id)).length, 0)
  check(
    'A few believable dead ends',
    nooks >= 3 && nooks <= 6,
    `${nooks} walkable nooks in ${blockedStreets.length} locked alleys: ${blockedStreets.map((s) => s.name.en).join(', ')}`,
  )

  const loops = loopCount(merged)
  check('Many interconnected loops', loops >= 6, `${loops} independent loops`)

  const shortest = shortestRoute(merged, from, to)
  check(
    'Station reachable on the street graph',
    shortest !== null,
    shortest ? `shortest ${Math.round(shortest.length)} m (~${Math.round(shortest.length / PLAYER.speed)} s at ${PLAYER.speed} m/s)` : 'unreachable',
  )

  const disjoint = edgeDisjointRouteCount(merged, from, to)
  check('At least three routes sharing no street', disjoint >= 3, `${disjoint} fully separate routes`)

  const found = diverseRoutes(merged, from, to, 3)
  check('Graph offers three distinct routes', found.length >= 3, `${found.length} routes overlapping ≤ 50%`)

  // The designed routes must be real paths and genuinely different from each other.
  const routes: Route[] = []
  const routeProblems: string[] = []
  for (const r of world.layout.routes) {
    const route = routeFromNodes(g, r.via)
    if (!route) routeProblems.push(`"${r.name}" is not a connected path`)
    else if (r.via[0] !== from || !entranceIds.includes(r.via[r.via.length - 1])) routeProblems.push(`"${r.name}" must run spawn → station`)
    else routes.push(route)
  }
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const shared = routes[i].edges.filter((e) => routes[j].edges.includes(e)).reduce((s, e) => s + g.edges[e].length, 0)
      const overlap = shared / Math.min(routes[i].length, routes[j].length)
      if (overlap > 0.5) routeProblems.push(`routes ${i + 1} and ${j + 1} share ${Math.round(overlap * 100)}%`)
    }
  }
  check(
    'Three designed routes are valid and distinct',
    routes.length >= 3 && routeProblems.length === 0,
    routeProblems.length ? routeProblems.join('; ') : routes.map((r) => `${Math.round(r.length)} m`).join(', '),
  )

  const footbridgeRoute = routes.some((r) => r.edges.some((e) => g.edges[e].kind === 'footbridge'))
  check('One designed route uses the footbridge', footbridgeRoute, footbridgeRoute ? 'yes' : 'no')

  // Geometry: streets must stay clear of buildings.
  const clashes: string[] = []
  for (const seg of world.segments) {
    for (const block of world.blocks) {
      if (segmentHitsPolygon(seg.a, seg.b, block.footprint)) clashes.push(`${seg.street.id} × ${block.layout.id}`)
    }
  }
  check('No street centreline passes through a block', clashes.length === 0, clashes.length ? clashes.join(', ') : 'clear')

  // Blocks must be sound: no inside-out footprints, no self-crossings, no overlaps.
  const blockProblems: string[] = []
  const edgesOf = (poly: Vec2[]) => poly.map((a, i) => [a, poly[(i + 1) % poly.length]] as const)
  for (const b of world.blocks) {
    const flipped = Math.sign(signedArea(b.outline)) !== Math.sign(signedArea(b.footprint))
    const derived = /^F\d+$/.test(b.layout.id)
    if (flipped || (derived && Math.abs(signedArea(b.footprint)) < 150)) blockProblems.push(`${b.layout.id} is degenerate`)
    const e = edgesOf(b.footprint)
    for (let i = 0; i < e.length; i++) {
      for (let j = i + 2; j < e.length; j++) {
        if (i === 0 && j === e.length - 1) continue
        if (segmentsIntersect(e[i][0], e[i][1], e[j][0], e[j][1])) blockProblems.push(`${b.layout.id} crosses itself`)
      }
    }
  }
  const touchesStreets = world.blocks.filter((b) => /^F\d+$/.test(b.layout.id) || b.layout.id === 'OUTER')
  for (const a of touchesStreets) {
    for (const b of world.blocks) {
      if (a === b || (b.layout.id < a.layout.id && touchesStreets.includes(b))) continue
      const crossing = edgesOf(a.footprint).some(([p, q]) => edgesOf(b.footprint).some(([r, s2]) => segmentsIntersect(p, q, r, s2)))
      if (crossing || pointInPolygon(a.footprint[0], b.footprint) || pointInPolygon(b.footprint[0], a.footprint)) {
        blockProblems.push(`${a.layout.id} overlaps ${b.layout.id}`)
      }
    }
  }
  const derivedCount = world.blocks.filter((b) => /^F\d+$/.test(b.layout.id)).length
  check('Blocks are sound and do not overlap', blockProblems.length === 0, blockProblems.length ? [...new Set(blockProblems)].join('; ') : `${derivedCount} enclosed blocks derived from the street graph`)

  // Ground truth: flood-fill the real collision world from the spawn point.
  const grid = buildWalkGrid(world)
  check('Spawn point is walkable', isReachable(grid, world.spawn.at), `${world.spawn.at.join(', ')}`)
  const unreachableEntrances = world.goal.entrances.filter((e) => !isReachable(grid, e.at)).map((e) => e.node)
  check(
    'Every station entrance reachable on foot',
    unreachableEntrances.length === 0,
    unreachableEntrances.length ? `unreachable: ${unreachableEntrances.join(', ')}` : world.goal.entrances.map((e) => e.node).join(', '),
  )
  check('Player cannot walk out of the district', !leaksToEdge(grid), leaksToEdge(grid) ? 'reachable cells touch the edge' : 'enclosed')

  const unreachableNodes = [...g.nodes.values()].filter((n) => !isReachable(grid, n.at)).map((n) => n.id)
  check('Every navigation node reachable on foot', unreachableNodes.length === 0, unreachableNodes.length ? unreachableNodes.join(', ') : 'all reachable')

  const detours: string[] = []
  const groundEdges = g.edges.filter((e) => e.kind !== 'footbridge')
  for (const e of groundEdges) {
    const a = g.nodes.get(e.a)?.at as Vec2
    const b = g.nodes.get(e.b)?.at as Vec2
    const walk = walkingDistance(grid, a, b)
    if (walk === null || walk > distance(a, b) * MAX_DETOUR + 3) {
      detours.push(`${e.a}–${e.b}: ${walk === null ? 'no path' : `${Math.round(walk)} m for ${Math.round(distance(a, b))} m`}`)
    }
  }
  check('Every street link is directly walkable', detours.length === 0, detours.length ? detours.join(', ') : `${groundEdges.length} links ok`)

  // Footbridge: both stair feet reachable, every stair top lands on a deck, decks connect.
  const stairFeet = world.ramps.map((r) => lerp(r.bottom, r.top, -0.05))
  const feetOk = stairFeet.every((p) => isReachable(grid, p))
  const topsOk = world.ramps.every((r) => world.decks.some((d) => pointInPolygon(lerp(r.bottom, r.top, 0.98), d.poly)))
  const decksOk = world.decks.every((d, i) => i === 0 || world.decks.slice(0, i).some((o) => d.poly.some((p) => pointInPolygon(p, o.poly)) || o.poly.some((p) => pointInPolygon(p, d.poly))))
  check('Footbridge connects both sides', feetOk && topsOk && decksOk, `stair feet ${feetOk ? 'ok' : 'blocked'}, stair tops ${topsOk ? 'ok' : 'off deck'}, decks ${decksOk ? 'joined' : 'gap'}`)

  // Where a stair runs under a deck, the step down at the deck edge must be walkable.
  const ledges = world.ramps.map((r) => {
    let overlap = 0
    while (overlap < r.halfLength * 2 && world.decks.some((d) => pointInPolygon(lerp(r.top, r.bottom, overlap / (r.halfLength * 2)), d.poly))) overlap += 0.05
    return (overlap / (r.halfLength * 2)) * r.rise
  })
  check('Stairs meet the deck without a ledge', ledges.every((h) => h <= STEP_HEIGHT * 0.75), ledges.map((h) => `${h.toFixed(2)} m`).join(', '))

  // First-person analysis from every reachable position in the district.
  const points = samplePoints(world, grid)
  const hiddenAtStart = !stationVisibleFrom(world, world.spawn.at)
  check('Station not visible from the start', hiddenAtStart, hiddenAtStart ? 'hidden' : 'the station sign is in view at the spawn point')

  const seen = stationVisibility(world, points)
  check(
    'Station hidden from most of the district',
    seen.share <= 0.2,
    `sign band visible from ${(seen.share * 100).toFixed(1)}% of ${points.length} street-level positions (limit 20%)`,
  )

  const view = sightlines(world, points, SIGHT_FAR)
  check(
    'Sightlines are short',
    view.p90 <= 70 && view.shareBeyondFar <= 0.05,
    `typical longest view ${view.median.toFixed(0)} m, 90th percentile ${view.p90.toFixed(0)} m; ${(view.shareBeyondFar * 100).toFixed(1)}% of positions see further than ${SIGHT_FAR} m`,
  )

  const decisions = world.layout.routes.map((r) => decisionsAlong(world, r.via))
  check(
    'Every designed route needs several decisions',
    decisions.every((d) => d >= 4),
    `junctions passed: ${decisions.join(', ')}`,
  )

  checkEnvironment(world, routes, check)

  return { checks, routes, grid }
}

/** Extra clearance, over the player's collision radius, that routes must still have after props are placed. */
const FAT_CLEARANCE = 0.25

/** Phase 2: props, facades and the routes that must survive them. */
function checkEnvironment(world: World, routes: Route[], check: (label: string, ok: boolean, detail: string) => void) {
  const g = world.navigation

  // Every walking link still has room for a wider walker, so no prop pinches a street shut.
  const fat = buildWalkGrid(world, 0.5, 25, FAT_CLEARANCE)
  const fatSpawn = isReachable(fat, world.spawn.at)
  const fatEntrances = world.goal.entrances.filter((e) => !isReachable(fat, e.at)).map((e) => e.node)
  const fatNodes = [...g.nodes.values()].filter((n) => !isReachable(fat, n.at)).map((n) => n.id)
  check(
    `Everything stays reachable with +${FAT_CLEARANCE} m extra clearance`,
    fatSpawn && fatEntrances.length === 0 && fatNodes.length === 0,
    fatSpawn ? [...fatEntrances, ...fatNodes].join(', ') || 'spawn, entrances and all nodes reachable' : 'spawn blocked',
  )

  const pinched: string[] = []
  for (const e of g.edges.filter((x) => x.kind !== 'footbridge')) {
    const a = g.nodes.get(e.a)?.at as Vec2
    const b = g.nodes.get(e.b)?.at as Vec2
    const walk = walkingDistance(fat, a, b)
    if (walk === null || walk > distance(a, b) * MAX_DETOUR + 3) pinched.push(`${e.a}–${e.b}`)
  }
  check('No street link is pinched or forced into a detour by props', pinched.length === 0, pinched.length ? pinched.join(', ') : 'all links open')

  const routeCut = routes.map((r, i) => {
    const bad = r.edges.filter((ei) => {
      const e = g.edges[ei]
      if (e.kind === 'footbridge') return false
      const a = g.nodes.get(e.a)?.at as Vec2
      const b = g.nodes.get(e.b)?.at as Vec2
      return walkingDistance(fat, a, b) === null
    })
    return bad.length ? `route ${i + 1}: ${bad.length} cut` : null
  })
  check('All three designed routes remain open', routeCut.every((r) => r === null) && routes.length >= 3, routeCut.filter(Boolean).join(', ') || `${routes.length} routes open`)

  // Props must be outside buildings and keep-outs, and the station forecourt must stay clear.
  const inside: string[] = []
  const inKeepout: string[] = []
  for (const p of world.props) {
    for (const c of p.colliders) {
      for (const pt of c.poly) {
        if (world.prisms.some((b) => pointInPolygon(pt, b.footprint))) {
          inside.push(`${p.type}#${p.id}`)
          break
        }
      }
      if (p.type !== 'coveredWalkway' && world.keepouts.some((k) => c.poly.some((pt) => pointInPolygon(pt, k)))) inKeepout.push(`${p.type}#${p.id}`)
    }
  }
  check('No solid prop stands inside a building', inside.length === 0, inside.length ? [...new Set(inside)].slice(0, 8).join(', ') : `${world.props.length} props checked`)
  check('Station forecourt, stairs and spawn keep-outs are clear', inKeepout.length === 0, inKeepout.length ? [...new Set(inKeepout)].slice(0, 8).join(', ') : `${world.keepouts.length} keep-out zones clear`)
  const nearEntrance = world.props.filter((p) => p.colliders.length > 0 && world.goal.entrances.some((e) => distance(e.at, p.at) < 6))
  check('Nothing solid within 6 m of a station entrance', nearEntrance.length === 0, nearEntrance.length ? nearEntrance.map((p) => p.type).join(', ') : 'clear')

  // The construction site keeps a pedestrian route through it.
  const site = world.props.filter((p) => p.zone === 'construction' && p.colliders.length > 0)
  check('Construction area is present and still passable', site.length >= 3 && pinched.length === 0, `${site.length} solid site props`)

  // Content sanity.
  const bad = world.facades.filter((f) => {
    const signs = [f.fascia, ...f.vertical].filter((s) => s !== null)
    return signs.some((s) => typeof s.label === 'number' && (s.label < 0 || s.label >= SHOP_LABELS.length))
  })
  check('Every sign uses a curated label', bad.length === 0, `${world.facades.length} facades, ${world.plates.length} plates`)

  const signs = world.plates.filter((p) => p.kind === 'direction')
  check('Every directional station sign found a wall', signs.length === WAYFINDING.length, `${signs.length}/${WAYFINDING.length}: ${signs.map((p) => `${p.ref} ${p.arrow}`).join(', ')}`)

  const r = world.placement
  const solid = world.props.filter((p) => p.colliders.length > 0).length
  check(
    'Placement report',
    world.props.length >= 120,
    `${world.props.length} props (${solid} solid), ${r.attempts} attempts, ${r.rejected} rejected ${JSON.stringify(r.rejectedBy)}, ${r.occluders} view-blocking solids`,
  )
  const repeated = (['scooter', 'bicycle', 'motorcycle', 'bench', 'crates', 'cart'] as const).map((t) => `${t} ${r.byType[t] ?? 0}`)
  const over = (r.byType.scooter ?? 0) > 16 || (r.byType.bicycle ?? 0) > 10 || (r.byType.bench ?? 0) > 4 || (r.byType.crates ?? 0) > 20
  check('Repetitive props stay rare', !over, repeated.join(', '))
}

function routeFromNodes(g: World['navigation'], via: readonly string[]): Route | null {
  const edges: number[] = []
  let total = 0
  for (let i = 0; i < via.length - 1; i++) {
    const e = g.edges.findIndex((x) => (x.a === via[i] && x.b === via[i + 1]) || (x.b === via[i] && x.a === via[i + 1]))
    if (e < 0) return null
    edges.push(e)
    total += g.edges[e].length
  }
  return { nodes: [...via], edges, length: total }
}
