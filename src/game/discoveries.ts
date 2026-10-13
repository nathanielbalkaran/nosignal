import { useSyncExternalStore } from 'react'

/*
 * State for the three quick discoveries: petting the cat, buying a drink, and
 * the payphone. All of it is scripted and timed by frame time (see `tick`), so
 * it freezes whenever the game is paused. Nothing here is kept between visits.
 */

export type Drink = 'tea' | 'lemon' | 'soy'

export type PhoneMessage = 'disconnected' | 'announcement' | 'chatter'

export interface DiscoverySnapshot {
  /** Seconds since the cat was touched; the petting lasts about six seconds. */
  cat: number
  /** The vending close-up: choosing, then dispensing. */
  vending: 'choose' | 'dispense'
  drink: Drink | null
  /** Seconds into the dispensing. */
  dispense: number
  /** The payphone: the receiver is down until the player lifts it. */
  phone: 'down' | 'up'
  message: PhoneMessage | null
  /** Seconds the receiver has been off the hook. */
  phoneTime: number
}

const FRESH: DiscoverySnapshot = { cat: 0, vending: 'choose', drink: null, dispense: 0, phone: 'down', message: null, phoneTime: 0 }

/** How long the cat reacts for. */
export const CAT_SECONDS = 6.5
/** The can drops, sits in the slot, then the scene ends. */
export const DISPENSE_SECONDS = 4.2
/** The longest a call runs before the line simply goes dead. */
export const CALL_SECONDS = 16

const MESSAGES: readonly PhoneMessage[] = ['disconnected', 'announcement', 'chatter']

let snap: DiscoverySnapshot = { ...FRESH }
let calls = 0
const listeners = new Set<() => void>()

function publish(next: Partial<DiscoverySnapshot>) {
  snap = { ...snap, ...next }
  for (const l of listeners) l()
}

export const discoveries = {
  getSnapshot: (): DiscoverySnapshot => snap,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },

  reset() {
    calls = 0
    snap = { ...FRESH }
    for (const l of listeners) l()
  },

  /** Ignored while the cat is still reacting, so E cannot be spammed. */
  petCat() {
    if (snap.cat > 0 && snap.cat < CAT_SECONDS) return
    publish({ cat: 0.001 })
  },
  /** A new visit to the machine starts at the buttons. */
  openVending() {
    publish({ vending: 'choose', drink: null, dispense: 0 })
  },
  chooseDrink(drink: Drink) {
    if (snap.vending !== 'choose') return
    publish({ vending: 'dispense', drink, dispense: 0.001 })
  },
  openPhone() {
    publish({ phone: 'down', message: null, phoneTime: 0 })
  },
  /** Lifts the receiver and gets the next message in a fixed rotation. */
  liftReceiver() {
    if (snap.phone !== 'down') return
    publish({ phone: 'up', message: MESSAGES[calls % MESSAGES.length], phoneTime: 0.001 })
    calls++
  },
  hangUp() {
    if (snap.phone !== 'up') return
    publish({ phone: 'down', phoneTime: 0 })
  },

  /** Advances whatever is in progress. Only called while the game is playing. */
  tick(dt: number) {
    if (snap.cat > 0 && snap.cat < CAT_SECONDS) publish({ cat: Math.min(CAT_SECONDS, snap.cat + dt) })
    if (snap.vending === 'dispense' && snap.dispense < DISPENSE_SECONDS) publish({ dispense: Math.min(DISPENSE_SECONDS, snap.dispense + dt) })
    if (snap.phone === 'up' && snap.phoneTime < CALL_SECONDS) publish({ phoneTime: Math.min(CALL_SECONDS, snap.phoneTime + dt) })
  },
}

export function useDiscoveries(): DiscoverySnapshot {
  return useSyncExternalStore(discoveries.subscribe, discoveries.getSnapshot)
}
