/*
 * The gameplay clock. Real elapsed time (performance.now) accumulates only while
 * the clock is running, so frame rate never matters and a pause adds nothing.
 * One setTimeout at a time schedules the next event (two-minute warning, then
 * the deadline); it is cleared on every change, so timers never stack.
 */

/** Game time at the start of a run: 05:12:00, in seconds after midnight. */
export const START_SECONDS = 5 * 3600 + 12 * 60
/** Time available, in milliseconds. The train leaves at 05:21:00. */
export const LIMIT_MS = 9 * 60 * 1000
/** The single warning fires when this much time is left. */
export const WARNING_REMAINING_MS = 2 * 60 * 1000
const WARNING_AT_MS = LIMIT_MS - WARNING_REMAINING_MS

const pad = (n: number) => String(n).padStart(2, '0')

/** Game time of day for an elapsed duration, as HH:MM:SS. */
export function formatClock(elapsedMs: number): string {
  const total = START_SECONDS + Math.floor(Math.max(0, elapsedMs) / 1000)
  return `${pad(Math.floor(total / 3600) % 24)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
}

/** Game time of day as HH:MM (minutes floored). */
export function formatMinutes(elapsedMs: number): string {
  return formatClock(elapsedMs).slice(0, 5)
}

class GameClock {
  private base = 0
  private since: number | null = null
  private warned = false
  private timer = 0
  onWarning: () => void = () => {}
  onExpire: () => void = () => {}

  get running(): boolean {
    return this.since !== null
  }

  elapsedMs(): number {
    return this.base + (this.since === null ? 0 : performance.now() - this.since)
  }

  remainingMs(): number {
    return Math.max(0, LIMIT_MS - this.elapsedMs())
  }

  setRunning(on: boolean) {
    if (on === this.running) return
    if (on) {
      this.since = performance.now()
    } else {
      this.base = this.elapsedMs()
      this.since = null
    }
    this.schedule()
  }

  /** Back to exactly 05:12:00 and a fresh warning. Keeps the running state. */
  reset() {
    this.setElapsed(0)
  }

  setElapsed(ms: number) {
    this.base = Math.max(0, ms)
    if (this.since !== null) this.since = performance.now()
    this.warned = this.base >= WARNING_AT_MS
    this.schedule()
  }

  private schedule() {
    window.clearTimeout(this.timer)
    if (this.since === null) return
    const target = this.warned ? LIMIT_MS : WARNING_AT_MS
    this.timer = window.setTimeout(this.check, Math.max(0, target - this.elapsedMs()) + 4)
  }

  private readonly check = () => {
    if (this.since === null) return
    const elapsed = this.elapsedMs()
    if (!this.warned && elapsed >= WARNING_AT_MS && elapsed < LIMIT_MS) {
      this.warned = true
      this.onWarning()
    }
    if (elapsed >= LIMIT_MS) {
      this.warned = true
      this.onExpire()
      return
    }
    this.schedule()
  }
}

export const clock = new GameClock()
