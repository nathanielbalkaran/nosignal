import { useSyncExternalStore } from 'react'

/*
 * The counter conversation. Everything the worker and the player say is fixed
 * and scripted; there is no tree, only a greeting, two choices and one short
 * exchange. The script advances with frame time (see `tick`), so it freezes
 * with the rest of the game when paused.
 */

export interface Beat {
  who: 'WORKER' | 'YOU'
  /** Cantonese, Traditional Chinese. Omitted for the player's English line. */
  zh?: string
  /** Subtitle. */
  en: string
  /** Seconds on screen. */
  dur: number
  /** What the worker does while this line plays. */
  action?: 'write' | 'hand'
}

export type Phase = 'greeting' | 'menu' | 'directions' | 'reminder'

export interface RestaurantSnapshot {
  phase: Phase
  /** The line on screen, or null between lines. */
  beat: Beat | null
  /** After the first visit the menu line changes. */
  visited: boolean
  /** The "receipt received" note after the exchange. */
  gave: boolean
}

const GREETING: Beat = { who: 'WORKER', zh: '早晨。', en: 'Morning.', dur: 2.4 }
const MENU_AGAIN: Beat = { who: 'WORKER', zh: '要啲咩？', en: 'Anything else?', dur: 0 }
const REMINDER: Beat = { who: 'WORKER', zh: '畀咗你喇。', en: 'Already gave you one.', dur: 2.2 }

/** About twenty seconds, start to finish. */
const DIRECTIONS: readonly Beat[] = [
  { who: 'YOU', en: 'Station?', dur: 2 },
  { who: 'WORKER', zh: '海旁站？', en: 'Hoi Pong Station?', dur: 2.4 },
  { who: 'WORKER', zh: '等陣。', en: 'Hold on.', dur: 2.2, action: 'write' },
  { who: 'WORKER', en: '...', dur: 4.6, action: 'write' },
  { who: 'WORKER', zh: '出門口右轉，再左轉，一直行，過咗馬路就到。', en: 'Out the door, turn right, then left. Straight on. Cross the road.', dur: 6 },
  { who: 'WORKER', zh: '嗱，畀你。', en: 'Here. For you.', dur: 3, action: 'hand' },
]

let snap: RestaurantSnapshot = { phase: 'menu', beat: null, visited: false, gave: false }
let queue: readonly Beat[] = []
let index = 0
let elapsed = 0
let greeted = false
const listeners = new Set<() => void>()

/** Read by the 3D scene every frame, so it never goes through React. */
export const workerAnim = { action: 'idle' as 'idle' | 'write' | 'hand', t: 0 }

function publish(next: Partial<RestaurantSnapshot>) {
  snap = { ...snap, ...next }
  for (const l of listeners) l()
}

function show(i: number) {
  index = i
  elapsed = 0
  const beat = queue[i]
  workerAnim.action = beat.action ?? 'idle'
  workerAnim.t = 0
  publish({ beat })
  if (beat.action === 'hand') restaurant.onReceipt()
}

function finish() {
  const wasDirections = snap.phase === 'directions'
  queue = []
  workerAnim.action = 'idle'
  workerAnim.t = 0
  publish({ phase: 'menu', beat: null, gave: wasDirections || snap.gave })
}

export const restaurant = {
  getSnapshot: (): RestaurantSnapshot => snap,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  /** The worker hands over the receipt (set by the session). */
  onReceipt: () => {},

  /** Back to a fresh restaurant: the next visit starts with the greeting. */
  reset() {
    queue = []
    index = 0
    elapsed = 0
    greeted = false
    workerAnim.action = 'idle'
    workerAnim.t = 0
    snap = { phase: 'menu', beat: null, visited: false, gave: false }
    for (const l of listeners) l()
  },

  /** Arriving at the counter, from the street or from the table. */
  enterCounter() {
    workerAnim.action = 'idle'
    workerAnim.t = 0
    if (!greeted) {
      greeted = true
      queue = [GREETING]
      publish({ phase: 'greeting', beat: GREETING, visited: false, gave: false })
      index = 0
      elapsed = 0
    } else {
      queue = []
      publish({ phase: 'menu', beat: MENU_AGAIN, visited: true, gave: false })
    }
  },

  /** Choice 1. */
  askAboutStation(hasReceipt: boolean) {
    if (snap.phase !== 'menu' && snap.phase !== 'greeting') return
    if (hasReceipt) {
      queue = [REMINDER]
      publish({ phase: 'reminder', gave: false })
    } else {
      queue = DIRECTIONS
      publish({ phase: 'directions', gave: false })
    }
    show(0)
  },

  /** Advance the script. Called every frame while the game is being played. */
  tick(dt: number) {
    workerAnim.t += dt
    if (!queue.length) return
    elapsed += dt
    const beat = queue[index]
    if (beat && elapsed >= beat.dur) {
      if (index + 1 < queue.length) show(index + 1)
      else if (snap.phase === 'greeting') {
        // The greeting stays up, with the choices beneath it.
        queue = []
        publish({ phase: 'menu' })
      } else finish()
    }
  },

  /** Click, Space or Enter: move on to the next line. */
  skip() {
    if (!queue.length || elapsed < 0.5) return
    if (snap.phase === 'greeting') return
    elapsed = queue[index].dur
  },
}

export function useRestaurant(): RestaurantSnapshot {
  return useSyncExternalStore(restaurant.subscribe, restaurant.getSnapshot)
}
