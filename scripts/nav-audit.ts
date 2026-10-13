import { PLAYER } from '../src/config/player.ts'
import { stationVisibleFrom } from '../src/world/analysis.ts'
import { buildWorld } from '../src/world/build.ts'
import { distance, type Vec2 } from '../src/world/geometry2d.ts'
import { DISTRICT } from '../src/world/layout.ts'
import { shortestRoute } from '../src/world/navigation.ts'
import { buildWalkGrid, findPath } from '../src/world/reachability.ts'

/*
 * Navigation audit (development only): start and station coordinates, route
 * lengths and times at the real walking speed, and what can be seen of the
 * station from the start and from the footbridge deck. Reads the same data the
 * game uses; nothing here is estimated by hand.
 */

const world = buildWorld(DISTRICT)
const g = world.navigation
const sec = (m: number) => m / PLAYER.speed
const fmt = (m: number) => `${m.toFixed(0)} m, ${sec(m).toFixed(0)} s`
const at = (id: string) => world.nodes.get(id)!.at as Vec2

console.log(`Speed ${PLAYER.speed} m/s. Start ${world.spawn.at.map((v) => v.toFixed(1)).join(', ')}.`)
for (const e of world.goal.entrances) {
  console.log(`Entrance ${e.node} at ${e.at.map((v) => v.toFixed(1)).join(', ')}: straight line ${distance(world.spawn.at, e.at).toFixed(0)} m`)
}

console.log('\nDesigned routes (street-graph length; real walking adds a few percent for corners and props):')
for (const r of world.layout.routes) {
  let len = 0
  for (let i = 0; i < r.via.length - 1; i++) len += shortestRoute(g, r.via[i], r.via[i + 1])?.length ?? NaN
  console.log(`  ${r.name.padEnd(44)} ${fmt(len)}`)
}

const best = world.goal.entrances.map((e) => shortestRoute(g, world.spawn.node, e.node)).filter((r) => r !== null)
const shortest = Math.min(...best.map((r) => r.length))
console.log(`  Shortest on the graph (any entrance)        ${fmt(shortest)}`)

// A detour: the market route, but first walk the whole of Lok Wo Lane east and back to the Tak On corner.
const detour = [
  ['SQ', 'L1'], ['L1', 'L2'], ['L2', 'L3'], ['L3', 'L2'], ['L2', 'L1'], ['L1', 'K3'], ['K3', 'K2'], ['K2', 'K1'], ['K1', 'J1'], ['J1', 'C1'], ['C1', 'K2'], ['K2', 'K1'], ['K1', 'T2'], ['T2', 'FBN'], ['FBN', 'STW'],
]
let detourLen = 0
for (const [a, b] of detour) detourLen += shortestRoute(g, a, b)?.length ?? 0
console.log(`  Market route with two wrong turns            ${fmt(detourLen)}`)

// Ground walking distance (real collision, footbridge not counted: stairs are solid in the grid).
const grid = buildWalkGrid(world, 0.5, 25, 0)
for (const e of world.goal.entrances) {
  const p = findPath(grid, world.spawn.at, e.at)
  console.log(`  Ground A* spawn -> ${e.node} (real collision, no bridge) ${p ? fmt(p.length) : 'unreachable'}`)
}

console.log('\nStation visibility (sign band, using the building heights):')
console.log(`  from the spawn: ${stationVisibleFrom(world, world.spawn.at) ? 'VISIBLE' : 'hidden'}`)
const deckHeight = world.layout.footbridge.deckHeight
const bridgeEye = deckHeight + 1.62
const pts: Vec2[] = []
const f = world.layout.footbridge
for (const dk of f.decks) for (let t = 0; t <= 1; t += 0.1) pts.push([dk.from[0] + (dk.to[0] - dk.from[0]) * t, dk.from[1] + (dk.to[1] - dk.from[1]) * t])
for (const s of f.stairs) for (let t = 0; t <= 1; t += 0.25) pts.push([s.bottom[0] + (s.top[0] - s.bottom[0]) * t, s.bottom[1] + (s.top[1] - s.bottom[1]) * t])
const seen = pts.filter((p) => stationVisibleFrom(world, p, bridgeEye))
console.log(`  from footbridge deck and stairs (eye ${bridgeEye.toFixed(1)} m): ${seen.length}/${pts.length} sample points`)
for (const p of seen) console.log(`     ${p.map((v) => v.toFixed(1)).join(', ')}  ${distance(p, at('STW')).toFixed(0)} m from STW`)
