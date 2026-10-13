import { CARDBOARD, DARK_STEEL, STEEL, hv, pickV, type PropBuilder } from './common.ts'
import type { Sink } from '../geo/layers.ts'
import { rgb, shade } from '../geo/Geo.ts'

/** Wire mesh hung over the outside of a scaffold. `repeat` is metres per texture tile. */
function meshPanel(s: Sink, x0: number, x1: number, y0: number, y1: number, z: number, color: string, repeat = 0.5) {
  const c = rgb(color)
  s.mesh.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], c, undefined, [0, 0, (x1 - x0) / repeat, (y1 - y0) / repeat])
}

export const bambooScaffold: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const H = p.height
  const g = s.solid
  const cane = '#a89560'
  const cane2 = '#97854f'
  const n = Math.max(2, Math.round(L / 1.45) + 1)
  const zs = [-W / 2 + 0.12, W / 2 - 0.1]
  const xAt = (i: number) => -L / 2 + 0.1 + (i / (n - 1)) * (L - 0.2)
  for (const z of zs) {
    for (let i = 0; i < n; i++) {
      const lean = hv(p.variant, i * 3 + (z > 0 ? 1 : 0)) * 0.03
      g.rod([xAt(i), 0, z], [xAt(i) + lean, H + 0.5, z], 0.034, i % 2 ? cane : cane2, 5, 0.026)
    }
  }
  for (let y = 1.3; y < H; y += 1.55) {
    for (const z of zs) g.rod([-L / 2, y, z], [L / 2, y, z], 0.03, cane, 4)
    for (let i = 0; i < n; i += 2) g.rod([xAt(i), y + 0.02, zs[0]], [xAt(i), y + 0.02, zs[1]], 0.028, cane2, 4)
  }
  // Diagonal braces on the outer face.
  for (let i = 0; i + 2 < n; i += 2) {
    const up = (i / 2) % 2 === 0
    g.rod([xAt(i), up ? 0.4 : H * 0.55, zs[1] + 0.03], [xAt(i + 2), up ? H * 0.55 : 0.4, zs[1] + 0.03], 0.026, cane2, 4)
  }
  // Working decks.
  for (let y = 3.1; y < H - 0.5; y += 3.1) g.box(0, y, 0, L - 0.1, 0.05, W - 0.1, '#7e6c50')
  g.box(0, 0.12, W / 2 - 0.1, L, 0.24, 0.05, '#6f5f47')
  meshPanel(s, -L / 2 + 0.02, L / 2 - 0.02, 0.3, H, W / 2 + 0.05, '#4a6350', 0.6)
}

export const metalScaffold: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const H = p.height
  const g = s.solid
  const bays = Math.max(1, Math.round(L / 1.8))
  const bay = L / bays
  const zs = [-W / 2 + 0.08, W / 2 - 0.08]
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + i * bay
    for (const z of zs) {
      g.rod([x, 0, z], [x, H + 0.3, z], 0.028, STEEL, 4)
      g.box(x, 0.06, z, 0.16, 0.06, 0.16, DARK_STEEL)
    }
  }
  for (let y = 0.5; y < H; y += 2) {
    for (const z of zs) g.rod([-L / 2, y, z], [L / 2, y, z], 0.024, STEEL, 4)
    for (let i = 0; i <= bays; i++) g.rod([-L / 2 + i * bay, y, zs[0]], [-L / 2 + i * bay, y, zs[1]], 0.022, STEEL, 4)
  }
  for (let i = 0; i < bays; i++) {
    const x0 = -L / 2 + i * bay
    const up = i % 2 === 0
    g.rod([x0, up ? 0.5 : H * 0.6, zs[1] + 0.03], [x0 + bay, up ? H * 0.6 : 0.5, zs[1] + 0.03], 0.02, STEEL, 4)
  }
  for (let y = 2.5; y < H - 0.5; y += 2) g.box(0, y, 0, L - 0.04, 0.045, W - 0.08, '#9b9a8f')
  meshPanel(s, -L / 2, L / 2, 0.45, H, W / 2 + 0.04, '#566a80', 0.5)
}

export const hoarding: PropBuilder = (s, p) => {
  const [L] = p.size
  const H = p.height
  const g = s.solid
  const panel = pickV(['#56738f', '#5d6f58', '#8a8f93'], p.variant, 1)
  const dark = shade(rgb(panel), 0.82)
  const ribs = Math.max(2, Math.round(L / 0.3))
  for (const side of [-1, 1]) {
    const z = side * 0.075
    for (let i = 0; i < ribs; i++) {
      const x0 = -L / 2 + (i / ribs) * L
      const x1 = -L / 2 + ((i + 1) / ribs) * L
      const c = i % 2 ? rgb(panel) : dark
      if (side > 0) g.quad([x0, 0.1, z], [x1, 0.1, z], [x1, H, z], [x0, H, z], c, [shade(c, 0.7), shade(c, 0.7), c, c])
      else g.quad([x1, 0.1, z], [x0, 0.1, z], [x0, H, z], [x1, H, z], c, [shade(c, 0.7), shade(c, 0.7), c, c])
    }
  }
  g.box(0, 0.05, 0, L, 0.1, 0.16, '#7a7b76')
  g.box(0, H + 0.02, 0, L, 0.05, 0.16, '#5b5e60')
  // A warning plate.
  if (L > 1.6) {
    g.box(0, H * 0.7, 0.078, 0.5, 0.28, 0.01, '#c9a84a')
    g.box(0, H * 0.7, 0.086, 0.4, 0.04, 0.01, '#2b2a28')
  }
  const posts = Math.max(2, Math.round(L / 2.4) + 1)
  for (let i = 0; i < posts; i++) g.box(-L / 2 + 0.05 + (i / (posts - 1)) * (L - 0.1), H / 2, 0, 0.08, H, 0.2, '#54585b')
}

export const coveredWalkway: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  const roof = '#43594a'
  g.box(0, 2.62, 0, L + 0.3, 0.07, W, roof)
  g.box(0, 2.7, 0, L + 0.3, 0.05, W * 0.86, shade(rgb(roof), 1.15))
  // Hazard stripes along the front and back edge of the roof.
  const stripes = Math.round(L / 0.5)
  for (let i = 0; i < stripes; i++) {
    if (i % 2) continue
    const x = -L / 2 + (i + 0.5) * (L / stripes)
    for (const side of [-1, 1]) g.box(x, 2.62, side * (W / 2 + 0.005), L / stripes, 0.07, 0.01, '#c9a84a')
  }
  for (const side of [-1, 1]) {
    const z = side * (W / 2 - 0.15)
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * (L / 2 - 0.2)
      g.rod([x, 0, z], [x, 2.62, z], 0.06, '#5d6166', 5)
    }
    g.rod([-(L / 2 - 0.2), 1.0, z], [L / 2 - 0.2, 1.0, z], 0.025, STEEL, 4)
    g.rod([-(L / 2 - 0.2), 0.5, z], [L / 2 - 0.2, 0.5, z], 0.02, STEEL, 4)
  }
  for (let i = 0; i < 2; i++) s.emissive.box((i - 0.5) * L * 0.5, 2.57, 0, 0.5, 0.03, 0.12, '#ffd9a0')
}

export const materials: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  const kind = Math.floor(hv(p.variant, 1) * 4)
  if (kind === 0) {
    g.box(0, 0.08, 0, L, 0.14, W, '#8a7556')
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) g.box(-L * 0.36 + i * L * 0.24, 0.22 + r * 0.14, 0, L * 0.22, 0.12, W * 0.9, r % 2 ? '#9f5a46' : '#a96651')
  } else if (kind === 1) {
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) g.blob(-L * 0.33 + i * L * 0.22 + r * L * 0.11, 0.16 + r * 0.22, 0, L * 0.14, 0.12, W * 0.38, '#b7ac90', 0.1, i + r)
  } else if (kind === 2) {
    g.box(0, 0.07, 0, L, 0.1, W * 0.5, '#7a6a50')
    for (let r = 0; r < 5; r++) g.box(0, 0.17 + r * 0.1, 0, L * 0.98, 0.09, W * 0.78, r % 2 ? '#8e7a5a' : '#9a8564')
  } else {
    g.box(0, 0.07, 0, L, 0.1, W, '#7d7260')
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) g.box(-L * 0.3 + i * L * 0.3, 0.2 + r * 0.14, 0, L * 0.28, 0.12, W * 0.9, r % 2 ? '#aaa89e' : '#b6b4aa')
  }
}

export const pipesStack: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  const c = pickV(['#9aa0a3', '#b86a2f', '#8a8d90', '#c4bfae'], p.variant, 1)
  g.box(-L * 0.35, 0.05, 0, 0.12, 0.1, W, '#7a6a50')
  g.box(L * 0.35, 0.05, 0, 0.12, 0.1, W, '#7a6a50')
  const rows = [4, 3, 2]
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 0.2
      g.rod([-L / 2, 0.2 + r * 0.17, z], [L / 2, 0.2 + r * 0.17, z], 0.095, c, 6)
    }
  })
}

export const tempFence: PropBuilder = (s, p) => {
  const [L] = p.size
  const H = p.height
  for (const x of [-L / 2 + 0.1, L / 2 - 0.1]) {
    s.solid.rod([x, 0, -0.18], [x, H * 0.35, 0], 0.03, STEEL, 4)
    s.solid.rod([x, 0, 0.18], [x, H * 0.35, 0], 0.03, STEEL, 4)
    s.solid.rod([x, 0.1, 0], [x, H, 0], 0.025, STEEL, 4)
  }
  s.solid.rod([-L / 2, H - 0.05, 0], [L / 2, H - 0.05, 0], 0.022, STEEL, 4)
  s.solid.rod([-L / 2, 0.15, 0], [L / 2, 0.15, 0], 0.022, STEEL, 4)
  meshPanel(s, -L / 2, L / 2, 0.15, H - 0.05, 0, '#9aa0a3', 0.25)
}

export const constructionBuilders = { bambooScaffold, metalScaffold, hoarding, coveredWalkway, materials, pipesStack, tempFence }
export { CARDBOARD }
