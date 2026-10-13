import { mix, rgb, shade, type RGB } from '../geo/Geo.ts'
import { bar, front, frontGrad, type FacadeContext } from './context.ts'
import { windowLog } from './windowLog.ts'

const FRAME_COLORS = ['#8a8d86', '#5b5f61', '#a39c8a', '#464a4d', '#7b7f7a']
const GRILLE_COLORS = ['#3a3d40', '#6b6f72', '#b4b0a2', '#4a5a52']
const AC_COLORS = ['#cfcfc6', '#b9bbb6', '#9a9d9a', '#d5d2c4']
const CURTAINS = ['#9d947c', '#7a8790', '#92796f', '#85927a', '#a39f92']
const CLOTHS = ['#8f9aa3', '#a68f84', '#b2ab98', '#7b8f84', '#9b8aa0', '#a8a6a0']
const PIPE_COLORS = ['#8a8d88', '#b2ada0', '#6e7276']
const GLASS_LO = rgb('#232d36')
const GLASS_HI = rgb('#4a5d70')
const WARM = '#e7b269'
const COOL = '#c7d6cb'

interface WindowDims {
  ww: number
  wh: number
  sill: number
}

function dimsFor(ctx: FacadeContext, bayWidth: number, forceTall: boolean): WindowDims {
  const kind = forceTall ? 'tall' : ctx.spec.windowKind
  switch (kind) {
    case 'casement':
      return { ww: Math.min(0.9, bayWidth * 0.5), wh: 1.35, sill: 0.85 }
    case 'louvre':
      return { ww: Math.min(0.75, bayWidth * 0.45), wh: 1.3, sill: 0.9 }
    case 'tall':
      return { ww: Math.min(1.0, bayWidth * 0.55), wh: 1.95, sill: 0.25 }
    default:
      return { ww: Math.min(1.35, bayWidth * 0.62), wh: 1.15, sill: 0.95 }
  }
}

/** Walls, cornice, parapet, pilasters and weathering. */
export function drawWalls(ctx: FacadeContext) {
  const { base, detail, W, H, G, spec, rng, wall, planes, storey, floors } = ctx

  // Ground floor wall: a tiled plinth, then dirty plaster.
  const tile = rgb(spec.tile)
  frontGrad(base, 0, 0, W, 1.0, 0, tile, 0.55, 0.95)
  frontGrad(base, 0, 1.0, W, G, 0, wall, 0.75, 0.98)

  for (let f = 1; f <= floors; f++) {
    const y0 = G + (f - 1) * storey
    const z = ctx.zAt(y0)
    const tint = 0.93 + rng.float() * 0.1
    frontGrad(base, 0, y0, W, y0 + storey, z, shade(wall, tint), 0.88, 1.0)
  }

  // Overhang: close the sides and underside of the projecting block.
  if (spec.overhang > 0) {
    const yO = G + storey
    base.span(0, yO, 0, W, H, spec.overhang, wall, { skip: ['+z', '-z', '+y'] })
  }
  // Terrace where a stepped building pulls back.
  const step = planes.find((p) => p.z < 0)
  if (step) {
    const concrete = rgb('#6a6c6a')
    base.quad([0, step.y0, 0], [W, step.y0, 0], [W, step.y0, step.z], [0, step.y0, step.z], concrete)
    base.span(0, step.y0, -0.12, W, step.y0 + 0.9, 0, shade(wall, 0.9), { skip: ['-z'] })
    const n = Math.max(1, Math.floor(W / 3))
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.55)) detail.blob((i + 0.5) * (W / n), step.y0 + 1.15, -0.5, 0.35, 0.28, 0.3, '#4b684c', 0.18, i)
    }
  }

  // Roofline: projecting cornice and a low parapet.
  const zTop = ctx.zAt(G + (floors - 1) * storey)
  base.span(-0.04, H - 0.26, zTop, W + 0.04, H, zTop + 0.26, ctx.trim, { skip: ['-z'] })
  base.span(0, H, zTop - 0.2, W, H + 0.8, zTop + 0.02, shade(wall, 0.9), { skip: ['-z'] })

  // Floor-line bands and pilasters give the flat wall some rhythm.
  if (spec.kind !== 'tower' && spec.kind !== 'restaurant') {
    for (const p of planes) {
      base.span(0, p.y0, p.z, 0.3, p.y1, p.z + 0.07, ctx.trim, { skip: ['-z', '-y'] })
      base.span(W - 0.3, p.y0, p.z, W, p.y1, p.z + 0.07, ctx.trim, { skip: ['-z', '-y'] })
    }
    const bandEvery = spec.kind === 'slab' || spec.kind === 'stepped' ? 1 : 2
    for (let f = 1; f <= floors; f += bandEvery) {
      const y = G + (f - 1) * storey
      const z = ctx.zAt(y)
      base.span(0, y - 0.07, z, W, y + 0.07, z + 0.06, ctx.trim, { skip: ['-z', '-y'] })
    }
  }

  // Patches of repair and rain streaks, kept slightly proud of the wall.
  const patches = Math.round((W / 4) * (0.5 + spec.stain))
  for (let i = 0; i < patches; i++) {
    const f = rng.int(1, floors)
    const y0 = G + (f - 1) * storey
    const z = ctx.zAt(y0) + 0.014
    const pw = rng.range(0.7, 2.0)
    const ph = rng.range(0.5, 1.3)
    const x = rng.range(0.4, Math.max(0.5, W - pw - 0.4))
    const y = y0 + rng.range(0.1, Math.max(0.2, storey - ph - 0.1))
    const k = rng.chance(0.6) ? rng.range(0.82, 0.92) : rng.range(1.05, 1.12)
    front(base, x, y, x + pw, y + ph, z, shade(wall, k))
  }
  const streaks = Math.round((W / 2.2) * spec.stain)
  for (let i = 0; i < streaks; i++) {
    const f = rng.int(1, floors)
    const yTop = G + f * storey - rng.range(0.1, 0.9)
    let yBot = yTop - rng.range(1.2, 3.8)
    const z = ctx.zAt(G + (f - 1) * storey) + 0.02
    // Stay on this wall plane.
    const plane = planes.find((p) => Math.abs(p.z - (z - 0.02)) < 1e-6 && p.y0 <= yTop - 0.01 && p.y1 >= yTop - 0.01)
    if (plane) yBot = Math.max(yBot, plane.y0 + 0.02)
    if (yBot > yTop - 0.4) continue
    const x = rng.range(0.3, W - 0.3)
    const w = rng.range(0.1, 0.34)
    const dark = shade(wall, rng.range(0.66, 0.8))
    front(base, x - w / 2, yBot, x + w / 2, yTop, z, wall, [wall, wall, dark, dark])
  }
}

interface Placed {
  x: number
  w: number
}

/** Windows, their frames, grilles, air conditioners, balconies. */
export function drawWindows(ctx: FacadeContext) {
  const { base, detail, W, G, spec, rng, storey, floors } = ctx
  const frameColor = rgb(rng.pick(FRAME_COLORS))
  const grilleColor = rgb(rng.pick(GRILLE_COLORS))
  const ribbon = spec.windowKind === 'ribbon'
  const bays = Math.max(1, spec.bays)
  const bw = W / bays

  for (let f = 1; f <= floors; f++) {
    const y0 = G + (f - 1) * storey
    const z = ctx.zAt(y0)
    const balconyHere = spec.balconies === 'every' || (spec.balconies === 'alternate' && f % 2 === 0)
    const topFloor = f === floors

    if (ribbon) {
      const x0 = 0.6
      const x1 = W - 0.6
      const sill = 0.95
      const wh = 1.05
      const segs = Math.max(1, Math.round((x1 - x0) / 1.8))
      const sw = (x1 - x0) / segs
      front(base, x0 - 0.06, y0 + sill - 0.06, x1 + 0.06, y0 + sill + wh + 0.06, z + 0.05, frameColor)
      for (let i = 0; i < segs; i++) {
        const sx0 = x0 + i * sw + 0.03
        const sx1 = x0 + (i + 1) * sw - 0.03
        drawPane(ctx, sx0, sx1, y0 + sill, y0 + sill + wh, z + 0.062, rng.chance(spec.litWindows), rng.float(), rng.chance(0.3))
      }
      if (rng.chance(spec.ac)) drawAc(ctx, rng.range(1, W - 1), y0 + 0.22, z)
      detail.span(x0 - 0.1, y0 + sill - 0.1, z, x1 + 0.1, y0 + sill - 0.04, z + 0.14, ctx.trim)
      continue
    }

    const placed: Placed[] = []
    for (let i = 0; i < bays; i++) {
      const cx = (i + 0.5) * bw
      const d = dimsFor(ctx, bw, balconyHere)
      if (cx - d.ww / 2 < 0.35 || cx + d.ww / 2 > W - 0.35) continue
      placed.push({ x: cx, w: d.ww })
      const lit = rng.chance(spec.litWindows)
      const shutters = !lit && rng.chance(0.07)
      const glassFrame = rng.range(0, 1)
      drawFramedWindow(ctx, cx, y0, z, d, frameColor, lit, shutters, glassFrame, rng.chance(0.3))

      const caged = !balconyHere && rng.chance(spec.grille)
      if (caged) drawGrille(ctx, cx, y0 + d.sill, z, d, grilleColor)
      if (!balconyHere && !topFloor && rng.chance(spec.ac)) drawAc(ctx, cx + rng.range(-0.2, 0.2), y0 + 0.2, z)
      if (balconyHere) drawBalcony(ctx, cx, y0, z, bw * 0.86, grilleColor, rng.chance(0.3), rng.chance(0.3))
    }
  }
}

function drawPane(ctx: FacadeContext, x0: number, x1: number, y0: number, y1: number, z: number, lit: boolean, tone: number, curtain: boolean) {
  const { base, emissive, rng } = ctx
  if (lit) {
    const c = rgb(tone < 0.7 ? WARM : COOL)
    front(emissive, x0, y0, x1, y1, z, shade(c, 0.9), [shade(c, 0.7), shade(c, 0.7), c, c])
    if (curtain) front(base, x0, y1 - (y1 - y0) * 0.35, x1, y1, z + 0.012, rgb(rng.pick(CURTAINS)))
    return
  }
  const k = 0.85 + tone * 0.3
  const lo = shade(GLASS_LO, k)
  const hi = shade(GLASS_HI, k)
  front(base, x0, y0, x1, y1, z, hi, [lo, lo, hi, hi])
  if (curtain) {
    const c = shade(rgb(rng.pick(CURTAINS)), 0.55)
    front(base, x0, y1 - (y1 - y0) * rng.range(0.4, 0.8), x1, y1, z + 0.012, c)
  }
}

function drawFramedWindow(ctx: FacadeContext, cx: number, y0: number, z: number, d: WindowDims, frameColor: RGB, lit: boolean, shutters: boolean, tone: number, curtain: boolean) {
  const { base, detail, spec } = ctx
  const x0 = cx - d.ww / 2
  const x1 = cx + d.ww / 2
  const ya = y0 + d.sill
  const yb = ya + d.wh
  base.span(x0 - 0.05, ya - 0.05, z, x1 + 0.05, yb + 0.05, z + 0.05, frameColor, { skip: ['-z', '-y', '+z'] })
  front(base, x0 - 0.05, ya - 0.05, x1 + 0.05, yb + 0.05, z + 0.05, frameColor)
  if (shutters) {
    const g = rgb('#59705f')
    front(base, x0, ya, x1, yb, z + 0.062, g)
    const n = 5
    for (let i = 1; i < n; i++) {
      const y = ya + (d.wh * i) / n
      front(base, x0, y - 0.015, x1, y + 0.015, z + 0.074, shade(g, 0.6))
    }
  } else {
    drawPane(ctx, x0, x1, ya, yb, z + 0.062, lit, tone, curtain)
    if (!lit) windowLog.push({ facade: spec.id, x0, x1, y0: ya, y1: yb, z: z + 0.062 })
    // Mullions by window type.
    const kind = spec.windowKind
    if (kind === 'sliding' || kind === 'tall' || kind === 'casement') bar(base, cx, ya, yb, z + 0.08, 0.05, frameColor)
    if (kind === 'casement') front(base, x0, ya + d.wh * 0.62, x1, ya + d.wh * 0.62 + 0.04, z + 0.08, frameColor)
    if (kind === 'louvre') {
      for (let i = 1; i < 6; i++) front(base, x0, ya + (d.wh * i) / 6, x1, ya + (d.wh * i) / 6 + 0.03, z + 0.075, shade(frameColor, 0.8))
    }
  }
  // Sill and a small drip streak below.
  detail.span(x0 - 0.1, ya - 0.1, z, x1 + 0.1, ya - 0.04, z + 0.14, ctx.trim, { skip: ['-z', '-y', '-x', '+x'] })
  if (ctx.rng.chance(0.25)) {
    const w = ctx.wall
    front(base, cx - 0.12, ya - 0.1 - 0.9, cx + 0.12, ya - 0.1, z + 0.022, w, [w, w, shade(w, 0.75), shade(w, 0.75)])
  }
}

function drawGrille(ctx: FacadeContext, cx: number, ya: number, z: number, d: WindowDims, color: RGB) {
  const { detail } = ctx
  const x0 = cx - d.ww / 2 - 0.08
  const x1 = cx + d.ww / 2 + 0.08
  const y0 = ya - 0.08
  const y1 = ya + d.wh + 0.08
  const zf = z + 0.32
  const n = Math.max(3, Math.round((x1 - x0) / 0.19))
  for (let i = 0; i <= n; i++) bar(detail, x0 + ((x1 - x0) * i) / n, y0, y1, zf, 0.025, color)
  front(detail, x0, y0, x1, y0 + 0.04, zf + 0.005, color)
  front(detail, x0, y1 - 0.04, x1, y1, zf + 0.005, color)
  front(detail, x0, (y0 + y1) / 2, x1, (y0 + y1) / 2 + 0.03, zf + 0.005, color)
  const dark = shade(color, 0.7)
  detail.quad([x0, y0, z + 0.05], [x0, y0, zf], [x0, y1, zf], [x0, y1, z + 0.05], dark)
  detail.quad([x1, y0, zf], [x1, y0, z + 0.05], [x1, y1, z + 0.05], [x1, y1, zf], dark)
  detail.quad([x0, y1, zf], [x1, y1, zf], [x1, y1, z + 0.05], [x0, y1, z + 0.05], dark)
}

function drawAc(ctx: FacadeContext, cx: number, y: number, z: number) {
  const { detail, rng, base } = ctx
  const body = rgb(rng.pick(AC_COLORS))
  const w = 0.78
  const h = 0.52
  const d = 0.32
  detail.span(cx - w / 2, y, z + 0.06, cx + w / 2, y + h, z + 0.06 + d, body, { skip: ['-z'] })
  front(detail, cx - w / 2 + 0.06, y + 0.08, cx + w / 2 - 0.06, y + h - 0.08, z + 0.06 + d + 0.006, shade(body, 0.42))
  front(detail, cx - 0.2, y + 0.1, cx + 0.2, y + h - 0.1, z + 0.06 + d + 0.012, shade(body, 0.28))
  detail.span(cx - w / 2 + 0.08, y - 0.06, z + 0.04, cx + w / 2 - 0.08, y, z + 0.38, shade(body, 0.5), { skip: ['-z', '-y', '+z', '-x', '+x'] })
  // Condensation stain below.
  const wc = ctx.wall
  front(base, cx - 0.1, y - 1.1, cx + 0.1, y - 0.04, z + 0.025, wc, [wc, wc, shade(wc, 0.62), shade(wc, 0.62)])
}

function drawBalcony(ctx: FacadeContext, cx: number, y0: number, z: number, width: number, color: RGB, laundry: boolean, plant: boolean) {
  const { detail, rng, base } = ctx
  const x0 = cx - width / 2
  const x1 = cx + width / 2
  const depth = 0.95
  detail.span(x0, y0 - 0.14, z, x1, y0, z + depth, mix(ctx.trim, ctx.wall, 0.4), { skip: ['+y'] })
  const zr = z + depth - 0.03
  const rail = 0.95
  const n = Math.max(4, Math.round(width / 0.2))
  for (let i = 0; i <= n; i++) bar(detail, x0 + ((x1 - x0) * i) / n, y0, y0 + rail, zr, 0.025, color)
  detail.span(x0, y0 + rail - 0.04, z + depth - 0.06, x1, y0 + rail + 0.02, z + depth, color)
  detail.quad([x0, y0, z + depth], [x0, y0, z], [x0, y0 + rail, z], [x0, y0 + rail, z + depth], shade(color, 0.8))
  detail.quad([x1, y0, z], [x1, y0, z + depth], [x1, y0 + rail, z + depth], [x1, y0 + rail, z], shade(color, 0.8))
  if (laundry) {
    const yl = y0 + 2.2
    detail.rod([x0 + 0.1, yl, z + depth - 0.1], [x1 - 0.1, yl, z + depth - 0.1], 0.02, '#55585a', 4)
    const k = rng.int(2, 4)
    for (let i = 0; i < k; i++) {
      const x = x0 + 0.3 + ((width - 0.6) * (i + rng.float() * 0.5)) / k
      const w = rng.range(0.3, 0.55)
      const h = rng.range(0.5, 0.9)
      front(base, x, yl - h, x + w, yl, z + depth - 0.08, rgb(rng.pick(CLOTHS)))
    }
  }
  if (plant) detail.blob(x0 + 0.3, y0 + 0.28, z + depth - 0.25, 0.25, 0.2, 0.22, '#4b684c', 0.2, 3)
}

/** Drainage and gas pipes, cable runs and creepers. */
export function drawServices(ctx: FacadeContext) {
  const { detail, base, W, spec, rng, planes, G, storey, floors } = ctx
  const bays = Math.max(1, spec.bays)
  const bw = W / bays

  const pipeColor = rgb(rng.pick(PIPE_COLORS))
  const xs: number[] = []
  for (let i = 0; i < spec.pipes; i++) {
    const candidates = [0.4, W - 0.4, ...Array.from({ length: bays - 1 }, (_, k) => (k + 1) * bw)]
    xs.push(rng.pick(candidates))
  }
  for (const x of xs) {
    for (const p of planes) {
      detail.rod([x, p.y0 + 0.2, p.z + 0.08], [x, p.y1 - 0.05, p.z + 0.08], 0.045, pipeColor, 5)
      for (let y = p.y0 + 1; y < p.y1; y += 3) detail.span(x - 0.07, y, p.z, x + 0.07, y + 0.07, p.z + 0.14, shade(pipeColor, 0.7))
    }
  }
  // A yellow gas line on some buildings.
  if (rng.chance(0.3) && xs.length > 0) {
    const x = xs[0] + 0.16
    const p = planes[0]
    detail.rod([x, 0.2, p.z + 0.07], [x, Math.min(G + storey * 2, p.y1), p.z + 0.07], 0.035, '#b59a3c', 4)
  }

  if (spec.conduit) {
    const runs = rng.int(1, 2)
    for (let i = 0; i < runs; i++) {
      const f = rng.int(1, floors)
      const y = G + (f - 1) * storey + rng.range(2.5, 2.75)
      const z = ctx.zAt(G + (f - 1) * storey) + 0.07
      const x0 = rng.range(0.3, W * 0.3)
      const x1 = rng.range(W * 0.6, W - 0.3)
      const c = rng.chance(0.5) ? '#2a2c2f' : '#7e8286'
      detail.rod([x0, y, z], [x1, y, z], 0.03, c, 4)
      detail.rod([x0, y + 0.07, z], [x1, y + 0.1, z], 0.022, '#2a2c2f', 4)
      if (rng.chance(0.6)) detail.span(x0 + 1, y - 0.12, z - 0.02, x0 + 1.35, y + 0.14, z + 0.1, '#6a6e70')
    }
    // A drop of cable down to the ground floor.
    if (rng.chance(0.5)) {
      const x = rng.range(0.6, W - 0.6)
      for (let k = 0; k < 3; k++) detail.rod([x + k * 0.04, 2.6, 0.08], [x + k * 0.04, 3.6 + k * 0.3, 0.08], 0.014, '#222426', 3)
    }
  }

  if (spec.vegetation) {
    const patches = rng.int(1, 3)
    for (let i = 0; i < patches; i++) {
      const x = rng.chance(0.5) && xs.length ? xs[rng.int(0, xs.length - 1)] : rng.range(0.4, W - 0.4)
      const y = rng.range(0.3, G + storey)
      const r = rng.range(0.35, 0.8)
      const z = ctx.zAt(y) + 0.03
      const cols = ['#3d5a3f', '#4b684c', '#55734f']
      for (let k = 0; k < 6; k++) {
        const a = rng.range(0, Math.PI * 2)
        const rr = r * rng.range(0.4, 1)
        const px = x + Math.cos(a) * rr
        const py = y + Math.sin(a) * rr * 1.3
        const s = rng.range(0.14, 0.26)
        const c = rgb(rng.pick(cols))
        base.tri([px, py, z + rng.float() * 0.01], [px + s, py - s * 0.4, z], [px + s * 0.3, py + s, z], c, shade(c, 0.8), c)
      }
    }
  }
}
