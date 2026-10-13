import type { Discovery } from '../../world/discoveries.ts'
import { Geo } from '../geo/Geo.ts'
import { Sink } from '../geo/layers.ts'

/*
 * The five discoveries as they stand in the street, drawn in each object's own
 * frame: local +z is its front (facing out into the street), +x is to the
 * viewer's right, y is up. Flat-shaded, vertex-coloured, and baked into the
 * same chunked layers as every other prop.
 */

const STEEL = '#7a7f83'
const STEEL_DARK = '#4c5156'
const PAINT = '#5d6a5e'
const PAINT_DARK = '#3d4a42'
const GLASS = '#1c242e'
const CREAM = '#cfc6a8'
const RED = '#8c3d36'
const AMBER = '#e8b86a'
const BLUE = '#3a5674'

/** The old utility box the stray cat sits on. The cat itself is drawn live by `Cat.tsx`. */
function catBox(s: Sink) {
  const g = s.solid
  const e = s.emissive
  // The box it sits on: a faded green electrical cabinet, low enough to step past.
  g.span(-0.4, 0, -0.02, 0.4, 0.5, 0.24, PAINT, { grime: 0.72 })
  g.span(-0.4, 0.46, -0.02, 0.4, 0.5, 0.26, PAINT_DARK)
  g.span(-0.3, 0.2, 0.24, 0.3, 0.42, 0.26, STEEL_DARK) // door seam
  e.span(0.22, 0.34, 0.25, 0.28, 0.38, 0.27, '#6a2a26') // a tiny indicator
}

/** An old painted-metal drinks machine, faded and a little dented. */
function vending(s: Sink) {
  const g = s.solid
  const e = s.emissive
  // Body.
  g.span(-0.46, 0, -0.36, 0.46, 1.75, 0.36, PAINT, { grime: 0.7 })
  g.span(-0.48, 0, -0.38, 0.48, 0.08, 0.38, STEEL_DARK) // kick plate
  g.span(-0.48, 1.7, -0.38, 0.48, 1.86, 0.38, PAINT_DARK) // top cap
  // Display window, dark glass with faded cans behind it.
  g.span(-0.32, 0.85, 0.34, 0.24, 1.55, 0.38, STEEL_DARK)
  g.span(-0.26, 0.9, 0.37, 0.26, 1.5, 0.39, GLASS)
  const cans = ['#a85a3a', '#c9b24a', '#d8d2c0', '#8a3a34', '#c9b24a', '#d8d2c0']
  cans.forEach((c, i) => g.cyl(-0.18 + (i % 3) * 0.16, 0.95 + Math.floor(i / 3) * 0.26, 0.41, 0.05, 0.16, c, 6))
  // Selection buttons, three of them, two lit.
  for (let i = 0; i < 3; i++) {
    g.span(0.32, 1.0 + i * 0.14, 0.34, 0.4, 1.08 + i * 0.14, 0.4, STEEL_DARK)
    e.span(0.33, 1.015 + i * 0.14, 0.39, 0.39, 1.065 + i * 0.14, 0.41, i === 1 ? '#4a4a4c' : AMBER)
  }
  // The dispensing flap.
  g.span(-0.26, 0.3, 0.34, 0.26, 0.62, 0.42, STEEL)
  g.span(-0.22, 0.34, 0.4, 0.22, 0.56, 0.44, '#2a2e32')
  // Coin slot and return, worn.
  g.span(0.22, 0.72, 0.34, 0.34, 0.86, 0.4, STEEL_DARK)
  g.span(0.24, 0.62, 0.34, 0.32, 0.7, 0.4, STEEL)
  // Faded lettering band.
  g.span(-0.3, 1.58, 0.34, 0.3, 1.68, 0.36, RED)
  // A dent in the side.
  g.span(0.42, 0.9, -0.1, 0.44, 1.1, 0.1, '#4f5a54')
}

/** A wall-mounted payphone under a small weathered hood. */
function phone(s: Sink) {
  const g = s.solid
  const e = s.emissive
  // The hood and its back board.
  g.span(-0.38, 1.15, -0.26, 0.38, 1.22, 0.3, STEEL_DARK)
  g.span(-0.38, 0.9, -0.28, 0.38, 2.05, -0.2, '#5a6066')
  g.span(-0.4, 2.0, -0.28, 0.4, 2.08, 0.34, STEEL_DARK) // roof
  g.span(-0.4, 0.9, -0.06, -0.34, 2.05, 0.34, STEEL_DARK)
  g.span(0.34, 0.9, -0.06, 0.4, 2.05, 0.34, STEEL_DARK)
  // The body of the phone.
  g.span(-0.16, 1.15, -0.2, 0.16, 1.85, 0.02, '#6a7074', { grime: 0.75 })
  // Handset on its cradle.
  g.rod([-0.1, 1.72, 0.02], [0.1, 1.72, 0.02], 0.035, '#2c3034', 6)
  g.cyl(-0.1, 1.68, 0.02, 0.045, 0.08, '#2c3034', 6)
  g.cyl(0.1, 1.68, 0.02, 0.045, 0.08, '#2c3034', 6)
  // The coiled cord, drooping.
  g.rod([0.1, 1.7, 0.02], [0.14, 1.45, 0.08], 0.012, '#1c1e20', 4)
  g.rod([0.14, 1.45, 0.08], [0.02, 1.4, 0.1], 0.012, '#1c1e20', 4)
  g.rod([0.02, 1.4, 0.1], [-0.06, 1.55, 0.02], 0.012, '#1c1e20', 4)
  // Keypad and a faded instruction card.
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.span(-0.07 + c * 0.05, 1.28 + r * 0.06, 0.0, -0.04 + c * 0.05, 1.31 + r * 0.06, 0.03, CREAM)
  g.span(-0.12, 1.18, 0.0, 0.12, 1.26, 0.02, '#8a8474')
  // A coin slot that still glows faintly.
  e.span(0.06, 1.6, 0.0, 0.1, 1.66, 0.03, AMBER)
  // The shelf under the phone.
  g.span(-0.3, 1.05, -0.2, 0.3, 1.1, 0.22, STEEL)
}

/** A plain steel door in the wall: the way up to the roof. */
function stairwellDoor(s: Sink) {
  const g = s.solid
  // The door leaf, set just proud of the wall, with a small step in front.
  g.span(-0.5, 0.02, -0.06, 0.5, 2.1, 0.04, '#4a4e52', { grime: 0.65 })
  g.span(-0.54, 0, -0.08, 0.54, 2.16, -0.04, '#2e3236') // frame
  g.span(-0.5, 0, -0.1, 0.5, 0.08, 0.16, '#6a6860') // step
  // Kick plate, handle, a small unlit lamp above, and a faded plate.
  g.span(-0.46, 0.08, 0.03, 0.46, 0.3, 0.05, STEEL)
  g.span(0.3, 0.95, 0.03, 0.42, 1.05, 0.09, STEEL_DARK)
  g.span(-0.12, 1.7, 0.03, 0.12, 1.9, 0.05, '#3a3e42')
  g.span(-0.16, 2.16, -0.06, 0.16, 2.3, 0.08, STEEL_DARK)
  g.span(-0.1, 2.18, 0.06, 0.1, 2.26, 0.1, '#2a2e32')
}

/** An arcade cabinet standing in a shallow shopfront recess. */
function arcade(s: Sink) {
  const g = s.solid
  const e = s.emissive
  // The recess it stands in, so it reads as inside a shop rather than on the pavement.
  g.span(-1.1, 0, -1.6, 1.1, 2.6, -0.5, '#3a3c40', { grime: 0.6 })
  g.span(-1.1, 2.55, -1.6, 1.1, 2.7, 0.5, '#2e3034')
  g.span(-1.1, 0, -1.6, -0.95, 2.6, 0.5, '#2e3034')
  g.span(0.95, 0, -1.6, 1.1, 2.6, 0.5, '#2e3034')
  // A half-raised shutter across the front.
  g.span(-1.05, 1.9, 0.42, 1.05, 2.6, 0.5, '#6a5538')
  for (let i = 0; i < 4; i++) g.span(-1.05, 1.95 + i * 0.16, 0.49, 1.05, 2.0 + i * 0.16, 0.52, '#57462e')
  // A fluorescent tube inside.
  e.span(-0.6, 2.5, -1.0, 0.6, 2.54, -0.9, '#e6d8b0')

  // The cabinet.
  g.span(-0.4, 0, -0.42, 0.4, 1.55, 0.42, '#2a3a4e', { grime: 0.8 })
  g.span(-0.42, 1.5, -0.2, 0.42, 1.95, 0.46, '#243246') // marquee housing
  // The marquee is still lit, a little faded.
  e.span(-0.34, 1.58, 0.44, 0.34, 1.86, 0.48, '#a85e36')
  e.span(-0.3, 1.68, 0.475, 0.3, 1.76, 0.49, '#d8c49a')
  // Screen bezel and the attract screen, glowing in the dark recess.
  g.span(-0.32, 0.95, 0.3, 0.32, 1.45, 0.46, '#16181c')
  e.span(-0.26, 1.0, 0.44, 0.26, 1.4, 0.47, '#1f4a46')
  e.span(-0.2, 1.3, 0.465, 0.2, 1.34, 0.48, '#9fd0b4') // title bar
  e.span(-0.04, 1.06, 0.465, 0.04, 1.11, 0.48, '#d8c49a') // the little runner
  e.span(-0.18, 1.2, 0.465, -0.06, 1.23, 0.48, '#6a9a86')
  e.span(0.06, 1.15, 0.465, 0.2, 1.18, 0.48, '#6a9a86')
  // A lit blade sign out over the pavement, so the shop can be spotted from up the street.
  g.span(1.18, 2.85, 0.05, 1.3, 3.95, 0.95, '#2a2c30')
  for (const x of [1.165, 1.315]) {
    const dx = x < 1.2 ? -0.01 : 0.01
    e.span(x, 2.92, 0.12, x + dx, 3.88, 0.88, '#9a3c34')
    e.span(x + dx, 3.62, 0.22, x + dx * 2, 3.8, 0.78, '#d8c49a')
    e.span(x + dx, 3.3, 0.3, x + dx * 2, 3.5, 0.7, '#d8c49a')
    e.span(x + dx, 3.0, 0.22, x + dx * 2, 3.18, 0.78, '#d8c49a')
  }
  g.rod([1.24, 3.9, 0.05], [1.24, 3.9, 0.95], 0.02, STEEL_DARK, 4)
  // Control panel, sloping down toward the player.
  g.span(-0.38, 0.72, 0.2, 0.38, 0.9, 0.5, '#1e2a3a')
  g.cyl(-0.16, 0.86, 0.34, 0.045, 0.05, '#8a3030', 7) // joystick
  g.cyl(0.1, 0.86, 0.3, 0.03, 0.02, CREAM, 6)
  g.cyl(0.2, 0.86, 0.36, 0.03, 0.02, BLUE, 6)
  // Coin door.
  g.span(-0.12, 0.3, 0.4, 0.12, 0.6, 0.46, STEEL_DARK)
  g.span(-0.04, 0.4, 0.45, 0.04, 0.46, 0.48, STEEL)
  // Side art, faded to almost nothing.
  g.span(0.4, 0.5, -0.2, 0.42, 1.4, 0.3, '#33465e')
  g.span(-0.42, 0.5, -0.2, -0.4, 1.4, 0.3, '#33465e')
}

const BUILDERS: Record<Discovery['kind'], (s: Sink) => void> = { cat: catBox, vending, phone, roof: stairwellDoor, arcade }

/** Bakes one discovery into the world layers. */
export function buildDiscovery(layers: import('../geo/layers.ts').Layers, d: Discovery) {
  const sink = new Sink(layers, 'props', d.at[0], d.at[1])
  sink.at(d.at[0], 0, d.at[1], d.yaw, () => BUILDERS[d.kind](sink))
}

/** A single can, used by the vending close-up. Built facing +z, standing on y = 0. */
export function canGeometry(color: string, band: string): Geo {
  const g = new Geo()
  g.cyl(0, 0, 0, 0.033, 0.115, color, 8, 0.033)
  g.cyl(0, 0.1, 0, 0.034, 0.012, band, 8)
  g.cyl(0, 0.112, 0, 0.03, 0.006, STEEL, 8)
  g.cyl(0, 0, 0, 0.028, 0.004, STEEL, 8)
  return g
}

/** The payphone handset, built along local x with the earpiece at +x. */
export function handsetGeometry(): Geo {
  const g = new Geo()
  g.rod([-0.11, 0, 0], [0.11, 0, 0], 0.014, '#2c3034', 6)
  g.cyl(-0.11, -0.02, 0, 0.02, 0.045, '#2c3034', 7)
  g.cyl(0.11, -0.02, 0, 0.02, 0.045, '#2c3034', 7)
  return g
}
