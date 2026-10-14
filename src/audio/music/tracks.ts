/** The NO SIGNAL FM soundtrack. Files keep their original names; players only ever see `title`. */

export interface Track {
  /** File inside public/audio/music/ (never shown to players). */
  file: string
  /** Display title, exactly as shown in the UI. */
  title: string
}

export const ARTIST = 'Nathaniel Balkaran'

export const TRACKS: readonly Track[] = [
  { file: 'SigmondFreudBeat.mp3', title: 'no signal (theme)' },
  { file: '930inMarkham.mp3', title: 'nine thirty' },
  { file: 'battle bus.mp3', title: 'battlebus' },
  { file: 'legendofzelda_1.mp3', title: 'wannabe' },
  { file: 'black.mp3', title: 'voices calling' },
  { file: 'SWAG.mp3', title: 'waiting for a call' },
  // macOS put a narrow no-break space (U+202F) before "PM" in this filename.
  { file: 'gapingbeat - 2024-03-31, 2.12\u202fPM.m4a', title: 'dazed and confused' },
  { file: 'lucky.mp3', title: 'get your hopes up' },
]

/** "no signal (theme)" plays by default for first-time players. */
export const DEFAULT_TRACK = TRACKS.findIndex((t) => t.title === 'no signal (theme)')

/** Base gain of every soundtrack file; the music slider scales this. 0..1. */
export const MUSIC_BASE_GAIN = 0.9

/** Fade lengths in milliseconds. */
export const FADE_OUT_MS = 180
export const FADE_IN_MS = 350
export const FADE_END_MS = 1500

/** Seconds the now-playing notification stays up before it fades. */
export const NOTICE_SECONDS = 3

/** Spaces and unusual characters are encoded; commas stay literal because Vite's dev server rejects %2C. */
export function trackUrl(track: Track): string {
  return `${import.meta.env.BASE_URL}audio/music/${encodeURIComponent(track.file).replace(/%2C/g, ',')}`
}
