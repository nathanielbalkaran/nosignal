import { session, type SessionStatus } from '../../game/session.ts'
import { mixer } from '../mixer.ts'
import { DEFAULT_TRACK, FADE_END_MS, FADE_IN_MS, FADE_OUT_MS, MUSIC_BASE_GAIN, TRACKS, trackUrl } from './tracks.ts'

/*
 * Soundtrack on a single HTMLAudioElement, so two songs can never overlap.
 * Changing track fades the old one out, swaps the source, and fades the new
 * one in. Pausing keeps the element (and its position) so music resumes where
 * it stopped. Nothing plays until the player has clicked Begin.
 */

const STORAGE_KEY = 'nosignal.music'
const FADE_STEP_MS = 30

export interface MusicState {
  index: number
}

export interface MusicNotice {
  index: number
  /** Increments on every notification, so identical repeats still retrigger. */
  id: number
}

function loadPrefs(): MusicState {
  const prefs: MusicState = { index: DEFAULT_TRACK }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return prefs
    const data = JSON.parse(raw) as { track?: unknown }
    if (typeof data.track === 'number' && Number.isInteger(data.track) && data.track >= 0 && data.track < TRACKS.length) {
      prefs.index = data.track
    }
  } catch {
    // Storage unavailable or corrupt: use defaults.
  }
  return prefs
}

function savePrefs(state: MusicState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ track: state.index }))
  } catch {
    // Ignore: preferences just won't persist.
  }
}

class MusicPlayer {
  private state: MusicState = loadPrefs()
  private notice: MusicNotice | null = null
  private noticeId = 0
  private readonly stateListeners = new Set<() => void>()
  private readonly noticeListeners = new Set<() => void>()

  private audio: HTMLAudioElement | null = null
  private loadedIndex = -1
  /** Temporary fade gain, 0..1. */
  private level = 0
  private fadeToken = 0
  private fadeTimer = 0
  private unlocked = false
  private playing = false
  private ended = false
  private hidden = false

  // --- external store plumbing (stable references, so React rerenders only on change) ---
  readonly getState = (): MusicState => this.state
  readonly getNotice = (): MusicNotice | null => this.notice
  readonly subscribeState = (l: () => void) => {
    this.stateListeners.add(l)
    return () => this.stateListeners.delete(l)
  }
  readonly subscribeNotice = (l: () => void) => {
    this.noticeListeners.add(l)
    return () => this.noticeListeners.delete(l)
  }

  private setState(next: MusicState) {
    this.state = next
    savePrefs(next)
    for (const l of this.stateListeners) l()
  }

  private showNotice() {
    this.notice = { index: this.state.index, id: ++this.noticeId }
    for (const l of this.noticeListeners) l()
  }

  // --- gesture + lifecycle ---

  /** Call from the click that begins play. Allows audio from now on and clears an ended game. */
  unlock() {
    this.unlocked = true
    this.ended = false
    this.ensureAudio()
    this.sync()
  }

  private ensureAudio() {
    if (!this.audio && typeof Audio !== 'undefined') {
      const audio = new Audio()
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = 0
      audio.addEventListener('error', this.onError)
      audio.addEventListener('playing', this.onPlaying)
      this.audio = audio
    }
  }

  /** Subscribes to the session and tab visibility. Returns a cleanup function. */
  attach(): () => void {
    const onStatus = () => this.onStatus(session.getStatus())
    const onVisibility = () => {
      this.hidden = document.hidden
      this.sync()
    }
    // Browsers block sound until the page has had a user gesture, so any first interaction unlocks it.
    const onGesture = () => {
      removeGestureListeners()
      this.unlock()
    }
    const gestureEvents = ['pointerdown', 'keydown', 'touchstart'] as const
    const removeGestureListeners = () => {
      for (const type of gestureEvents) window.removeEventListener(type, onGesture, true)
    }
    for (const type of gestureEvents) window.addEventListener(type, onGesture, true)

    const unsubscribe = session.subscribe(onStatus)
    // Slider changes apply to the live element at once; no restart, no seek.
    const unsubscribeMixer = mixer.subscribe(() => this.applyVolume())
    document.addEventListener('visibilitychange', onVisibility)
    this.hidden = document.hidden
    this.playing = session.getStatus() !== 'paused'
    // Try to start as soon as the page opens; if the browser refuses, the first gesture does it.
    this.unlocked = true
    this.ensureAudio()
    this.sync()
    return () => {
      removeGestureListeners()
      unsubscribe()
      unsubscribeMixer()
      document.removeEventListener('visibilitychange', onVisibility)
      this.dispose()
    }
  }

  private dispose() {
    this.cancelFade()
    if (this.audio) {
      this.audio.removeEventListener('error', this.onError)
      this.audio.removeEventListener('playing', this.onPlaying)
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio = null
    }
    this.loadedIndex = -1
    this.level = 0
    this.playing = false
    this.unlocked = false
  }

  private onStatus(status: SessionStatus) {
    const wasPlaying = this.playing
    // Music plays on the title screen and in-game; only a pause stops it.
    this.playing = status !== 'paused'
    if (this.playing === wasPlaying) return
    this.sync()
  }

  private hasStarted = false

  private announce() {
    this.hasStarted = true
    this.showNotice()
  }

  /** First time sound actually starts (not merely requested), show the notification. */
  private readonly onPlaying = () => {
    if (!this.hasStarted) this.announce()
  }

  private readonly onError = () => {
    const audio = this.audio
    console.warn(`[music] could not load or decode track ${this.loadedIndex + 1}`, audio?.error?.message ?? '')
  }

  // --- controls ---

  select(index: number) {
    const i = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length
    if (i === this.state.index) return
    this.setState({ ...this.state, index: i })
    // Show the now-playing popup right away, including when switching from the pause menu.
    this.announce()
    this.sync()
  }

  next() {
    this.select(this.state.index + 1)
  }

  previous() {
    this.select(this.state.index - 1)
  }

  /** Fades the music out when the game ends. Begin again (unlock) to restart it. */
  endGame() {
    this.ended = true
    this.sync(FADE_END_MS)
  }

  // --- playback ---

  private shouldPlay(): boolean {
    return this.unlocked && this.playing && !this.ended && !this.hidden
  }

  private sync(outMs = FADE_OUT_MS) {
    const audio = this.audio
    if (!audio) return

    if (!this.shouldPlay()) {
      this.fadeTo(0, outMs, () => audio.pause())
      return
    }

    if (this.loadedIndex !== this.state.index) {
      if (!audio.paused && this.level > 0) {
        this.fadeTo(0, FADE_OUT_MS, () => this.startTrack())
      } else {
        this.startTrack()
      }
      return
    }

    this.play(audio)
    this.fadeTo(1, FADE_IN_MS)
  }

  private startTrack() {
    const audio = this.audio
    if (!audio) return
    this.loadedIndex = this.state.index
    audio.src = trackUrl(TRACKS[this.loadedIndex])
    audio.currentTime = 0
    this.setLevel(0)
    this.play(audio)
    this.fadeTo(1, FADE_IN_MS)
  }

  private play(audio: HTMLAudioElement) {
    if (!audio.paused) return
    audio.play().catch((err: unknown) => {
      // Autoplay refusal or an interrupted load; the next sync tries again.
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Blocked before any gesture: wait for the first interaction instead.
      if (err instanceof DOMException && err.name === 'NotAllowedError') return
      console.warn('[music] playback did not start', err)
    })
  }

  private setLevel(v: number) {
    this.level = v
    this.applyVolume()
  }

  /** effective volume = base gain × music channel volume × fade gain. */
  private applyVolume() {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, MUSIC_BASE_GAIN * mixer.get('music') * this.level))
  }

  private cancelFade() {
    this.fadeToken++
    window.clearInterval(this.fadeTimer)
  }

  /** Linear fade of the element volume. A newer fade cancels this one, so `done` only runs if it finished. */
  private fadeTo(target: number, ms: number, done?: () => void) {
    this.cancelFade()
    const token = this.fadeToken
    const from = this.level
    if (ms <= 0 || from === target) {
      this.setLevel(target)
      done?.()
      return
    }
    const start = performance.now()
    this.fadeTimer = window.setInterval(() => {
      if (token !== this.fadeToken) return
      const t = Math.min(1, (performance.now() - start) / ms)
      this.setLevel(from + (target - from) * t)
      if (t >= 1) {
        window.clearInterval(this.fadeTimer)
        done?.()
      }
    }, FADE_STEP_MS)
  }
}

export const music = new MusicPlayer()
