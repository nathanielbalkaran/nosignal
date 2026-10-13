import { CARDBOARD, DARK_STEEL, PLASTIC, STEEL, TYRE, hv, pickV, type PropBuilder } from './common.ts'
import { rgb, shade } from '../geo/Geo.ts'

export const crates: PropBuilder = (s, p) => {
  const g = s.solid
  const base = pickV(PLASTIC, p.variant, 1)
  const stack = 2 + Math.floor(hv(p.variant, 2) * 3)
  for (let i = 0; i < stack; i++) {
    const col = hv(p.variant, 5 + i) < 0.7 ? base : pickV(PLASTIC, p.variant, 8 + i)
    const dx = (hv(p.variant, 20 + i) - 0.5) * 0.08
    g.box(dx, 0.17 + i * 0.3, 0, 0.5, 0.3, 0.36, col, { grime: 0.8 })
    g.box(dx, 0.19 + i * 0.3, 0.181, 0.4, 0.1, 0.01, shade(rgb(col), 0.45))
    g.box(dx, 0.19 + i * 0.3, -0.181, 0.4, 0.1, 0.01, shade(rgb(col), 0.45))
  }
  // A second column beside the first.
  if (hv(p.variant, 3) < 0.6) {
    const n2 = 1 + Math.floor(hv(p.variant, 4) * 3)
    for (let i = 0; i < n2; i++) g.box(0.3, 0.17 + i * 0.3, 0, 0.5, 0.3, 0.36, pickV(PLASTIC, p.variant, 30 + i), { grime: 0.8 })
  }
}

export const boxes: PropBuilder = (s, p) => {
  const g = s.solid
  const n = 2 + Math.floor(hv(p.variant, 1) * 3)
  let y = 0
  for (let i = 0; i < n; i++) {
    const w = 0.5 + hv(p.variant, 2 + i) * 0.22
    const d = 0.4 + hv(p.variant, 9 + i) * 0.2
    const h = 0.26 + hv(p.variant, 15 + i) * 0.16
    const c = pickV(CARDBOARD, p.variant, 20 + i)
    const dx = (hv(p.variant, 30 + i) - 0.5) * 0.12
    g.box(dx, y + h / 2, 0, w, h, d, c, { grime: 0.85 })
    g.box(dx, y + h + 0.004, 0, 0.06, 0.006, d, '#cfc5ab')
    y += h
  }
}

export const foldedStall: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  const canopy = pickV(['#8c3f38', '#3f6c93', '#5f8a60', '#c7c2b3', '#b99347'], p.variant, 1)
  const stripe = '#d6d2c4'
  // The frame leans against the wall, canopy folded over it.
  g.rod([-L * 0.45, 0, -W * 0.3], [-L * 0.35, 1.1, W * 0.1], 0.025, STEEL, 4)
  g.rod([L * 0.45, 0, -W * 0.3], [L * 0.35, 1.1, W * 0.1], 0.025, STEEL, 4)
  g.rod([-L * 0.45, 0, W * 0.3], [-L * 0.35, 1.1, W * 0.1], 0.025, STEEL, 4)
  g.rod([L * 0.45, 0, W * 0.3], [L * 0.35, 1.1, W * 0.1], 0.025, STEEL, 4)
  g.rod([-L * 0.5, 0.45, 0], [L * 0.5, 0.45, 0], 0.025, STEEL, 4)
  const folds = 6
  for (let i = 0; i < folds; i++) {
    const x = -L / 2 + (i / folds) * L
    g.box(x + L / folds / 2, 0.82, 0, L / folds, 0.34, 0.5 + (i % 2) * 0.06, i % 2 ? canopy : stripe)
  }
  g.box(0, 0.4, 0, L * 0.9, 0.1, 0.4, canopy)
}

export const cart: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  const frame = pickV(['#4a5560', '#6a3a34', '#5d6a55'], p.variant, 1)
  g.box(0, 0.38, 0, L * 0.82, 0.05, W * 0.86, frame)
  for (const side of [-1, 1]) {
    g.rod([-L * 0.41, 0.38, side * W * 0.43], [-L * 0.41, 0.6, side * W * 0.43], 0.02, frame, 4)
    g.rod([L * 0.41, 0.38, side * W * 0.43], [L * 0.41, 0.62, side * W * 0.43], 0.02, frame, 4)
    g.rod([-L * 0.41, 0.6, side * W * 0.43], [L * 0.41, 0.62, side * W * 0.43], 0.02, frame, 4)
    g.rod([L * 0.41, 0.38, side * W * 0.4], [L * 0.62, 0.95, side * W * 0.4], 0.022, DARK_STEEL, 4)
    g.rod([-L * 0.05, 0.28, side * (W / 2 + 0.03)], [-L * 0.05, 0.28, side * (W / 2 + 0.07)], 0.28, TYRE, 8, 0.28, true)
  }
  g.rod([L * 0.62, 0.95, -W * 0.4], [L * 0.62, 0.95, W * 0.4], 0.022, DARK_STEEL, 4)
  const load = Math.floor(hv(p.variant, 2) * 3)
  if (load === 0) for (let i = 0; i < 3; i++) g.box(-L * 0.25 + (i % 2) * L * 0.3, 0.6 + Math.floor(i / 2) * 0.28, 0, 0.5, 0.26, 0.5, pickV(CARDBOARD, p.variant, 10 + i))
  else if (load === 1) for (let i = 0; i < 3; i++) g.box(-L * 0.28 + i * 0.2, 0.55 + (i % 2) * 0.3, 0, 0.5, 0.28, 0.36, pickV(PLASTIC, p.variant, 12 + i))
  else g.blob(-L * 0.1, 0.65, 0, L * 0.3, 0.2, W * 0.4, '#5d6f5f', 0.12, p.variant)
}

export const display: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const g = s.solid
  const frame = pickV(['#4a5560', '#6a5a46', '#52584d'], p.variant, 1)
  g.box(0, p.height / 2, -W / 2 + 0.03, L, p.height, 0.05, frame)
  for (let i = 0; i < 3; i++) {
    const y = 0.35 + i * 0.4
    g.box(0, y, 0, L, 0.04, W * 0.9, frame)
    const produce = pickV(['#a8503a', '#c18a3a', '#5f8a4e', '#b8a24a', '#8a4a58'], p.variant, 5 + i)
    for (let k = 0; k < 4; k++) g.blob(-L * 0.36 + k * L * 0.24, y + 0.1, 0.02, 0.1, 0.08, 0.1, produce, 0.2, i * 5 + k)
  }
  for (const x of [-L / 2 + 0.03, L / 2 - 0.03]) g.box(x, p.height / 2, 0, 0.05, p.height, W * 0.9, frame)
}

export const commercialBuilders = { crates, boxes, foldedStall, cart, display }
