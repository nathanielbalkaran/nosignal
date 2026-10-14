export type ViewBobbingSetting = 'OFF' | 'LOW' | 'NORMAL'

const STORAGE_KEY = 'no-signal:view-bobbing'
const DEFAULT_SETTING: ViewBobbingSetting = 'NORMAL'

export const BOBBING_MULTIPLIERS: Record<ViewBobbingSetting, number> = {
  OFF: 0,
  LOW: 0.5,
  NORMAL: 1.0,
} as const

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function getStorage(): StorageLike | null {
  try {
    const g = globalThis as unknown as { localStorage?: StorageLike }
    if (g && typeof g.localStorage?.getItem === 'function') {
      return g.localStorage
    }
  } catch {
    // Ignore: private browsing or storage unavailable
  }
  return null
}

function loadSetting(): ViewBobbingSetting {
  try {
    const storage = getStorage()
    if (!storage) return DEFAULT_SETTING
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === 'OFF' || raw === 'LOW' || raw === 'NORMAL') {
      return raw
    }
  } catch {
    // Ignore: private browsing or storage disabled
  }
  return DEFAULT_SETTING
}

let currentSetting: ViewBobbingSetting = loadSetting()
const listeners = new Set<() => void>()

export const settings = {
  getViewBobbing: (): ViewBobbingSetting => currentSetting,
  setViewBobbing(value: ViewBobbingSetting) {
    if (currentSetting === value) return
    currentSetting = value
    try {
      const storage = getStorage()
      storage?.setItem(STORAGE_KEY, value)
    } catch {
      // Ignore: settings just won't persist
    }
    for (const listener of listeners) {
      listener()
    }
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
