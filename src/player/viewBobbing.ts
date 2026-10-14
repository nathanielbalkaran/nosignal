import { PLAYER } from '../config/player.ts'
import { BOBBING_MULTIPLIERS, settings } from '../game/settings.ts'

/** Stride distance in metres for one complete two-step walking cycle. Calmer cadence to reduce nausea. */
const STRIDE_LENGTH = 2.6

/** Base amplitudes for NORMAL intensity (metres for position, radians for rotation). Dampened to avoid nausea. */
const BASE_AMPLITUDES = {
  bobY: 0.016,
  sway: 0.007,
  roll: 0.001,
  pitch: 0.0008,
} as const

/** Blend rate when starting to walk (per second). */
const BLEND_IN_RATE = 8
/** Blend rate when stopping (per second). Slightly gentler for smooth settling. */
const BLEND_OUT_RATE = 8

export interface BobOffset {
  /** Vertical camera offset in metres (+Y up). */
  bobY: number
  /** Lateral camera offset in metres (+ right). */
  sway: number
  /** Camera roll tilt in radians (+ tilt right). */
  roll: number
  /** Camera pitch nod in radians (+ look down). */
  pitch: number
}

class ViewBobbingController {
  private phase = 0
  private blendWeight = 0
  private activeMult = BOBBING_MULTIPLIERS[settings.getViewBobbing()]

  /**
   * Advances the view bobbing simulation by `dt` seconds based on the actual
   * distance traversed across the ground plane.
   *
   * @param movedDist Horizontal distance moved this frame in metres.
   * @param dt Frame delta time in seconds.
   * @param canMove Whether the player is in first-person gameplay and capable of moving.
   * @returns Camera offsets to apply for this frame.
   */
  step(movedDist: number, dt: number, canMove: boolean): BobOffset {
    if (dt <= 0) return this.computeOffset()

    // Guard against teleports or large coordinate snaps (e.g. dev teleport).
    if (movedDist > 1.5) {
      this.reset()
      return { bobY: 0, sway: 0, roll: 0, pitch: 0 }
    }

    const actualSpeed = movedDist / dt
    const setting = settings.getViewBobbing()
    const targetMult = BOBBING_MULTIPLIERS[setting]

    // If disabled via settings, drop multiplier immediately.
    if (targetMult === 0) {
      this.activeMult = 0
    } else {
      const multBlend = 1 - Math.exp(-12 * dt)
      this.activeMult += (targetMult - this.activeMult) * multBlend
    }

    const isWalking = canMove && actualSpeed > 0.05 && this.activeMult > 0.001

    let targetWeight = 0
    if (isWalking) {
      // Speed ratio relative to configured base speed.
      const speedRatio = actualSpeed / PLAYER.speed
      // If moving faster than base speed (e.g. sprinting), slightly increase frequency & amplitude.
      const sprintAmp = 1 + Math.max(0, speedRatio - 1) * 0.35
      const cadenceFactor = 1 + Math.max(0, speedRatio - 1) * 0.25

      targetWeight = sprintAmp

      // Distance-based phase advance: strictly synchronized with ground traversal.
      const deltaPhase = (movedDist / STRIDE_LENGTH) * (Math.PI * 2) * cadenceFactor
      this.phase = (this.phase + deltaPhase) % (Math.PI * 2)
    }

    // Smoothly blend intensity in when starting, out when stopping.
    const blendRate = targetWeight > this.blendWeight ? BLEND_IN_RATE : BLEND_OUT_RATE
    const blendFactor = 1 - Math.exp(-blendRate * dt)
    this.blendWeight += (targetWeight - this.blendWeight) * blendFactor

    if (targetWeight === 0 && this.blendWeight < 0.0005) {
      this.blendWeight = 0
    }

    return this.computeOffset()
  }

  private computeOffset(): BobOffset {
    if (this.blendWeight === 0 || this.activeMult < 0.0001) {
      return { bobY: 0, sway: 0, roll: 0, pitch: 0 }
    }

    // Natural walking wave profile:
    // Vertical bob has 2 dips per full stride (one per footstep) with a 4th harmonic
    // that creates a sharper cushioning on heel strike and a smooth rise.
    const bobNormY = (Math.cos(2 * this.phase) - 0.25 * Math.cos(4 * this.phase)) / 1.25
    // Horizontal sway sways left and right across alternating footsteps.
    const swayNorm = Math.sin(this.phase)
    // Subtle roll tilt into the supporting foot.
    const rollNorm = -Math.sin(this.phase)
    // Subtle pitch nod forward on impact.
    const pitchNorm = Math.cos(2 * this.phase)

    const scale = this.blendWeight * this.activeMult
    return {
      bobY: bobNormY * BASE_AMPLITUDES.bobY * scale,
      sway: swayNorm * BASE_AMPLITUDES.sway * scale,
      roll: rollNorm * BASE_AMPLITUDES.roll * scale,
      pitch: pitchNorm * BASE_AMPLITUDES.pitch * scale,
    }
  }

  /** Resets bobbing offsets and phase immediately to neutral. */
  reset() {
    this.phase = 0
    this.blendWeight = 0
    this.activeMult = BOBBING_MULTIPLIERS[settings.getViewBobbing()]
  }

  getOffset(): BobOffset {
    return this.computeOffset()
  }
}

export const viewBobbing = new ViewBobbingController()
