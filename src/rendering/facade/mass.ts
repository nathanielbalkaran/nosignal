import { ShapeUtils, Vector2 } from 'three'
import type { World } from '../../world/build.ts'
import type { FacadeSpec } from '../../world/facades.ts'
import { add, scale, signedArea, normalize, sub, type Vec2 } from '../../world/geometry2d.ts'
import { rgb, shade, type Geo, type RGB } from '../geo/Geo.ts'
import { Sink, type Layers } from '../geo/layers.ts'
import { stepHeight } from './context.ts'
import { stationFronts } from './station.ts'

const key = (a: Vec2, b: Vec2) => `${a[0].toFixed(2)},${a[1].toFixed(2)}|${b[0].toFixed(2)},${b[1].toFixed(2)}`

/**
 * The solid volume of each building: side and rear walls, roofs and the
 * pulled-back upper block of stepped buildings. Edges that carry a facade are
 * left open because the facade builder draws the wall itself.
 */
export function buildMasses(layers: Layers, world: World, specs: readonly FacadeSpec[]) {
  const byId = new Map<string, FacadeSpec>()
  const covered = new Set<string>()
  for (const s of specs) {
    if (s.source === 'lot') byId.set(s.id, s)
    else {
      covered.add(key(s.a, s.b))
      covered.add(key(s.b, s.a))
    }
  }

  // The station draws its own street faces.
  for (const f of stationFronts(world)) {
    covered.add(key(f.a, f.b))
    covered.add(key(f.b, f.a))
  }

  for (const p of world.prisms) {
    const c = p.footprint.reduce((acc, q) => [acc[0] + q[0] / p.footprint.length, acc[1] + q[1] / p.footprint.length] as Vec2, [0, 0] as Vec2)
    const sink = new Sink(layers, 'base', c[0], c[1])
    const g = sink.solid
    const spec = p.id ? byId.get(p.id) : undefined
    const wall: RGB = spec ? shade(rgb(spec.wall), 0.82) : p.kind === 'station' ? rgb('#6d706e') : p.kind === 'lot' ? shade(rgb(p.color), 0.8) : shade(rgb(p.color), 0.85)
    const roofSeed = Math.abs(Math.sin(c[0] * 12.9898 + c[1] * 78.233) * 43758.5453) % 1
    const roof = shade(rgb('#5d5f5c'), 0.85 + roofSeed * 0.3)
    const ccw = signedArea(p.footprint) > 0
    // Base volumes sit under the lots' own facades, so pull their walls in a touch to avoid fighting them.
    const inset = p.kind === 'base' ? 0.08 : 0

    const wallQuad = (a0: Vec2, b0: Vec2, y0: number, y1: number) => {
      let a = a0
      let b = b0
      if (inset > 0) {
        const t = normalize(sub(b0, a0))
        const n: Vec2 = ccw ? [t[1], -t[0]] : [-t[1], t[0]]
        a = [a0[0] - n[0] * inset, a0[1] - n[1] * inset]
        b = [b0[0] - n[0] * inset, b0[1] - n[1] * inset]
      }
      const [s0, s1] = ccw ? [b, a] : [a, b]
      const lo = shade(wall, 0.72)
      g.quad([s0[0], y0, s0[1]], [s1[0], y0, s1[1]], [s1[0], y1, s1[1]], [s0[0], y1, s0[1]], wall, [lo, lo, wall, wall])
    }

    const fp = p.footprint
    const top = p.base + p.height
    // An entrance building's only visible wall is its front (drawn in station.ts); the rest lies against the
    // pocket walls, which are drawn by the neighbouring facades.
    if (p.kind === 'station') {
      cap(g, fp, top, roof)
      continue
    }
    const y0 = p.base
    const step = spec ? stepHeight(spec) : null
    if (spec && step !== null && fp.length === 4) {
      const dd = normalize(sub(fp[3], fp[0]))
      const u0 = add(fp[0], scale(dd, spec.setback))
      const u1 = add(fp[1], scale(dd, spec.setback))
      wallQuad(fp[1], fp[2], y0, step)
      wallQuad(fp[2], fp[3], y0, step)
      wallQuad(fp[3], fp[0], y0, step)
      wallQuad(u1, fp[2], step, top)
      wallQuad(fp[2], fp[3], step, top)
      wallQuad(fp[3], u0, step, top)
      cap(g, [u0, u1, fp[2], fp[3]], top, roof)
      continue
    }
    for (let i = 0; i < fp.length; i++) {
      const a = fp[i]
      const b = fp[(i + 1) % fp.length]
      if (spec && i === 0) continue
      if (covered.has(key(a, b))) continue
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) continue
      wallQuad(a, b, y0, top)
    }
    cap(g, fp, top, roof)
  }
}

/** A flat roof cap facing up. */
function cap(g: Geo, pts: readonly Vec2[], y: number, color: RGB) {
  const contour = pts.map((q) => new Vector2(q[0], q[1]))
  const faces = ShapeUtils.triangulateShape(contour, [])
  for (const [i, j, k] of faces) {
    const a = pts[i]
    const b = pts[j]
    const c = pts[k]
    const crossY = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    // Counter-clockwise seen from above has a negative x-z cross product in this handedness.
    if (crossY < 0) g.tri([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], color)
    else g.tri([a[0], y, a[1]], [c[0], y, c[1]], [b[0], y, b[1]], color)
  }
}
