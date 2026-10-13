import { world } from '../world/index.ts'

/**
 * Live player pose, mutated every frame by the controller. Kept outside
 * React so per-frame reads (lighting, dev tools) don't cause re-renders.
 */
export const playerState = {
  x: world.spawn.at[0],
  z: world.spawn.at[1],
  /** Feet height. */
  y: 0,
  yaw: world.spawn.yaw,
  pitch: 0,
}

export function placePlayer(x: number, z: number, y = 0, yaw = playerState.yaw) {
  playerState.x = x
  playerState.z = z
  playerState.y = y
  playerState.yaw = yaw
}
