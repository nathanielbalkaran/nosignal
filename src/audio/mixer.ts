/*
 * User-facing channel volumes (0..1), shared by music and ambience.
 * Each audio source computes: base gain × channel volume × temporary fade gain.
 * This store only holds the sliders; a music volume of 0 silences music.
 */

export type Channel = 'music' | 'ambience' | 'sfx'

export type Volumes = Record<Channel, number>

export const DEFAULT_VOLUMES: Volumes = { music: 0.75, ambience: 0.18, sfx: 0.6 }

const STORAGE_KEY = 'nosignal.volumes'

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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function load(): Volumes {
  const volumes = { ...DEFAULT_VOLUMES }
  try {
    const storage = getStorage()
    if (!storage) return volumes
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return volumes
    const data = JSON.parse(raw) as Partial<Record<Channel, unknown>> | null
    if (!data || typeof data !== 'object') return volumes
    for (const ch of Object.keys(volumes) as Channel[]) {
      const v = data[ch]
      if (typeof v === 'number' && Number.isFinite(v)) volumes[ch] = clamp01(v)
    }
  } catch {
    // Storage unavailable or corrupt: use defaults.
  }
  return volumes
}

let volumes: Volumes = load()
const MUTE_KEY = 'nosignal.musicMuted'
let musicMuted = (() => {
  try {
    const storage = getStorage()
    return storage?.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<() => void>()

export const mixer = {
  getVolumes: (): Volumes => volumes,
  get: (ch: Channel): number => volumes[ch],
  /** The volume sources should use: the slider, or 0 while music is muted. */
  effective: (ch: Channel): number => (ch === 'music' && musicMuted ? 0 : volumes[ch]),
  isMusicMuted: (): boolean => musicMuted,
  setMusicMuted(muted: boolean) {
    if (muted === musicMuted) return
    musicMuted = muted
    try {
      getStorage()?.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      // Ignore: the setting just won't persist.
    }
    for (const l of listeners) l()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  set(ch: Channel, value: number) {
    const v = clamp01(Number.isFinite(value) ? value : 0)
    if (v === volumes[ch]) return
    volumes = { ...volumes, [ch]: v }
    try {
      getStorage()?.setItem(STORAGE_KEY, JSON.stringify(volumes))
    } catch {
      // Ignore: settings just won't persist.
    }
    for (const l of listeners) l()
  },
}
