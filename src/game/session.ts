import { useSyncExternalStore } from 'react'
import { resetPlayer } from '../player/playerState.ts'
import { clock, LIMIT_MS } from './clock.ts'

/*
 * One small game-state store. The 3D scene stays mounted for every state;
 * only this store, the clock and the overlays change.
 *
 * Entering or resuming play asks for pointer lock and only becomes PLAYING once
 * the browser grants it, so the mouse can never be visible while play continues.
 * A denied request leaves the menu up with `lockBlocked` set, as a retry hint.
 */

export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'WON' | 'LOST'
export type GameMode = 'PLAY' | 'EXPLORE'
/** Entrance prompt: 'enter' (E works) or 'explore' (message only). */
export type Prompt = 'enter' | 'explore' | null

export interface Result {
  /** Clock at the moment the game ended. */
  elapsedMs: number
  remainingMs: number
}

export interface GameSnapshot {
  state: GameState
  mode: GameMode
  lockBlocked: boolean
  /** Increments on every (re)start, so run-scoped scenery can reset. */
  runId: number
  result: Result | null
  /** The run in which the two-minute warning fired (0 = none yet). */
  warningRun: number
  prompt: Prompt
}

/** Development only: `?nolock` skips pointer lock so automation (which cannot lock) can play. */
const BYPASS_LOCK = import.meta.env.DEV && new URLSearchParams(window.location.search).has('nolock')

let snap: GameSnapshot = { state: 'TITLE', mode: 'PLAY', lockBlocked: false, runId: 0, result: null, warningRun: 0, prompt: null }
let lockHandler: (() => void) | null = null
/** A start/resume was requested and we are waiting for the browser to grant the lock. */
let wantPlay = false
let frozen = false
const listeners = new Set<() => void>()

function set(patch: Partial<GameSnapshot>) {
  const next = { ...snap, ...patch }
  if ((Object.keys(patch) as (keyof GameSnapshot)[]).every((k) => next[k] === snap[k])) return
  snap = next
  syncClock()
  for (const l of listeners) l()
}

function syncClock() {
  const active = snap.state === 'PLAYING' && snap.mode === 'PLAY' && !frozen && !document.hidden && document.hasFocus()
  clock.setRunning(active)
}

function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock()
}

function requestLock() {
  wantPlay = true
  set({ lockBlocked: false })
  if (BYPASS_LOCK) {
    session.onLockAcquired()
    return
  }
  lockHandler?.()
}

function finish(state: 'WON' | 'LOST') {
  if (snap.state !== 'PLAYING') return
  wantPlay = false
  const elapsedMs = Math.min(clock.elapsedMs(), LIMIT_MS)
  // Set the state first, so the pointer-lock change that follows does not read as a pause.
  set({ state, result: { elapsedMs: state === 'LOST' ? LIMIT_MS : elapsedMs, remainingMs: Math.max(0, LIMIT_MS - elapsedMs) }, prompt: null })
  releaseLock()
}

export const session = {
  getSnapshot: (): GameSnapshot => snap,
  getStatus: (): GameState => snap.state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Registered by the player controller, which owns the pointer-lock element. */
  setLockHandler(handler: (() => void) | null) {
    lockHandler = handler
  },

  /** Begin a fresh run in `mode`. Call from a click so pointer lock is allowed. */
  start(mode: GameMode) {
    wantPlay = false
    resetPlayer()
    clock.reset()
    set({ mode, runId: snap.runId + 1, prompt: null })
    requestLock()
  },
  restart() {
    session.start(snap.mode)
  },
  /** From the pause menu: lock the mouse again and carry on. */
  resume() {
    if (snap.state === 'PAUSED') requestLock()
  },
  pause() {
    if (snap.state !== 'PLAYING') return
    wantPlay = false
    set({ state: 'PAUSED', prompt: null })
    releaseLock()
  },
  toTitle() {
    if (snap.state === 'TITLE') return
    wantPlay = false
    resetPlayer()
    clock.reset()
    set({ state: 'TITLE', result: null, prompt: null, lockBlocked: false, runId: snap.runId + 1 })
    releaseLock()
  },

  // --- pointer lock events (from the controller) ---
  onLockAcquired() {
    if (wantPlay && snap.state !== 'PLAYING') {
      wantPlay = false
      set({ state: 'PLAYING', lockBlocked: false, result: null })
    } else if (snap.state !== 'PLAYING') {
      releaseLock()
    }
  },
  onLockLost() {
    if (snap.state === 'PLAYING') session.pause()
  },
  onLockFailed() {
    if (!wantPlay) return
    wantPlay = false
    set({ lockBlocked: true })
  },

  // --- gameplay events ---
  setPrompt(prompt: Prompt) {
    if (snap.state === 'PLAYING') set({ prompt })
    else set({ prompt: null })
  },
  /** E pressed at the entrance. Only Play mode can win; the deadline decides win or loss. */
  enterStation() {
    if (snap.state !== 'PLAYING' || snap.mode !== 'PLAY') return
    finish(clock.elapsedMs() >= LIMIT_MS ? 'LOST' : 'WON')
  },

  // --- development controls ---
  isFrozen: () => frozen,
  setFrozen(on: boolean) {
    frozen = on
    syncClock()
    for (const l of listeners) l()
  },
}

clock.onWarning = () => {
  if (snap.state === 'PLAYING' && snap.mode === 'PLAY') set({ warningRun: snap.runId })
}
clock.onExpire = () => finish('LOST')

/** Wires window-level events once. Returns a cleanup function. */
export function attachSession(): () => void {
  const sync = () => syncClock()
  const onKey = (e: KeyboardEvent) => {
    // With pointer lock the browser swallows Esc and reports a lock change instead; either way pause() runs once.
    if (e.code === 'Escape' && !e.repeat) session.pause()
  }
  const onError = () => session.onLockFailed()
  document.addEventListener('visibilitychange', sync)
  document.addEventListener('pointerlockerror', onError)
  window.addEventListener('blur', sync)
  window.addEventListener('focus', sync)
  window.addEventListener('keydown', onKey)
  syncClock()
  return () => {
    document.removeEventListener('visibilitychange', sync)
    document.removeEventListener('pointerlockerror', onError)
    window.removeEventListener('blur', sync)
    window.removeEventListener('focus', sync)
    window.removeEventListener('keydown', onKey)
  }
}

export function useGame(): GameSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot)
}
