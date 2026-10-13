import { useMemo } from 'react'
import { add, scale, type Vec2 } from '../../world/geometry2d.ts'
import { world } from '../../world/index.ts'
import type { Stall } from '../../world/build.ts'
import { boxAlong, slab, type BoxSpec } from './boxes.ts'
import type { RetroSurface } from '../geo/retroTextures.ts'
import { InstancedBoxes } from './InstancedBoxes.tsx'

const POLE = '#3d3a37'
const POLE_RUST = '#5a4a3e'
const COUNTER = ['#4a443c', '#55493c', '#3f4440', '#50463f']
const TARPS = ['#4a5f6e', '#56604a', '#6b5a48', '#5d5d66']
const CRATES = ['#3f5e72', '#6a3f3a', '#4c6b4a', '#7a7466', '#58607a']
const PRODUCE = ['#55704a', '#a8743a', '#8f4a3a', '#7d8a4a', '#b09a52']
const PAPER = '#cbc4ab'
const WARM = '#e0b070'
const WARM_DIM = '#7a5c36'

/** Scales a #rrggbb colour (weathering). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`
}

/** Builds one stall in its own frame: u along the street, v from its back toward the aisle. */
function buildStall(s: Stall, solid: BoxSpec[], lit: BoxSpec[]) {
  const { rect, out } = s
  const u = rect.axis
  const L = rect.halfLength * 2
  const D = rect.halfWidth * 2
  const pt = (uc: number, vv: number): Vec2 => add(add(rect.center, scale(u, uc)), scale(out, vv))
  /** Axis-aligned (in the stall frame) box: centre (uc, vv), size ulen x olen, from y, height h. */
  const box = (uc: number, vv: number, ulen: number, olen: number, y: number, h: number, color: string, surface: RetroSurface = 'metal') => {
    const c = pt(uc, vv)
    solid.push({ ...boxAlong(add(c, scale(u, -ulen / 2)), add(c, scale(u, ulen / 2)), olen, y, h, color), surface })
  }
  const glow = (uc: number, vv: number, ulen: number, olen: number, y: number, h: number, color: string) => {
    const c = pt(uc, vv)
    lit.push(boxAlong(add(c, scale(u, -ulen / 2)), add(c, scale(u, ulen / 2)), olen, y, h, color))
  }
  /** A roof sloping from the back (higher) to the front (lower) of the stall. */
  const roof = (width: number, backY: number, frontY: number, vFront: number, thick: number, color: string, surface: RetroSurface = 'fabric') => {
    solid.push({ ...slab(pt(0, -D / 2 - 0.05), pt(0, vFront), width, backY, frontY, thick, color), surface })
  }
  const crate = (uc: number, vv: number, y: number, k: number) => {
    box(uc, vv, 0.5, 0.36, y, 0.28, CRATES[Math.floor(((s.seed * 7 + k * 0.37) % 1) * CRATES.length)], 'plaster')
  }
  const post = (uc: number, vv: number, h: number, color = POLE) => box(uc, vv, 0.06, 0.06, 0, h, color)

  const counterColor = COUNTER[Math.floor(s.seed * COUNTER.length)]
  const tarp = TARPS[Math.floor((s.seed * 13) % 1 * TARPS.length)]
  const awn = shade(s.color, 0.9)
  const half = L / 2

  if (s.kind === 'produce') {
    // Metal frame, covered counter, stacked crates, handwritten sign.
    box(0, 0, L, D, 0, s.counter, counterColor, 'concrete')
    box(0, 0, L + 0.06, D + 0.06, s.counter, 0.06, tarp, 'fabric')
    box(0, D / 2 + 0.03, L + 0.06, 0.05, s.counter - 0.4, 0.4, tarp, 'fabric')
    box(-half * 0.45, D / 2 + 0.04, 0.5, 0.02, s.counter - 0.34, 0.26, PAPER, 'plaster')
    for (const k of [0, 1, 2]) crate(half - 0.4, 0, s.counter + 0.06 + k * 0.28, k)
    crate(half - 0.95, 0.1, s.counter + 0.06, 5)
    for (const e of [-1, 1]) {
      post(e * (half - 0.05), D / 2 - 0.05, s.awning)
      post(e * (half - 0.05), -D / 2 + 0.05, s.awning + 0.3)
    }
    if (s.folded) {
      roof(L + 0.1, s.awning + 0.3, s.awning + 0.1, D / 2 + 0.1, 0.04, awn)
      box(0, D / 2 + 0.1, L + 0.1, 0.14, s.awning - 0.06, 0.14, shade(awn, 0.8), 'fabric')
    } else {
      roof(L + 0.3, s.awning + 0.3, s.awning - 0.05, D / 2 + s.proj, 0.05, awn)
      box(0, D / 2 + s.proj, L + 0.3, 0.04, s.awning - 0.3, 0.3, shade(awn, 0.85), 'fabric')
    }
  } else if (s.kind === 'tarp') {
    // Uneven counters, plastic sheeting, containers underneath.
    box(-half * 0.35, 0, L * 0.6, D, 0, s.counter + 0.12, counterColor, 'concrete')
    box(half * 0.3, 0, L * 0.4, D * 0.85, 0, s.counter - 0.18, shade(counterColor, 1.15), 'concrete')
    box(half * 0.3, 0, L * 0.4 + 0.04, D * 0.85 + 0.04, s.counter - 0.18, 0.04, tarp, 'fabric')
    box(-half * 0.3, D / 2 + 0.03, 0.55, 0.02, s.counter - 0.32, 0.22, PAPER, 'plaster')
    crate(half * 0.35, D / 2 + 0.2, 0, 3)
    crate(half * 0.35 + 0.05, D / 2 + 0.2, 0.28, 4)
    post(-half + 0.05, D / 2, s.awning)
    post(half - 0.05, D / 2, s.awning - 0.1, POLE_RUST)
    post(-half + 0.05, -D / 2 + 0.05, s.awning + 0.4)
    post(half - 0.05, -D / 2 + 0.05, s.awning + 0.3)
    roof(L + 0.5, s.awning + 0.4, s.awning - 0.15, D / 2 + s.proj, 0.03, tarp)
    box(-0.1, D / 2 + s.proj, L * 0.55, 0.03, s.awning - 0.75, 0.6, shade(tarp, 0.9), 'fabric')
  } else if (s.kind === 'open') {
    // Early opener: produce on display, baskets, one warm lamp.
    box(0, 0, L, D, 0, s.counter, counterColor, 'concrete')
    const cols = Math.max(3, Math.round(L / 0.55))
    for (let i = 0; i < cols; i++) {
      const uc = -half + 0.3 + (i * (L - 0.6)) / (cols - 1)
      box(uc, D / 2 - 0.45, 0.46, 0.5, s.counter, 0.1, '#7b6746', 'plaster')
      box(uc, D / 2 - 0.45, 0.4, 0.44, s.counter + 0.1, 0.07 + ((i * 37) % 3) * 0.03, PRODUCE[(i + Math.floor(s.seed * 5)) % PRODUCE.length], 'plaster')
    }
    for (const k of [0, 1, 2]) box(-half + 0.35, -D / 2 + 0.3, 0.45, 0.4, s.counter + k * 0.24, 0.22, '#8a6d45', 'plaster')
    box(half - 0.3, -D / 2 + 0.35, 0.5, 0.4, 0, 0.9, CRATES[1], 'plaster')
    post(-half + 0.05, D / 2 + 0.2, s.awning)
    post(half - 0.05, D / 2 + 0.2, s.awning)
    roof(L + 0.4, s.awning + 0.3, s.awning, D / 2 + s.proj, 0.05, awn)
    // The lit underside and its bulb.
    solid.push({ ...slab(pt(0, -D / 2 - 0.05), pt(0, D / 2 + s.proj - 0.05), L + 0.2, s.awning + 0.28, s.awning - 0.02, 0.02, shade(awn, 0.7)), surface: 'fabric' })
    glow(0, D / 2 + 0.25, 0.14, 0.14, s.awning - 0.22, 0.12, WARM)
    glow(0, D / 2 + 0.25, L - 0.4, 0.5, s.awning - 0.05, 0.02, WARM_DIM)
    glow(0, 0, L - 0.2, D - 0.2, s.counter + 0.005, 0.01, WARM_DIM)
  } else if (s.kind === 'storage') {
    // Half-dismantled frame, folded tables, delivery crates and a hand cart.
    post(-half + 0.05, D / 2 - 0.05, s.awning, POLE_RUST)
    post(half - 0.05, D / 2 - 0.05, s.awning - 0.3, POLE_RUST)
    box(-half + 0.5, D / 2 - 0.05, 1.1, 0.05, s.awning - 0.05, 0.05, POLE)
    for (const k of [0, 1, 2]) {
      solid.push({ ...slab(pt(-half + 0.5 + k * 0.1, -D / 2 + 0.05), pt(-half + 0.5 + k * 0.1, -D / 2 + 0.45), 0.7, 0, 1.15, 0.05, shade(counterColor, 1.2)), surface: 'concrete' })
    }
    for (const k of [0, 1, 2, 3]) crate(0.2, -0.1, k * 0.28, k + 1)
    for (const k of [0, 1, 2]) crate(0.2, D / 2 - 0.3, k * 0.28, k + 9)
    box(half - 0.65, -D / 2 + 0.35, 0.7, 0.5, 0, 0.45, '#8a7757', 'plaster')
    box(half - 0.65, -D / 2 + 0.35, 0.5, 0.4, 0.45, 0.3, '#7d6e50', 'plaster')
    // Hand cart: deck, wheels, handle.
    box(half - 0.5, D / 2 - 0.35, 0.9, 0.55, 0.3, 0.07, '#4c5a50')
    box(half - 0.5, D / 2 - 0.35, 0.3, 0.7, 0.14, 0.28, '#222')
    solid.push({ ...slab(pt(half - 0.05, D / 2 - 0.35), pt(half + 0.25, D / 2 - 0.35), 0.04, 0.37, 0.95, 0.04, POLE), surface: 'metal' })
  } else if (s.kind === 'kiosk') {
    // Compact enclosed booth: distinct roof, closed serving window, faded sign.
    box(0, 0, L, D, 0, 2.1, s.color)
    box(0, D / 2 + 0.01, L * 0.62, 0.03, s.counter - 0.1, 0.65, '#222a2e')
    box(0, D / 2 + 0.03, L * 0.62 + 0.1, 0.04, s.counter + 0.45, 0.14, shade(s.color, 1.25))
    box(0, D / 2 + 0.03, L * 0.62 + 0.1, 0.04, s.counter - 0.2, 0.1, shade(s.color, 0.7))
    const sign = box
    sign(0, D / 2 + 0.03, L * 0.8, 0.05, 1.75, 0.3, shade(s.color, 0.55))
    box(-0.05, D / 2 + 0.06, L * 0.5, 0.02, 1.82, 0.16, PAPER, 'plaster')
    roof(L + 0.45, 2.45, 2.2, D / 2 + 0.3, 0.1, shade(s.color, 0.62), 'metal')
    box(0, 0, L * 0.5, D * 0.5, 2.3, 0.2, shade(s.color, 0.5))
    box(half + 0.04, 0.1, 0.1, 0.5, 1.3, 0.35, '#6b6e6e')
    if (s.lit) glow(0, D / 2 + 0.07, L * 0.8 - 0.1, 0.02, 1.8, 0.18, WARM_DIM)
  } else {
    // Shopfront under a narrow canopy: a shelf and crates against the wall.
    box(0, 0, L, D, 0, 1.0, shade(counterColor, 0.9), 'concrete')
    for (let i = 0; i < 3; i++) crate(-half + 0.5 + i * 0.9, 0, 1.0, i + 3)
    crate(half - 0.4, 0, 0, 7)
    crate(half - 0.4, 0, 0.28, 8)
    roof(L + 0.2, s.awning + 0.1, s.awning - 0.1, D / 2 + s.proj, 0.06, awn, 'metal')
    box(0, D / 2 + s.proj, L + 0.2, 0.04, s.awning - 0.32, 0.22, shade(awn, 0.8), 'fabric')
    post(-half, D / 2 + s.proj - 0.1, s.awning - 0.1, POLE_RUST)
    post(half, D / 2 + s.proj - 0.1, s.awning - 0.1, POLE_RUST)
    glow(-half * 0.5, D / 2 + 0.3, 0.12, 0.12, s.awning - 0.18, 0.1, WARM_DIM)
  }
}

/** The market stalls, and the damp patches and drain channel on the market floor. */
export function StreetObjects() {
  const { solid, lit } = useMemo(() => {
    const solid: BoxSpec[] = []
    const lit: BoxSpec[] = []
    for (const s of world.stalls) buildStall(s, solid, lit)

    // Hosed, darker patches and a gutter, beside the stalls.
    const m = world.layout.market
    const a = world.nodes.get(m.from)?.at as Vec2
    const b = world.nodes.get(m.to)?.at as Vec2
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dir: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const n: Vec2 = [-dir[1], dir[0]]
    const at = (s: number, l: number): Vec2 => add(add(a, scale(dir, s)), scale(n, l))
    const patch = (s0: number, s1: number, l: number, w: number, color: string) => solid.push({ ...boxAlong(at(s0, l), at(s1, l), w, 0.03, 0.012, color), surface: 'concrete' })
    patch(6, 21, 2.45, 0.22, '#2c2d2e')
    patch(9, 13, -1.6, 2.2, '#574c42')
    patch(20, 24, 1.9, 1.8, '#574c42')
    patch(27, 30, -2.4, 1.5, '#574c42')
    patch(14, 17, 3.3, 2.0, '#5a5046')
    return { solid, lit }
  }, [])

  return (
    <>
      <InstancedBoxes boxes={solid} />
      <InstancedBoxes boxes={lit} unlit castShadow={false} receiveShadow={false} />
    </>
  )
}
