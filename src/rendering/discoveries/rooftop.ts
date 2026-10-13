import { Geo } from '../geo/Geo.ts'

/*
 * A small rooftop, in its own frame: the access door is at z = +4, and the view
 * looks toward -z, out over the parapet. Compact on purpose. The neighbouring
 * blocks and the skyline are silhouettes, not the real district, so standing up
 * here never gives the station away.
 */

export const ROOF = { x0: -6, x1: 6, z0: -5, z1: 4.5 } as const

export interface RoofParts {
  /** Lit surfaces: concrete, tanks, pipes, the door. */
  solid: Geo
  /** Unlit: the dark glass of the door, a couple of small lights. */
  glow: Geo
  /** The surrounding blocks, pre-shaded, so they need no lights of their own. */
  city: Geo
}

const CONCRETE = '#8d8a82'
const CONCRETE_DARK = '#6e6b64'
const PARAPET = '#7a776f'
const TANK = '#5d6a62'
const STEEL = '#6a6e72'
const RUST = '#7a5a42'

export function buildRoof(): RoofParts {
  const solid = new Geo()
  const glow = new Geo()
  const city = new Geo()
  const { x0, x1, z0, z1 } = ROOF

  // The slab, stained and patched.
  solid.span(x0 - 0.3, -0.25, z0 - 0.3, x1 + 0.3, 0, z1 + 0.3, CONCRETE_DARK)
  const tile = 1.5
  for (let x = x0; x < x1 - 0.01; x += tile) {
    for (let z = z0; z < z1 - 0.01; z += tile) {
      const shade = ((Math.round(x / tile) + Math.round(z / tile)) % 2 === 0 ? 0.92 : 1) * (0.9 + ((x * 3 + z * 7) % 5) * 0.02)
      solid.span(x, 0, z, Math.min(x + tile - 0.02, x1), 0.02, Math.min(z + tile - 0.02, z1), tint(CONCRETE, shade))
    }
  }
  // A puddle, and a patched repair.
  solid.span(-1.2, 0.02, -2.4, 0.4, 0.025, -1.2, '#5e646c')
  solid.span(2.4, 0.02, 0.6, 4.2, 0.03, 2.2, '#9a968c')

  // Parapet walls, low, with a coping.
  const parapet = (xa: number, za: number, xb: number, zb: number) => {
    solid.span(xa, 0, za, xb, 0.85, zb, PARAPET, { grime: 0.78 })
    solid.span(xa - 0.02, 0.85, za - 0.02, xb + 0.02, 0.95, zb + 0.02, CONCRETE_DARK)
  }
  parapet(x0 - 0.15, z0 - 0.15, x0, z1 + 0.15)
  parapet(x1, z0 - 0.15, x1 + 0.15, z1 + 0.15)
  parapet(x0, z0 - 0.15, x1, z0)
  parapet(x0, z1, -1.2, z1 + 0.15)
  parapet(1.2, z1, x1, z1 + 0.15)

  // The stair head: a low housing with a steel door, behind where the player stands.
  solid.span(-1.3, 0, 2.6, 1.3, 2.5, z1 + 0.1, '#5a5e62', { grime: 0.7 })
  solid.span(-0.55, 0, 2.55, 0.55, 2.05, 2.62, '#3e4348')
  solid.span(-0.45, 0.05, 2.5, 0.45, 1.95, 2.57, '#4e545a')
  solid.span(0.28, 0.95, 2.48, 0.38, 1.05, 2.5, STEEL) // handle
  glow.span(-0.18, 1.35, 2.49, 0.18, 1.6, 2.5, '#1c242c') // a dark wired-glass panel
  solid.span(-0.25, 2.15, 2.5, 0.25, 2.35, 2.6, '#2e3236') // a lamp housing, unlit
  // A short run of steps down to the slab, so the door sits a little above it.
  solid.span(-0.8, 0, 1.9, 0.8, 0.16, 2.6, CONCRETE_DARK)
  solid.span(-0.8, 0.16, 2.15, 0.8, 0.32, 2.6, '#7a776f')

  // Water tanks on a steel frame, toward the back corner.
  solid.span(-5.2, 0, -4.2, -2.6, 0.7, -2.2, STEEL)
  for (const [tx, tz] of [[-4.6, -3.6], [-3.4, -3.2]] as const) {
    solid.cyl(tx, 0.7, tz, 0.75, 1.5, TANK, 8)
    solid.cyl(tx, 2.2, tz, 0.78, 0.08, '#3e4a44', 8)
    solid.rod([tx, 2.28, tz], [tx, 2.7, tz], 0.04, STEEL, 4)
  }
  // A pipe run from the tanks along the parapet and down.
  solid.rod([-3.4, 1.2, -3.2], [-3.4, 1.2, 1.5], 0.06, RUST, 5)
  solid.rod([-3.4, 1.2, 1.5], [-5.6, 1.2, 1.5], 0.06, RUST, 5)
  solid.rod([-5.6, 1.2, 1.5], [-5.6, 0, 1.5], 0.06, RUST, 5)
  solid.cyl(-3.4, 0.4, -1.0, 0.1, 0.8, RUST, 6) // a support

  // An antenna mast and a small dish.
  solid.rod([4.6, 0, -3.6], [4.6, 4.2, -3.6], 0.035, STEEL, 4)
  solid.rod([4.2, 3.4, -3.6], [5.0, 3.4, -3.6], 0.015, STEEL, 3)
  solid.rod([4.3, 2.8, -3.6], [4.9, 2.8, -3.6], 0.015, STEEL, 3)
  solid.at(3.6, 1.65, -3.4, 0.6, () => solid.span(-0.32, 0, -0.32, 0.32, 0.05, 0.32, '#4a4e52'))
  solid.rod([3.6, 0, -3.4], [3.6, 1.6, -3.4], 0.03, STEEL, 4)

  // A plastic chair and a small table, and a crate used as a table.
  const chair = (x: number, z: number, yaw: number) => {
    solid.at(x, 0, z, yaw, () => {
      solid.span(-0.22, 0.4, -0.22, 0.22, 0.45, 0.22, '#b9b4a4')
      solid.span(-0.22, 0.45, 0.16, 0.22, 0.85, 0.22, '#b9b4a4')
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) solid.span(lx - 0.02, 0, lz - 0.02, lx + 0.02, 0.4, lz + 0.02, '#8a8678')
    })
  }
  chair(1.6, 0.4, 0.4)
  solid.span(2.3, 0, -0.6, 3.1, 0.55, 0.2, '#6a5538') // crate
  solid.cyl(2.7, 0.55, -0.2, 0.045, 0.09, '#d8d2c0', 6) // a cup left out

  // Pots: a few, not a garden.
  const pot = (x: number, z: number, h: number) => {
    solid.cyl(x, 0, z, 0.16, 0.18, '#8a4a3a', 6, 0.13)
    solid.cyl(x, 0.18, z, 0.13, 0.04, '#4a3a2a', 6)
    solid.blob(x, 0.22 + h * 0.4, z, 0.16, h * 0.5, 0.16, '#3e5a40', 0.2, x + z)
  }
  pot(-2.4, 1.6, 0.5)
  pot(-1.9, 1.9, 0.3)
  pot(4.4, 2.6, 0.55)
  pot(-4.6, 2.2, 0.35)

  // A clothes horse, empty but for one shirt.
  solid.rod([-4.2, 0, 0.6], [-4.2, 1.2, 0.6], 0.015, STEEL, 3)
  solid.rod([-2.8, 0, 0.6], [-2.8, 1.2, 0.6], 0.015, STEEL, 3)
  solid.rod([-4.2, 1.2, 0.6], [-2.8, 1.2, 0.6], 0.015, STEEL, 3)
  solid.span(-3.9, 0.7, 0.58, -3.5, 1.15, 0.66, '#c8c2b0')

  // An air-con unit and its drip tray, humming away.
  solid.span(5.2, 0, -1.2, 5.9, 0.6, -0.3, '#c8c4b4')
  solid.span(5.15, 0.6, -1.25, 5.95, 0.66, -0.25, '#8a8678')
  glow.span(5.3, 0.3, -0.28, 5.8, 0.5, -0.26, '#2a2e2a')

  buildCity(city)
  return { solid, glow, city }
}

/** Darkens or lightens a hex colour. */
function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')
  return '#' + c((n >> 16) & 255) + c((n >> 8) & 255) + c(n & 255)
}

/**
 * Neighbouring blocks and a low skyline, all in pre-dawn blues with a few warm
 * windows. Spread wide and kept generic, so no street or landmark is readable.
 */
function buildCity(g: Geo) {
  const block = (x: number, near: number, w: number, d: number, h: number, lit: number) => {
    const z = near - 16
    g.span(x, -24, z, x + w, h, z + d, tint('#4a5260', 0.62 + (h % 5) * 0.05))
    const face = z + d
    for (let f = -7; f * 3 < h - 3; f++) {
      for (let i = 0; i < Math.floor(w / 2.5); i++) {
        if (((f + 8) * 7 + i * 3) % 16 >= lit) continue
        const wx = x + 0.6 + i * 2.5
        const wy = f * 3 + 0.8
        g.span(wx, wy, face, wx + 0.9, wy + 1.3, face + 0.05, (f + i) % 4 === 0 ? '#687c90' : '#a8804c')
      }
    }
  }
  // The near neighbours, close enough to frame the view.
  block(-16, -14, 8, 7, 14, 3)
  block(-6, -18, 10, 8, 23, 4)
  block(6, -15, 9, 6, 11, 2)
  block(17, -20, 12, 9, 31, 4)
  block(-20, -30, 14, 10, 27, 3)
  block(2, -34, 16, 11, 19, 3)
  block(22, -36, 11, 9, 38, 5)
  block(-14, -44, 18, 12, 34, 4)
  // Far silhouettes, barely more than tones.
  for (const [x, h, w] of [[-40, 46, 14], [-22, 58, 16], [-4, 42, 12], [14, 66, 18], [36, 50, 15], [54, 40, 13]] as const) {
    g.span(x * 1.6, -24, -100, x * 1.6 + w, h, -88, tint('#2c3440', 0.85 + h / 400))
  }
}
