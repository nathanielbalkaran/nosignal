/*
 * User-facing channel volumes (0..1), shared by music and ambience.
 * Each audio source computes: base gain × channel volume × temporary fade gain.
 * This store only holds the sliders; a music volume of 0 silences music.
 */

export type Channel = 'music' | 'ambience'

export type Volumes = Record<Channel, number>

export const DEFAULT_VOLUMES: Volumes = { music: 0.75, ambience: 0.2 }

const STORAGE_KEY = 'nosignal.volumes'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function load(): Volumes {
  const volumes = { ...DEFAULT_VOLUMES }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
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
const listeners = new Set<() => void>()

export const mixer = {
  getVolumes: (): Volumes => volumes,
  get: (ch: Channel): number => volumes[ch],
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes))
    } catch {
      // Ignore: settings just won't persist.
    }
    for (const l of listeners) l()
  },
}
