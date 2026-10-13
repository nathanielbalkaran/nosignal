import { Matrix4, Vector3 } from 'three'
import type { StationEntrance, World } from '../../world/build.ts'
import { distance, normalize, signedArea, sub, type Vec2 } from '../../world/geometry2d.ts'
import { Rng } from '../../world/rng.ts'
import { PLATFORM_LABEL, STATION_LABEL, TRANSIT_LABELS } from '../../world/signage.ts'
import { rgb, shade, type Geo } from '../geo/Geo.ts'
import { Sink, type Layers } from '../geo/layers.ts'
import type { SignAtlas } from '../geo/textures.ts'
import { front, frontGrad } from './context.ts'

/** A stretch of the station's street frontage, and the entrance on it if there is one. */
export interface StationFront {
  index: number
  a: Vec2
  b: Vec2
  outward: Vec2
  entrance?: StationEntrance
}

const WALL = rgb('#8d897e')
const TRIM = rgb('#a9a496')
const TILE = rgb('#56635f')
const BAND = rgb('#2b3f56')
const GLASS = rgb('#18212c')
const FRAME = rgb('#2a2f33')
const SHUTTER = rgb('#667369')
const CONCRETE = rgb('#6d706c')

/**
 * The street-facing edges of the station footprint. The mass builder leaves these
 * open (the walls are drawn here), so keep this the only place that decides which
 * edges they are.
 */
export function stationFronts(world: World): StationFront[] {
  const out: StationFront[] = []
  for (const prism of world.prisms.filter((p) => p.kind === 'station')) {
  const fp = prism.footprint
  const ccw = signedArea(fp) > 0
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i]
    const b = fp[(i + 1) % fp.length]
    const len = distance(a, b)
    if (len < 1) continue
    const t = normalize(sub(b, a))
    const outward: Vec2 = ccw ? [t[1], -t[0]] : [-t[1], t[0]]
    // Only the entrance wall is a drawn front. The slab's other faces are buried in the neighbouring block.
    const entrance = world.station.entrances.find((e) => distance(e.facade[0], a) < 1e-6 && distance(e.facade[1], b) < 1e-6)
    if (!entrance) continue
    out.push({ index: i, a, b, outward, entrance })
  }
  }
  return out
}

/** Draws the station's street faces: bays, windows, entrance portals, canopies and signs. */
export function buildStation(layers: Layers, atlas: SignAtlas, world: World) {
  for (const f of stationFronts(world)) drawFront(layers, atlas, world, f)
}

function drawFront(layers: Layers, atlas: SignAtlas, world: World, f: StationFront) {
  const H = world.layout.station.height
  const W = distance(f.a, f.b)
  // Local frame: x along the front, y up, z out into the street (as for the shop facades).
  let u: Vec2 = normalize(sub(f.b, f.a))
  let o: Vec2 = f.a
  let n: Vec2 = [-u[1], u[0]]
  if (n[0] * f.outward[0] + n[1] * f.outward[1] < 0) {
    u = [-u[0], -u[1]]
    o = f.b
    n = [-u[1], u[0]]
  }
  const frame = new Matrix4().makeBasis(new Vector3(u[0], 0, u[1]), new Vector3(0, 1, 0), new Vector3(n[0], 0, n[1])).setPosition(o[0], 0, o[1])
  const s = new Sink(layers, 'base', (f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2)
  const rng = new Rng(`station:${f.index}`)

  // The portal: where the entrance sits along this front, in local x.
  const e = f.entrance
  const major = !!e && e.width >= 24
  const portal = e
    ? (() => {
        const lx = (e.at[0] - o[0]) * u[0] + (e.at[1] - o[1]) * u[1]
        const pw = major ? 7.4 : 5.2
        return { x0: lx - pw / 2, x1: lx + pw / 2, w: pw, c: lx }
      })()
    : null

  s.with(frame, () => {
    const g = s.solid
    const d = s.detail
    const em = s.emissive

    const PH = 4.4 // portal height
    const C = 5.4 // top of the concourse level
    const FLOOR2 = 8.0

    // ---- Walls --------------------------------------------------------------
    if (portal) {
      frontGrad(g, 0, 0, portal.x0, H, 0, WALL, 0.74)
      frontGrad(g, portal.x1, 0, W, H, 0, WALL, 0.74)
      frontGrad(g, portal.x0, PH, portal.x1, H, 0, WALL, 0.9)
    } else {
      frontGrad(g, 0, 0, W, H, 0, WALL, 0.74)
    }
    // Parapet and cornice.
    frontGrad(g, 0, H, W, H + 0.8, 0, WALL, 0.95)
    g.span(-0.05, H + 0.8, -0.1, W + 0.05, H + 1.0, 0.35, TRIM)
    g.span(-0.05, H - 0.7, 0, W + 0.05, H, 0.35, TRIM, { grime: 0.8 })
    // Floor bands and the dark fascia band at the top of the concourse level.
    g.span(0, C, 0, W, C + 0.55, 0.14, BAND)
    g.span(0, FLOOR2 - 0.12, 0, W, FLOOR2 + 0.12, 0.1, TRIM, { grime: 0.85 })
    // Tiled plinth.
    const plinth = (x0: number, x1: number) => {
      if (x1 - x0 < 0.05) return
      g.span(x0, 0, 0, x1, 1.0, 0.07, TILE, { grime: 0.7 })
    }
    if (portal) {
      plinth(0, portal.x0)
      plinth(portal.x1, W)
    } else plinth(0, W)

    // ---- Bays ---------------------------------------------------------------
    const segments: [number, number][] = portal ? [[0, portal.x0], [portal.x1, W]] : [[0, W]]
    const blocked = portal ? [portal.x0 - 1.4, portal.x1 + 1.4] : null
    const clampPilaster = (x: number) => Math.max(0.25, Math.min(W - 0.25, x))
    for (const [sx0, sx1] of segments) {
      const sw = sx1 - sx0
      if (sw < 1.5) continue
      const nb = Math.max(1, Math.round(sw / 5.4))
      const bw = sw / nb
      for (let k = 0; k <= nb; k++) {
        // The portal surround takes the place of a pilaster beside the entrance.
        if (portal && ((sx1 === portal.x0 && k === nb) || (sx0 === portal.x1 && k === 0))) continue
        const x = clampPilaster(sx0 + k * bw)
        d.span(x - 0.25, 0, 0, x + 0.25, H - 0.7, 0.25, TRIM, { grime: 0.75 })
      }
      for (let k = 0; k < nb; k++) {
        const x0 = sx0 + k * bw + 0.45
        const x1 = sx0 + (k + 1) * bw - 0.45
        if (x1 - x0 < 1.2) continue
        drawConcourseBay(g, d, em, rng, x0, x1, C)
        // Two rows of upper windows; the entrance sign hides the lower row above the portal.
        for (const row of [0, 1]) {
          const y0 = row === 0 ? 7.3 : 11.3
          const y1 = y0 + 2.1
          if (row === 0 && blocked && x1 > blocked[0] && x0 < blocked[1]) continue
          drawWindowBay(g, d, em, rng, x0 + 0.5, x1 - 0.5, y0, y1)
        }
        // A water stain below the sill now and then.
        if (rng.chance(0.4)) {
          const sx = rng.range(x0 + 1, x1 - 1)
          front(g, sx, 3.0, sx + 0.28, 7.9, 0.02, shade(WALL, 0.84), undefined)
        }
        if (rng.chance(0.28)) {
          const ax = rng.range(x0 + 1, x1 - 1.6)
          d.span(ax, 9.9, 0.05, ax + 0.9, 10.5, 0.55, rgb('#b2b0a6'))
          d.span(ax + 0.05, 9.95, 0.5, ax + 0.85, 10.45, 0.56, rgb('#4b4f50'))
          front(g, ax + 0.3, 8.4, ax + 0.5, 9.9, 0.03, shade(WALL, 0.8))
        }
      }
    }
    // Rainwater pipes at the corners.
    for (const x of [0.5, W - 0.5]) d.rod([x, 0.1, 0.32], [x, H - 0.7, 0.32], 0.07, rgb('#5d6563'), 6)

    // ---- Entrance -----------------------------------------------------------
    if (portal && e) drawPortal(s, atlas, portal, PH, C, major)
  })
}

/** Shuttered or glazed concourse-level bay; the station is shut up at this hour apart from its entrances. */
function drawConcourseBay(g: Geo, d: Geo, em: Geo, rng: Rng, x0: number, x1: number, C: number) {
  const kind = rng.float()
  if (kind < 0.62) {
    // Roller shutter.
    g.span(x0, 1.0, 0, x1, 4.5, 0.12, SHUTTER, { grime: 0.8 })
    for (let y = 1.25; y < 4.4; y += 0.3) front(d, x0, y, x1, y + 0.04, 0.125, shade(SHUTTER, 0.62))
    d.span((x0 + x1) / 2 - 0.25, 1.15, 0.12, (x0 + x1) / 2 + 0.25, 1.3, 0.2, rgb('#2c3030'))
    d.span(x0 - 0.05, 4.45, 0.05, x1 + 0.05, 4.65, 0.2, rgb('#3d4442'))
  } else if (kind < 0.88) {
    // Display case with a poster lit from inside.
    g.span(x0 + 0.2, 1.3, 0, x1 - 0.2, 4.2, 0.1, FRAME)
    const px0 = x0 + 0.5
    const px1 = x1 - 0.5
    front(em, px0, 1.65, px1, 3.85, 0.115, rgb(rng.chance(0.5) ? '#a7b3a8' : '#c9bf9d'), [rgb('#6e7a72'), rgb('#6e7a72'), rgb('#98a498'), rgb('#98a498')])
    for (let i = 1; i < 4; i++) front(d, px0 + 0.2, 1.65 + i * 0.5, px1 - 0.2 - (i % 2) * 0.5, 1.65 + i * 0.5 + 0.12, 0.125, rgb('#59615c'))
  } else {
    // Dark glazing with a mesh gate behind it.
    g.span(x0, 1.0, 0, x1, 4.5, 0.08, FRAME)
    front(g, x0 + 0.25, 1.25, x1 - 0.25, 4.25, 0.09, GLASS, [rgb('#10161d'), rgb('#10161d'), rgb('#26323f'), rgb('#26323f')])
    const mid = (x0 + x1) / 2
    d.span(mid - 0.04, 1.25, 0.09, mid + 0.04, 4.25, 0.12, FRAME)
  }
  // Louvre vents on the transom above.
  for (let y = 4.95; y < C - 0.25; y += 0.22) front(d, x0 + 0.4, y, x1 - 0.4, y + 0.08, 0.04, rgb('#4a504e'))
}

/** A framed, mostly dark window; occasionally someone left a light on. */
function drawWindowBay(g: Geo, d: Geo, em: Geo, rng: Rng, x0: number, x1: number, y0: number, y1: number) {
  if (x1 - x0 < 0.8) return
  g.span(x0 - 0.12, y0 - 0.12, 0, x1 + 0.12, y1 + 0.12, 0.1, FRAME)
  const lit = rng.chance(0.14)
  if (lit) front(em, x0, y0, x1, y1, 0.11, rgb('#b0b58d'), [rgb('#6f7656'), rgb('#6f7656'), rgb('#9aa07a'), rgb('#9aa07a')])
  else front(g, x0, y0, x1, y1, 0.11, GLASS, [rgb('#10161d'), rgb('#10161d'), rgb('#2c3947'), rgb('#2c3947')])
  const mid = (x0 + x1) / 2
  d.span(mid - 0.04, y0, 0.11, mid + 0.04, y1, 0.14, FRAME)
  d.span(x0 - 0.18, y0 - 0.2, 0, x1 + 0.18, y0 - 0.1, 0.3, TRIM, { grime: 0.8 })
}

interface Portal {
  x0: number
  x1: number
  w: number
  c: number
}

/** The street-level entrance: a surround, a recessed stairwell going down into the dark, a canopy and the name board. */
function drawPortal(s: Sink, atlas: SignAtlas, p: Portal, PH: number, C: number, major: boolean) {
  const g = s.solid
  const d = s.detail
  const em = s.emissive
  const D = 3.6 // recess depth
  const innerWall = rgb('#767975')
  const ceiling = rgb('#585c5a')

  // Surround.
  g.span(p.x0 - 0.5, 0, 0, p.x0, PH + 0.45, 0.22, TRIM, { grime: 0.72 })
  g.span(p.x1, 0, 0, p.x1 + 0.5, PH + 0.45, 0.22, TRIM, { grime: 0.72 })
  g.span(p.x0 - 0.5, PH, 0, p.x1 + 0.5, PH + 0.45, 0.22, TRIM)

  // Recess shell.
  const left: [number, number, number][] = [[p.x0, 0, 0], [p.x0, 0, -D], [p.x0, PH, -D], [p.x0, PH, 0]]
  g.quad(left[0], left[1], left[2], left[3], innerWall, [shade(innerWall, 0.6), shade(innerWall, 0.2), shade(innerWall, 0.3), innerWall])
  g.quad([p.x1, 0, -D], [p.x1, 0, 0], [p.x1, PH, 0], [p.x1, PH, -D], innerWall, [shade(innerWall, 0.2), shade(innerWall, 0.6), innerWall, shade(innerWall, 0.3)])
  g.quad([p.x0, PH, 0], [p.x0, PH, -D], [p.x1, PH, -D], [p.x1, PH, 0], ceiling, [ceiling, shade(ceiling, 0.3), shade(ceiling, 0.3), ceiling])
  front(g, p.x0, 0, p.x1, PH, -D, rgb('#0b0f14'), [rgb('#07090c'), rgb('#07090c'), rgb('#0f1820'), rgb('#0f1820')])
  // A dim cool light far down the stairwell.
  front(em, p.x0 + p.w * 0.3, 0.15, p.x1 - p.w * 0.3, 1.6, -D + 0.02, rgb('#8a6c3c'), [rgb('#4a3a22'), rgb('#4a3a22'), rgb('#9c7b45'), rgb('#9c7b45')])

  // Landing, then steps that darken as they drop away.
  const landing = 0.9
  g.quad([p.x0, 0.02, 0], [p.x1, 0.02, 0], [p.x1, 0.02, -landing], [p.x0, 0.02, -landing], CONCRETE)
  g.quad([p.x0, 0.03, -landing], [p.x1, 0.03, -landing], [p.x1, 0.03, -landing - 0.16], [p.x0, 0.03, -landing - 0.16], rgb('#9a8f58'))
  const steps = 8
  const run = (D - landing - 0.16) / steps
  for (let i = 0; i < steps; i++) {
    const z0 = -landing - 0.16 - i * run
    const k = 1 - (i / steps) * 0.85
    const tread = shade(rgb('#a4a79f'), k)
    const riser = shade(rgb('#5c5f5a'), k)
    g.quad([p.x0, 0.025, z0], [p.x1, 0.025, z0], [p.x1, 0.025, z0 - run * 0.62], [p.x0, 0.025, z0 - run * 0.62], tread)
    g.quad([p.x0, 0.025, z0 - run * 0.62], [p.x1, 0.025, z0 - run * 0.62], [p.x1, 0.025, z0 - run], [p.x0, 0.025, z0 - run], riser)
  }
  // Centre and side handrails dropping toward the platform.
  const rail = rgb('#9aa39f')
  for (const x of [p.x0 + p.w * 0.3, p.x1 - p.w * 0.3]) {
    d.rod([x, 1.0, -landing], [x, 0.3, -D + 0.2], 0.035, rail, 5)
    d.rod([x, 0.0, -landing], [x, 1.0, -landing], 0.04, rail, 5)
    d.rod([x, 0.0, -landing - 1.4], [x, 0.78, -landing - 1.4], 0.03, rail, 5)
  }
  // Ceiling light strips.
  for (const x of [p.x0 + p.w * 0.32, p.x1 - p.w * 0.32]) {
    em.quad([x - 0.18, PH - 0.01, -0.4], [x - 0.18, PH - 0.01, -D + 0.6], [x + 0.18, PH - 0.01, -D + 0.6], [x + 0.18, PH - 0.01, -0.4], rgb('#e6cd96'))
  }
  // "To platforms" board, hung just inside the opening.
  const uvPlatform = atlas.fascia(PLATFORM_LABEL.zh, PLATFORM_LABEL.en, 'blue')
  const bw = Math.min(p.w - 1.2, 3.4)
  const sl = s.signsLit
  sl.quad([p.c - bw / 2, PH - 1.25, -0.5], [p.c + bw / 2, PH - 1.25, -0.5], [p.c + bw / 2, PH - 1.25 + bw / 4, -0.5], [p.c - bw / 2, PH - 1.25 + bw / 4, -0.5], '#ffffff', undefined, uvPlatform)

  // Canopy: a cantilevered steel-and-glass hood with a dim lit underside, tied back to the wall.
  const reach = major ? 3.0 : 2.4
  const cx0 = p.x0 - 1.2
  const cx1 = p.x1 + 1.2
  const cy = PH + 0.7
  g.span(cx0, cy, 0, cx1, cy + 0.2, reach - 0.1, rgb('#7d9488'), { grime: 0.8 })
  g.span(cx0 - 0.04, cy - 0.12, reach - 0.12, cx1 + 0.04, cy + 0.3, reach, BAND)
  g.quad([cx0, cy - 0.005, 0.12], [cx1, cy - 0.005, 0.12], [cx1, cy - 0.005, reach - 0.12], [cx0, cy - 0.005, reach - 0.12], rgb('#3c4a46'))
  for (const x of [p.c - p.w * 0.28, p.c + p.w * 0.28]) {
    em.quad([x - 0.4, cy - 0.02, 0.4], [x + 0.4, cy - 0.02, 0.4], [x + 0.4, cy - 0.02, reach - 0.4], [x - 0.4, cy - 0.02, reach - 0.4], rgb('#d9bf86'), [rgb('#8a7448'), rgb('#8a7448'), rgb('#b59a62'), rgb('#b59a62')])
  }
  for (const x of [cx0 + 0.3, cx1 - 0.3]) {
    d.rod([x, cy + 0.2, reach - 0.1], [x, C + 0.4, 0.06], 0.025, rail, 4)
  }

  // Name board and a quiet rail roundel-style plate.
  const uvStation = atlas.fascia(STATION_LABEL.zh, STATION_LABEL.en, 'blue')
  const hw = major ? 4.4 : 2.2
  const y0 = C + 0.7
  s.signsLit.quad([p.c - hw, y0, 0.22], [p.c + hw, y0, 0.22], [p.c + hw, y0 + hw / 2, 0.22], [p.c - hw, y0 + hw / 2, 0.22], '#ffffff', undefined, uvStation)
  g.span(p.c - hw - 0.12, y0 - 0.12, 0, p.c + hw + 0.12, y0 + hw / 2 + 0.12, 0.2, FRAME)
  if (major) {
    const t = TRANSIT_LABELS[0]
    const uvRail = atlas.plate(t.zh, t.en, 'transit')
    const px = p.x1 + 2.6
    s.signs.quad([px - 1.0, 3.2, 0.16], [px + 1.0, 3.2, 0.16], [px + 1.0, 3.7, 0.16], [px - 1.0, 3.7, 0.16], '#ffffff', undefined, uvRail)
  }

  // A warm pool of light on the pavement in front of the entrance.
  const pool = shade(rgb('#d8b878'), 0.5)
  const hw2 = p.w * 0.75
  s.glow.quad([p.c - hw2, 0.045, reach + 2.4], [p.c + hw2, 0.045, reach + 2.4], [p.c + hw2, 0.045, 0.1], [p.c - hw2, 0.045, 0.1], pool, undefined, [0, 0, 1, 1])
}
