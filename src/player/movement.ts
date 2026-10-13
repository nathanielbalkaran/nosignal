import { PLAYER } from '../config/player.ts'
import type { World } from '../world/build.ts'
import { movePlayer, type PlayerPosition } from '../world/collision.ts'

/** Each axis is -1, 0 or 1: forward is W minus S, strafe is D minus A. */
export interface MoveInput {
  forward: number
  strafe: number
}

export interface Velocity {
  x: number
  z: number
}

/** Ground-plane velocity the input asks for; diagonals are normalised to `speed`. */
export function targetVelocity(input: MoveInput, yaw: number, speed: number = PLAYER.speed): Velocity {
  const len = Math.hypot(input.forward, input.strafe)
  if (len === 0) return { x: 0, z: 0 }
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  // Forward is (-sin, -cos) and right is (cos, -sin) on the ground plane.
  return {
    x: ((-sin * input.forward + cos * input.strafe) / len) * speed,
    z: ((-cos * input.forward - sin * input.strafe) / len) * speed,
  }
}

/**
 * Advances velocity towards the input and moves the player through the
 * collision world. Mutates `velocity`; returns the new position.
 */
export function stepMovement(
  world: World,
  from: PlayerPosition,
  velocity: Velocity,
  input: MoveInput,
  yaw: number,
  dt: number,
  speed: number = PLAYER.speed,
): PlayerPosition {
  const target = targetVelocity(input, yaw, speed)
  const idle = target.x === 0 && target.z === 0
  const rate = idle ? PLAYER.deceleration : PLAYER.acceleration
  // Frame-rate independent exponential approach.
  const blend = 1 - Math.exp(-rate * dt)
  velocity.x += (target.x - velocity.x) * blend
  velocity.z += (target.z - velocity.z) * blend
  if (Math.hypot(velocity.x, velocity.z) < 0.01) {
    velocity.x = 0
    velocity.z = 0
    return from
  }
  return movePlayer(world, from, velocity.x * dt, velocity.z * dt)
}

/** Eye-level follow: exact on slopes, eased over small ledges, snapped on teleports. */
export function followEyeHeight(eyeY: number, standY: number, dt: number): number {
  const dy = standY - eyeY
  if (Math.abs(dy) > 1) return standY
  const maxStep = PLAYER.eyeFollowSpeed * dt
  return eyeY + Math.max(-maxStep, Math.min(maxStep, dy))
}
