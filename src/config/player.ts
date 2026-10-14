/** First-person movement and camera tuning. All movement feel is set here. */
export const PLAYER = {
  /** Base movement speed in metres per second (damped by 10% from 5.5). The main traversal-pace dial. */
  speed: 4.95,
  /** How quickly velocity closes on the input direction (per second). Higher is snappier. */
  acceleration: 20,
  /** How quickly velocity falls to zero once keys are released (per second). */
  deceleration: 28,
  eyeHeight: 1.62,
  /**
   * Fastest the camera follows a change in standing height (m/s). Above any
   * stair slope at full speed, so slopes are tracked exactly and only small
   * ledges are eased.
   */
  eyeFollowSpeed: 4,
  lookSensitivity: 0.0022,
  maxPitch: 1.45,
} as const
