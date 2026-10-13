import { useSyncExternalStore } from 'react'

/*
 * Lightweight achievement system. Achievements are unlocked when the relevant
 * action actually happens (not on approach). They persist in localStorage across
 * sessions, restarts, and mode switches. Nothing here rewards or changes gameplay.
 */

export type AchievementId =
  | 'local_regular'   // Visit the restaurant
  | 'take_your_time'  // Sit down for tea and noodles
  | 'nine_lives'      // Pet the stray cat
  | 'something_cold'  // Use the vending machine
  | 'wrong_number'    // Use the payphone
  | 'above_the_city'  // Sit on the rooftop
  | 'last_stop'       // Play the arcade minigame
  | 'homeward_bound'  // Catch the train successfully

export interface AchievementDef {
  id: AchievementId
  title: string
  description: string
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  { id: 'local_regular',  title: 'LOCAL REGULAR',  description: 'Visit the restaurant.' },
  { id: 'take_your_time', title: 'TAKE YOUR TIME', description: 'Sit down for tea and noodles.' },
  { id: 'nine_lives',     title: 'NINE LIVES',     description: 'Pet the stray cat.' },
  { id: 'something_cold', title: 'SOMETHING COLD', description: 'Use the vending machine.' },
  { id: 'wrong_number',   title: 'WRONG NUMBER',   description: 'Use the payphone.' },
  { id: 'above_the_city', title: 'ABOVE THE CITY', description: 'Sit on the rooftop.' },
  { id: 'last_stop',      title: 'LAST STOP',      description: 'Play the arcade minigame.' },
  { id: 'homeward_bound', title: 'HOMEWARD BOUND', description: 'Catch the train successfully.' },
]

const STORAGE_KEY = 'ns:achievements'

function loadUnlocked(): Set<AchievementId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is AchievementId => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function saveUnlocked(set: Set<AchievementId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // Ignore storage failures silently.
  }
}

export interface AchievementsSnapshot {
  unlocked: ReadonlySet<AchievementId>
  /** The most recently unlocked achievement, shown in the notification for ~4 s. */
  latest: AchievementId | null
}

let unlocked: Set<AchievementId> = loadUnlocked()
let latest: AchievementId | null = null
let latestTimer = 0
const listeners = new Set<() => void>()
/** Cached snapshot — only replaced when something actually changes, so useSyncExternalStore gets a stable ref. */
let snap: AchievementsSnapshot = { unlocked, latest }

function publish() {
  snap = { unlocked, latest }
  for (const l of listeners) l()
}

export const achievements = {
  getSnapshot: (): AchievementsSnapshot => snap,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },

  /** Unlock an achievement. No-ops if already unlocked. */
  unlock(id: AchievementId) {
    if (unlocked.has(id)) return
    unlocked = new Set(unlocked)
    unlocked.add(id)
    saveUnlocked(unlocked)
    latest = id
    window.clearTimeout(latestTimer)
    publish()
    // Clear the notification after 4.5 s (notification itself fades at 4 s).
    latestTimer = window.setTimeout(() => {
      latest = null
      publish()
    }, 4500)
  },

  isUnlocked: (id: AchievementId): boolean => unlocked.has(id),
}

export function useAchievements(): AchievementsSnapshot {
  return useSyncExternalStore(achievements.subscribe, achievements.getSnapshot)
}
