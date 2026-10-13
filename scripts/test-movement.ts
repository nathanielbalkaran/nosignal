/**
 * Headless movement tests against the real controller step and collision code.
 * A bot walks every designed route with keyboard-style input, then targeted
 * and randomised cases check speed, responsiveness, camera height, walls,
 * stairs, the footbridge deck, railings, tunnelling, and trapping.
 */
import { PLAYER } from '../src/config/player.ts'
import { followEyeHeight, stepMovement, type MoveInput, type Velocity } from '../src/player/movement.ts'
import { buildWorld, type World } from '../src/world/build.ts'
import { isBlocked, movePlayer, PLAYER_RADIUS, standingHeight, type PlayerPosition } from '../src/world/collision.ts'
import {
  add,
  closestPointOnBoundary,
  distance,
  normalize,
  pointInPolygon,
  rectFromSegment,
  scale,
  seededRandom,
  sub,
  type Vec2,
} from '../src/world/geometry2d.ts'
import { enterableEntrance } from '../src/world/goal.ts'
import { atStation } from '../src/world/goal.ts'
import { DISTRICT } from '../src/world/layout.ts'
import { buildWalkGrid, findPath } from '../src/world/reachability.ts'

interface EntranceViewCase {
  x: number
  z: number
  y: number
  yaw: number
}

const world = buildWorld(DISTRICT)
/** The same district without props, for tests that measure the walker rather than the clutter. */
const bare: World = { ...world, props: [], obstacles: world.obstacles.filter((o) => o.kind !== 'prop') }
const grid = buildWalkGrid(world)
const DT = 1 / 60
const FORWARD: MoveInput = { forward: 1, strafe: 0 }
const IDLE: MoveInput = { forward: 0, strafe: 0 }

let failures = 0
function report(ok: boolean, label: string, detail: string) {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n      ${detail}`)
}

/** Yaw that makes "forward" point along `dir` (forward is (-sin yaw, -cos yaw)). */
function yawFacing(dir: Vec2): number {
  const d = normalize(dir)
  return Math.atan2(-d[0], -d[1])
}

/** A player driven exactly like the controller: input + yaw -> velocity -> collision. */
class Walker {
  pos: PlayerPosition
  vel: Velocity = { x: 0, z: 0 }
  eye: number
  readonly world: World
  constructor(at: Vec2, y = 0, w: World = world) {
    this.pos = { x: at[0], z: at[1], y }
    this.eye = y
    this.world = w
  }
  get at(): Vec2 {
    return [this.pos.x, this.pos.z]
  }
  step(input: MoveInput, yaw: number, dt = DT, speed: number = PLAYER.speed) {
    this.pos = stepMovement(this.world, this.pos, this.vel, input, yaw, dt, speed)
    this.eye = followEyeHeight(this.eye, this.pos.y, dt)
  }
  walk(dir: Vec2, seconds: number, dt = DT, speed: number = PLAYER.speed) {
    const yaw = yawFacing(dir)
    for (let t = 0; t < seconds; t += dt) this.step(FORWARD, yaw, dt, speed)
  }
}

/** Steers through waypoints holding W; fails if progress stalls for 3 s. */
function follow(start: Vec2, waypoints: Vec2[]) {
  const w = new Walker(start)
  let time = 0
  let maxY = 0
  let maxEyeLag = 0
  let lastProgress = 0
  for (let i = 0; i < waypoints.length; i++) {
    const target = waypoints[i]
    const reach = i === waypoints.length - 1 ? 1 : 1.2
    let best = Infinity
    while (distance(w.at, target) > reach) {
      w.step(FORWARD, yawFacing(sub(target, w.at)))
      time += DT
      maxY = Math.max(maxY, w.pos.y)
      maxEyeLag = Math.max(maxEyeLag, Math.abs(w.eye - w.pos.y))
      const d = distance(w.at, target)
      if (d < best - 0.05) {
        best = d
        lastProgress = time
      }
      if (time - lastProgress > 3) {
        return { ok: false, end: w.pos, time, maxY, maxEyeLag, why: `stalled at (${w.pos.x.toFixed(1)}, ${w.pos.z.toFixed(1)}, y ${w.pos.y.toFixed(2)}) heading for waypoint ${i}` }
      }
    }
  }
  return { ok: true, end: w.pos, time, maxY, maxEyeLag, why: '' }
}

function navPoint(id: string): Vec2 {
  const n = world.navigation.nodes.get(id)
  if (!n) throw new Error(`no nav node ${id}`)
  return n.at
}

function groundLeg(from: Vec2, to: Vec2): Vec2[] {
  const path = findPath(grid, from, to)
  if (!path) throw new Error(`no ground path ${from} → ${to}`)
  return path.points.filter((_, i) => i % 4 === 0 || i === path.points.length - 1)
}

/** Waypoints over the footbridge: up the south stair, across the deck, down the north stair. */
function footbridgeLeg(): Vec2[] {
  const [south, north] = world.ramps
  const out = (r: (typeof world.ramps)[number], m: number) => add(r.bottom, scale(r.axis, -m))
  return [out(south, 1.5), south.bottom, south.top, world.layout.footbridge.decks[0].to, north.top, north.bottom, out(north, 1.5)]
}

/** A street segment by street id and end nodes. */
function segmentOf(streetId: string, from: string): { a: Vec2; b: Vec2 } {
  const at = world.layout.nodes.find((n) => n.id === from)?.at
  const seg = world.segments.find((s) => s.street.id === streetId && (distance(s.a, at ?? [1e9, 1e9]) < 1e-6 || distance(s.b, at ?? [1e9, 1e9]) < 1e-6))
  if (!seg || !at) throw new Error(`no segment of ${streetId} at ${from}`)
  return distance(seg.a, at) < 1e-6 ? { a: seg.a, b: seg.b } : { a: seg.b, b: seg.a }
}

// An open stretch of Shun Hing Street (J2 to J3): about 30 m ahead and 6 m to either side.
// The free-movement tests measure the walker itself, so they run in the same district with
// its props removed; props are covered by the bot routes and the random walks below.
const OPEN_SEG = segmentOf('shun-hing-street', 'J2')
const OPEN_DIR: Vec2 = normalize(sub(OPEN_SEG.b, OPEN_SEG.a))
const OPEN: Vec2 = add(OPEN_SEG.a, scale(OPEN_DIR, 2))
const OPEN_MID: Vec2 = add(OPEN_SEG.a, scale(sub(OPEN_SEG.b, OPEN_SEG.a), 0.5))
const OPEN_SIDE: Vec2 = [OPEN_DIR[1], -OPEN_DIR[0]]

/** The nearest building to a point. */
function nearestBlock(p: Vec2) {
  let best = { dist: Infinity, inside: false }
  for (const b of world.blocks) {
    const d = closestPointOnBoundary(p, b.footprint).dist
    if (d < best.dist) best = { dist: d, inside: pointInPolygon(p, b.footprint) }
  }
  return best
}

// 1. Walk every designed route.
for (const route of world.layout.routes) {
  const waypoints: Vec2[] = []
  let cursor: Vec2 = world.spawn.at
  for (let i = 0; i < route.via.length - 1; i++) {
    const a = route.via[i]
    const b = route.via[i + 1]
    const edge = world.navigation.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
    if (edge?.kind === 'footbridge') {
      const leg = footbridgeLeg()
      waypoints.push(...groundLeg(cursor, leg[0]), ...leg)
      cursor = leg[leg.length - 1]
    } else {
      waypoints.push(...groundLeg(cursor, navPoint(b)))
      cursor = navPoint(b)
    }
  }
  const result = follow(world.spawn.at, waypoints)
  const inGoal = atStation(world, [result.end.x, result.end.z])
  const bridge = route.via.includes('FBN')
  const ok = result.ok && inGoal && (!bridge || result.maxY > world.layout.footbridge.deckHeight - 0.01)
  report(
    ok,
    `Bot walks "${route.name}"`,
    result.ok
      ? `reached the station in ${Math.round(result.time)} s${bridge ? `, peak height ${result.maxY.toFixed(2)} m, camera at most ${result.maxEyeLag.toFixed(2)} m off the surface` : ''}`
      : result.why,
  )
}

// 2. Top speed matches the config, and diagonals are no faster than straight lines.
{
  const measure = (input: MoveInput) => {
    const w = new Walker(OPEN, 0, bare)
    const yaw = yawFacing(OPEN_DIR)
    for (let t = 0; t < 0.4; t += DT) w.step(input, yaw)
    const before = w.at
    for (let i = 0; i < 30; i++) w.step(input, yaw)
    return distance(before, w.at) / (30 * DT)
  }
  const straight = measure(FORWARD)
  const diagonal = measure({ forward: 1, strafe: -1 })
  const strafe = measure({ forward: 0, strafe: -1 })
  const ok = [straight, diagonal, strafe].every((v) => Math.abs(v - PLAYER.speed) < 0.02)
  report(
    ok,
    'Speed matches config in every direction',
    `forward ${straight.toFixed(2)}, diagonal ${diagonal.toFixed(2)}, strafe ${strafe.toFixed(2)} m/s (config ${PLAYER.speed})`,
  )
}

// 3. Responsive start and stop.
{
  const w = new Walker(OPEN, 0, bare)
  const yaw = yawFacing(OPEN_DIR)
  let t90 = 0
  for (let t = 0; t < 1; t += DT) {
    w.step(FORWARD, yaw)
    if (!t90 && Math.hypot(w.vel.x, w.vel.z) >= PLAYER.speed * 0.9) t90 = t + DT
  }
  const released = w.at
  let stopTime = 0
  for (let t = 0; t < 1; t += DT) {
    w.step(IDLE, yaw)
    if (!stopTime && w.vel.x === 0 && w.vel.z === 0) stopTime = t + DT
  }
  const glide = distance(released, w.at)
  const ok = t90 > 0 && t90 <= 0.15 && glide <= 0.3 && stopTime > 0 && stopTime <= 0.25
  report(ok, 'Responsive start and stop', `90% speed after ${(t90 * 1000).toFixed(0)} ms; stops in ${(stopTime * 1000).toFixed(0)} ms, gliding ${glide.toFixed(2)} m`)
}

// 4. Camera height is constant on flat ground and tracks stairs closely (checked in test 1 for the bridge).
{
  const w = new Walker(OPEN, 0, bare)
  let maxOff = 0
  w.walk(OPEN_DIR, 1)
  for (let t = 0; t < 2; t += DT) {
    w.step({ forward: 1, strafe: Math.sin(t * 7) > 0 ? 1 : -1 }, yawFacing(OPEN_DIR))
    maxOff = Math.max(maxOff, Math.abs(w.eye - w.pos.y), Math.abs(w.pos.y))
  }
  report(maxOff === 0, 'Camera height constant on flat ground', `largest deviation while zig-zagging: ${maxOff.toFixed(3)} m`)
}

// 5. Walking straight into a building stops at the facade.
{
  const w = new Walker(OPEN_MID, 0, bare)
  w.walk(OPEN_SIDE, 6)
  const near = nearestBlock(w.at)
  const gap = near.dist
  const ok = !near.inside && Math.abs(gap - PLAYER_RADIUS) < 0.05
  report(ok, 'Building walls stop the player', `walked north into a facade and stopped ${gap.toFixed(3)} m from it (radius ${PLAYER_RADIUS})`)
}

// 6. Sliding along a wall at a shallow angle keeps moving.
{
  const w = new Walker(OPEN, 0, bare)
  const heading = normalize(add(OPEN_DIR, scale(OPEN_SIDE, 0.45)))
  w.walk(heading, 2.5)
  const along = (w.pos.x - OPEN[0]) * OPEN_DIR[0] + (w.pos.z - OPEN[1]) * OPEN_DIR[1]
  report(along > 8, 'Sliding along walls', `moved ${along.toFixed(1)} m along the street in 2.5 s while pushing into a facade`)
}

// 7. The footbridge deck edge holds the player.
{
  const deck = world.decks[0]
  const h = world.layout.footbridge.deckHeight
  const directions: Vec2[] = [[1, 0], [-1, 0]]
  const ends = directions.map((dir) => {
    const w = new Walker(deck.center, h)
    w.walk(dir, 3)
    return w.pos
  })
  const ok = ends.every((p) => p.y === h && pointInPolygon([p.x, p.z], deck.poly))
  report(ok, 'Footbridge deck edges hold', `east ${ends[0].x.toFixed(2)}, west ${ends[1].x.toFixed(2)}, height stays ${ends[0].y}`)
}

// 8. Walking under the deck keeps you on the ground.
{
  const deck = world.decks[0]
  const under = standingHeight(world, deck.center, 0)
  const over = standingHeight(world, deck.center, world.layout.footbridge.deckHeight)
  report(under === 0 && over === world.layout.footbridge.deckHeight, 'Ground and deck levels are separate', `below the deck stand at ${under}, on it at ${over}`)
}

// 9. Stair sides are solid from the ground.
{
  const stair = world.ramps[0]
  const side = normalize([-stair.axis[1], stair.axis[0]])
  const mid = add(stair.center, scale(stair.axis, stair.halfLength * 0.5))
  const w = new Walker(add(mid, scale(side, stair.halfWidth + 2)))
  w.walk(scale(side, -1), 3)
  const ok = w.pos.y === 0 && !pointInPolygon(w.at, stair.poly)
  report(ok, 'Stair sides are solid', `stopped ${(distance(w.at, mid) - stair.halfWidth).toFixed(2)} m from the stair side`)
}

// 10. Kerb railings stop the player stepping onto the trunk road away from crossings.
const trunk = world.segments.find((s) => s.street.fenced && s.a[0] <= -9 && s.b[0] >= -9)
if (!trunk) throw new Error('no trunk segment at x = -9')
const carriageway = rectFromSegment(trunk.a, trunk.b, trunk.street.carriageway)
// The trunk end of Tai Ping Alley, beyond its gate: the alley runs straight at the railings.
const tai = world.segments.find((s) => s.street.id === 'tai-ping-alley')
if (!tai) throw new Error('no Tai Ping Alley')
const TAI_DIR = normalize(sub(tai.b, tai.a))
const TAI_END: Vec2 = add(tai.a, scale(sub(tai.b, tai.a), 0.75))
{
  const w = new Walker(TAI_END)
  w.walk(TAI_DIR, 4)
  const ok = !pointInPolygon(w.at, carriageway) && distance(TAI_END, w.at) > 1
  report(ok, 'Kerb railings block the trunk road', `walked up Tai Ping Alley into the trunk railings and stopped ${distance(TAI_END, w.at).toFixed(1)} m on, short of the carriageway`)
}

// 11. No tunnelling: at four times the configured speed and a 20 fps frame time,
//     each frame moves over a metre, yet railings, walls and deck edges still hold.
{
  const speed = PLAYER.speed * 4
  const dt = 0.05
  const problems: string[] = []
  /** Walks for 2 s and reports whether `bad` held on any frame. */
  const everBad = (w: Walker, dir: Vec2, bad: (w: Walker) => boolean) => {
    const yaw = yawFacing(dir)
    for (let t = 0; t < 2; t += dt) {
      w.step(FORWARD, yaw, dt, speed)
      if (bad(w)) return true
    }
    return false
  }
  if (everBad(new Walker(TAI_END), TAI_DIR, (w) => pointInPolygon(w.at, carriageway))) problems.push('crossed a kerb railing')
  if (everBad(new Walker(OPEN_MID, 0, bare), OPEN_SIDE, (w) => { const n = nearestBlock(w.at); return n.inside || n.dist < PLAYER_RADIUS * 0.98 })) {
    problems.push('entered a building')
  }
  const deck = world.decks[0]
  const h = world.layout.footbridge.deckHeight
  if (everBad(new Walker(deck.center, h), [1, 0], (w) => w.pos.y !== h || !pointInPolygon(w.at, deck.poly))) problems.push('fell off the deck')
  report(problems.length === 0, 'No tunnelling at extreme speed', problems.length ? problems.join(', ') : `${(speed * dt).toFixed(2)} m per frame: railing, wall and deck edge all hold`)
}

// 12. Random walks with variable frame times: never inside a solid, never stranded.
//     One starts at the spawn and roams the district; one starts on the footbridge
//     deck so the stairs and deck are always exercised, whatever the seed does.
/** Trapped means no direction at all can move, not just the one being pressed. */
function canMoveSomewhere(p: PlayerPosition): boolean {
  return Array.from({ length: 8 }, (_, k) => (k / 8) * Math.PI * 2).some((a) => {
    const q = movePlayer(world, p, Math.cos(a) * 0.1, Math.sin(a) * 0.1)
    return q.x !== p.x || q.z !== p.z
  })
}

function randomWalk(seed: string, start: Vec2, y: number, steps: number) {
  const random = seededRandom(seed)
  const w = new Walker(start, y)
  let input: MoveInput = FORWARD
  let yaw = 0
  let penetrations = 0
  let stuckFrames = 0
  let trapped = 0
  let maxY = 0
  let minY = Infinity
  let time = 0
  for (let i = 0; i < steps; i++) {
    if (i % 90 === 0) {
      yaw = random() * Math.PI * 2
      const r = random()
      input = r < 0.6 ? FORWARD : r < 0.8 ? { forward: 1, strafe: random() < 0.5 ? 1 : -1 } : { forward: 0, strafe: random() < 0.5 ? 1 : -1 }
    }
    const dt = 1 / 240 + random() * (0.05 - 1 / 240)
    const before = w.pos
    w.step(input, yaw, dt)
    time += dt
    if (isBlocked(world, w.at, w.pos.y, PLAYER_RADIUS * 0.98)) penetrations++
    if (w.pos.x === before.x && w.pos.z === before.z) {
      stuckFrames++
      if (!canMoveSomewhere(w.pos)) trapped++
    }
    maxY = Math.max(maxY, w.pos.y)
    minY = Math.min(minY, w.pos.y)
  }
  return { steps, time, penetrations, stuckFrames, trapped, minY, maxY }
}

{
  const deckHeight = world.layout.footbridge.deckHeight
  const walks = [
    { name: 'district', ...randomWalk('fuzz', world.spawn.at, 0, 200_000) },
    { name: 'footbridge', ...randomWalk('fuzz-bridge', world.decks[0].center, deckHeight, 50_000) },
  ]
  const summary = (f: (r: (typeof walks)[number]) => string) => walks.map((r) => `${r.name}: ${f(r)}`).join('; ')
  report(
    walks.every((r) => r.penetrations === 0),
    'Random walk never enters a solid',
    summary((r) => `${r.steps} steps (${Math.round(r.time)} s), ${r.penetrations} penetrations`) + '; frame times 4–50 ms',
  )
  report(
    walks.every((r) => r.trapped === 0),
    'Random walk never gets trapped',
    summary((r) => `${r.stuckFrames} frames pressing into a wall head-on, ${r.trapped} with no way out`),
  )
  const bridge = walks[1]
  report(
    bridge.maxY === deckHeight && bridge.minY === 0,
    'Random walk uses the stairs',
    `footbridge walk ranged from ${bridge.minY.toFixed(2)} m to ${bridge.maxY.toFixed(2)} m`,
  )
}

{
  // Station entrance prompt: only at the doorway, facing it, from the street side.
  const goodFront: boolean[] = []
  const cases: string[] = []
  for (const [i, e] of world.station.entrances.entries()) {
    const toDoor = (d: number, side = 0): EntranceViewCase => {
      const x = e.at[0] + e.outward[0] * d + -e.outward[1] * side
      const z = e.at[1] + e.outward[1] * d + e.outward[0] * side
      return { x, z, y: 0, yaw: Math.atan2(e.outward[0], e.outward[1]) }
    }
    const checks: [string, boolean][] = [
      ['3 m, facing', enterableEntrance(world, toDoor(3)) === i],
      ['6 m, facing', enterableEntrance(world, toDoor(6)) === i],
      ['10 m (too far)', enterableEntrance(world, toDoor(10)) === null],
      ['facing away', enterableEntrance(world, { ...toDoor(3), yaw: toDoor(3).yaw + Math.PI }) === null],
      ['behind the wall', enterableEntrance(world, toDoor(-2)) === null],
      ['on the footbridge deck', enterableEntrance(world, { ...toDoor(3), y: 6 }) === null],
      ['beside the pocket', enterableEntrance(world, toDoor(3, 9)) === null],
    ]
    for (const [name, ok] of checks) {
      goodFront.push(ok)
      if (!ok) cases.push(`${e.node}: ${name}`)
    }
  }
  report(goodFront.every(Boolean), 'Station prompt only at the doorway, facing it', cases.length ? `failed: ${cases.join('; ')}` : 'both entrances, 7 cases each')
}

console.log(failures ? `\n${failures} movement test(s) failed` : '\nAll movement tests passed')
process.exit(failures ? 1 : 0)
