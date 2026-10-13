import { GLASS, STEEL, TYRE, hv, pickV, type PropBuilder } from './common.ts'
import type { Sink } from '../geo/layers.ts'

const CAR_COLORS = ['#c9c9c3', '#8c9093', '#3b4552', '#2e3033', '#7d3430', '#a1a9a4', '#b3a78f', '#566a74']
const VAN_COLORS = ['#b4b4ac', '#8d9aa5', '#aea78f', '#6a8075', '#85888a', '#a3a7a5']
const TRUCK_BOX = ['#aeafa6', '#52707f', '#5f7f69', '#988e74', '#8c4f43']
const SCOOTER_COLORS = ['#d5d4cf', '#2b2d30', '#8e9296', '#9c3e38', '#3f6285', '#b99b4e', '#5b7b66']

function wheel(s: Sink, x: number, y: number, z: number, r: number, thickness: number) {
  s.solid.rod([x, y, z - thickness / 2], [x, y, z + thickness / 2], r, TYRE, 7, r, true)
  s.solid.rod([x, y, z - thickness / 2 - 0.005], [x, y, z + thickness / 2 + 0.005], r * 0.5, '#8d9094', 6, r * 0.5, true)
}

/** Dark window quads on both sides of a cabin, set just proud of the body. */
function sideWindows(s: Sink, x0: number, x1: number, y0: number, y1: number, halfWidth: number) {
  for (const side of [-1, 1]) {
    const z = side * (halfWidth + 0.01)
    if (side > 0) s.solid.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], GLASS)
    else s.solid.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], GLASS)
  }
}

export const car: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const taxi = hv(p.variant, 1) < 0.22
  const body = taxi ? '#a8362f' : pickV(CAR_COLORS, p.variant, 2)
  const roof = taxi ? '#cfcfc6' : body
  const g = s.solid
  g.box(0, 0.6, 0, L, 0.5, W, body, { grime: 0.7 })
  // Hood and boot are slightly lower than the cabin.
  g.box(L * 0.3, 0.9, 0, L * 0.34, 0.12, W * 0.96, body)
  g.box(-L * 0.36, 0.9, 0, L * 0.26, 0.12, W * 0.96, body)
  g.box(-L * 0.02, 1.13, 0, L * 0.5, 0.52, W * 0.88, roof)
  sideWindows(s, -L * 0.23, L * 0.2, 0.98, 1.34, W * 0.44)
  // Windscreens: dark slanted quads front and back.
  const hw = W * 0.44
  g.quad([L * 0.23, 0.95, -hw], [L * 0.23, 0.95, hw], [L * 0.2, 1.38, hw], [L * 0.2, 1.38, -hw], GLASS)
  g.quad([-L * 0.25, 0.95, hw], [-L * 0.25, 0.95, -hw], [-L * 0.23, 1.38, -hw], [-L * 0.23, 1.38, hw], GLASS)
  if (taxi) g.box(-L * 0.02, 1.43, 0, 0.5, 0.12, 0.2, '#e6e2d0')
  g.box(L / 2 + 0.005, 0.62, 0, 0.02, 0.14, W * 0.82, '#b9b8b0')
  g.box(-L / 2 - 0.005, 0.66, 0, 0.02, 0.1, W * 0.8, '#5a2926')
  for (const x of [-L * 0.31, L * 0.31]) for (const z of [-W / 2 + 0.04, W / 2 - 0.04]) wheel(s, x, 0.31, z, 0.31, 0.22)
}

export const van: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const H = p.height
  const body = pickV(VAN_COLORS, p.variant, 1)
  const g = s.solid
  g.box(0, 0.55, 0, L, 0.4, W, '#43474b', { grime: 0.5 })
  // Cargo box and a lower cab.
  g.box(-L * 0.17, 0.2 + (H - 0.1) / 2 + 0.1, 0, L * 0.64, H - 0.5, W, body, { grime: 0.55 })
  g.box(L * 0.34, 0.55 + 0.45, 0, L * 0.32, 0.9, W * 0.98, body, { grime: 0.6 })
  g.quad([L * 0.5, 1.15, -W * 0.44], [L * 0.5, 1.15, W * 0.44], [L * 0.42, 1.75, W * 0.44], [L * 0.42, 1.75, -W * 0.44], GLASS)
  sideWindows(s, L * 0.2, L * 0.44, 1.2, 1.65, W * 0.49)
  // A delivery stripe along the cargo box.
  if (hv(p.variant, 4) < 0.7) {
    const stripe = pickV(['#8e3b35', '#3d6590', '#c29a3e', '#4c7b5e'], p.variant, 5)
    for (const side of [-1, 1]) g.box(-L * 0.17, H * 0.55, side * (W / 2 + 0.006), L * 0.6, 0.18, 0.01, stripe)
  }
  g.box(-L / 2 - 0.006, H * 0.5, 0, 0.012, H * 0.55, W * 0.7, '#6c6f70')
  g.box(L / 2 + 0.005, 0.65, 0, 0.02, 0.14, W * 0.8, '#b0afa8')
  for (const x of [-L * 0.3, L * 0.34]) for (const z of [-W / 2 + 0.05, W / 2 - 0.05]) wheel(s, x, 0.34, z, 0.34, 0.24)
}

export const truck: PropBuilder = (s, p) => {
  const [L, W] = p.size
  const H = p.height
  const g = s.solid
  const cab = pickV(['#aaa696', '#85908f', '#9c9686'], p.variant, 1)
  const box = pickV(TRUCK_BOX, p.variant, 2)
  const cabLen = L * 0.28
  g.box(0, 0.62, 0, L, 0.28, W * 0.94, '#2f3236')
  g.box(L / 2 - cabLen / 2, 1.45, 0, cabLen, 1.6, W * 0.98, cab, { grime: 0.55 })
  g.quad([L / 2 + 0.002, 1.35, -W * 0.42], [L / 2 + 0.002, 1.35, W * 0.42], [L / 2 + 0.002, 2.2, W * 0.42], [L / 2 + 0.002, 2.2, -W * 0.42], GLASS)
  sideWindows(s, L / 2 - cabLen * 0.85, L / 2 - cabLen * 0.1, 1.5, 2.1, W * 0.49)
  const boxLen = L - cabLen - 0.15
  const tarp = hv(p.variant, 3) < 0.3
  if (tarp) {
    g.box(-L / 2 + boxLen / 2, 0.85 + (H - 0.85) / 2, 0, boxLen, H - 0.85, W, '#4f5f50', { grime: 0.5 })
    g.blob(-L / 2 + boxLen / 2, H - 0.1, 0, boxLen * 0.45, 0.28, W * 0.45, '#667a68', 0.1, p.variant)
  } else {
    g.box(-L / 2 + boxLen / 2, 0.85 + (H - 0.85) / 2, 0, boxLen, H - 0.85, W, box, { grime: 0.5 })
    // Rear roller shutter.
    g.box(-L / 2 - 0.006, 1.7, 0, 0.012, H - 1.25, W * 0.8, '#6c706f')
  }
  for (const x of [-L * 0.34, -L * 0.2, L * 0.34]) for (const z of [-W / 2 + 0.06, W / 2 - 0.06]) wheel(s, x, 0.4, z, 0.4, 0.26)
}

export const scooter: PropBuilder = (s, p) => {
  const [L] = p.size
  const k = L / 1.7
  const body = pickV(SCOOTER_COLORS, p.variant, 1)
  const g = s.solid
  wheel(s, -0.6 * k, 0.21, 0, 0.21, 0.1)
  wheel(s, 0.62 * k, 0.21, 0, 0.21, 0.1)
  g.box(-0.38 * k, 0.55, 0, 0.62 * k, 0.38, 0.3, body)
  g.box(-0.34 * k, 0.8, 0, 0.5 * k, 0.1, 0.28, '#222326')
  g.box(0.12 * k, 0.28, 0, 0.55 * k, 0.07, 0.34, '#3b3d41')
  g.box(0.5 * k, 0.65, 0, 0.1 * k, 0.8, 0.3, body)
  g.box(0.52 * k, 1.1, 0, 0.12, 0.08, 0.62, '#2a2b2e')
  g.box(0.57 * k, 1.0, 0, 0.1, 0.16, 0.22, '#c9c9bf')
  if (hv(p.variant, 2) < 0.28) g.box(-0.62 * k, 1.0, 0, 0.45 * k, 0.4, 0.4, pickV(['#9c3e38', '#b99b4e', '#3f6285'], p.variant, 3))
}

export const motorcycle: PropBuilder = (s, p) => {
  const [L] = p.size
  const k = L / 2
  const body = pickV(['#2b2d30', '#8e9296', '#7d3430', '#3f6285'], p.variant, 1)
  const g = s.solid
  wheel(s, -0.7 * k, 0.3, 0, 0.3, 0.12)
  wheel(s, 0.72 * k, 0.3, 0, 0.3, 0.12)
  g.box(0, 0.62, 0, 0.9 * k, 0.28, 0.3, body)
  g.box(0.22 * k, 0.86, 0, 0.42 * k, 0.28, 0.28, '#a9aaa4')
  g.box(-0.3 * k, 0.88, 0, 0.55 * k, 0.1, 0.28, '#222326')
  g.rod([0.72 * k, 0.3, 0], [0.5 * k, 0.95, 0], 0.03, STEEL, 4)
  g.box(0.5 * k, 1.0, 0, 0.1, 0.06, 0.62, '#2a2b2e')
  g.box(0.62 * k, 0.95, 0, 0.1, 0.16, 0.2, '#c9c9bf')
}

export const bicycle: PropBuilder = (s, p) => {
  const g = s.solid
  const frame = pickV(['#2e3a46', '#6a2f2b', '#4d5b4a', '#8a8d90'], p.variant, 1)
  for (const x of [-0.6, 0.6]) {
    s.solid.rod([x, 0.33, -0.02], [x, 0.33, 0.02], 0.33, TYRE, 8, 0.33, true)
    s.solid.rod([x, 0.33, -0.015], [x, 0.33, 0.015], 0.26, '#6e7276', 8, 0.26, true)
  }
  g.rod([-0.6, 0.33, 0], [-0.1, 0.62, 0], 0.018, frame, 4)
  g.rod([-0.1, 0.62, 0], [0.45, 0.65, 0], 0.018, frame, 4)
  g.rod([-0.6, 0.33, 0], [0.0, 0.33, 0], 0.018, frame, 4)
  g.rod([0, 0.33, 0], [-0.1, 0.62, 0], 0.018, frame, 4)
  g.rod([0.45, 0.65, 0], [0.6, 0.33, 0], 0.018, frame, 4)
  g.box(-0.12, 0.72, 0, 0.2, 0.04, 0.12, '#1d1e20')
  g.box(0.45, 0.95, 0, 0.04, 0.04, 0.5, '#2a2b2e')
  g.rod([0.45, 0.65, 0], [0.45, 0.95, 0], 0.018, frame, 4)
}
