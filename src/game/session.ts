import { useSyncExternalStore } from 'react'

/**
 * Whether the player is in control. "ready" before the first click,
 * "playing" while the pointer is locked, "paused" after Escape.
 */
export type SessionStatus = 'ready' | 'playing' | 'paused'

let status: SessionStatus = 'ready'
let lockHandler: (() => void) | null = null
const listeners = new Set<() => void>()

export const session = {
  getStatus: (): SessionStatus => status,

  setStatus(next: SessionStatus) {
    if (next === status) return
    status = next
    for (const l of listeners) l()
  },

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Registered by the player controller, which owns the pointer-lock element. */
  setLockHandler(handler: (() => void) | null) {
    lockHandler = handler
  },

  requestPlay() {
    lockHandler?.()
  },
}

export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(session.subscribe, session.getStatus)
}
