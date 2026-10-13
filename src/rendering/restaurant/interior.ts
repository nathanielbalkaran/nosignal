import { Geo } from '../geo/Geo.ts'
import { Rng } from '../../world/rng.ts'

/*
 * The cha chaan teng interior and the lane outside its window, as merged
 * flat-shaded geometry. Room-local metres: +x to the right of the counter
 * camera, -z toward the back wall, y up. The street-facing window is in the
 * back wall, left of the worker (z = -2.7); the lane runs along it outside. Three geometries: `lit` (scene-lit surfaces),
 * `glow` (unlit lamps and screens) and `out` (the pre-dawn lane, unlit and
 * pre-shaded, so nothing outside needs a light).
 */

export const ROOM = { x0: -3.4, x1: 3.4, z0: -2.7, z1: 2.4, h: 2.7 } as const
/** The window opening in the back wall. */
export const WINDOW = { x0: -3.0, x1: -1.5, y0: 0.9, y1: 2.2 } as const
export const COUNTER_TOP = 1.02
export const TABLE = { x: -2.25, z: -1.65, top: 0.76 } as const
/** The lane is built in its own frame (x out from the window wall, z along the lane) and placed by the rig. */
export const LAMP = { x: -4.5, y: 4.6, z: 0.2 } as const
/** Lane frame -> room: world = (-lz + LANE_AT.x, lx + LANE_AT.z). */
export const LANE_AT = { x: -3.4, z: 0.7 } as const

export interface Interior {
  lit: Geo
  glow: Geo
  out: Geo
}

const C = {
  tileLow: '#a3ae98',
  tileTrim: '#7e8a74',
  plaster: '#c8bf9e',
  plasterDark: '#b3aa8a',
  ceiling: '#b1a98f',
  floorA: '#8c8776',
  floorB: '#6f6b5e',
  wood: '#5c4331',
  woodLight: '#7c5e44',
  steel: '#a2a8aa',
  steelDark: '#6e7476',
  counterFront: '#7b3a30',
  counterTop: '#b9a98a',
  cup: '#e3ddd0',
  cupBlue: '#43618a',
}

export function buildInterior(): Interior {
  const lit = new Geo()
  const glow = new Geo()
  const out = new Geo()
  const rng = new Rng('restaurant:interior')
  const { x0, x1, z0, z1, h } = ROOM

  // ----- floor: worn two-tone tiles -----
  for (let ix = 0; ix < 12; ix++) {
    for (let iz = 0; iz < 9; iz++) {
      const a = x0 + ix * (6.8 / 12)
      const b = a + 6.8 / 12
      const c = z0 + iz * (5.1 / 9)
      const d = c + 5.1 / 9
      const base = (ix + iz) % 2 ? C.floorA : C.floorB
      const k = 0.88 + rng.float() * 0.2
      lit.span(a, -0.04, c, b, 0, d, shadeHex(base, k), { skip: ['+x', '-x', '+z', '-z', '-y'] })
    }
  }
  // Wear in front of the counter and a dark stain by the kitchen.
  lit.span(-1.6, 0.0005, 0.25, 1.8, 0.001, 1.0, '#5a574c', { skip: ['+x', '-x', '+z', '-z', '-y'] })
  lit.span(2.0, 0.0005, -1.5, 2.8, 0.001, -0.8, '#4c493f', { skip: ['+x', '-x', '+z', '-z', '-y'] })

  // ----- walls: green tile to 1.35 m, nicotine plaster above, a dark trim line between -----
  const wallBand = (ax: number, az: number, bx: number, bz: number) => {
    // A wall run, either along x (az === bz) or along z (ax === bx).
    const alongX = Math.abs(bz - az) < 1e-6
    const t = 0.1
    const span = (y0: number, y1: number, col: string) =>
      alongX ? lit.span(ax, y0, az - (az < 0 ? t : 0), bx, y1, az + (az < 0 ? 0 : t), col) : lit.span(ax - (ax < 0 ? t : 0), y0, az, ax + (ax < 0 ? 0 : t), y1, bz, col)
    span(0, 1.3, C.tileLow)
    span(1.3, 1.38, C.tileTrim)
    span(1.38, h, C.plaster)
    span(0, 0.1, C.tileTrim)
  }
  wallBand(x0, z1, x1, z1) // front (street door, behind the camera)
  wallBand(x1, z0, x1, z1) // right
  wallBand(x0, z0, x0, z1) // left
  // Back wall, with the window cut out of it.
  const thick = 0.1
  const back = (xA: number, xB: number, yA: number, yB: number, col: string) => lit.span(xA, yA, z0 - thick, xB, yB, z0, col)
  const bandsOf = (xA: number, xB: number) => {
    back(xA, xB, 0, 1.3, C.tileLow)
    back(xA, xB, 1.3, 1.38, C.tileTrim)
    back(xA, xB, 1.38, h, C.plaster)
  }
  bandsOf(x0, WINDOW.x0)
  bandsOf(WINDOW.x1, x1)
  back(WINDOW.x0, WINDOW.x1, 0, WINDOW.y0, C.tileLow)
  back(WINDOW.x0, WINDOW.x1, WINDOW.y1, h, C.plaster)
  // Ceiling, slightly stained, with two beams.
  lit.span(x0 - thick, h, z0 - thick, x1 + thick, h + 0.1, z1 + thick, C.ceiling)
  lit.span(x0, h - 0.18, -1.0, x1, h, -0.8, C.plasterDark)
  lit.span(x0, h - 0.18, 0.9, x1, h, 1.1, C.plasterDark)
  lit.span(x0, h - 0.03, z0, x1, h, z0 + 0.08, '#d7cfb2')

  // ----- the window: aluminium sliding frame, two panes, a sill -----
  const fr = '#8d9396'
  const wx0 = WINDOW.x0
  const wx1 = WINDOW.x1
  const midX = (wx0 + wx1) / 2
  const fy = z0 + 0.04
  lit.span(wx0 - 0.04, WINDOW.y0 - 0.04, z0 - 0.08, wx1 + 0.04, WINDOW.y0 + 0.04, fy, fr)
  lit.span(wx0 - 0.04, WINDOW.y1 - 0.04, z0 - 0.08, wx1 + 0.04, WINDOW.y1 + 0.04, fy, fr)
  lit.span(wx0 - 0.04, WINDOW.y0, z0 - 0.08, wx0 + 0.04, WINDOW.y1, fy, fr)
  lit.span(wx1 - 0.04, WINDOW.y0, z0 - 0.08, wx1 + 0.04, WINDOW.y1, fy, fr)
  lit.span(midX - 0.025, WINDOW.y0, z0 - 0.06, midX + 0.025, WINDOW.y1, z0 + 0.02, shadeHex(fr, 0.9))
  lit.span(wx0, 1.62, z0 - 0.06, wx1, 1.66, z0 + 0.02, shadeHex(fr, 0.9))
  lit.span(wx0 - 0.12, WINDOW.y0 - 0.02, z0 - 0.02, wx1 + 0.12, WINDOW.y0 + 0.02, z0 + 0.26, '#bfb8a0') // sill
  lit.span(wx0 + 0.04, WINDOW.y0 + 0.02, z0 - 0.02, wx1 - 0.04, WINDOW.y0 + 0.1, z0 + 0.02, '#3d3a34') // grime along the glass

  // ----- front wall door frame (behind the counter camera) -----
  lit.span(0.1, 0, z1 - 0.12, 1.3, 2.15, z1 - 0.02, '#2d3a38')
  lit.span(0.18, 0.08, z1 - 0.14, 1.22, 2.07, z1 - 0.1, '#4d5d5b')

  // ----- counter -----
  const cz0 = -0.55
  const cz1 = 0.15
  lit.span(-0.9, 0, cz0, 2.6, COUNTER_TOP - 0.05, cz1, C.counterFront)
  lit.span(-0.9, 0, cz1 - 0.02, 2.6, 0.12, cz1 + 0.02, '#4a2a24') // kick
  lit.span(-0.94, COUNTER_TOP - 0.05, cz0 - 0.03, 2.64, COUNTER_TOP, cz1 + 0.07, C.counterTop)
  // Worn, wiped patches and a burn on the top.
  lit.span(0.1, COUNTER_TOP, -0.35, 1.5, COUNTER_TOP + 0.002, 0.05, '#cdbf9f', { skip: ['-y', '+x', '-x', '+z', '-z'] })
  lit.span(1.7, COUNTER_TOP, -0.2, 1.9, COUNTER_TOP + 0.003, 0.0, '#584a38', { skip: ['-y', '+x', '-x', '+z', '-z'] })
  lit.span(-0.6, COUNTER_TOP, -0.1, -0.3, COUNTER_TOP + 0.003, 0.1, '#9f8f70', { skip: ['-y', '+x', '-x', '+z', '-z'] })
  // Panelling on the counter front.
  for (let i = 0; i <= 7; i++) lit.span(-0.7 + i * 0.5 - 0.01, 0.15, cz1 + 0.02, -0.7 + i * 0.5 + 0.01, COUNTER_TOP - 0.1, cz1 + 0.03, '#5d2b24')

  // ----- stools in front of the counter -----
  for (const sx of [-0.3, 1.0, 2.1]) {
    lit.cyl(sx, 0.0, 0.7, 0.03, 0.46, '#3b3b3d', 5)
    lit.cyl(sx, 0.43, 0.7, 0.19, 0.07, '#8b2f2c', 8)
    lit.cyl(sx, 0.0, 0.7, 0.17, 0.02, '#3b3b3d', 8)
  }

  // ----- on the counter: cups on saucers, a tray, kettle burner, register, sundries -----
  const T = COUNTER_TOP
  lit.span(-0.15, T, -0.32, 0.75, T + 0.025, -0.02, C.steel) // tray
  for (let i = 0; i < 5; i++) cup(lit, -0.05 + i * 0.17, T + 0.025, -0.17, i % 2 ? C.cup : '#d7d2c4')
  cup(lit, 0.02, T + 0.025, -0.33, C.cup)
  lit.cyl(0.95, T, -0.12, 0.04, 0.12, '#cfc9b8', 6)
  lit.cyl(0.95, T + 0.12, -0.12, 0.045, 0.01, '#2f2f30', 6)
  // Kettle on a burner at the left end.
  lit.span(-0.85, T, -0.33, -0.3, T + 0.05, -0.0, '#3a3c3e')
  lit.cyl(-0.58, T + 0.05, -0.16, 0.15, 0.3, '#b5babb', 8, 0.11)
  lit.cyl(-0.58, T + 0.35, -0.16, 0.08, 0.04, '#9da2a3', 8, 0.05)
  lit.span(-0.58 - 0.03, T + 0.4, -0.19, -0.58 + 0.03, T + 0.43, -0.13, '#2d2d2d')
  lit.rod([-0.44, T + 0.28, -0.16], [-0.26, T + 0.36, -0.16], 0.022, '#9da2a3', 5, 0.012) // spout
  lit.rod([-0.73, T + 0.12, -0.16], [-0.7, T + 0.34, -0.16], 0.014, '#2d2d2d', 4) // handle post
  // Cash register at the right end.
  lit.span(1.85, T, -0.42, 2.4, T + 0.2, -0.04, '#6b6d66')
  lit.span(1.85, T + 0.2, -0.42, 2.4, T + 0.28, -0.1, '#585a54')
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) lit.span(1.9 + c * 0.075, T + 0.2 + r * 0.007, -0.38 + r * 0.06, 1.95 + c * 0.075, T + 0.215 + r * 0.007, -0.34 + r * 0.06, c % 3 === 0 ? '#a23c34' : '#c8c2ae')
  lit.span(1.9, T + 0.28, -0.42, 2.35, T + 0.46, -0.38, '#3b3d38') // display housing
  glow.span(1.94, T + 0.3, -0.378, 2.3, T + 0.42, -0.372, '#7fae62')
  lit.span(1.88, T, -0.04, 2.37, T + 0.03, 0.12, '#3a3b36') // drawer front
  // Toothpick tin, sugar pot, paper spike, a small menu stand.
  lit.cyl(1.5, T, -0.3, 0.04, 0.09, '#c1a65f', 6)
  lit.cyl(1.35, T, -0.1, 0.05, 0.12, '#d6d2c6', 6)
  lit.rod([1.65, T, -0.1], [1.65, T + 0.18, -0.1], 0.006, '#777', 3)
  lit.span(1.57, T, -0.1, 1.73, T + 0.01, 0.02, '#bdb7a2')
  lit.span(1.0, T, 0.0, 1.3, T + 0.18, 0.04, '#a8362f') // menu stand, red
  lit.span(1.0, T + 0.18, -0.06, 1.3, T + 0.19, 0.05, '#7d2924')
  lit.span(1.04, T + 0.07, 0.04, 1.26, T + 0.15, 0.045, '#e9e0c4')

  // ----- back wall: shelves, tins, bottles, cups; the back counter, the range and the hood -----
  const shelf = (y: number, xa: number, xb: number) => {
    lit.span(xa, y, z0 + 0.0, xb, y + 0.03, z0 + 0.32, C.wood)
    for (let bx = xa + 0.1; bx < xb; bx += 0.8) lit.span(bx, y - 0.12, z0, bx + 0.03, y, z0 + 0.2, C.woodLight)
  }
  shelf(1.5, -1.35, 0.85)
  shelf(1.95, -1.35, 0.85)
  let px = -1.25
  while (px < 0.7) {
    const kind = rng.int(0, 4)
    const sy = 1.53
    if (kind === 0) {
      for (let k = 0; k < rng.int(2, 4); k++) cup(lit, px + k * 0.0, sy + k * 0.045, z0 + 0.15, rng.chance(0.3) ? C.cupBlue : C.cup, 0.05)
      px += 0.18
    } else if (kind === 1) {
      lit.cyl(px + 0.05, sy, z0 + 0.14, 0.05, 0.22, rng.pick(['#4d6a52', '#7a6a3a', '#5b4c3e']), 6)
      px += 0.14
    } else if (kind === 2) {
      lit.span(px, sy, z0 + 0.06, px + 0.14, sy + 0.2, z0 + 0.24, rng.pick(['#b9a15a', '#9b3f35', '#456075', '#c9c3ac']))
      px += 0.2
    } else {
      lit.cyl(px + 0.05, sy, z0 + 0.14, 0.045, 0.3, rng.pick(['#3f5d4a', '#6a4a2e', '#8a8e8a']), 6, 0.025)
      px += 0.13
    }
  }
  px = -1.25
  while (px < 0.7) {
    const kind = rng.int(0, 3)
    const sy = 1.98
    if (kind === 0) {
      lit.span(px, sy, z0 + 0.05, px + 0.22, sy + 0.12, z0 + 0.26, '#d1ccbc')
      px += 0.27
    } else if (kind === 1) {
      lit.cyl(px + 0.06, sy, z0 + 0.14, 0.06, 0.18, '#b8bdbe', 7)
      px += 0.16
    } else {
      lit.span(px, sy, z0 + 0.08, px + 0.16, sy + 0.22, z0 + 0.22, rng.pick(['#a8362f', '#3d5d86', '#c2a24a']))
      px += 0.21
    }
  }
  // Back counter and range.
  lit.span(-1.35, 0, z0 + 0.1, 0.85, 0.9, z0 + 0.65, C.steelDark)
  lit.span(-1.35, 0.9, z0 + 0.08, 0.85, 0.94, z0 + 0.68, C.steel)
  lit.span(-1.3, 0.94, z0 + 0.15, -0.9, 1.15, z0 + 0.5, '#bfc4c5') // urn
  lit.cyl(-0.35, 0.94, z0 + 0.4, 0.17, 0.4, '#a9afb0', 8, 0.15) // stocking pot
  glow.span(-0.5, 1.1, z0 + 0.4 + 0.17, -0.2, 1.14, z0 + 0.4 + 0.19, '#6a4a2a')
  lit.rod([-0.35, 1.34, z0 + 0.4], [-0.35, 1.62, z0 + 0.4], 0.01, '#6a4a2a', 3)
  lit.span(0.2, 0.94, z0 + 0.2, 0.7, 1.05, z0 + 0.5, '#8f9496') // toaster / press
  lit.span(1.0, 0, z0 + 0.1, 3.2, 0.92, z0 + 0.75, C.steel)
  lit.span(1.0, 0.92, z0 + 0.1, 3.2, 0.97, z0 + 0.75, C.steelDark)
  for (const bx of [1.45, 2.1, 2.75]) {
    lit.cyl(bx, 0.97, z0 + 0.42, 0.2, 0.05, '#2a2b2c', 8)
    lit.cyl(bx, 1.02, z0 + 0.42, 0.18, 0.28, '#9ea4a6', 8, 0.17)
  }
  lit.span(1.0, 1.95, z0 + 0.0, 3.3, 2.5, z0 + 0.75, '#8a9092') // hood
  lit.span(1.0, 1.9, z0 + 0.0, 3.3, 1.95, z0 + 0.8, '#6e7476')
  lit.span(1.7, 2.5, z0 + 0.1, 2.5, h, z0 + 0.5, '#6e7476')
  // Pots and ladles on a rail.
  for (const hx of [1.2, 1.5, 1.8]) {
    lit.rod([hx, 1.9, z0 + 0.05], [hx, 1.55, z0 + 0.05], 0.012, '#7a7f80', 3)
    lit.cyl(hx, 1.4, z0 + 0.05, 0.07, 0.15, '#9ea4a6', 6, 0.08)
  }

  // ----- right wall furnishings and fixtures -----
  lit.span(x1 - 0.06, 0.2, -2.2, x1, 1.1, -1.2, '#c9c4b2') // fridge, behind the range side
  lit.span(x1 - 0.09, 0.2, -2.2, x1 - 0.06, 0.21, -1.2, '#7c7d74')
  lit.span(x1 - 0.28, 0, -0.5, x1, 1.15, 0.7, '#9c9f98') // chest freezer
  lit.span(x1 - 0.3, 1.15, -0.52, x1 + 0.0, 1.2, 0.72, '#6f736d')
  glow.span(x1 - 0.285, 0.95, -0.2, x1 - 0.27, 1.0, 0.4, '#b44a3a') // pilot light
  lit.span(x1 - 0.05, 1.7, -0.35, x1, 2.5, 0.35, '#cfc8ac') // calendar
  lit.span(x1 - 0.06, 1.72, -0.3, x1 - 0.05, 2.45, 0.3, '#a8362f')
  // Fire extinguisher by the door.
  lit.cyl(x1 - 0.12, 0.2, 1.6, 0.06, 0.4, '#a2342c', 6)

  // ----- ceiling fixtures: two warm fluorescent tubes and two hanging shades -----
  for (const tx of [-0.4, 1.9]) {
    lit.span(tx - 0.62, h - 0.06, -1.6, tx + 0.62, h - 0.01, -1.4, '#8e8a78')
    glow.span(tx - 0.55, h - 0.075, -1.57, tx + 0.55, h - 0.06, -1.43, '#fff0c8')
  }
  for (const tx of [0.3, 1.7]) {
    lit.rod([tx, h, -0.45], [tx, h - 0.35, -0.45], 0.008, '#222', 3)
    lit.cyl(tx, h - 0.55, -0.45, 0.2, 0.2, '#6b3a2a', 8, 0.05)
    glow.cyl(tx, h - 0.52, -0.45, 0.04, 0.05, '#ffd89a', 5)
  }

  // ----- the window table and its chairs -----
  const t = TABLE
  lit.span(t.x - 0.5, t.top - 0.04, t.z - 0.45, t.x + 0.5, t.top, t.z + 0.45, '#c6b894')
  lit.span(t.x - 0.51, t.top - 0.06, t.z - 0.46, t.x + 0.51, t.top - 0.04, t.z + 0.46, '#2f2b26')
  for (const [lx, lz] of [[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]] as const) lit.span(t.x + lx - 0.025, 0, t.z + lz - 0.025, t.x + lx + 0.025, t.top - 0.06, t.z + lz + 0.025, '#33302b')
  // Burn marks, a ring stain and a wiped band.
  for (const [bx, bz, s] of [[0.32, 0.28, 0.05], [-0.38, -0.1, 0.035], [0.1, -0.3, 0.04]] as const) lit.span(t.x + bx, t.top, t.z + bz, t.x + bx + s, t.top + 0.002, t.z + bz + s, '#4b3a2a', { skip: ['-y', '+x', '-x', '+z', '-z'] })
  lit.span(t.x - 0.1, t.top, t.z - 0.1, t.x + 0.35, t.top + 0.002, t.z + 0.4, '#d2c6a4', { skip: ['-y', '+x', '-x', '+z', '-z'] })
  chair(lit, t.x, t.z + 1.1, 'back')
  chair(lit, -3.05, t.z, 'left')

  // ----- the tea and the noodles (the table scene) -----
  // The camera sits at the near edge of the table looking toward the window (-z), so its right is +x.
  const cupX = t.x + 0.3
  const cupZ = t.z + 0.22
  lit.cyl(cupX, t.top, cupZ, 0.085, 0.012, '#dcd6c6', 9)
  lit.cyl(cupX, t.top + 0.012, cupZ, 0.055, 0.08, '#e6e0d2', 9, 0.07)
  lit.span(cupX + 0.055, t.top + 0.025, cupZ - 0.012, cupX + 0.095, t.top + 0.06, cupZ + 0.012, '#e6e0d2') // handle
  glow.cyl(cupX, t.top + 0.088, cupZ, 0.062, 0.002, '#a87b4c', 9) // the tea
  lit.rod([cupX - 0.1, t.top + 0.015, cupZ + 0.06], [cupX - 0.03, t.top + 0.1, cupZ + 0.0], 0.005, '#c4c8c8', 3) // spoon
  // Bowl of noodles, left of centre.
  const bx = t.x - 0.2
  const bz = t.z + 0.08
  lit.cyl(bx, t.top, bz, 0.07, 0.02, '#d7d2c4', 8)
  lit.cyl(bx, t.top + 0.02, bz, 0.11, 0.09, '#e1dccd', 10, 0.17)
  lit.cyl(bx, t.top + 0.07, bz, 0.172, 0.014, '#35577d', 10) // blue rim band
  glow.cyl(bx, t.top + 0.1, bz, 0.155, 0.004, '#a77c3e', 10) // broth
  lit.blob(bx, t.top + 0.11, bz, 0.12, 0.04, 0.12, '#d9b457', 0.1, 3) // noodles
  lit.blob(bx + 0.03, t.top + 0.125, bz - 0.03, 0.07, 0.03, 0.07, '#e0bf62', 0.1, 4)
  lit.span(bx - 0.09, t.top + 0.13, bz + 0.02, bx - 0.02, t.top + 0.145, bz + 0.1, '#c97a6b') // luncheon meat
  lit.cyl(bx + 0.04, t.top + 0.13, bz + 0.06, 0.03, 0.012, '#eae2c6', 7) // egg white
  lit.cyl(bx + 0.04, t.top + 0.142, bz + 0.06, 0.012, 0.01, '#d9992f', 5) // yolk
  for (let i = 0; i < 4; i++) lit.span(bx + 0.02 - i * 0.012, t.top + 0.13, bz - 0.08 + i * 0.01, bx + 0.035 - i * 0.012, t.top + 0.138, bz - 0.06 + i * 0.01, '#5a8a4a') // spring onion
  // Chopsticks laid on the table in front of the bowl, and a chopstick tube.
  lit.rod([t.x - 0.36, t.top + 0.006, t.z + 0.34], [t.x - 0.08, t.top + 0.006, t.z + 0.34], 0.004, '#8a6a42', 4)
  lit.rod([t.x - 0.36, t.top + 0.006, t.z + 0.37], [t.x - 0.08, t.top + 0.006, t.z + 0.37], 0.004, '#8a6a42', 4)
  lit.cyl(t.x + 0.42, t.top, t.z - 0.3, 0.04, 0.12, '#c9c3b0', 6)
  for (const [dx, dz] of [[-0.01, -0.01], [0.012, 0.0], [0, 0.015]] as const) lit.rod([t.x + 0.42 + dx, t.top + 0.1, t.z - 0.3 + dz], [t.x + 0.42 + dx * 2, t.top + 0.2, t.z - 0.3 + dz * 2], 0.004, '#8a6a42', 4)
  // Condiments and a napkin dispenser against the window.
  lit.cyl(t.x - 0.1, t.top, t.z - 0.38, 0.025, 0.1, '#3a3028', 6)
  lit.cyl(t.x - 0.02, t.top, t.z - 0.38, 0.022, 0.09, '#a9a38c', 6)
  lit.span(t.x - 0.4, t.top, t.z - 0.4, t.x - 0.3, t.top + 0.1, t.z - 0.3, '#b6b09a') // napkin dispenser
  // A paper placemat under the noodles.
  lit.span(bx - 0.22, t.top, bz - 0.22, bx + 0.26, t.top + 0.002, bz + 0.2, '#d8d0b4', { skip: ['-y', '+x', '-x', '+z', '-z'] })

  // ----- the lane outside -----
  buildLane(out, rng)

  return { lit, glow, out }
}

function cup(g: Geo, x: number, y: number, z: number, color: string, r = 0.045) {
  g.cyl(x, y, z, r * 1.7, 0.006, '#d9d3c4', 7)
  g.cyl(x, y + 0.006, z, r, r * 1.5, color, 7, r * 1.2)
  g.span(x + r * 0.9, y + 0.025, z - 0.006, x + r * 1.6, y + 0.04, z + 0.006, color)
}

function chair(g: Geo, x: number, z: number, backSide: 'left' | 'back') {
  g.span(x - 0.2, 0.43, z - 0.2, x + 0.2, 0.48, z + 0.2, '#6b2f28')
  for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) g.span(x + lx - 0.015, 0, z + lz - 0.015, x + lx + 0.015, 0.43, z + lz + 0.015, '#3b3b3d')
  if (backSide === 'left') {
    g.span(x - 0.205, 0.48, z - 0.2, x - 0.175, 0.9, z + 0.2, '#6b2f28')
    g.span(x - 0.21, 0.8, z - 0.2, x - 0.17, 0.84, z + 0.2, '#3b3b3d')
  } else {
    g.span(x - 0.2, 0.48, z + 0.175, x + 0.2, 0.9, z + 0.205, '#6b2f28')
    g.span(x - 0.2, 0.8, z + 0.17, x + 0.2, 0.84, z + 0.21, '#3b3b3d')
  }
}

/** The pavement, the lane, a lamp and the building opposite, all in pre-dawn blues and a little sodium orange. */
function buildLane(g: Geo, rng: Rng) {
  const lamp = LAMP
  const lampLight = (x: number, z: number): number => {
    const d = Math.hypot(x - lamp.x, z - lamp.z)
    return 1 + 1.6 * Math.max(0, 1 - d / 7) ** 1.5
  }
  const tint = (hex: string, x: number, z: number, k = 1): string => {
    const f = lampLight(x, z) * k
    const warm = (f - 1) / 1.6
    return shadeHex(mixHex(hex, '#d9a35d', warm * 0.5), f * 0.9)
  }
  // Ground in 1 m quads, lit by the lamp. Pavement then road then pavement.
  const strips: [number, number, string][] = [
    [-4.7, -3.6, '#4d4f54'],
    [-8.6, -4.7, '#33363d'],
    [-9.5, -8.6, '#4b4d52'],
  ]
  for (const [xa, xb, col] of strips) {
    for (let z = -20; z < 20; z += 1) {
      const c = (x: number, zz: number) => tint(col, x, zz)
      g.quad([xb, 0, z + 1], [xa, 0, z + 1], [xa, 0, z], [xb, 0, z], col, [c(xb, z + 1), c(xa, z + 1), c(xa, z), c(xb, z)])
    }
  }
  // Kerb.
  g.span(-4.78, 0, -20, -4.7, 0.14, 20, '#6c6e72')
  g.span(-8.62, 0, -20, -8.54, 0.14, 20, '#6c6e72')
  // Streetlamp: pole, arm and head.
  g.rod([lamp.x, 0, lamp.z], [lamp.x, lamp.y, lamp.z], 0.07, '#2f3235', 6)
  g.rod([lamp.x, lamp.y, lamp.z], [lamp.x - 0.9, lamp.y + 0.2, lamp.z], 0.045, '#2f3235', 5)
  g.span(lamp.x - 1.35, lamp.y + 0.1, lamp.z - 0.12, lamp.x - 0.8, lamp.y + 0.22, lamp.z + 0.12, '#40454a')
  g.span(lamp.x - 1.3, lamp.y + 0.06, lamp.z - 0.1, lamp.x - 0.85, lamp.y + 0.1, lamp.z + 0.1, '#ffc980')

  // The building opposite: a dark facade with shutters, windows, air-con boxes and pipes.
  const fx = -9.5
  const floors = 5
  const bayW = 3.0
  for (let bay = -5; bay < 5; bay++) {
    const bz = bay * bayW
    const tone = rng.pick(['#4b525c', '#54545a', '#46505a', '#5b5a58'])
    g.span(fx - 0.5, 0, bz, fx, floors * 3.2 + 1, bz + bayW, tone)
    // Ground shopfront: shutter or lit shop.
    if (rng.chance(0.28)) {
      g.span(fx, 0.15, bz + 0.3, fx + 0.04, 2.6, bz + bayW - 0.3, '#d9b46f')
      g.span(fx + 0.02, 1.0, bz + 0.6, fx + 0.06, 1.9, bz + bayW - 0.9, '#f0d594')
      g.span(fx + 0.0, 2.7, bz + 0.3, fx + 0.08, 3.3, bz + bayW - 0.3, '#8f3a33')
    } else {
      g.span(fx, 0.0, bz + 0.2, fx + 0.05, 2.7, bz + bayW - 0.2, '#575d62')
      for (let r = 0; r < 14; r++) g.span(fx + 0.04, 0.1 + r * 0.19, bz + 0.2, fx + 0.07, 0.15 + r * 0.19, bz + bayW - 0.2, '#454a4e')
    }
    for (let f = 1; f <= floors; f++) {
      const y = f * 3.2 + 0.4
      const wz = bz + 0.5 + rng.float() * 0.4
      const on = rng.chance(0.2)
      const blue = on && rng.chance(0.3)
      g.span(fx, y - 0.1, wz - 0.06, fx + 0.06, y + 1.5, wz + 1.7, '#2c3036')
      g.span(fx + 0.03, y, wz, fx + 0.1, y + 1.4, wz + 1.6, on ? (blue ? '#7fa2c0' : '#e6b868') : '#1b2129')
      if (rng.chance(0.4)) g.span(fx + 0.0, y + 0.1, wz + 1.75, fx + 0.5, y + 0.6, wz + 2.5, '#767b7e') // air-con
      if (rng.chance(0.25)) g.span(fx + 0.03, y - 0.1, wz + 0.2, fx + 0.5, y - 0.05, wz + 1.4, '#3a3d40') // balcony slab
    }
    if (rng.chance(0.6)) g.rod([fx + 0.12, 0, bz + 0.1], [fx + 0.12, floors * 3.2 + 1, bz + 0.1], 0.04, '#3d4144', 5)
  }
  // A scooter and a row of bins on the far kerb.
  g.span(-8.2, 0.2, 3.0, -7.4, 0.9, 3.25, '#3d4a52')
  g.span(-8.1, 0.0, 3.05, -7.5, 0.2, 3.2, '#222')
  for (let i = 0; i < 3; i++) g.span(-8.2, 0, -4 - i * 0.7, -7.7, 0.9, -3.6 - i * 0.7, '#355540')
  // A closed-up stall on the near pavement.
  g.span(-4.4, 0, 5.0, -3.9, 0.9, 6.6, '#5f564a')
  g.span(-4.4, 0.9, 5.0, -3.8, 1.0, 6.7, '#7a5a3a')
}

/** A small hatchback for the lane: unlit body, dark glass, lit lamps. Faces -z. */
export function buildCar(): Geo {
  const g = new Geo()
  g.span(-0.9, 0.25, -2.2, 0.9, 0.95, 2.2, '#566a62')
  g.span(-0.8, 0.95, -0.9, 0.8, 1.45, 1.6, '#4c6058')
  g.span(-0.82, 1.0, -0.85, 0.82, 1.4, -0.84, '#1b222a')
  g.span(-0.7, 1.0, -0.9, 0.7, 1.4, -0.88, '#1b222a')
  g.span(-0.95, 0.25, -2.05, -0.8, 0.5, -1.4, '#222')
  g.span(0.8, 0.25, -2.05, 0.95, 0.5, -1.4, '#222')
  g.span(-0.95, 0.25, 1.3, -0.8, 0.5, 1.9, '#222')
  g.span(0.8, 0.25, 1.3, 0.95, 0.5, 1.9, '#222')
  g.span(-0.7, 0.55, -2.22, -0.3, 0.7, -2.2, '#fff0c0')
  g.span(0.3, 0.55, -2.22, 0.7, 0.7, -2.2, '#fff0c0')
  g.span(-0.7, 0.6, 2.2, -0.45, 0.7, 2.22, '#b42d26')
  g.span(0.45, 0.6, 2.2, 0.7, 0.7, 2.22, '#b42d26')
  return g
}

/** `hex` darkened or brightened by `k`, as a hex string. */
export function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function mixHex(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16)
  const nb = parseInt(b.slice(1), 16)
  const m = (s: number) => Math.round(((na >> s) & 255) * (1 - t) + ((nb >> s) & 255) * t)
  return '#' + [m(16), m(8), m(0)].map((v) => v.toString(16).padStart(2, '0')).join('')
}
