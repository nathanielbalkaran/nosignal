import { useMemo } from 'react'
import { add, lerp, scale, type Vec2 } from '../../world/geometry2d.ts'
import { world } from '../../world/index.ts'
import { boxAlong, slab, type BoxSpec } from './boxes.ts'
import { InstancedBoxes } from './InstancedBoxes.tsx'

const CONCRETE = '#6c6a64'
const CONCRETE_DARK = '#5a5853'
const STEEL = '#4d5553'
const STEEL_LIGHT = '#6a726f'
const TREAD = '#77746c'
const NOSING = '#9c8f4a'
const PANEL = ['#7a8478', '#74806f', '#7f8579', '#6f7a6b']
const RAIL = '#8a918c'
const ROOF = '#7f9a8e'
const CONDUIT = '#3a3c3c'
const LAMP = '#d8d2b4'
const PLATE = '#8a3b32'
const RISER = 0.18
const DECK_THICKNESS = 0.35
const RAIL_H = 1.1

/** The elevated pedestrian bridge over Hoi Pong Road. Visual only: collision comes from the world's decks, ramps and columns. */
export function Footbridge() {
  const { solid, lit } = useMemo(() => {
    const out: BoxSpec[] = []
    const lit: BoxSpec[] = []
    const h = world.layout.footbridge.deckHeight
    const perp = (a: Vec2): Vec2 => [-a[1], a[0]]

    // ---- Decks: thin slab, steel girders and cross beams underneath, faded edge fascia.
    for (const d of world.decks) {
      const a = add(d.center, scale(d.axis, -d.halfLength))
      const b = add(d.center, scale(d.axis, d.halfLength))
      const n = perp(d.axis)
      out.push(boxAlong(a, b, d.halfWidth * 2, h - DECK_THICKNESS, DECK_THICKNESS, CONCRETE))
      for (const side of [-1, 1]) {
        const o = scale(n, side * (d.halfWidth - 0.1))
        out.push(boxAlong(add(a, o), add(b, o), 0.2, h - DECK_THICKNESS - 0.45, 0.45, STEEL))
        const fascia = scale(n, side * (d.halfWidth + 0.01))
        out.push(boxAlong(add(a, fascia), add(b, fascia), 0.03, h - DECK_THICKNESS, DECK_THICKNESS, CONCRETE_DARK))
      }
      const beams = Math.max(2, Math.round(d.halfLength / 1.2))
      for (let i = 0; i <= beams; i++) {
        const c = add(a, scale(d.axis, (i / beams) * d.halfLength * 2))
        out.push(boxAlong(add(c, scale(n, -d.halfWidth + 0.1)), add(c, scale(n, d.halfWidth - 0.1)), 0.12, h - DECK_THICKNESS - 0.3, 0.3, STEEL_LIGHT))
      }
      // Conduit run along one side of the underside.
      const o = scale(n, d.halfWidth - 0.4)
      out.push(boxAlong(add(a, o), add(b, o), 0.08, h - DECK_THICKNESS - 0.3, 0.08, CONDUIT))
      // Worn paint line down the middle of the walkway.
      out.push(boxAlong(add(a, scale(d.axis, 0.3)), add(b, scale(d.axis, -0.3)), 0.12, h + 0.005, 0.01, '#9a9382'))
    }

    // ---- Stairs: open steel stairs with treads, risers, stringers, soffit and legs.
    for (const r of world.ramps) {
      const steps = Math.ceil(r.rise / RISER)
      const run = (r.halfLength * 2) / steps
      const n = perp(r.axis)
      const W = r.halfWidth * 2
      for (let i = 0; i < steps; i++) {
        const a: Vec2 = add(r.bottom, scale(r.axis, i * run))
        const b: Vec2 = add(r.bottom, scale(r.axis, (i + 1) * run))
        // Tread top matches the walkable surface at the middle of the step.
        const top = ((i + 0.5) / steps) * r.rise
        const edge = i === 0 || i === steps - 1
        out.push(boxAlong(a, b, W, top - 0.05, 0.05, TREAD))
        out.push(boxAlong(a, add(a, scale(r.axis, 0.04)), W, top - 0.5, 0.5, i % 2 ? '#6a6862' : '#706e68'))
        if (edge || i % 6 === 0) out.push(boxAlong(a, add(a, scale(r.axis, 0.07)), W - 0.1, top, 0.012, NOSING))
      }
      for (const side of [-1, 1]) {
        const o = scale(n, side * (r.halfWidth - 0.04))
        out.push(slab(add(r.bottom, o), add(r.top, o), 0.1, -0.125, r.rise - 0.125, 0.55, STEEL))
      }
      out.push(slab(r.bottom, r.top, W - 0.1, -0.5, r.rise - 0.5, 0.1, STEEL))
      for (let k = 1; k <= 3; k++) {
        const t = k / 4
        const at = add(r.bottom, scale(r.axis, t * r.halfLength * 2))
        const hh = t * r.rise - 0.5
        for (const side of [-1, 1]) {
          const p = add(at, scale(n, side * (r.halfWidth - 0.04)))
          out.push(boxAlong(add(p, scale(r.axis, -0.05)), add(p, scale(r.axis, 0.05)), 0.1, 0, hh, STEEL))
        }
      }
      // Faded safety plate on the stringer, near the foot.
      const plate = add(add(r.bottom, scale(r.axis, 1.4)), scale(n, r.halfWidth + 0.02))
      out.push(boxAlong(plate, add(plate, scale(r.axis, 0.5)), 0.02, 1.4 * (r.rise / (r.halfLength * 2)) + 0.05, 0.3, PLATE))
    }

    // ---- Roof over each deck: thin steel roof, edge trim, posts, beams, a lamp or two.
    for (const d of world.decks) {
      const a = add(d.center, scale(d.axis, -d.halfLength))
      const b = add(d.center, scale(d.axis, d.halfLength))
      const n = perp(d.axis)
      out.push(boxAlong(a, b, d.halfWidth * 2 + 0.8, h + 3.1, 0.12, ROOF))
      for (const side of [-1, 1]) {
        const o = scale(n, side * (d.halfWidth + 0.4))
        out.push(boxAlong(add(a, o), add(b, o), 0.06, h + 3.0, 0.22, '#62786d'))
      }
      const posts = Math.max(2, Math.round((d.halfLength * 2) / 4.5) + 1)
      for (let i = 0; i < posts; i++) {
        const c = add(a, scale(d.axis, (i / (posts - 1)) * d.halfLength * 2))
        out.push(boxAlong(add(c, scale(n, -d.halfWidth + 0.1)), add(c, scale(n, d.halfWidth - 0.1)), 0.08, h + 2.95, 0.15, STEEL))
        for (const side of [-1, 1]) {
          const at = add(c, scale(n, side * (d.halfWidth - 0.08)))
          out.push(boxAlong(add(at, scale(d.axis, -0.04)), add(at, scale(d.axis, 0.04)), 0.08, h, 3.0, STEEL))
        }
        if (i % 2 === 1 || posts <= 3) {
          const lamp = add(c, scale(d.axis, 0.0))
          lit.push(boxAlong(add(lamp, scale(n, -0.35)), add(lamp, scale(n, 0.35)), 0.12, h + 2.88, 0.06, LAMP))
        }
      }
    }

    // ---- Piers: slim column, plinth, and a crosshead that carries the girders.
    for (const c of world.columns) {
      const deck = world.decks[0]
      const n = deck ? perp(deck.axis) : ([1, 0] as Vec2)
      const ax = deck ? deck.axis : ([0, 1] as Vec2)
      const at: Vec2 = c.center
      out.push(boxAlong(add(at, scale(ax, -0.2)), add(at, scale(ax, 0.2)), 0.4, 0.35, h - DECK_THICKNESS - 0.35 - 0.35, CONCRETE))
      out.push(boxAlong(add(at, scale(ax, -0.32)), add(at, scale(ax, 0.32)), 0.64, 0, 0.35, CONCRETE_DARK))
      out.push(boxAlong(add(at, scale(n, -1.45)), add(at, scale(n, 1.45)), 0.5, h - DECK_THICKNESS - 0.35, 0.35, STEEL))
    }

    // ---- Railings: solid lower panel, top and mid rails, posts. Stair rails run on the slope.
    const railPosts = (a: Vec2, b: Vec2, yA: number, yB: number) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const count = Math.max(1, Math.round(len / 1.6))
      for (let i = 0; i <= count; i++) {
        const p = lerp(a, b, i / count)
        const y = yA + (yB - yA) * (i / count)
        out.push(boxAlong(add(p, [-0.04, 0]), add(p, [0.04, 0]), 0.08, y, RAIL_H, STEEL))
      }
    }
    const rail = (a: Vec2, b: Vec2, yA: number, yB: number, tone: number) => {
      out.push(slab(a, b, 0.1, yA + RAIL_H - 0.05, yB + RAIL_H - 0.05, 0.07, RAIL))
      out.push(slab(a, b, 0.04, yA + 0.62, yB + 0.62, 0.04, RAIL))
      out.push(slab(a, b, 0.07, yA + 0.05, yB + 0.05, 0.42, PANEL[tone % PANEL.length]))
      railPosts(a, b, yA, yB)
    }
    world.parapets.forEach((p, idx) => {
      const sloped = p.baseA !== p.baseB
      const pieces = sloped ? 1 : Math.max(1, Math.round(Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) / 3))
      for (let i = 0; i < pieces; i++) {
        rail(lerp(p.a, p.b, i / pieces), lerp(p.a, p.b, (i + 1) / pieces), p.baseA + (p.baseB - p.baseA) * (i / pieces), p.baseA + (p.baseB - p.baseA) * ((i + 1) / pieces), idx + i)
      }
    })
    // Join each stair rail to the nearest deck rail end so no run stops short at the landing.
    const level = world.parapets.filter((p) => p.baseA === p.baseB)
    for (const p of world.parapets.filter((q) => q.baseA !== q.baseB)) {
      const top = p.baseA > p.baseB ? p.a : p.b
      let best: Vec2 | null = null
      let bd = 0.9
      for (const q of level) {
        for (const e of [q.a, q.b]) {
          const dd = Math.hypot(e[0] - top[0], e[1] - top[1])
          if (dd < bd && dd > 0.01) {
            bd = dd
            best = e
          }
        }
      }
      if (best) rail(top, best, h, h, 0)
    }

    // Walking surfaces and piers read as worn concrete; everything else is painted steel.
    const concrete = new Set([CONCRETE, CONCRETE_DARK, TREAD, NOSING, '#6a6862', '#706e68', '#9a9382'])
    for (const b of out) b.surface = concrete.has(b.color) ? 'concrete' : 'metal'
    return { solid: out, lit }
  }, [])

  return (
    <>
      <InstancedBoxes boxes={solid} />
      <InstancedBoxes boxes={lit} unlit castShadow={false} receiveShadow={false} />
    </>
  )
}

