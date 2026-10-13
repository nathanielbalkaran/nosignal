import { DARK_STEEL, FOLIAGE, PLASTIC, STEEL, hv, pickV, type PropBuilder } from './common.ts'
import type { Sink } from '../geo/layers.ts'
import { rgb, shade } from '../geo/Geo.ts'

export const LAMP_COLOR = '#ffc27a'
/** Brightness of the warm decal under each streetlight. Subtle on purpose; the darker surroundings make it read. */
const LAMP_POOL_STRENGTH = 0.27

/** A soft pool of light on the ground, drawn additively. */
export function lightPool(s: Sink, cx: number, cz: number, size: number, color: string, strength: number) {
  const c = shade(rgb(color), strength)
  const h = size / 2
  s.glow.quad([cx - h, 0.07, cz + h], [cx + h, 0.07, cz + h], [cx + h, 0.07, cz - h], [cx - h, 0.07, cz - h], c)
}

export const streetlight: PropBuilder = (s, p) => {
  const g = s.solid
  const trunk = p.zone === 'trunk'
  const H = trunk ? 8 : 6.4
  g.cyl(0, 0, 0, 0.15, 0.5, DARK_STEEL, 6, 0.11)
  g.rod([0, 0, 0], [0, H, 0], 0.07, '#5b6066', 6, 0.05)
  const reach = trunk ? 1.6 : 1.3
  for (const dir of trunk ? [-1, 1] : [1]) {
    g.rod([0, H - 0.1, 0], [0, H + 0.2, dir * reach], 0.035, '#5b6066', 4)
    g.box(0, H + 0.18, dir * reach, 0.28, 0.1, 0.6, '#4a4e53')
    s.emissive.box(0, H + 0.11, dir * reach, 0.22, 0.04, 0.5, LAMP_COLOR)
    lightPool(s, 0, dir * (reach + 0.6), 8, LAMP_COLOR, LAMP_POOL_STRENGTH)
  }
}

export const bollard: PropBuilder = (s) => {
  s.solid.cyl(0, 0, 0, 0.1, 0.9, '#55595e', 6, 0.09)
  s.solid.cyl(0, 0.62, 0, 0.102, 0.1, '#c9c6b8', 6, 0.102, false)
}

export const trafficSign: PropBuilder = (s, p) => {
  const g = s.solid
  g.rod([0, 0, 0], [0, 2.6, 0], 0.045, '#6a6f74', 5)
  const kind = Math.floor(hv(p.variant, 1) * 3)
  const z = 0.07
  if (kind === 0) {
    // No stopping: blue disc with a red ring and bar.
    g.rod([0, 2.35, z], [0, 2.35, z + 0.03], 0.3, '#a8372f', 10, 0.3, true)
    g.rod([0, 2.35, z + 0.02], [0, 2.35, z + 0.05], 0.24, '#2f5f95', 10, 0.24, true)
    g.box(0, 2.35, z + 0.06, 0.4, 0.05, 0.01, '#a8372f')
  } else if (kind === 1) {
    // One way: blue plate with a pale bar.
    g.box(0, 2.3, z, 0.6, 0.4, 0.03, '#2f5f95')
    g.box(0, 2.3, z + 0.02, 0.4, 0.08, 0.01, '#e4e2d6')
  } else {
    // Parking: small blue square.
    g.box(0, 2.3, z, 0.42, 0.42, 0.03, '#2f5f95')
    g.box(0, 2.3, z + 0.02, 0.1, 0.24, 0.01, '#e4e2d6')
  }
}

export const cabinet: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const body = pickV(['#7e8a82', '#8b8f8a', '#6f7d86', '#7a7f72'], p.variant, 1)
  s.solid.box(0, p.height / 2, 0, L, p.height, W, body, { grime: 0.65 })
  s.solid.box(0, 0.05, 0, L + 0.04, 0.1, W + 0.04, '#4d5156')
  const z = W / 2 + 0.006
  s.solid.box(-L * 0.24, p.height * 0.55, z, L * 0.4, p.height * 0.62, 0.012, shade(rgb(body), 0.82))
  s.solid.box(L * 0.24, p.height * 0.55, z, L * 0.4, p.height * 0.62, 0.012, shade(rgb(body), 0.82))
  s.solid.box(0, p.height - 0.14, z, L * 0.8, 0.08, 0.012, '#2a2d2e')
}

export const bin: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const body = pickV(['#3f6a52', '#566067', '#7a3b36', '#3a5a76'], p.variant, 1)
  s.solid.box(0, 0.5, 0, L, 0.9, W, body, { grime: 0.7 })
  s.solid.box(0, 1.0, 0, L + 0.04, 0.12, W + 0.04, shade(rgb(body), 0.72))
  s.solid.box(0, 0.12, -W / 2 + 0.07, L * 0.8, 0.12, 0.1, '#222426')
}

export const barrier: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  g.box(0, 0.28, 0, L, 0.56, W, '#c7c3b6')
  g.box(0, 0.72, 0, L * 0.9, 0.35, W * 0.7, '#c7c3b6')
  for (let i = 0; i < 4; i++) {
    const x = -L / 2 + (i + 0.5) * (L / 4)
    if (i % 2 === 0) g.box(x, 0.5, 0, L / 4, 0.22, W + 0.012, '#a8372f')
  }
}

export const bench: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  const wood = pickV(['#6f5a44', '#5d4d3c', '#7a6850'], p.variant, 1)
  for (const x of [-L * 0.4, L * 0.4]) g.box(x, 0.22, 0, 0.08, 0.44, W * 0.9, DARK_STEEL)
  for (let i = 0; i < 3; i++) g.box(0, 0.46, -W / 2 + 0.1 + i * 0.15, L, 0.05, 0.11, wood)
  g.box(0, 0.75, -W / 2 + 0.06, L, 0.34, 0.05, wood)
}

export const stool: PropBuilder = (s, p) => {
  const c = pickV(PLASTIC, p.variant, 1)
  s.solid.cyl(0, 0, 0, 0.14, 0.38, c, 6, 0.16)
  s.solid.cyl(0, 0.38, 0, 0.17, 0.04, shade(rgb(c), 0.85), 6, 0.17)
}

export const diningSet: PropBuilder = (s, p) => {
  const g = s.solid
  g.cyl(0, 0, 0, 0.05, 0.68, DARK_STEEL, 5)
  g.cyl(0, 0.68, 0, 0.42, 0.04, pickV(['#d4cdb8', '#b9c2c0', '#c9b9a0'], p.variant, 1), 8, 0.42)
  const c = pickV(PLASTIC, p.variant, 2)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.6
    g.cyl(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62, 0.14, 0.4, c, 6, 0.16)
  }
}

export const tree: PropBuilder = (s, p) => {
  const g = s.solid
  const v = p.variant
  const leaf = pickV(FOLIAGE, v, 1)
  const big = hv(v, 2) < 0.4
  g.box(0, 0.12, 0, 1.0, 0.24, 1.0, '#6c6a64')
  g.box(0, 0.25, 0, 0.84, 0.03, 0.84, '#3b3126')
  g.cyl(0, 0.2, 0, 0.18, big ? 3.3 : 2.8, '#5c4c3b', 6, 0.12)
  const cy = big ? 4.4 : 3.8
  const r = big ? 1.9 : 1.5
  g.blob(0, cy, 0, r, r * 0.7, r, leaf, 0.14, v)
  g.blob(r * 0.55, cy - 0.35, r * 0.25, r * 0.75, r * 0.55, r * 0.75, FOLIAGE[(v + 1) % 4], 0.12, v + 1)
  g.blob(-r * 0.5, cy - 0.15, -r * 0.35, r * 0.7, r * 0.55, r * 0.7, FOLIAGE[(v + 2) % 4], 0.12, v + 2)
  g.blob(0.1, cy + r * 0.45, -0.2, r * 0.6, r * 0.4, r * 0.6, FOLIAGE[(v + 3) % 4], 0.12, v + 3)
  // Aerial roots hang from the canopy, banyan-style.
  for (let i = 0; i < 5; i++) {
    const a = hv(v, 10 + i) * Math.PI * 2
    const d = r * (0.3 + hv(v, 20 + i) * 0.5)
    const len = 0.8 + hv(v, 30 + i) * 1.6
    g.rod([Math.cos(a) * d, cy - 0.4, Math.sin(a) * d], [Math.cos(a) * d, cy - 0.4 - len, Math.sin(a) * d], 0.018, '#6a5a46', 3)
  }
}

export const pottedPlant: PropBuilder = (s, p) => {
  const g = s.solid
  const pot = pickV(['#9a5c3f', '#c9c3b0', '#4f7088', '#8a8d8e', '#a46a48'], p.variant, 1)
  const leaf = pickV(FOLIAGE, p.variant, 2)
  g.cyl(0, 0, 0, 0.17, 0.36, pot, 7, 0.23)
  g.blob(0, 0.62, 0, 0.3, 0.28, 0.3, leaf, 0.15, p.variant)
  if (hv(p.variant, 3) < 0.4) g.blob(0.12, 0.9, 0.05, 0.16, 0.16, 0.16, FOLIAGE[(p.variant + 2) % 4], 0.12, p.variant)
}

export const shrub: PropBuilder = (s, p) => {
  const g = s.solid
  g.blob(0, 0.3, 0, 0.42, 0.3, 0.38, pickV(FOLIAGE, p.variant, 1), 0.16, p.variant)
  g.blob(0.28, 0.24, 0.12, 0.28, 0.22, 0.26, pickV(FOLIAGE, p.variant, 2), 0.16, p.variant + 3)
  g.blob(-0.26, 0.22, -0.1, 0.26, 0.2, 0.26, pickV(FOLIAGE, p.variant, 3), 0.16, p.variant + 5)
}

export const planter: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  g.box(0, 0.25, 0, L, 0.5, W, '#8b867c', { grime: 0.7 })
  g.box(0, 0.51, 0, L - 0.1, 0.03, W - 0.1, '#3a3025')
  const n = 3
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + L * ((i + 0.5) / n)
    g.blob(x, 0.8, 0, 0.36, 0.34, 0.3, pickV(FOLIAGE, p.variant, i), 0.15, p.variant + i)
  }
  if (hv(p.variant, 9) < 0.4) g.blob(0, 1.4, 0, 0.55, 0.45, 0.5, FOLIAGE[p.variant % 4], 0.13, p.variant + 9)
}

export const cone: PropBuilder = (s) => {
  s.solid.box(0, 0.015, 0, 0.32, 0.03, 0.32, '#2b2c2e')
  s.solid.cyl(0, 0.03, 0, 0.13, 0.62, '#c0552d', 6, 0.03)
  s.solid.cyl(0, 0.34, 0, 0.082, 0.12, '#dcd8cc', 6, 0.065, false)
}

export const streetFurnitureBuilders = { streetlight, bollard, trafficSign, cabinet, bin, barrier, bench, stool, diningSet, tree, pottedPlant, shrub, planter, cone }
export { STEEL }
