import { Group } from 'three'
import { disposeFigures, makeFigure, type Archetype, type Figure } from './figures.ts'
import type { World } from '../../world/build.ts'
import type { Vec2 } from '../../world/geometry2d.ts'
import { Rng } from '../../world/rng.ts'
import { dist, frameOf, hiddenFrom, roundCorners, toWorld, type Ambient, type PlayerPose } from './common.ts'

/*
 * Three scripted passers-by. Each has a fixed short path, wakes when the
 * player comes near its area, waits until the start point is out of sight,
 * walks the path once and is gone. No pathfinding, no avoidance, no repeats.
 * The figures never touch the collision world.
 */

/** Who walks each route, and how fast (m/s). */
const CAST: { kind: Archetype; speed: number }[] = [
  { kind: 'elder', speed: 1.15 },
  { kind: 'commuter', speed: 1.55 },
  { kind: 'courier', speed: 1.7 },
]
/** Past the end of a route, a figure keeps walking until the player cannot see it, up to this far. */
const MAX_EXTRA = 30

interface Moment {
  trigger: Vec2
  /** The player must be nearer than `far` and farther than `near` from the trigger. */
  near: number
  far: number
  path: Vec2[]
  speed: number
  figure: Figure
  /** The route ends at a doorway, so the figure goes in rather than walking on. */
  door: boolean
  yaw: number
  length: number
  state: 'idle' | 'waiting' | 'walking' | 'done'
  s: number
}

function slice(points: readonly Vec2[], from: number, to: number): Vec2[] {
  const out: Vec2[] = []
  let acc = 0
  const at = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = dist(a[0], a[1], b[0], b[1])
    const lo = acc
    const hi = acc + len
    if (hi > from && lo < to) {
      const t0 = Math.max(0, (from - lo) / len)
      const t1 = Math.min(1, (to - lo) / len)
      if (out.length === 0) out.push(at(a, b, t0))
      out.push(at(a, b, t1))
    }
    acc = hi
  }
  return out
}

const pathLength = (p: readonly Vec2[]) => p.slice(1).reduce((sum, q, i) => sum + dist(p[i][0], p[i][1], q[0], q[1]), 0)

export function createPedestrians(world: World): Ambient {
  const root = new Group()
  const rng = new Rng('ambient:pedestrians')
  const node = (id: string): Vec2 => world.nodes.get(id)!.at
  const leg = (a: string, b: string) => dist(node(a)[0], node(a)[1], node(b)[0], node(b)[1])

  // 1. Someone crosses the junction at Kam Fung Street and Fuk Wing Lane, turning north.
  const crossing = slice([node('b'), node('K3'), node('K2')], leg('b', 'K3') - 14, leg('b', 'K3') + 16)

  // 2. A commuter comes up Shun Hing Street to a doorway and goes in.
  const doorFacade = world.facades.find((s) => s.id === 'F1.3')!
  const fr = frameOf(doorFacade)
  const doorX = doorFacade.ground.door === 'left' ? 0.9 : fr.width - 0.9
  const dir = doorFacade.ground.door === 'left' ? 1 : -1
  const commuter: Vec2[] = [toWorld(fr, doorX + dir * 10, 4.1), toWorld(fr, doorX + dir * 4, 3.0), toWorld(fr, doorX, 0.9)]

  // 3. Someone crosses Po Sin Lane at Fuk Tai Alley and goes off up Lung Hing Alley.
  const corner = slice([node('D1'), node('C1'), node('J1')], leg('D1', 'C1') - 14, leg('D1', 'C1') + 16)

  const defs: { trigger: Vec2; near: number; far: number; path: Vec2[]; door: boolean }[] = [
    { trigger: node('K3'), near: 18, far: 52, path: crossing, door: false },
    { trigger: toWorld(fr, doorX, 3), near: 16, far: 46, path: commuter, door: true },
    { trigger: node('C1'), near: 18, far: 50, path: corner, door: false },
  ]

  const moments: Moment[] = defs.map((d, i) => {
    const figure = makeFigure(CAST[i].kind, i * 3 + 1)
    figure.group.visible = false
    root.add(figure.group)
    // Round the corners a little so people turn rather than pivot.
    const path = roundCorners(d.path, 2.5, 2)
    return { ...d, path, figure, yaw: 0, speed: CAST[i].speed * (1 + rng.range(-0.04, 0.04)), length: pathLength(path), state: 'idle', s: 0 }
  })

  let waitCheck = 0

  /** Puts the figure `m.s` metres along its route, carrying on straight past the end. */
  const place = (m: Moment, dt: number, snap = false) => {
    let rest = m.s
    const last = m.path.length - 2
    for (let i = 0; i <= last; i++) {
      const a = m.path[i]
      const b = m.path[i + 1]
      const len = dist(a[0], a[1], b[0], b[1])
      if (rest <= len || i === last) {
        const t = rest / len
        m.figure.group.position.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t)
        const target = Math.atan2(b[0] - a[0], b[1] - a[1])
        if (snap) m.yaw = target
        else {
          // Turn at a human rate, the short way round.
          const diff = Math.atan2(Math.sin(target - m.yaw), Math.cos(target - m.yaw))
          m.yaw += diff * Math.min(1, dt * 6)
        }
        m.figure.group.rotation.y = m.yaw
        return
      }
      rest -= len
    }
  }

  return {
    object: root,
    update(time, dt, p: PlayerPose) {
      waitCheck -= dt
      for (const m of moments) {
        if (m.state === 'idle') {
          const d = dist(p.x, p.z, m.trigger[0], m.trigger[1])
          if (d < m.far && d > m.near) m.state = 'waiting'
        }
        if (m.state === 'waiting') {
          // Check a few times a second; show the figure once its start is out of the player's sight and not close.
          if (waitCheck > 0) continue
          const start = m.path[0]
          if (dist(p.x, p.z, start[0], start[1]) > 14 && hiddenFrom(world, p, start[0], start[1])) {
            m.state = 'walking'
            m.s = 0
            m.figure.group.visible = true
            place(m, 0, true)
          }
        } else if (m.state === 'walking') {
          m.s += m.speed * dt
          if (m.s >= m.length) {
            // Doorways swallow people. Anywhere else, keep walking until out of sight.
            const gone = m.door || m.s > m.length + MAX_EXTRA || (waitCheck <= 0 && hiddenFrom(world, p, m.figure.group.position.x, m.figure.group.position.z))
            if (gone) {
              m.state = 'done'
              m.figure.group.visible = false
              continue
            }
          }
          place(m, dt)
          m.figure.pose(m.s, m.speed)
        }
      }
      if (waitCheck <= 0) waitCheck = 0.3
      void time
    },
    dispose() {
      disposeFigures()
    },
  }
}
