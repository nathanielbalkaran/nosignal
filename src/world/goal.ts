import type { World } from './build.ts'
import { distance, type Vec2 } from './geometry2d.ts'

/** True once `p` is within the goal radius of any station entrance. */
export function atStation(world: World, p: Vec2): boolean {
  return world.goal.entrances.some((e) => distance(p, e.at) <= world.goal.radius)
}
