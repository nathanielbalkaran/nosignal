import type { World } from './build.ts'
import { distance, type Vec2 } from './geometry2d.ts'

/** True once `p` is within the goal radius of any station entrance. */
export function atStation(world: World, p: Vec2): boolean {
  return world.goal.entrances.some((e) => distance(p, e.at) <= world.goal.radius)
}

/** The entrance prompt appears within this distance of the doorway (metres). */
export const ENTER_DISTANCE = 7
/** ...and when the view is within this many degrees of straight at the door. */
const ENTER_FACING_DEG = 40

export interface EntranceView {
  x: number
  z: number
  /** Feet height; the footbridge deck is not the street. */
  y: number
  yaw: number
}

/**
 * The station entrance the player can enter right now, or null. The player must be
 * on the street side of the doorway wall (not behind it), inside the pocket's width,
 * at street level, close, and looking at the door.
 */
export function enterableEntrance(world: World, p: EntranceView): number | null {
  const fx = -Math.sin(p.yaw)
  const fz = -Math.cos(p.yaw)
  if (Math.abs(p.y) > 1) return null
  for (let i = 0; i < world.station.entrances.length; i++) {
    const e = world.station.entrances[i]
    const dx = p.x - e.at[0]
    const dz = p.z - e.at[1]
    const dist = Math.hypot(dx, dz)
    if (dist > ENTER_DISTANCE) continue
    const along = dx * e.outward[0] + dz * e.outward[1]
    const across = Math.abs(dx * -e.outward[1] + dz * e.outward[0])
    if (along < 0.2 || across > e.width / 2) continue
    // Facing: the view must point from the player toward the door.
    const toward = dist < 1e-6 ? 1 : (-dx * fx + -dz * fz) / dist
    if (toward < Math.cos((ENTER_FACING_DEG * Math.PI) / 180)) continue
    return i
  }
  return null
}
