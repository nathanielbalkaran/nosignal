import { session } from '../game/session.ts'
import { Rng } from '../world/rng.ts'
import { mixer } from './mixer.ts'
import { SAMPLE_RATE, makeSamples, type SoundName } from './synth.ts'
import { ZONES, attenuate, trunkLevel, zoneLevel, type ZoneName } from './zones.ts'

/*
 * Ambient audio on plain Web Audio. A handful of looping beds (traffic, hum,
 * ventilation, restaurant fan, railway) are faded by distance to their zone,
 * and a few one-shot sounds are scheduled with seeded timing. A bed is only
 * running while it is audible, and at most three one-shots overlap.
 *
 * Nothing here is needed to play. If the browser has no Web Audio the whole
 * module quietly does nothing.
 */

const MASTER = 0.85
const MAX_ONE_SHOTS = 3
const APPLY_INTERVAL = 0.1

interface Bed {
  name: SoundName
  /** Target gain from the player's position. */
  level: (z: Levels) => number
  rate?: number
  lowpass?: number
  source: AudioBufferSourceNode | null
  gain: GainNode | null
  current: number
}

type Levels = Record<ZoneName, number> & { trunk: number; vehicle: number }

interface Shot {
  zone: ZoneName | null
  min: number
  max: number
  next: number
  pick(r: Rng): { sound: SoundName; gain: number; rate: number; lowpass?: number }
}

const bed = (name: SoundName, level: Bed['level'], extra: { rate?: number; lowpass?: number } = {}): Bed => ({ name, level, ...extra, source: null, gain: null, current: 0 })

class AmbientAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** master (pause fade) <- ambience bus (user volume) <- every ambient source. */
  private ambienceBus: GainNode | null = null
  private buffers = new Map<SoundName, AudioBuffer>()
  private running = false
  private suspendTimer = 0
  private clock = 0
  private applyIn = 0
  private active = 0
  private readonly rng = new Rng('audio:schedule')
  private vehicle = 0

  private readonly beds: Bed[] = [
    bed('traffic', (l) => 0.2 + 0.2 * l.trunk, { lowpass: 900 }),
    bed('hum', () => 0.09),
    bed('vent', (l) => 0.035 + 0.14 * l.residential, { rate: 0.9 }),
    bed('fan', (l) => 0.2 * l.restaurant),
    bed('rail', (l) => 0.2 * l.station + 0.035 * l.railFar),
    bed('engine', (l) => 0.5 * l.vehicle, { lowpass: 500 }),
  ]

  private readonly shots: Shot[] = [
    { zone: null, min: 14, max: 34, next: 6, pick: (r) => ({ sound: r.chance(0.5) ? 'birdA' : 'birdB', gain: r.range(0.05, 0.1), rate: r.range(0.85, 1.25) }) },
    { zone: null, min: 25, max: 60, next: 20, pick: (r) => ({ sound: r.chance(0.5) ? 'thump' : 'pipe', gain: 0.07, rate: r.range(0.9, 1.1), lowpass: 800 }) },
    { zone: 'restaurant', min: 4, max: 10, next: 2, pick: (r) => ({ sound: r.chance(0.5) ? 'dishesA' : 'dishesB', gain: 0.4, rate: r.range(0.95, 1.08) }) },
    { zone: 'market', min: 16, max: 34, next: 8, pick: (r) => ({ sound: 'shutter', gain: 0.3, rate: r.range(0.9, 1.15), lowpass: 2500 }) },
    { zone: 'market', min: 20, max: 44, next: 14, pick: (r) => ({ sound: 'thump', gain: 0.35, rate: r.range(0.85, 1.0) }) },
    { zone: 'residential', min: 10, max: 26, next: 6, pick: (r) => ({ sound: r.chance(0.55) ? 'thump' : 'pipe', gain: 0.3, rate: r.range(1.0, 1.4), lowpass: 1400 }) },
    { zone: 'construction', min: 7, max: 16, next: 4, pick: (r) => ({ sound: r.chance(0.6) ? 'clank' : 'rattle', gain: 0.32, rate: r.range(0.85, 1.2) }) },
    { zone: 'station', min: 45, max: 85, next: 12, pick: () => ({ sound: 'train', gain: 0.55, rate: 1 }) },
    // Far off and muffled; comes and goes, never a GPS beacon.
    { zone: 'railFar', min: 60, max: 110, next: 25, pick: (r) => ({ sound: 'train', gain: 0.22, rate: r.range(0.92, 1.0), lowpass: 700 }) },
    { zone: 'station', min: 70, max: 130, next: 30, pick: () => ({ sound: 'announce', gain: 0.4, rate: 1, lowpass: 1800 }) },
  ]

  /** Creates the audio context. Must be called from a user gesture (the click that starts play). */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      try {
        this.ctx = new Ctor({ latencyHint: 'playback' })
      } catch {
        return
      }
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)
      this.ambienceBus = this.ctx.createGain()
      this.ambienceBus.connect(this.master)
      this.applyVolumes()
      const samples = makeSamples()
      for (const [name, data] of Object.entries(samples) as [SoundName, Float32Array][]) {
        const b = this.ctx.createBuffer(1, data.length, SAMPLE_RATE)
        b.copyToChannel(data as Float32Array<ArrayBuffer>, 0)
        this.buffers.set(name, b)
      }
    }
    this.sync()
  }

  /** Follows the session, the tab's visibility and window focus. */
  attach(): () => void {
    const sync = () => this.sync()
    const unsub = session.subscribe(sync)
    const unsubMixer = mixer.subscribe(() => this.applyVolumes())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('blur', sync)
    window.addEventListener('focus', sync)
    return () => {
      unsub()
      unsubMixer()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('blur', sync)
      window.removeEventListener('focus', sync)
      this.setRunning(false)
    }
  }

  /** Applies the ambience slider. Set directly (not ramped) so it also holds while the context is suspended. */
  private applyVolumes() {
    const bus = this.ambienceBus
    if (!bus || !this.ctx) return
    bus.gain.cancelScheduledValues(this.ctx.currentTime)
    bus.gain.value = mixer.get('ambience')
  }

  private sync() {
    const want = session.getStatus() === 'playing' && !document.hidden && document.hasFocus()
    if (want && !this.ctx) this.unlock()
    this.setRunning(want)
  }

  private setRunning(on: boolean) {
    const { ctx, master } = this
    if (!ctx || !master || on === this.running) return
    this.running = on
    window.clearTimeout(this.suspendTimer)
    if (on) {
      void ctx.resume()
      master.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.4)
    } else {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
      this.suspendTimer = window.setTimeout(() => {
        if (!this.running) void ctx.suspend()
      }, 400)
    }
  }

  /** Drives beds and scheduled sounds. Cheap enough to call every frame. */
  update(dt: number, x: number, z: number) {
    const { ctx } = this
    if (!ctx || !this.running) return
    this.clock += dt
    this.applyIn -= dt
    if (this.applyIn > 0) return
    this.applyIn = APPLY_INTERVAL

    const levels = { trunk: trunkLevel(x, z), vehicle: this.vehicle } as Levels
    for (const name of Object.keys(ZONES) as ZoneName[]) levels[name] = zoneLevel(ZONES[name], x, z)

    for (const b of this.beds) this.driveBed(b, b.level(levels))

    for (const s of this.shots) {
      if (this.clock < s.next) continue
      const level = s.zone ? levels[s.zone] : 1
      if (level < 0.06 || this.active >= MAX_ONE_SHOTS) {
        s.next = this.clock + 1.5
        continue
      }
      s.next = this.clock + this.rng.range(s.min, s.max)
      const p = s.pick(this.rng)
      this.play(p.sound, p.gain * level, p.rate, p.lowpass, this.rng.range(-0.6, 0.6))
    }
  }

  private driveBed(b: Bed, target: number) {
    const ctx = this.ctx!
    if (!b.source) {
      if (target < 0.01) return
      const buffer = this.buffers.get(b.name)
      if (!buffer) return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.playbackRate.value = b.rate ?? 1
      const gain = ctx.createGain()
      gain.gain.value = 0
      let tail: AudioNode = source
      if (b.lowpass) {
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = b.lowpass
        source.connect(f)
        tail = f
      }
      tail.connect(gain).connect(this.ambienceBus!)
      // Start part-way in so beds do not all begin at the same phase.
      source.start(0, this.rng.float() * buffer.duration)
      b.source = source
      b.gain = gain
    }
    b.gain!.gain.setTargetAtTime(target, ctx.currentTime, 0.5)
    b.current = target
    // Stop beds that have faded out, so only the audible ones are running.
    if (target < 0.004 && b.source) {
      const source = b.source
      const gain = b.gain!
      b.source = null
      b.gain = null
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25)
      window.setTimeout(() => {
        source.stop()
        gain.disconnect()
      }, 1500)
    }
  }

  /** One-shot at a given loudness (already attenuated by the caller). */
  play(sound: SoundName, gain: number, rate = 1, lowpass?: number, pan = 0) {
    const { ctx } = this
    const buffer = this.buffers.get(sound)
    if (!ctx || !this.running || !buffer || gain < 0.004) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    const g = ctx.createGain()
    g.gain.value = gain
    let tail: AudioNode = source
    if (lowpass) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = lowpass
      source.connect(f)
      tail = f
    }
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    tail.connect(g).connect(panner).connect(this.ambienceBus!)
    this.active++
    source.onended = () => {
      this.active--
      panner.disconnect()
    }
    source.start()
  }

  /** A scripted event sound (ambience channel) heard from `distance` metres away. */
  playAt(sound: SoundName, distance: number, radius: number, gain: number, rate = 1, lowpass?: number) {
    this.play(sound, gain * attenuate(distance, radius), rate, lowpass, 0)
  }

  /** Engine loudness for the passing delivery vehicle (0 when there is none). */
  setVehicle(level: number) {
    this.vehicle = level
  }
}

export const ambientAudio = new AmbientAudio()
