import type { Vec2 } from '../../world/geometry2d.ts'
import type { RetroSurface } from '../geo/retroTextures.ts'

export interface BoxSpec {
  /** Footprint centre on the ground plane. */
  at: Vec2
  /** Bottom of the box. */
  y: number
  /** Size along the box's own axis, height, and size across. */
  length: number
  height: number
  width: number
  /** Unit direction of the length axis on the ground plane. */
  axis: Vec2
  color: string
  /** Tilt of the length axis above horizontal, radians. */
  pitch?: number
  /** Retro surface texture; omitted means a plain vertex-coloured box. */
  surface?: RetroSurface
}

export function boxAlong(a: Vec2, b: Vec2, width: number, y: number, height: number, color: string): BoxSpec {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len = Math.hypot(dx, dz)
  return {
    at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    y,
    length: len,
    height,
    width,
    axis: len > 0 ? [dx / len, dz / len] : [1, 0],
    color,
  }
}

/** A thin plank between two ground points whose ends are at heights `yA` and `yB` (rails, sloped roofs, stair stringers). */
export function slab(a: Vec2, b: Vec2, width: number, yA: number, yB: number, thick: number, color: string): BoxSpec {
  const run = Math.hypot(b[0] - a[0], b[1] - a[1])
  const len = Math.hypot(run, yB - yA)
  const axis: Vec2 = run > 0 ? [(b[0] - a[0]) / run, (b[1] - a[1]) / run] : [1, 0]
  return {
    at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    y: (yA + yB) / 2 - thick / 2,
    length: len,
    height: thick,
    width,
    axis,
    color,
    pitch: Math.atan2(yB - yA, run),
  }
}
