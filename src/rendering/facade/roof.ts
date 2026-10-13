import type { RooftopFeature } from '../../world/facades.ts'
import { rgb, shade } from '../geo/Geo.ts'
import { front, type FacadeContext } from './context.ts'

const TANKS = ['#c9c6b8', '#4e6e8c', '#4a6e5a']
const CLOTHS = ['#8f9aa3', '#a68f84', '#b2ab98', '#7b8f84', '#9b8aa0']

/** Rooftop clutter: water tanks, huts, antennas, shacks, laundry. One feature per slot along the roof. */
export function drawRoof(ctx: FacadeContext) {
  const { spec, W, H, rng, base, detail } = ctx
  const features = spec.rooftop
  if (features.length === 0 || spec.depth < 3.5) return
  const zFront = ctx.zAt(ctx.G + (ctx.floors - 1) * ctx.storey)
  const zBack = -spec.depth + 0.6
  const slotW = (W - 1) / Math.min(features.length, Math.max(1, Math.floor(W / 2.6)))
  const usable = features.slice(0, Math.max(1, Math.floor(W / 2.6)))
  usable.forEach((f: RooftopFeature, i) => {
    const x = 0.5 + i * slotW + slotW / 2
    const zSpan = zFront - 1.0 - zBack
    if (zSpan < 1.4) return
    const z = zBack + rng.range(0.5, 1) * zSpan - 0.6
    switch (f) {
      case 'hut': {
        const w = Math.min(slotW * 0.9, rng.range(1.8, 2.8))
        const h = rng.range(2.1, 2.6)
        const d = Math.min(2.2, zSpan)
        const c = shade(ctx.wall, rng.range(0.85, 1))
        base.span(x - w / 2, H, z - d, x + w / 2, H + h, z, c)
        base.span(x - w / 2 - 0.1, H + h, z - d - 0.1, x + w / 2 + 0.1, H + h + 0.12, z + 0.1, rgb('#55585a'))
        front(base, x - 0.4, H, x + 0.4, H + 1.9, z + 0.012, rgb('#2a3138'))
        break
      }
      case 'tank': {
        const col = rng.pick(TANKS)
        const n = rng.int(1, 2)
        for (let k = 0; k < n; k++) {
          const cx = x + (k - (n - 1) / 2) * 1.2
          for (const [lx, lz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
            detail.rod([cx + lx, H, z + lz], [cx + lx, H + 0.7, z + lz], 0.04, '#6a6e70', 4)
          }
          detail.cyl(cx, H + 0.7, z, 0.55, 1.15, col, 8)
        }
        break
      }
      case 'antenna': {
        const h = rng.range(4, 6.5)
        detail.rod([x, H, z], [x, H + h, z], 0.03, '#5a5d60', 4, 0.015)
        for (let k = 0; k < 3; k++) {
          const y = H + h * (0.45 + k * 0.17)
          const l = 0.7 - k * 0.18
          detail.rod([x - l, y, z], [x + l, y, z], 0.014, '#5a5d60', 3)
        }
        break
      }
      case 'shack': {
        const w = Math.min(slotW * 0.95, rng.range(2.6, 3.4))
        const d = Math.min(2.4, zSpan)
        const rust = rng.chance(0.5)
        const c = rgb(rust ? '#8a5a42' : '#7d8a86')
        base.span(x - w / 2, H, z - d, x + w / 2, H + 2.2, z, c, { skip: ['+y'] })
        const tarp = rgb(rng.pick(['#41667e', '#7d5a48', '#5b6a52']))
        base.quad([x - w / 2 - 0.15, H + 2.15, z + 0.2], [x + w / 2 + 0.15, H + 2.15, z + 0.2], [x + w / 2 + 0.15, H + 2.5, z - d], [x - w / 2 - 0.15, H + 2.5, z - d], tarp)
        front(base, x - 0.35, H, x + 0.35, H + 1.85, z + 0.012, rgb('#2a3138'))
        break
      }
      case 'laundry': {
        const w = Math.min(3.2, slotW)
        for (const sx of [-w / 2, w / 2]) detail.rod([x + sx, H, z], [x + sx, H + 2.1, z], 0.03, '#55585a', 4)
        for (const y of [1.7, 2.05]) detail.rod([x - w / 2, H + y, z], [x + w / 2, H + y, z], 0.012, '#55585a', 3)
        const n = rng.int(3, 6)
        for (let k = 0; k < n; k++) {
          const cx = x - w / 2 + 0.3 + ((w - 0.6) * k) / Math.max(1, n - 1)
          const h = rng.range(0.5, 0.9)
          front(detail, cx - 0.17, H + 1.7 - h, cx + 0.17, H + 1.7, z + 0.01, rgb(rng.pick(CLOTHS)))
        }
        break
      }
      case 'dish': {
        detail.rod([x, H, z], [x, H + 1.1, z], 0.03, '#55585a', 4)
        detail.rod([x, H + 1.1, z], [x + 0.06, H + 1.25, z + 0.28], 0.4, '#d9d8d0', 8, 0.4, true)
        break
      }
      case 'billboard': {
        const w = Math.min(W * 0.7, rng.range(3.5, 5.5))
        const cx = W / 2
        for (const sx of [-w * 0.35, w * 0.35]) detail.rod([cx + sx, H, zFront - 0.3], [cx + sx, H + 2.6, zFront - 0.3], 0.06, '#4a4d50', 4)
        base.span(cx - w / 2, H + 2.4, zFront - 0.45, cx + w / 2, H + 4.4, zFront - 0.3, rgb(rng.pick(['#6a6e72', '#7d7a6b', '#5d6a75', '#7a5a52'])), { skip: ['-y'] })
        front(detail, cx - w / 2 + 0.2, H + 2.6, cx + w / 2 - 0.2, H + 4.2, zFront - 0.29, rgb(rng.pick(['#8a8576', '#76808a', '#8a7468'])))
        break
      }
    }
  })
}
