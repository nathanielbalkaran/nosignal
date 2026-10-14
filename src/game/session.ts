import { useSyncExternalStore } from 'react'
import { playerState, resetPlayer } from '../player/playerState.ts'
import { clock, LIMIT_MS } from './clock.ts'
import { discoveries } from './discoveries.ts'
import { achievements } from './achievements.ts'
import { restaurant } from './restaurant.ts'

/*
 * One small game-state store. The 3D scene stays mounted for every state;
 * only this store, the clock and the overlays change.
 *
 * Entering or resuming play asks for pointer lock and only becomes PLAYING once
 * the browser grants it, so the mouse can never be visible while play continues.
 * A denied request leaves the menu up with `lockBlocked` set, as a retry hint.
 */

export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'CINEMATIC' | 'WON' | 'LOST'
export type GameMode = 'PLAY' | 'EXPLORE'
/** Entrance prompt: 'enter' (E works) or 'explore' (message only). */
export type Prompt = 'enter' | 'explore' | 'restaurant' | 'cat' | 'vending' | 'phone' | 'roof' | 'arcade' | null
/** Where the player is: the street, a restaurant scene, or one of the fixed discovery scenes. */
export type Place = 'STREET' | 'COUNTER' | 'TABLE' | 'VENDING' | 'PHONE' | 'ROOF' | 'ROOF_SEAT' | 'ARCADE' | 'TRAIN'

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
  /** Where the player is, as the game logic sees it. Changes the moment a transition starts. */
  place: Place
  /** Which scene is drawn. Follows `place` at the darkest moment of the fade. */
  view: Place
  /** The screen is fading to black or back. Input is ignored meanwhile. */
  fading: boolean
  /** The directions receipt: the one persistent item. */
  hasReceipt: boolean
  receiptOpen: boolean
  /** The train left while the player was inside; the loss waits until they step out. */
  deferredLoss: boolean
}

/** Development only: `?nolock` skips pointer lock so automation (which cannot lock) can play. */
const BYPASS_LOCK = import.meta.env.DEV && new URLSearchParams(window.location.search).has('nolock')

const FRESH = { place: 'STREET', view: 'STREET', fading: false, hasReceipt: false, receiptOpen: false, deferredLoss: false } as const
let snap: GameSnapshot = { state: 'TITLE', mode: 'PLAY', lockBlocked: false, runId: 0, result: null, warningRun: 0, prompt: null, ...FRESH }
/** Where the player stood and looked before going in; restored on the way out. */
let savedPose: { x: number; z: number; y: number; yaw: number; pitch: number } | null = null
let transitionTimer = 0
/** Time at full black: long enough that the swap is never seen. */
const FADE_MS = 420
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
  // A missed train waits for the player to step back out; then it ends the run.
  if (snap.deferredLoss && snap.state === 'PLAYING' && snap.place === 'STREET' && snap.view === 'STREET' && !snap.fading) finish('LOST')
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
  // The restaurant scenes have no mouse look, so nothing needs the pointer lock.
  if (snap.place !== 'STREET') {
    session.onLockAcquired()
    return
  }
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
  set({ state, result: { elapsedMs: state === 'LOST' ? LIMIT_MS : elapsedMs, remainingMs: Math.max(0, LIMIT_MS - elapsedMs) }, prompt: null, receiptOpen: false })
  if (state === 'WON') achievements.unlock('homeward_bound')
  releaseLock()
}

function cancelTransition() {
  window.clearTimeout(transitionTimer)
  transitionTimer = 0
}

/** Everything an optional scene owns, back to a new game. */
function resetSceneState() {
  cancelTransition()
  savedPose = null
  restaurant.reset()
  discoveries.reset()
}

/**
 * Fade to black, run `swap` while the screen is dark, fade back. `place` has
 * already changed when this is called; `view` follows in the dark.
 */
function transition(swap: () => void) {
  cancelTransition()
  set({ fading: true, prompt: null, receiptOpen: false })
  transitionTimer = window.setTimeout(() => {
    transitionTimer = 0
    swap()
    set({ view: snap.place, fading: false })
  }, FADE_MS)
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
    resetSceneState()
    set({ mode, runId: snap.runId + 1, prompt: null, ...FRESH })
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
    set({ state: 'PAUSED', prompt: null, receiptOpen: false })
    releaseLock()
  },
  toTitle() {
    if (snap.state === 'TITLE') return
    wantPlay = false
    resetPlayer()
    clock.reset()
    resetSceneState()
    set({ state: 'TITLE', result: null, prompt: null, lockBlocked: false, runId: snap.runId + 1, ...FRESH })
    releaseLock()
  },

  // --- pointer lock events (from the controller) ---
  onLockAcquired() {
    if (snap.state === 'PLAYING') {
      wantPlay = false
    } else if (wantPlay) {
      wantPlay = false
      set({ state: 'PLAYING', lockBlocked: false, result: null })
    } else {
      releaseLock()
    }
  },
  onLockLost() {
    // Going indoors lets go of the mouse on purpose; that is not a pause.
    if (snap.state === 'PLAYING' && snap.place === 'STREET') session.pause()
  },
  onLockFailed() {
    if (!wantPlay) return
    wantPlay = false
    // Came back out of the restaurant and the browser refused the mouse: wait on the pause menu for a click.
    if (snap.state === 'PLAYING') {
      set({ lockBlocked: true })
      session.pause()
      return
    }
    set({ lockBlocked: true })
  },

  // --- gameplay events ---
  setPrompt(prompt: Prompt) {
    if (snap.state === 'PLAYING') set({ prompt })
    else set({ prompt: null })
  },
  /** E pressed at the entrance. Only Play mode can win; the deadline decides win or loss. */
  enterStation() {
    if (snap.state !== 'PLAYING' || snap.mode !== 'PLAY' || snap.place !== 'STREET' || snap.fading || snap.receiptOpen) return
    if (clock.elapsedMs() >= LIMIT_MS) {
      finish('LOST')
      return
    }
    const elapsedMs = Math.min(clock.elapsedMs(), LIMIT_MS)
    const result: Result = { elapsedMs, remainingMs: Math.max(0, LIMIT_MS - elapsedMs) }
    wantPlay = false
    achievements.unlock('homeward_bound')
    releaseLock()
    set({
      state: 'CINEMATIC',
      place: 'TRAIN',
      result,
      prompt: null,
      receiptOpen: false,
    })
    transition(() => {})
  },
  finishCinematic() {
    if (snap.state !== 'CINEMATIC') return
    cancelTransition()
    set({ state: 'WON', prompt: null, receiptOpen: false, fading: false })
    releaseLock()
  },

  // --- the restaurant ---
  /** First-person controls are live: outdoors, not fading, no receipt in hand. */
  canMove: (): boolean => snap.state === 'PLAYING' && snap.place === 'STREET' && snap.view === 'STREET' && !snap.fading && !snap.receiptOpen,
  /** Input for the fixed scenes: playing, in a restaurant scene that is on screen. */
  inRestaurant: (): boolean => snap.state === 'PLAYING' && (snap.place === 'COUNTER' || snap.place === 'TABLE') && snap.place === snap.view && !snap.fading,
  /** Input for one of the optional fixed scenes, settled on screen. */
  inScene: (place: Place): boolean => snap.state === 'PLAYING' && snap.place === place && snap.view === place && !snap.fading,

  /** E at the restaurant door. Keeps the outdoor pose, lets go of the mouse and fades into the counter scene. */
  enterRestaurant() {
    if (snap.state !== 'PLAYING' || snap.place !== 'STREET' || snap.fading || snap.receiptOpen) return
    savedPose = { x: playerState.x, z: playerState.z, y: playerState.y, yaw: playerState.yaw, pitch: playerState.pitch }
    set({ place: 'COUNTER' })
    releaseLock()
    transition(() => restaurant.enterCounter())
  },
  /** From the counter: sit at the window table. */
  sitDown() {
    if (!session.inRestaurant() || snap.place !== 'COUNTER') return
    set({ place: 'TABLE' })
    transition(() => {})
  },
  /** From the table: back to the counter. */
  getUp() {
    if (!session.inRestaurant() || snap.place !== 'TABLE') return
    set({ place: 'COUNTER' })
    transition(() => restaurant.enterCounter())
  },
  /** From the counter: back out to exactly where the player stood. */
  exitRestaurant() {
    if (!session.inRestaurant() || snap.place !== 'COUNTER') return
    const missed = snap.mode === 'PLAY' && (snap.deferredLoss || clock.elapsedMs() >= LIMIT_MS)
    set({ place: 'STREET', deferredLoss: missed })
    transition(() => {
      if (savedPose) {
        playerState.x = savedPose.x
        playerState.z = savedPose.z
        playerState.y = savedPose.y
        playerState.yaw = savedPose.yaw
        playerState.pitch = savedPose.pitch
      }
      // The deferred loss, if any, fires from `set` once the street is showing again; no mouse is needed for it.
      if (!missed && snap.state === 'PLAYING') requestLock()
    })
  },

  giveReceipt() {
    if (snap.state === 'PLAYING') set({ hasReceipt: true })
  },
  /** R: look at the receipt, or put it away. */
  toggleReceipt() {
    if (snap.state !== 'PLAYING' || !snap.hasReceipt || snap.fading) return
    // The discovery scenes have their own keys (R retries the arcade).
    if (!snap.receiptOpen && !['STREET', 'COUNTER', 'TABLE'].includes(snap.place)) return
    set({ receiptOpen: !snap.receiptOpen })
  },

  // --- the optional discoveries ---
  /** Steps off the street into a fixed scene, keeping the pose to come back to. */
  enterScene(place: Place, begin: () => void) {
    if (snap.state !== 'PLAYING' || snap.place !== 'STREET' || snap.fading || snap.receiptOpen) return
    savedPose = { x: playerState.x, z: playerState.z, y: playerState.y, yaw: playerState.yaw, pitch: playerState.pitch }
    set({ place })
    releaseLock()
    transition(begin)
  },
  /** Back to exactly where the player stood. A missed train ends the run once the street is showing. */
  leaveScene() {
    if (snap.state !== 'PLAYING' || snap.place === 'STREET' || snap.place !== snap.view || snap.fading) return
    const missed = snap.mode === 'PLAY' && (snap.deferredLoss || clock.elapsedMs() >= LIMIT_MS)
    set({ place: 'STREET', deferredLoss: missed })
    transition(() => {
      if (savedPose) {
        playerState.x = savedPose.x
        playerState.z = savedPose.z
        playerState.y = savedPose.y
        playerState.yaw = savedPose.yaw
        playerState.pitch = savedPose.pitch
      }
      if (!missed && snap.state === 'PLAYING') requestLock()
    })
  },
  /** Rooftop: from the door to the chair, or back again. */
  setPlace(place: Place) {
    if (snap.state !== 'PLAYING' || snap.place !== snap.view || snap.fading) return
    set({ place })
    transition(() => {})
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
clock.onExpire = () => {
  // Inside the restaurant the scene is never cut short; the loss is applied when the player leaves.
  if (snap.place !== 'STREET') set({ deferredLoss: true })
  else finish('LOST')
}
restaurant.onReceipt = () => session.giveReceipt()

/** Wires window-level events once. Returns a cleanup function. */
export function attachSession(): () => void {
  const sync = () => syncClock()
  const onKey = (e: KeyboardEvent) => {
    // With pointer lock the browser swallows Esc and reports a lock change instead; either way pause() runs once.
    if (e.code === 'Escape' && !e.repeat) {
      if (snap.state === 'CINEMATIC') {
        session.finishCinematic()
        return
      }
      session.pause()
    }
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

/** Which scene is on screen; re-renders only when that changes. */
export function useView(): Place {
  return useSyncExternalStore(session.subscribe, () => snap.view)
}

export function useGame(): GameSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot)
}
