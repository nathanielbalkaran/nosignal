import { world } from '../world/index.ts'
import { Rng } from '../world/rng.ts'
import { directionsRoute, type LandmarkKind, type RouteLandmark } from '../world/restaurant.ts'

/*
 * The directions receipt, drawn with Canvas 2D. The sketch is not artwork that
 * was authored separately: its turns, the length of each leg and the three
 * landmarks all come from `directionsRoute`, the shortest walk on the real
 * street graph from the restaurant door to the station. It is a pen sketch on a
 * strip of worn thermal paper, not a map: leg lengths are squashed and nothing
 * is to scale.
 */

export const RECEIPT_W = 300
export const RECEIPT_H = 560

const CJK = '"PingFang HK", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "Heiti TC", "Noto Sans CJK TC", sans-serif'
const INK = '#26324f'
const PRINT = '#8a8576'
const PAPER = '#dcd7c6'

type Pt = readonly [number, number]

/** Heading in degrees clockwise from "up the paper" to a unit step on the paper (y runs down). */
const dir = (deg: number): Pt => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]

interface Leg {
  a: Pt
  b: Pt
  /** Route metres at the start of the leg, and its length. */
  s0: number
  m: number
  heading: number
}

/** The walk as a squashed pen path: real turns, compressed lengths, fitted to the drawing area. */
function sketchPath(): { legs: Leg[]; points: Pt[] } {
  const route = directionsRoute(world)
  const first = route.turns[0].degrees
  // Heading on the paper: up out of the door, then the same turns as the real walk.
  const headings: number[] = []
  const lens = route.points.slice(1).map((p, i) => Math.hypot(p[0] - route.points[i][0], p[1] - route.points[i][1]))
  let h = 0
  for (let i = 0; i < lens.length; i++) {
    if (i === 0) h = first
    else h += route.turns.find((t) => t.at === i)?.degrees ?? 0
    headings.push(h)
  }
  // Squashed so that a long walk and a short one both fit, while their order of size is kept.
  const px = lens.map((m) => 22 + 12 * Math.sqrt(m))
  let at: Pt = [0, 0]
  const raw: Pt[] = [at]
  let s = 0
  const legs: Leg[] = []
  headings.forEach((hd, i) => {
    const d = dir(hd)
    const next: Pt = [at[0] + d[0] * px[i], at[1] + d[1] * px[i]]
    legs.push({ a: at, b: next, s0: s, m: lens[i], heading: hd })
    s += lens[i]
    raw.push(next)
    at = next
  })
  // Fit to the writing area.
  const xs = raw.map((p) => p[0])
  const ys = raw.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const area = { x: 62, y: 150, w: 176, h: 340 }
  const k = Math.min(area.w / Math.max(1, maxX - minX), area.h / Math.max(1, maxY - minY), 1.35)
  const ox = area.x + (area.w - (maxX - minX) * k) / 2 - minX * k
  const oy = area.y + (area.h - (maxY - minY) * k) / 2 - minY * k
  const map = (p: Pt): Pt => [ox + p[0] * k, oy + p[1] * k]
  return { legs: legs.map((l) => ({ ...l, a: map(l.a), b: map(l.b) })), points: raw.map(map) }
}

/** A point `s` metres along the route, on the sketched path, with the direction there. */
function along(legs: readonly Leg[], s: number): { p: Pt; heading: number } {
  for (const l of legs) {
    if (s <= l.s0 + l.m + 1e-6) {
      const t = Math.max(0, Math.min(1, (s - l.s0) / l.m))
      return { p: [l.a[0] + (l.b[0] - l.a[0]) * t, l.a[1] + (l.b[1] - l.a[1]) * t], heading: l.heading }
    }
  }
  const last = legs[legs.length - 1]
  return { p: last.b, heading: last.heading }
}

function wobble(rng: Rng, a: Pt, b: Pt, amp = 1.6): Pt[] {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9))
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const edge = i === 0 || i === n ? 0 : 1
    out.push([a[0] + (b[0] - a[0]) * t + rng.range(-amp, amp) * edge, a[1] + (b[1] - a[1]) * t + rng.range(-amp, amp) * edge])
  }
  return out
}

function stroke(ctx: CanvasRenderingContext2D, pts: readonly Pt[], width = 2.2, color = INK) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])))
  ctx.stroke()
}

function arrowHead(ctx: CanvasRenderingContext2D, rng: Rng, tip: Pt, heading: number, size = 11) {
  const back = dir(heading + 180)
  const side = dir(heading + 90)
  const base: Pt = [tip[0] + back[0] * size, tip[1] + back[1] * size]
  const w = size * 0.55
  stroke(ctx, [[base[0] + side[0] * w + rng.range(-1, 1), base[1] + side[1] * w], tip, [base[0] - side[0] * w, base[1] - side[1] * w + rng.range(-1, 1)]], 2.6)
}

// --- landmark sketches (all in a local frame: origin at the foot, y up is negative) ---

function drawRoadworks(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number) {
  // A striped barrier on two legs, and a cone.
  stroke(ctx, wobble(rng, [x - 18, y], [x - 18, y - 16], 0.6), 2)
  stroke(ctx, wobble(rng, [x + 18, y], [x + 18, y - 16], 0.6), 2)
  ctx.fillStyle = 'rgba(38, 50, 79, 0.13)'
  ctx.fillRect(x - 21, y - 26, 42, 11)
  stroke(ctx, wobble(rng, [x - 21, y - 26], [x + 21, y - 26], 0.8), 2)
  stroke(ctx, wobble(rng, [x - 21, y - 15], [x + 21, y - 15], 0.8), 2)
  for (let i = -18; i <= 14; i += 8) stroke(ctx, [[x + i, y - 15], [x + i + 8, y - 26]], 1.6)
  stroke(ctx, [[x + 30, y], [x + 36, y - 16], [x + 42, y], [x + 30, y]], 1.8)
}

function drawTower(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number) {
  // A tall stepped block with rows of windows.
  const w = 26
  const h = 82
  stroke(ctx, [[x - w / 2, y], ...wobble(rng, [x - w / 2, y - 2], [x - w / 2, y - h], 0.8), [x - 5, y - h], [x - 5, y - h - 14], [x + w / 2, y - h - 14], [x + w / 2, y], [x - w / 2, y]], 2.2)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = 'rgba(38, 50, 79, 0.55)'
      ctx.fillRect(x - w / 2 + 4 + c * 11, y - 10 - r * 10, 6, 5)
    }
  }
}

function drawZebra(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, heading: number) {
  // Two kerb lines across the walk and bars between them.
  const along = dir(heading)
  const across = dir(heading + 90)
  const at = (u: number, v: number): Pt => [x + along[0] * u + across[0] * v, y + along[1] * u + across[1] * v]
  stroke(ctx, wobble(rng, at(-14, -34), at(-14, 34), 0.8), 2)
  stroke(ctx, wobble(rng, at(14, -34), at(14, 34), 0.8), 2)
  for (let v = -26; v <= 26; v += 13) stroke(ctx, [at(-9, v), at(9, v)], 4.2)
}

function drawStation(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number) {
  // A signboard over a stairwell: the railway plate on the entrance.
  stroke(ctx, [[x - 32, y + 24], [x - 32, y - 2], [x + 32, y - 2], [x + 32, y + 24]], 2.4)
  ctx.fillStyle = 'rgba(38, 50, 79, 0.2)'
  ctx.fillRect(x - 30, y - 20, 60, 18)
  stroke(ctx, wobble(rng, [x - 32, y - 20], [x + 32, y - 20], 0.7).concat([[x + 32, y - 2], [x - 32, y - 2], [x - 32, y - 20]]), 2.2)
  ctx.fillStyle = INK
  ctx.font = `700 14px ${CJK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('海旁站', x, y - 11)
  for (let i = 0; i < 4; i++) stroke(ctx, [[x - 20 + i * 4, y + 6 + i * 5], [x + 20 - i * 4, y + 6 + i * 5]], 1.6)
}

function drawCafe(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number) {
  // The shopfront, seen from the street, with its door.
  stroke(ctx, [[x - 26, y + 22], [x - 26, y - 4], [x + 26, y - 4], [x + 26, y + 22], [x - 26, y + 22]], 2.2)
  stroke(ctx, wobble(rng, [x - 26, y + 3], [x + 26, y + 3], 0.6), 1.6)
  stroke(ctx, [[x + 6, y + 22], [x + 6, y + 9], [x + 17, y + 9], [x + 17, y + 22]], 1.8)
  ctx.fillStyle = INK
  ctx.font = `700 15px ${CJK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('茶', x - 9, y + 14)
}

const ICON: Record<LandmarkKind, (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, heading: number) => void> = {
  roadworks: (c, r, x, y) => drawRoadworks(c, r, x, y),
  tower: (c, r, x, y) => drawTower(c, r, x, y),
  crossing: (c, r, x, y, h) => drawZebra(c, r, x, y, h),
}

/** How far to the side of the path a landmark's icon stands, so it never sits on the line. */
const SIDE_OFFSET: Record<LandmarkKind, number> = { roadworks: 38, tower: 30, crossing: 0 }

function paperEdge(rng: Rng, w: number, h: number): Path2D {
  // Slightly uneven sides, a torn top and a zig-zag bottom, like a strip pulled off the printer.
  const p = new Path2D()
  const teeth = 17
  p.moveTo(14, 8)
  for (let i = 1; i <= teeth; i++) p.lineTo(14 + ((w - 28) * i) / teeth, 8 + (i % 2 ? rng.range(0, 6) : rng.range(-2, 2)))
  for (let y = 8; y <= h - 14; y += 40) p.lineTo(w - 14 + rng.range(-3, 2), y)
  for (let i = teeth; i >= 0; i--) p.lineTo(14 + ((w - 28) * i) / teeth, h - 14 + (i % 2 ? 7 : 0) + rng.range(-1.5, 1.5))
  for (let y = h - 14; y >= 8; y -= 40) p.lineTo(14 + rng.range(-2, 3), y)
  p.closePath()
  return p
}

/** Draws the receipt onto `canvas`, at `scale` device pixels per logical pixel. */
export function drawReceipt(canvas: HTMLCanvasElement, scale = 2) {
  const w = RECEIPT_W
  const h = RECEIPT_H
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const rng = new Rng('receipt:paper')
  ctx.clearRect(0, 0, w, h)

  // Paper, with a soft drop shadow.
  const edge = paperEdge(rng, w, h)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  ctx.fillStyle = PAPER
  ctx.fill(edge)
  ctx.restore()
  ctx.save()
  ctx.clip(edge)
  // Uneven yellowing, stains, creases and grit.
  const wash = ctx.createLinearGradient(0, 0, w, h)
  wash.addColorStop(0, '#e2ddcc')
  wash.addColorStop(0.55, '#d8d2bf')
  wash.addColorStop(1, '#c9c2ac')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 7; i++) {
    const g = ctx.createRadialGradient(rng.range(0, w), rng.range(0, h), 2, rng.range(0, w), rng.range(0, h), rng.range(30, 90))
    g.addColorStop(0, 'rgba(110, 88, 52, 0.12)')
    g.addColorStop(1, 'rgba(110, 88, 52, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  for (let i = 0; i < 3; i++) {
    const y = rng.range(90, h - 70)
    ctx.strokeStyle = 'rgba(90, 80, 60, 0.16)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(16, y)
    ctx.lineTo(w - 16, y + rng.range(-5, 5))
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.moveTo(16, y + 1.4)
    ctx.lineTo(w - 16, y + 1.4 + rng.range(-5, 5))
    ctx.stroke()
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(70, 60, 40, ${rng.range(0.03, 0.09)})`
    ctx.fillRect(rng.range(0, w), rng.range(0, h), 1.2, 1.2)
  }

  // Faded printed heading (thermal print fades first at the top).
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = PRINT
  ctx.globalAlpha = 0.72
  ctx.font = `700 25px ${CJK}`
  ctx.fillText('美華茶餐廳', w / 2, 50)
  ctx.font = '700 14px "VT323", ui-monospace, monospace'
  ctx.letterSpacing = '3px'
  ctx.fillText('MEI WAH CAFE', w / 2, 72)
  ctx.letterSpacing = '0px'
  ctx.globalAlpha = 0.5
  ctx.font = '16px "VT323", ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText('NO. 0417', 34, 102)
  ctx.textAlign = 'right'
  ctx.fillText('奶茶  1', w - 34, 102)
  ctx.globalAlpha = 0.4
  ctx.textAlign = 'center'
  ctx.fillText('- - - - - - - - - - - - - - - - - -', w / 2, 120)
  ctx.globalAlpha = 1

  // The pen sketch.
  const { legs } = sketchPath()
  const route = directionsRoute(world)
  const penRng = new Rng('receipt:pen')
  // Start: the café front, at the foot of the path.
  const start = legs[0].a
  drawCafe(ctx, penRng, start[0] - 24, start[1] + 34)
  // Path legs, with an arrowhead at the end of each.
  legs.forEach((l) => {
    stroke(ctx, wobble(penRng, l.a, l.b, 1.8), 2.6)
    // Each arrow stops short, so the corner stays open and readable.
    const back = dir(l.heading + 180)
    const tip: Pt = [l.b[0] + back[0] * 4, l.b[1] + back[1] * 4]
    arrowHead(ctx, penRng, tip, l.heading)
  })
  // Landmarks, placed at the point on the path where the real walk passes them.
  for (const lm of route.landmarks as readonly RouteLandmark[]) {
    const a = along(legs, lm.s)
    const side = dir(a.heading + (lm.side === 'right' ? 90 : -90))
    const o = SIDE_OFFSET[lm.kind]
    const x = a.p[0] + side[0] * o + (lm.kind === 'tower' ? side[0] * 6 : 0)
    // Icons stand with their feet at this y; offset down a little so they sit beside the path, not above it.
    const y = a.p[1] + side[1] * o + (lm.kind === 'roadworks' ? 6 : lm.kind === 'tower' ? 36 : 0)
    ICON[lm.kind](ctx, penRng, x, y, a.heading)
  }
  // End: the station.
  const end = legs[legs.length - 1].b
  drawStation(ctx, penRng, end[0] + 4, end[1] - 28)

  ctx.restore()
}

let cached: HTMLCanvasElement | null = null

/** One shared drawing at screen quality; the 3D prop and the overlay both use it. */
export function receiptCanvas(): HTMLCanvasElement {
  if (!cached) {
    cached = document.createElement('canvas')
    drawReceipt(cached, 2)
  }
  return cached
}
