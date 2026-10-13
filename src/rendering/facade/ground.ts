import { RESTAURANT_LABEL, CONVENIENCE_LABEL, SHOP_LABELS } from '../../world/signage.ts'
import type { SignSpec } from '../../world/facades.ts'
import { rgb, shade, type RGB } from '../geo/Geo.ts'
import { bar, front, type FacadeContext } from './context.ts'

const DOOR_COLORS = ['#3e4a44', '#55463a', '#444a52', '#6a4a42']
const PRODUCTS = ['#c8553f', '#4b8fb5', '#e0b840', '#5aa56a', '#d7d2c4', '#9b6aa8', '#d98a3c']
const OH = 2.65

const INTERIOR: Record<string, string> = {
  convenience: '#e4efe2',
  restaurant: '#eba458',
  bakery: '#f4c27c',
  shop: '#ead8a8',
}

/** The ground floor: shutters, doors, shopfronts, awnings, lamps and signs. */
export function drawGround(ctx: FacadeContext) {
  const { spec, W, rng, base, detail } = ctx
  const g = spec.ground
  const doorW = 1.2
  let x0 = 0.4
  let x1 = W - 0.4
  const doors: number[] = []

  if (g.kind === 'restaurant' && g.door === 'none' && W > 5) {
    doors.push(W / 2)
  } else if (g.door === 'left') {
    doors.push(0.3 + doorW / 2)
    x0 = 0.3 + doorW + 0.5
  } else if (g.door === 'right') {
    doors.push(W - 0.3 - doorW / 2)
    x1 = W - 0.3 - doorW - 0.5
  }
  for (const dx of doors) drawDoor(ctx, dx, doorW)

  const room = x1 - x0
  if (g.kind === 'entranceOnly') {
    if (room > 1.6) {
      const cx = (x0 + x1) / 2
      const ww = Math.min(room - 0.5, 1.5)
      base.span(cx - ww / 2 - 0.05, 1.1, 0, cx + ww / 2 + 0.05, 2.35, 0.05, rgb('#6b6f6a'), { skip: ['-z', '+z', '-y'] })
      front(base, cx - ww / 2 - 0.05, 1.1, cx + ww / 2 + 0.05, 2.35, 0.05, rgb('#6b6f6a'))
      front(base, cx - ww / 2, 1.15, cx + ww / 2, 2.3, 0.062, rgb('#2d3943'), [rgb('#232d36'), rgb('#232d36'), rgb('#3f5163'), rgb('#3f5163')])
      const n = Math.round(ww / 0.14)
      for (let i = 0; i <= n; i++) bar(detail, cx - ww / 2 + (ww * i) / n, 1.1, 2.35, 0.3, 0.025, '#3a3d40')
    }
  } else if (room > 1.4) {
    if (g.kind === 'garage') drawGarage(ctx, x0, x1)
    else if (g.kind === 'restaurant') drawRestaurantFront(ctx, x0, x1, doors.length > 0 ? doors[0] : null)
    else if (g.lit && g.shutter !== 'closed') drawLitShop(ctx, x0, x1)
    else drawShutter(ctx, x0, x1, g.shutter)
  }

  // A header band above the opening, then the awning.
  if (room > 1.4 && g.kind !== 'entranceOnly') {
    base.span(x0 - 0.06, OH, 0, x1 + 0.06, OH + 0.12, 0.2, shade(rgb(spec.tile), 0.7))
    if (g.awning) drawAwning(ctx, x0, x1)
  }

  if (spec.wallLamp) {
    const x = doors.length ? doors[0] + (doors[0] < W / 2 ? doorW / 2 + 0.35 : -doorW / 2 - 0.35) : rng.range(0.6, W - 0.6)
    drawWallLamp(ctx, Math.max(0.4, Math.min(W - 0.4, x)))
  }

  if (spec.fascia && room > 1.4) drawSign(ctx, spec.fascia, true)
  for (const v of spec.vertical) drawSign(ctx, v, false)
}

function drawDoor(ctx: FacadeContext, cx: number, w: number) {
  const { base, detail, rng } = ctx
  const dc = rgb(rng.pick(DOOR_COLORS))
  const h = 2.25
  base.span(cx - w / 2 - 0.1, 0, 0, cx + w / 2 + 0.1, h + 0.1, 0.06, rgb('#7b7d77'), { skip: ['-z', '+z', '-y'] })
  front(base, cx - w / 2 - 0.1, 0, cx + w / 2 + 0.1, h + 0.1, 0.06, rgb('#7b7d77'))
  front(base, cx - w / 2, 0, cx + w / 2, h, 0.075, rgb('#1d2226'), [rgb('#14181b'), rgb('#14181b'), rgb('#2a333a'), rgb('#2a333a')])
  const gate = rng.chance(0.6)
  if (gate) {
    const n = 7
    for (let i = 0; i <= n; i++) bar(detail, cx - w / 2 + 0.05 + ((w - 0.1) * i) / n, 0.05, h - 0.05, 0.14, 0.03, dc)
    front(detail, cx - w / 2, 1.0, cx + w / 2, 1.05, 0.145, dc)
    front(detail, cx - w / 2, h - 0.1, cx + w / 2, h - 0.05, 0.145, dc)
  } else {
    front(base, cx - w / 2 + 0.05, 0.05, cx + w / 2 - 0.05, h - 0.05, 0.09, dc, [shade(dc, 0.7), shade(dc, 0.7), dc, dc])
  }
  // Lintel plate and a mailbox bank beside the door.
  front(detail, cx - 0.22, h + 0.18, cx + 0.22, h + 0.4, 0.075, rgb('#c8c2ae'))
  const side = cx < ctx.W / 2 ? 1 : -1
  const mx = cx + side * (w / 2 + 0.55)
  if (mx > 0.35 && mx < ctx.W - 0.35 && rng.chance(0.65)) {
    detail.span(mx - 0.25, 1.0, 0.0, mx + 0.25, 1.75, 0.1, rgb('#6e7578'))
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) front(detail, mx - 0.22 + c * 0.15, 1.05 + r * 0.17, mx - 0.1 + c * 0.15, 1.17 + r * 0.17, 0.106, rgb('#2a2e31'))
  }
}

function drawShutter(ctx: FacadeContext, x0: number, x1: number, mode: 'closed' | 'half' | 'open') {
  const { base, detail, spec, rng } = ctx
  const color = rgb(spec.ground.shutterColor)
  const z = 0.08
  const low = mode === 'half' ? OH * 0.55 : 0
  if (low > 0) {
    // Dark shop interior under a half-raised shutter.
    front(base, x0, 0.02, x1, low, 0.03, rgb('#14181b'), [rgb('#0f1215'), rgb('#0f1215'), rgb('#1c2227'), rgb('#1c2227')])
    // A shelf edge or two so the gap reads as a room.
    front(base, x0, 0.85, x1, 0.9, 0.034, rgb('#2a2a28'))
  }
  const ribs = Math.round((OH - low) / 0.16)
  const rh = (OH - low) / ribs
  for (let i = 0; i < ribs; i++) {
    const y = low + i * rh
    const k = i % 2 === 0 ? 1 : 0.92
    const dirt = 0.62 + 0.38 * Math.min(1, (y + 0.4) / 1.8)
    front(base, x0, y, x1, y + rh, z, shade(color, k * dirt), [shade(color, k * dirt), shade(color, k * dirt), shade(color, k * dirt), shade(color, k * dirt)])
  }
  // Tracks, housing, and a padlock hasp.
  const track = shade(color, 0.55)
  base.span(x0 - 0.1, 0, 0, x0, OH, 0.14, track, { skip: ['-z', '-y'] })
  base.span(x1, 0, 0, x1 + 0.1, OH, 0.14, track, { skip: ['-z', '-y'] })
  base.span(x0 - 0.1, OH - 0.02, 0, x1 + 0.1, OH + 0.3, 0.24, shade(color, 0.7), { skip: ['-z', '-y'] })
  if (mode === 'closed') {
    detail.span((x0 + x1) / 2 - 0.04, 0.05, z, (x0 + x1) / 2 + 0.04, 0.3, z + 0.05, '#2c2e30')
    // Faded graffiti or posters on a few shutters.
    if (rng.chance(0.35)) {
      const w = rng.range(0.4, 1.1)
      const x = rng.range(x0 + 0.2, Math.max(x0 + 0.21, x1 - w - 0.2))
      const y = rng.range(0.3, 1.5)
      front(base, x, y, x + w, y + rng.range(0.3, 0.7), z + 0.012, rgb(rng.pick(['#8a6f66', '#6d7f8a', '#8f8a6b', '#6a6a72'])))
    }
  }
}

function drawGarage(ctx: FacadeContext, x0: number, x1: number) {
  const { base } = ctx
  const w = Math.min(x1 - x0, 3.6)
  const cx = (x0 + x1) / 2
  const a = cx - w / 2
  const b = cx + w / 2
  front(base, a, 0.02, b, 2.8, 0.03, rgb('#0f1215'), [rgb('#0a0c0e'), rgb('#0a0c0e'), rgb('#1a2025'), rgb('#1a2025')])
  const col = rgb(ctx.spec.ground.shutterColor)
  const y0 = 1.5
  const n = Math.round((2.8 - y0) / 0.16)
  for (let i = 0; i < n; i++) {
    const y = y0 + (i * (2.8 - y0)) / n
    front(base, a, y, b, y + (2.8 - y0) / n, 0.08, shade(col, i % 2 ? 0.92 : 1))
  }
  base.span(a - 0.1, 0, 0, a, 2.9, 0.12, shade(col, 0.55), { skip: ['-z', '-y'] })
  base.span(b, 0, 0, b + 0.1, 2.9, 0.12, shade(col, 0.55), { skip: ['-z', '-y'] })
  // Oil stain on the pavement.
  base.quad([a + 0.4, 0.04, 0.5], [b - 0.6, 0.04, 0.5], [b - 0.9, 0.04, 2.4], [a + 0.8, 0.04, 2.1], '#2a2926')
}

function drawLitShop(ctx: FacadeContext, x0: number, x1: number) {
  const { base, emissive, spec, rng, lights, W } = ctx
  const kind = spec.ground.kind
  const col = rgb(INTERIOR[kind] ?? INTERIOR.shop)
  const half = spec.ground.shutter === 'half'
  const yLow = half ? 0.9 : 0.1
  const top = OH
  front(emissive, x0, yLow, x1, top, 0.03, col, [shade(col, 0.72), shade(col, 0.72), col, col])

  // Shelves of goods.
  const rows = half ? 1 : 4
  for (let r = 0; r < rows; r++) {
    const y = yLow + 0.35 + r * 0.5
    let x = x0 + 0.1
    while (x < x1 - 0.4) {
      const w = rng.range(0.22, 0.5)
      const c = rgb(rng.pick(PRODUCTS))
      front(emissive, x, y, Math.min(x1 - 0.1, x + w), y + rng.range(0.22, 0.4), 0.05, shade(c, 0.95))
      x += w + rng.range(0.03, 0.12)
    }
    front(base, x0, y - 0.04, x1, y, 0.055, rgb('#262b2d'))
  }
  // Frame, mullions and a lintel.
  const frame = rgb('#2f3436')
  front(base, x0 - 0.06, top, x1 + 0.06, top + 0.06, 0.07, frame)
  front(base, x0 - 0.06, 0, x0, top, 0.07, frame)
  front(base, x1, 0, x1 + 0.06, top, 0.07, frame)
  front(base, x0, 0, x1, yLow, 0.07, frame)
  const m = Math.max(1, Math.round((x1 - x0) / 1.8))
  for (let i = 1; i < m; i++) bar(base, x0 + ((x1 - x0) * i) / m, yLow, top, 0.075, 0.06, frame)

  if (half) {
    const color = rgb(spec.ground.shutterColor)
    const n = Math.round((OH - 1.6) / 0.16)
    for (let i = 0; i < n; i++) {
      const y = 1.6 + (i * (OH - 1.6)) / n
      front(base, x0, y, x1, y + (OH - 1.6) / n, 0.1, shade(color, i % 2 ? 0.92 : 1))
    }
  }

  const light = kind === 'convenience' ? { c: '#dfe8dc', i: 5, d: 15 } : { c: '#ffc27a', i: 4, d: 11 }
  const p = ctx.toWorld((x0 + x1) / 2, 2.0, 2.2)
  lights.push({ x: p[0], y: p[1], z: p[2], color: light.c, intensity: light.i, distance: light.d })
  pool(ctx, (x0 + x1) / 2, Math.min(W * 0.9, (x1 - x0) * 1.3), 4.2, kind === 'convenience' ? '#bfd0c4' : '#e0a561', 0.75)
}

function drawRestaurantFront(ctx: FacadeContext, x0: number, x1: number, doorX: number | null) {
  const { base, emissive, detail, lights } = ctx
  const warm = rgb(INTERIOR.restaurant)
  const frame = rgb('#e2d9c2')
  const spans: [number, number][] = []
  if (doorX === null) spans.push([x0, x1])
  else {
    if (doorX - 0.9 - x0 > 1.2) spans.push([x0, doorX - 0.9])
    if (x1 - (doorX + 0.9) > 1.2) spans.push([doorX + 0.9, x1])
  }
  for (const [a, b] of spans) {
    front(emissive, a, 0.5, b, OH - 0.1, 0.03, warm, [shade(warm, 0.75), shade(warm, 0.75), warm, warm])
    // Menu boards and a counter silhouetted against the light.
    front(emissive, a + 0.2, 1.6, a + 0.2 + Math.min(1.0, (b - a) * 0.4), 2.2, 0.05, rgb('#f3e6c0'))
    front(base, a + 0.2, 1.75, a + 0.2 + Math.min(0.8, (b - a) * 0.3), 1.85, 0.06, rgb('#a4423b'))
    detail.span(a + 0.1, 0.5, 0.1, b - 0.1, 1.05, 0.5, rgb('#3a2f28'))
    const tables = Math.max(1, Math.floor((b - a) / 1.8))
    for (let i = 0; i < tables; i++) {
      const tx = a + ((i + 0.5) * (b - a)) / tables
      detail.span(tx - 0.3, 0.5, 0.6, tx + 0.3, 0.55, 1.1, rgb('#2a211c'))
      detail.span(tx - 0.03, 0.0, 0.83, tx + 0.03, 0.5, 0.88, rgb('#2a211c'))
      detail.span(tx - 0.2, 0.0, 1.25, tx + 0.2, 0.45, 1.5, rgb('#241c18'))
    }
    // White frames with a red band under the glass.
    front(base, a - 0.08, 0.0, b + 0.08, 0.5, 0.07, rgb('#a1564c'))
    front(base, a - 0.08, OH - 0.1, b + 0.08, OH + 0.02, 0.07, frame)
    front(base, a - 0.08, 0.5, a, OH - 0.1, 0.07, frame)
    front(base, b, 0.5, b + 0.08, OH - 0.1, 0.07, frame)
    const m = Math.max(1, Math.round((b - a) / 1.5))
    for (let i = 1; i < m; i++) bar(base, a + ((b - a) * i) / m, 0.5, OH - 0.1, 0.075, 0.07, frame)
    pool(ctx, (a + b) / 2, (b - a) * 1.3, 4.5, '#e0a561', 0.9)
  }
  const c = (x0 + x1) / 2
  const p = ctx.toWorld(c, 2.0, 2.4)
  lights.push({ x: p[0], y: p[1], z: p[2], color: '#ffbd70', intensity: 6, distance: 16 })
}

function drawAwning(ctx: FacadeContext, x0: number, x1: number) {
  const { base, spec } = ctx
  const aw = spec.ground.awning
  if (!aw) return
  const col = rgb(aw.color)
  const yTop = 3.2
  const yLow = 2.62
  const d = aw.depth
  const n = Math.max(2, Math.round((x1 - x0) / 0.5))
  const w = (x1 - x0) / n
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w
    const c = i % 2 === 0 ? col : shade(col, 1.25)
    // Sloping top: wall edge high, street edge low. Winding makes it face up and out.
    base.quad([a, yLow, d], [a + w, yLow, d], [a + w, yTop, 0.1], [a, yTop, 0.1], c, [shade(c, 0.85), shade(c, 0.85), shade(c, 0.95), shade(c, 0.95)])
    front(base, a, yLow - 0.2, a + w, yLow, d, shade(c, 0.8))
  }
  const side = shade(col, 0.7)
  base.tri([x0, yLow, d], [x0, yTop, 0.1], [x0, yLow, 0.1], side)
  base.tri([x1, yLow, d], [x1, yLow, 0.1], [x1, yTop, 0.1], side)
}

function drawWallLamp(ctx: FacadeContext, x: number) {
  const { detail, emissive } = ctx
  const glow = ctx.s.glow
  const y = 3.2
  detail.span(x - 0.05, y - 0.05, 0, x + 0.05, y + 0.05, 0.18, '#3a3d40')
  emissive.span(x - 0.09, y - 0.14, 0.18, x + 0.09, y + 0.0, 0.32, rgb('#ffcf8a'))
  const g = rgb('#7a5a34')
  const r = 1.6
  glow.quad([x - r, 0.04, 0.9 + r], [x + r, 0.04, 0.9 + r], [x + r, 0.04, 0.9 - r], [x - r, 0.04, 0.9 - r], g, undefined, [0, 0, 1, 1])
}

/** A soft additive pool of light on the pavement in front of a lit shop. */
function pool(ctx: FacadeContext, cx: number, width: number, depth: number, color: string, strength: number) {
  const c = shade(rgb(color), strength * 0.55)
  const glow = ctx.s.glow
  const hw = width / 2
  glow.quad([cx - hw, 0.045, depth], [cx + hw, 0.045, depth], [cx + hw, 0.045, 0.1], [cx - hw, 0.045, 0.1], c, undefined, [0, 0, 1, 1])
}

function resolveLabel(spec: SignSpec): { zh: string; en: string | undefined } {
  if (spec.label === 'restaurant') return RESTAURANT_LABEL
  if (spec.label === 'convenience') return CONVENIENCE_LABEL
  const l = SHOP_LABELS[spec.label]
  return { zh: l.zh, en: l.en }
}

function drawSign(ctx: FacadeContext, sign: SignSpec, horizontal: boolean) {
  const { s, base, detail, W } = ctx
  const label = resolveLabel(sign)
  const g = sign.lit ? s.signsLit : s.signs
  const edge: RGB = rgb('#26282a')
  if (horizontal) {
    const w = sign.width
    const cx = Math.max(w / 2 + 0.05, Math.min(W - w / 2 - 0.05, sign.at * W))
    const uv = ctx.atlas.fascia(label.zh, label.en, sign.tone)
    const x0 = cx - w / 2
    const x1 = cx + w / 2
    base.span(x0 - 0.04, sign.y - 0.04, 0.04, x1 + 0.04, sign.y + sign.height + 0.04, 0.16, edge, { skip: ['-z', '+z'] })
    g.quad([x0, sign.y, 0.165], [x1, sign.y, 0.165], [x1, sign.y + sign.height, 0.165], [x0, sign.y + sign.height, 0.165], '#ffffff', undefined, uv)
    detail.rod([x0 + 0.2, sign.y + sign.height + 0.04, 0.04], [x0 + 0.2, sign.y + sign.height + 0.3, 0.04], 0.02, '#2a2c2e', 4)
    return
  }
  const w = sign.width
  const x = Math.max(0.3, Math.min(W - 0.3, sign.at * W))
  const z0 = 0.5
  const z1 = z0 + w
  const y0 = sign.y
  const y1 = sign.y + sign.height
  const uv = ctx.atlas.vertical(label.zh, sign.tone)
  base.span(x - 0.03, y0 - 0.03, z0 - 0.03, x + 0.03, y1 + 0.03, z1 + 0.03, edge)
  g.quad([x + 0.034, y0, z1], [x + 0.034, y0, z0], [x + 0.034, y1, z0], [x + 0.034, y1, z1], '#ffffff', undefined, uv)
  g.quad([x - 0.034, y0, z0], [x - 0.034, y0, z1], [x - 0.034, y1, z1], [x - 0.034, y1, z0], '#ffffff', undefined, uv)
  detail.rod([x, y0 + sign.height * 0.12, 0.02], [x, y0 + sign.height * 0.12, z0], 0.022, '#2a2c2e', 4)
  detail.rod([x, y0 + sign.height * 0.88, 0.02], [x, y0 + sign.height * 0.88, z0], 0.022, '#2a2c2e', 4)
}
