import { Matrix4, Vector3 } from 'three'
import type { World } from '../../world/build.ts'
import { add, distance, normalize, perp, scale, sub, type Vec2 } from '../../world/geometry2d.ts'
import { PRIVATE_LABEL, ROADWORKS_LABEL, STAFF_LABEL } from '../../world/signage.ts'
import type { DeadEnd } from '../../world/types.ts'
import { Rng } from '../../world/rng.ts'
import { rgb, shade } from '../geo/Geo.ts'
import { Sink, type Layers } from '../geo/layers.ts'
import type { SignAtlas } from '../geo/textures.ts'
import { front, frontGrad } from './context.ts'

/*
 * Everything that closes the district without looking like the edge of a map:
 * the dressed dead ends of the three blocked alleys, the roadworks that shut
 * the trunk road at both ends, the kerb railings, and the elevated road that
 * crosses beyond each closure.
 *
 * Every piece is written in a local frame with x across the face, y up and z
 * out towards the viewer, exactly like a shopfront.
 */

const CONCRETE = rgb('#7b7d79')
const STAIN = rgb('#5c5e5b')
const TRIM = rgb('#8a8a82')
const FRAME = rgb('#2a2f33')
const DARK = rgb('#0d1116')
const STEEL = rgb('#80858a')
const DARK_STEEL = rgb('#4a4e53')
const WARM = rgb('#d9a85a')
const BAMBOO = rgb('#a89560')

/** Frame for a face at `at` looking along `outward` (unit, on the ground plane). */
function faceFrame(at: Vec2, outward: Vec2): Matrix4 {
  const u: Vec2 = [outward[1], -outward[0]]
  return new Matrix4().makeBasis(new Vector3(u[0], 0, u[1]), new Vector3(0, 1, 0), new Vector3(outward[0], 0, outward[1])).setPosition(at[0], 0, at[1])
}

// ------------------------------------------------------------------ railings

/** Kerb railings: posts and two rails, so the road beyond shows through them. */
export function buildRailings(layers: Layers, world: World) {
  for (const r of world.railings) {
    const len = distance(r.a, r.b)
    if (len < 0.2) continue
    const mid: Vec2 = [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2]
    const dir = normalize(sub(r.b, r.a))
    const s = new Sink(layers, 'props', mid[0], mid[1])
    s.at(mid[0], 0, mid[1], Math.atan2(-dir[1], dir[0]), () => {
      const g = s.solid
      const rail = rgb('#6f7672')
      g.box(0, r.height - 0.03, 0, len, 0.06, 0.06, rail)
      g.box(0, r.height * 0.55, 0, len, 0.035, 0.035, shade(rail, 0.85))
      const n = Math.max(1, Math.round(len / 2.2))
      for (let i = 0; i <= n; i++) g.box(-len / 2 + (i / n) * len, r.height / 2, 0, 0.06, r.height, 0.06, shade(rail, 0.75))
    })
  }
}

// ------------------------------------------------------------------ dead ends

/** Height of the building end that closes a blocked alley. */
const END_HEIGHT = 10

export function buildDeadEnds(layers: Layers, atlas: SignAtlas, world: World) {
  world.gates.forEach((gate, gi) => {
    const W = gate.halfWidth * 2 + 0.5
    // The body's roof, once, from the centre.
    const roofSink = new Sink(layers, 'base', gate.centre[0], gate.centre[1])
    roofSink.with(faceFrame(gate.centre, gate.dir), () => {
      const f = gate.faceOffset
      const roof = shade(rgb('#5d5f5c'), 0.9)
      roofSink.solid.quad([-W / 2, END_HEIGHT, f], [W / 2, END_HEIGHT, f], [W / 2, END_HEIGHT, -f], [-W / 2, END_HEIGHT, -f], roof)
    })
    // Face 0 looks back towards the street's first node, face 1 towards its second.
    for (const end of [0, 1] as const) {
      const outward: Vec2 = end === 0 ? [-gate.dir[0], -gate.dir[1]] : gate.dir
      const at = add(gate.centre, scale(outward, gate.faceOffset))
      const s = new Sink(layers, 'base', at[0], at[1])
      const rng = new Rng(`deadend:${gate.streetId}:${end}`)
      s.with(faceFrame(at, outward), () => drawEnd(s, atlas, gate.ends[end], W, rng, gi + end))
    }
  })
}

function drawEnd(s: Sink, atlas: SignAtlas, kind: DeadEnd, W: number, rng: Rng, salt: number) {
  const g = s.solid
  const hw = W / 2
  const H = END_HEIGHT
  const wall = kind === 'retaining' ? CONCRETE : shade(rgb(['#8c8f89', '#7e8782', '#938c80'][salt % 3]), 0.82)
  if (kind !== 'retaining') {
    frontGrad(g, -hw, 0, hw, H, 0, wall, 0.68)
    g.span(-hw, H - 0.4, 0, hw, H, 0.28, TRIM, { grime: 0.8 })
    // Stains running down from the cornice, and a pair of dark vents high up.
    for (let k = 0; k < 3; k++) {
      const x = rng.range(-hw + 0.3, hw - 0.5)
      front(g, x, rng.range(2.8, 5), x + 0.22, H - 0.5, 0.02, shade(wall, 0.8))
    }
  }
  if (kind === 'service') drawService(s, atlas, hw, H, rng, wall)
  else if (kind === 'gate') drawGate(s, atlas, hw, H, rng, wall)
  else if (kind === 'construction') drawClosure(s, atlas, hw, H, rng)
  else drawRetaining(s, hw, H, rng)
}

/** A building's service entrance: a steel door, meters, pipes and bins. The alley ends because the building does. */
function drawService(s: Sink, atlas: SignAtlas, hw: number, H: number, rng: Rng, wall: ReturnType<typeof rgb>) {
  const g = s.solid
  const d = s.detail
  const em = s.emissive
  const door = rng.chance(0.5) ? -0.25 : 0.2
  // Steel door in a concrete surround, with a louvre above.
  g.span(door - 0.62, 0, 0, door + 0.62, 2.35, 0.1, TRIM, { grime: 0.7 })
  front(g, door - 0.5, 0.04, door + 0.5, 2.22, 0.11, rgb('#4d5b55'), [rgb('#3a463f'), rgb('#3a463f'), rgb('#56645d'), rgb('#56645d')])
  d.span(door + 0.32, 1.0, 0.11, door + 0.4, 1.12, 0.2, rgb('#c9c4a8'))
  for (let y = 2.5; y < 3.0; y += 0.14) front(d, door - 0.5, y, door + 0.5, y + 0.06, 0.06, rgb('#34393b'))
  // Staff-only plate and a wall lamp, lit.
  s.signs.quad([door - 0.45, 3.2, 0.1], [door + 0.45, 3.2, 0.1], [door + 0.45, 3.45, 0.1], [door - 0.45, 3.45, 0.1], '#ffffff', undefined, atlas.plate(STAFF_LABEL.zh, STAFF_LABEL.en, 'street'))
  d.span(door - 0.15, 3.65, 0, door + 0.15, 3.85, 0.3, DARK_STEEL)
  em.span(door - 0.1, 3.6, 0.08, door + 0.1, 3.65, 0.26, WARM)
  s.glow.quad([door - 1.2, 0.04, 1.8], [door + 1.2, 0.04, 1.8], [door + 1.2, 0.04, 0.1], [door - 1.2, 0.04, 0.1], shade(WARM, 0.35), undefined, [0, 0, 1, 1])
  // Meter cabinet and a conduit run on the other side.
  const side = door > 0 ? -1 : 1
  const mx = side * (hw - 0.75)
  g.span(mx - 0.4, 0.8, 0, mx + 0.4, 1.9, 0.22, rgb('#868b88'), { grime: 0.8 })
  front(d, mx - 0.3, 0.9, mx + 0.3, 1.8, 0.23, rgb('#6b706d'))
  d.rod([mx, 1.9, 0.1], [mx, H - 0.6, 0.1], 0.025, rgb('#202325'), 4)
  // Drain and gas pipes up the wall.
  for (const x of [-side * (hw - 0.3), side * (hw - 1.7)]) {
    d.rod([x, 0.05, 0.09], [x, H - 0.8, 0.09], 0.065, rgb('#5d6563'), 6)
    for (let y = 1.4; y < H - 1; y += 2.2) d.box(x, y, 0.08, 0.16, 0.06, 0.14, DARK_STEEL)
  }
  d.rod([-side * (hw - 0.3), 3.5, 0.09], [side * (hw - 1.7), 3.5, 0.09], 0.04, rgb('#a2814a'), 5)
  // A pair of bins and a stack of crates on the shelf in front.
  const bx = -door * 0.8 + side * 0.9
  for (const [k, x] of [bx, bx + 0.72].entries()) {
    g.box(x, 0.5, 0.38, 0.6, 1.0, 0.56, rgb(k === 0 ? '#4f7f58' : '#7f7f86'))
    g.box(x, 1.03, 0.38, 0.64, 0.07, 0.6, shade(rgb(k === 0 ? '#4f7f58' : '#7f7f86'), 0.8))
  }
  g.box(bx + 1.6, 0.25, 0.4, 0.8, 0.5, 0.55, rgb('#a8916b'))
  g.box(bx + 1.6, 0.7, 0.4, 0.7, 0.4, 0.5, rgb('#9c8660'))
  // Louvred windows and an AC unit on the walls above.
  for (const x of [-hw + 1.2, hw - 1.2]) {
    front(g, x - 0.45, 5.6, x + 0.45, 6.8, 0.04, FRAME)
    for (let y = 5.7; y < 6.75; y += 0.16) front(d, x - 0.4, y, x + 0.4, y + 0.07, 0.06, rgb('#3b4244'))
  }
  d.span(rng.range(-0.6, 0.6), 7.6, 0.05, rng.range(0.6, 1.5), 8.3, 0.6, rgb('#b2b0a6'))
  void wall
}

/** A private lane: an iron gate in a recess, with a courtyard glow behind it. */
function drawGate(s: Sink, atlas: SignAtlas, hw: number, H: number, rng: Rng, wall: ReturnType<typeof rgb>) {
  const g = s.solid
  const d = s.detail
  const em = s.emissive
  const ow = Math.min(1.0, hw - 0.5) // half opening
  const oh = 2.7
  const depth = 1.3
  // Surround and plinth.
  g.span(-ow - 0.45, 0, 0, -ow, oh + 0.4, 0.2, TRIM, { grime: 0.7 })
  g.span(ow, 0, 0, ow + 0.45, oh + 0.4, 0.2, TRIM, { grime: 0.7 })
  g.span(-ow - 0.45, oh, 0, ow + 0.45, oh + 0.4, 0.2, TRIM)
  // The recess: shell, dark back, and a dim warm light from a yard beyond.
  const inner = shade(wall, 0.7)
  g.quad([-ow, 0, 0], [-ow, 0, -depth], [-ow, oh, -depth], [-ow, oh, 0], inner, [shade(inner, 0.5), shade(inner, 0.2), shade(inner, 0.3), inner])
  g.quad([ow, 0, -depth], [ow, 0, 0], [ow, oh, 0], [ow, oh, -depth], inner, [shade(inner, 0.2), shade(inner, 0.5), inner, shade(inner, 0.3)])
  g.quad([-ow, oh, 0], [-ow, oh, -depth], [ow, oh, -depth], [ow, oh, 0], shade(inner, 0.6))
  front(g, -ow, 0, ow, oh, -depth, DARK, [rgb('#07090c'), rgb('#07090c'), rgb('#141b20'), rgb('#141b20')])
  front(em, -ow * 0.6, 0.3, ow * 0.6, 1.6, -depth + 0.02, rgb('#6b5636'), [rgb('#3d3220'), rgb('#3d3220'), rgb('#7d6640'), rgb('#7d6640')])
  // A potted shrub and a hanging washing line, seen through the bars.
  s.solid.blob(ow * 0.45, 0.5, -depth * 0.55, 0.32, 0.4, 0.32, rgb('#3e5c45'), 0.15, 3)
  g.rod([ow * 0.45, 0, -depth * 0.55], [ow * 0.45, 0.25, -depth * 0.55], 0.1, rgb('#6b5c4b'), 5)
  // The gate: bars, rails and a chain.
  for (let x = -ow + 0.08; x < ow; x += 0.14) d.rod([x, 0.1, 0.06], [x, oh - 0.05, 0.06], 0.014, rgb('#1d2022'), 4)
  for (const y of [0.25, 1.4, oh - 0.12]) d.box(0, y, 0.06, ow * 2, 0.06, 0.05, rgb('#1d2022'))
  d.box(0, 1.05, 0.1, 0.08, 0.4, 0.04, rgb('#2c2f31'))
  for (let x = -ow + 0.1; x < ow; x += 0.14) d.span(x - 0.025, oh - 0.12, 0.06, x + 0.025, oh + 0.04, 0.09, rgb('#1d2022'))
  // Private-property plate and a lamp.
  s.signs.quad([-0.75, oh + 0.62, 0.1], [0.75, oh + 0.62, 0.1], [0.75, oh + 0.62 + 0.375, 0.1], [-0.75, oh + 0.62 + 0.375, 0.1], '#ffffff', undefined, atlas.plate(PRIVATE_LABEL.zh, PRIVATE_LABEL.en, 'street'))
  const lx = rng.chance(0.5) ? -ow - 0.7 : ow + 0.7
  d.span(lx - 0.1, oh - 0.1, 0, lx + 0.1, oh + 0.2, 0.28, DARK_STEEL)
  em.span(lx - 0.07, oh - 0.14, 0.06, lx + 0.07, oh - 0.1, 0.22, WARM)
  // Plants growing over the wall above, and a rainwater pipe.
  for (let i = 0; i < 4; i++) g.blob(rng.range(-hw + 0.4, hw - 0.4), H + 0.1, -rng.range(0, 1.2), 0.45, 0.28, 0.4, rgb('#4b684c'), 0.15, i)
  d.rod([hw - 0.25, 0.05, 0.08], [hw - 0.25, H - 0.6, 0.08], 0.06, rgb('#5d6563'), 6)
  void H
}

/** A construction closure: bamboo scaffold, green netting and hoarding across a building end. */
function drawClosure(s: Sink, atlas: SignAtlas, hw: number, H: number, rng: Rng) {
  const g = s.solid
  const d = s.detail
  const em = s.emissive
  // The architecture behind: a few dark windows and a stained wall, partly hidden.
  for (const y of [5.4, 8.0]) for (const x of [-hw * 0.5, hw * 0.45]) front(g, x - 0.5, y, x + 0.5, y + 1.2, 0.03, rgb('#10161d'), [rgb('#0a0e13'), rgb('#0a0e13'), rgb('#25303c'), rgb('#25303c')])
  // Bamboo uprights and ledgers.
  const top = H - 0.8
  for (let x = -hw + 0.2; x <= hw - 0.15; x += 0.95) d.rod([x, 0, 0.12], [x + rng.range(-0.03, 0.03), top, 0.12], 0.032, BAMBOO, 5, 0.026)
  for (let y = 1.2; y < top; y += 1.5) d.rod([-hw, y, 0.12], [hw, y, 0.12], 0.028, shade(BAMBOO, 0.92), 4)
  for (let i = 0; i < 3; i++) d.rod([-hw + 0.2 + i * 1.1, 0.3, 0.14], [-hw + 1.3 + i * 1.1, top * 0.5, 0.14], 0.025, shade(BAMBOO, 0.85), 4)
  // Netting over the upper part: see-through, with the building showing behind.
  const net = s.mesh
  net.quad([-hw, 2.2, 0.2], [hw, 2.2, 0.2], [hw, top, 0.2], [-hw, top, 0.2], rgb('#4a6350'), undefined, [0, 0, (hw * 2) / 0.6, (top - 2.2) / 0.6])
  // Hoarding on the lower part, painted, with the warning sign.
  g.span(-hw, 0, 0.28, hw, 2.2, 0.38, rgb('#4f6a52'), { grime: 0.75 })
  for (let x = -hw + 0.8; x < hw - 0.3; x += 1.2) front(d, x, 0.05, x + 0.03, 2.15, 0.39, shade(rgb('#4f6a52'), 0.7))
  d.span(-hw, 2.2, 0.26, hw, 2.28, 0.42, rgb('#34463a'))
  s.signs.quad([-0.7, 1.25, 0.4], [0.7, 1.25, 0.4], [0.7, 1.25 + 0.35, 0.4], [-0.7, 1.25 + 0.35, 0.4], '#ffffff', undefined, atlas.plate(ROADWORKS_LABEL.zh, ROADWORKS_LABEL.en, 'street'))
  // Water-filled barriers at the foot and an amber lamp.
  for (const x of [-hw * 0.55, hw * 0.1]) {
    g.box(x, 0.4, 0.6, 1.5, 0.8, 0.3, rgb('#a4423b'))
    g.box(x, 0.4, 0.6, 0.5, 0.82, 0.31, rgb('#d6d3c8'))
    d.rod([x, 0.8, 0.6], [x, 1.1, 0.6], 0.03, DARK_STEEL, 4)
    em.box(x, 1.15, 0.6, 0.2, 0.14, 0.2, rgb('#e09a3a'))
  }
  d.span(hw - 0.5, 0.02, 0.4, hw - 0.1, 0.3, 0.7, rgb('#c7803a'))
}

/** Ground that steps up: a concrete retaining wall with a fence on top and a building set back above it. */
function drawRetaining(s: Sink, hw: number, H: number, rng: Rng) {
  const g = s.solid
  const d = s.detail
  const R = 3.4
  const setback = 0.9
  const up = shade(rgb('#8c8f89'), 0.78)
  frontGrad(g, -hw, 0, hw, R, 0, CONCRETE, 0.62)
  for (let y = 0.9; y < R; y += 0.9) front(d, -hw, y, hw, y + 0.04, 0.02, STAIN)
  for (let x = -hw + 0.7; x < hw - 0.4; x += 1.3) front(d, x, 0.15, x + 0.04, R, 0.02, STAIN)
  // Weep holes and a stain.
  for (const x of [-hw * 0.5, hw * 0.35]) front(d, x - 0.06, 0.45, x + 0.06, 0.55, 0.03, rgb('#0b0e11'))
  front(g, hw * 0.1, 0.1, hw * 0.1 + 0.5, R - 0.2, 0.025, shade(CONCRETE, 0.7))
  // The ledge, then the building behind, set back.
  g.quad([-hw, R, 0.12], [hw, R, 0.12], [hw, R, -setback], [-hw, R, -setback], shade(CONCRETE, 0.9))
  g.span(-hw, R - 0.15, 0, hw, R + 0.08, 0.18, TRIM, { grime: 0.8 })
  frontGrad(g, -hw, R, hw, H, -setback, up, 0.8)
  g.span(-hw, H - 0.4, -setback, hw, H, -setback + 0.28, TRIM, { grime: 0.8 })
  for (const x of [-hw * 0.45, hw * 0.5]) {
    front(g, x - 0.45, 5.4, x + 0.45, 6.6, -setback + 0.03, FRAME)
    front(g, x - 0.4, 5.45, x + 0.4, 6.55, -setback + 0.04, rgb('#141c24'))
    for (let b = x - 0.35; b < x + 0.4; b += 0.14) d.rod([b, 5.45, -setback + 0.07], [b, 6.55, -setback + 0.07], 0.012, rgb('#1d2022'), 4)
  }
  // Fence on the ledge: posts and net.
  for (let x = -hw + 0.1; x <= hw - 0.1; x += 1.25) d.rod([x, R, 0.05], [x, R + 1.25, 0.05], 0.025, STEEL, 4)
  d.rod([-hw, R + 1.25, 0.05], [hw, R + 1.25, 0.05], 0.025, STEEL, 4)
  s.mesh.quad([-hw, R, 0.05], [hw, R, 0.05], [hw, R + 1.25, 0.05], [-hw, R + 1.25, 0.05], rgb('#7b8086'), undefined, [0, 0, (hw * 2) / 0.4, 1.25 / 0.4])
  // Planting spilling over the top, and a pipe down the face.
  for (let i = 0; i < 5; i++) g.blob(rng.range(-hw + 0.3, hw - 0.3), R + 0.2, rng.range(-0.3, 0.1), 0.42, 0.26, 0.34, rgb('#4b684c'), 0.15, i)
  for (const x of [-hw * 0.7, hw * 0.55]) for (let k = 0; k < 4; k++) d.rod([x, R - 0.1 - k * 0.55, 0.05], [x + rng.range(-0.1, 0.1), R - 0.65 - k * 0.55, 0.05], 0.015, rgb('#3e5c45'), 3)
  d.rod([hw - 0.3, 0.05, 0.06], [hw - 0.3, R, 0.06], 0.055, rgb('#5d6563'), 6)
}

// ------------------------------------------------------------------ trunk road closures

/**
 * Roadworks across each end of the trunk road: barriers, mesh fencing, lamps
 * and signs. The road carries on beyond, visible through the fence, into the haze.
 */
export function buildClosures(layers: Layers, atlas: SignAtlas, world: World) {
  world.layout.barriers.forEach(([a, b], i) => {
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const across = normalize(sub(b, a))
    const half = distance(a, b) / 2
    const alongRoad = perp(across)
    const s = new Sink(layers, 'base', mid[0], mid[1])
    const rng = new Rng(`closure:${i}`)
    // Two faces: one towards each way along the road.
    for (const dirn of [1, -1] as const) {
      const out = scale(alongRoad, dirn)
      const at = add(mid, scale(out, 0.55))
      s.with(faceFrame(at, out), () => {
        const g = s.solid
        const d = s.detail
        const em = s.emissive
        // Barriers in a row, alternate red and white, with a few lamps.
        const n = Math.round((half * 2) / 1.8)
        const bw = (half * 2) / n
        for (let k = 0; k < n; k++) {
          const x = -half + (k + 0.5) * bw
          g.box(x, 0.4, 0.12, bw - 0.08, 0.8, 0.3, rgb(k % 2 ? '#d6d3c8' : '#a4423b'), { grime: 0.8 })
          if (k % 3 === 1) {
            d.rod([x, 0.8, 0.12], [x, 1.05, 0.12], 0.03, DARK_STEEL, 4)
            em.box(x, 1.1, 0.12, 0.2, 0.14, 0.2, rgb(k % 2 ? '#e09a3a' : '#cf7a2e'))
          }
        }
        // Mesh fencing above, on posts, so the road beyond stays visible.
        for (let k = 0; k <= Math.round(half); k++) {
          const x = -half + (k / Math.round(half)) * half * 2
          d.rod([x, 0.8, 0.0], [x, 2.7, 0.0], 0.04, STEEL, 4)
        }
        d.rod([-half, 2.7, 0], [half, 2.7, 0], 0.03, STEEL, 4)
        s.mesh.quad([-half, 0.8, 0.0], [half, 0.8, 0.0], [half, 2.7, 0.0], [-half, 2.7, 0.0], rgb('#7b8086'), undefined, [0, 0, (half * 2) / 0.45, 1.9 / 0.45])
        // Roadworks signs on the fence, and a tall flashing lamp on a pole.
        for (const x of [-half * 0.45, half * 0.4]) {
          s.signs.quad([x - 0.8, 1.45, 0.03], [x + 0.8, 1.45, 0.03], [x + 0.8, 1.45 + 0.4, 0.03], [x - 0.8, 1.45 + 0.4, 0.03], '#ffffff', undefined, atlas.plate(ROADWORKS_LABEL.zh, ROADWORKS_LABEL.en, 'street'))
        }
        const px = rng.range(-half * 0.7, half * 0.7)
        d.rod([px, 0, 0.1], [px, 3.4, 0.1], 0.04, DARK_STEEL, 5)
        em.box(px, 3.5, 0.1, 0.28, 0.2, 0.28, rgb('#e09a3a'))
      })
    }
  })
}

/**
 * An elevated road crossing the trunk road beyond each closure: a deck on one
 * central pier, running on into the buildings either side. It is never
 * reachable, and tells you the city goes on.
 */
export function buildViaducts(layers: Layers, world: World) {
  const [west, east] = world.layout.barriers
  const trunk = world.nodes.get('TW')?.at
  const trunkEnd = world.nodes.get('TE')?.at
  if (!trunk || !trunkEnd) return
  const dir = normalize(sub(trunkEnd, trunk))
  const yaw = Math.atan2(-dir[1], dir[0])
  const place = (barrier: readonly [Vec2, Vec2], sign: 1 | -1, distanceBeyond: number) => {
    const mid: Vec2 = [(barrier[0][0] + barrier[1][0]) / 2, (barrier[0][1] + barrier[1][1]) / 2]
    const c = add(mid, scale(dir, sign * distanceBeyond))
    const s = new Sink(layers, 'base', c[0], c[1])
    s.at(c[0], 0, c[1], yaw, () => {
      const g = s.solid
      const deck = rgb('#6c6d6b')
      g.box(0, 8.2, 0, 9, 1.2, 46, deck, { grime: 0.8 })
      g.box(0, 9.0, 22.9, 9, 0.9, 0.3, shade(deck, 0.85))
      g.box(0, 9.0, -22.9, 9, 0.9, 0.3, shade(deck, 0.85))
      for (const z of [-10, 10]) g.box(0, 9.0, z, 9.2, 0.7, 0.18, shade(deck, 0.8))
      g.box(0, 3.8, 0, 1.8, 7.6, 1.8, shade(deck, 0.9), { grime: 0.7 })
      g.box(0, 7.4, 0, 3.6, 0.5, 6, shade(deck, 0.95))
      // A few lamps on the deck edge: lit, so the road reads even in the haze.
      for (const z of [-7, 0, 7]) {
        s.emissive.box(4.45, 9.6, z, 0.15, 0.15, 0.4, rgb('#c8b58a'))
        s.emissive.box(-4.45, 9.6, z, 0.15, 0.15, 0.4, rgb('#c8b58a'))
      }
    })
  }
  place(west, -1, 40)
  place(east, 1, 38)
}

