import { PLAYER } from '../src/config/player.ts'
import { wander } from '../src/world/analysis.ts'
import { buildWorld } from '../src/world/build.ts'
import { DISTRICT } from '../src/world/layout.ts'
import { describeEdge } from '../src/world/navigation.ts'
import { validateWorld } from '../src/world/validate.ts'

/** Links that take longer than this at full speed are flagged in the pacing report. */
const LONG_LINK_SECONDS = 12

const started = performance.now()
const world = buildWorld(DISTRICT)
const { checks, routes } = validateWorld(world)

for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}\n      ${c.detail}`)
}

const seconds = (metres: number) => metres / PLAYER.speed
console.log(`\nPacing at ${PLAYER.speed} m/s (straight-line link lengths; links over ${LONG_LINK_SECONDS} s flagged)`)
const edges = [...world.navigation.edges].sort((a, b) => b.length - a.length)
for (const e of edges) {
  const t = seconds(e.length)
  const flag = t > LONG_LINK_SECONDS ? '  LONG' : ''
  console.log(`  ${`${e.a}–${e.b}`.padEnd(8)} ${describeEdge(e).padEnd(18)} ${e.length.toFixed(0).padStart(4)} m ${t.toFixed(1).padStart(5)} s${flag}`)
}
const lengths = world.navigation.edges.map((e) => e.length)
const average = lengths.reduce((s, l) => s + l, 0) / lengths.length
console.log(`  average link ${average.toFixed(0)} m, ${seconds(average).toFixed(1)} s`)
world.layout.routes.forEach((r, i) => {
  const length = routes[i]?.length ?? 0
  console.log(`  Route "${r.name}": ${length.toFixed(0)} m, ${seconds(length).toFixed(0)} s`)
})

// Estimated times for walkers who do not know the way (simulation, not playtesting).
const mins = (m: number) => `${(seconds(m) / 60).toFixed(1)} min`
for (const [label, bias] of [['lost, no sense of direction', 1], ['heading roughly north', 3]] as const) {
  const r = wander(world, bias).distance
  console.log(`  Wanderer (${label}): median ${mins(r.p50)}, 75th pct ${mins(r.p75)}, 90th pct ${mins(r.p90)}`)
}

// Determinism: building the district again from the same seed must give identical props and facades.
const fingerprint = (w: typeof world) =>
  JSON.stringify([
    w.props.map((p) => [p.type, p.at[0].toFixed(3), p.at[1].toFixed(3), p.yaw.toFixed(3), p.variant]),
    w.facades.map((f) => [f.id, f.wall, f.ground.kind, f.fascia?.label, f.vertical.length, f.bays]),
    w.plates.length,
    w.cables.length,
  ])
const deterministic = fingerprint(buildWorld(DISTRICT)) === fingerprint(world)
checks.push({ label: 'Props and facades are deterministic', ok: deterministic, detail: deterministic ? 'two builds are identical' : 'builds differ' })
console.log(`${deterministic ? 'PASS' : 'FAIL'}  Props and facades are deterministic`)

const failed = checks.filter((c) => !c.ok).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed in ${Math.round(performance.now() - started)} ms`)
process.exit(failed > 0 ? 1 : 0)
