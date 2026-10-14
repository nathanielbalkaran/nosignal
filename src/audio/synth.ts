import { Rng } from '../world/rng.ts'

/*
 * Every sound in the game is generated here, once, into small mono buffers
 * (16 kHz, about 1.5 MB in total). There are no audio files, no licences and no
 * network requests. The sounds are deliberately dull and distant: rumble,
 * hiss and a few soft transients, to be heard through walls and across streets.
 */

export const SAMPLE_RATE = 16000

export type SoundName =
  // Loops
  | 'traffic'
  | 'hum'
  | 'vent'
  | 'fan'
  | 'rail'
  | 'engine'
  // One-shots
  | 'birdA'
  | 'birdB'
  | 'dishesA'
  | 'dishesB'
  | 'shutter'
  | 'shutterRise'
  | 'thump'
  | 'pipe'
  | 'clank'
  | 'rattle'
  | 'train'
  | 'announce'
  // Footsteps
  | 'stepPavementA'
  | 'stepPavementB'
  | 'stepPavementC'
  | 'stepBridgeA'
  | 'stepBridgeB'
  | 'stepBridgeC'

const TAU = Math.PI * 2

function lowpass(x: Float32Array, fc: number): Float32Array {
  const a = 1 - Math.exp((-TAU * fc) / SAMPLE_RATE)
  let y = 0
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i] - y)
    x[i] = y
  }
  return x
}

function highpass(x: Float32Array, fc: number): Float32Array {
  const a = Math.exp((-TAU * fc) / SAMPLE_RATE)
  let y = 0
  let prev = 0
  for (let i = 0; i < x.length; i++) {
    const v = x[i]
    y = a * (y + v - prev)
    prev = v
    x[i] = y
  }
  return x
}

function bandpass(x: Float32Array, lo: number, hi: number): Float32Array {
  return lowpass(highpass(x, lo), hi)
}

function normalise(x: Float32Array, peak = 0.9): Float32Array {
  let m = 1e-9
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]))
  const k = peak / m
  for (let i = 0; i < x.length; i++) x[i] *= k
  return x
}

class Gen {
  readonly rng: Rng
  constructor(seed: string) {
    this.rng = new Rng(`audio:${seed}`)
  }

  noise(n: number): Float32Array {
    const x = new Float32Array(n)
    for (let i = 0; i < n; i++) x[i] = this.rng.float() * 2 - 1
    return x
  }
}

/** A noise-based loop that joins itself: the tail is cross-faded into the head. */
function loop(seed: string, seconds: number, make: (g: Gen, n: number, t: (i: number) => number) => Float32Array): Float32Array {
  const g = new Gen(seed)
  const n = Math.round(seconds * SAMPLE_RATE)
  const fade = Math.round(0.4 * SAMPLE_RATE)
  const warm = Math.round(0.5 * SAMPLE_RATE)
  const raw = make(g, n + fade + warm, (i) => (i - warm) / SAMPLE_RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const head = raw[warm + i]
    if (i < fade) {
      const w = i / fade
      out[i] = head * w + raw[warm + n + i] * (1 - w)
    } else out[i] = head
  }
  return normalise(out)
}

function sine(f: number, t: number, phase = 0) {
  return Math.sin(TAU * f * t + phase)
}

function env(t: number, attack: number, decay: number) {
  if (t < 0) return 0
  return Math.min(1, t / attack) * Math.exp(-t / decay)
}

function addClick(out: Float32Array, at: number, freqs: readonly number[], decay: number, amp: number) {
  const start = Math.floor(at * SAMPLE_RATE)
  const len = Math.min(out.length - start, Math.floor(decay * 6 * SAMPLE_RATE))
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE
    let v = 0
    for (const f of freqs) v += sine(f, t)
    out[start + i] += (v / freqs.length) * amp * env(t, 0.001, decay)
  }
}

function addNoiseBurst(out: Float32Array, g: Gen, at: number, seconds: number, amp: number, lo: number, hi: number, decay = seconds / 3) {
  const start = Math.floor(at * SAMPLE_RATE)
  const len = Math.min(out.length - start, Math.floor(seconds * SAMPLE_RATE))
  if (len <= 0) return
  const burst = bandpass(g.noise(len), lo, hi)
  for (let i = 0; i < len; i++) out[start + i] += burst[i] * amp * env(i / SAMPLE_RATE, 0.004, decay)
}

function bird(seed: string): Float32Array {
  const g = new Gen(seed)
  const out = new Float32Array(Math.round(1.6 * SAMPLE_RATE))
  const r = g.rng
  let at = 0.05
  const calls = r.int(3, 5)
  const base = r.range(2300, 3600)
  for (let c = 0; c < calls; c++) {
    const len = r.range(0.07, 0.13)
    const f0 = base * r.range(0.9, 1.25)
    const f1 = f0 * r.range(0.75, 1.4)
    const start = Math.floor(at * SAMPLE_RATE)
    const n = Math.floor(len * SAMPLE_RATE)
    let phase = 0
    for (let i = 0; i < n && start + i < out.length; i++) {
      const u = i / n
      phase += (TAU * (f0 + (f1 - f0) * u)) / SAMPLE_RATE
      out[start + i] += Math.sin(phase) * Math.sin(Math.PI * u) ** 2 * 0.5
    }
    at += len + r.range(0.06, 0.22)
  }
  return normalise(out, 0.7)
}

function dishes(seed: string): Float32Array {
  const g = new Gen(seed)
  const r = g.rng
  const out = new Float32Array(Math.round(2.6 * SAMPLE_RATE))
  let at = 0.05
  const hits = r.int(4, 7)
  for (let i = 0; i < hits; i++) {
    const a = r.range(1900, 4200)
    addClick(out, at, [a, a * r.range(1.5, 2.4), a * r.range(2.6, 3.4)], r.range(0.03, 0.08), r.range(0.3, 0.9))
    if (r.chance(0.35)) addNoiseBurst(out, g, at, 0.06, 0.25, 600, 3000)
    if (r.chance(0.25)) addClick(out, at, [r.range(150, 260)], 0.05, 0.6)
    at += r.range(0.12, 0.5)
  }
  return normalise(lowpass(out, 5200), 0.8)
}

function shutter(seed: string, seconds: number): Float32Array {
  const g = new Gen(seed)
  const n = Math.round(seconds * SAMPLE_RATE)
  const out = bandpass(g.noise(n), 500, 3200)
  const clunkAt = seconds - 0.25
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const body = Math.min(1, t / 0.2) * Math.min(1, (clunkAt - t) / 0.2)
    const rattle = 0.55 + 0.45 * Math.sin(TAU * (26 - t * 3) * t)
    out[i] *= Math.max(0, body) * rattle
  }
  addClick(out, clunkAt, [95, 140], 0.07, 1.4)
  addNoiseBurst(out, g, clunkAt, 0.2, 0.6, 200, 2200, 0.05)
  return normalise(out, 0.85)
}

function thump(seed: string, f: number): Float32Array {
  const g = new Gen(seed)
  const out = new Float32Array(Math.round(1.4 * SAMPLE_RATE))
  addClick(out, 0.05, [f, f * 1.5], 0.09, 1)
  addNoiseBurst(out, g, 0.05, 0.25, 0.5, 80, 500, 0.06)
  addClick(out, 0.55, [f * 0.8], 0.12, 0.8)
  return normalise(lowpass(out, 900), 0.85)
}

function pipe(seed: string): Float32Array {
  const g = new Gen(seed)
  const n = Math.round(2.2 * SAMPLE_RATE)
  const out = bandpass(g.noise(n), 260, 900)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    out[i] *= Math.sin((Math.PI * i) / n) ** 2 * (0.6 + 0.4 * sine(3.1, t) * sine(0.9, t))
  }
  return normalise(out, 0.8)
}

function clank(seed: string): Float32Array {
  const g = new Gen(seed)
  const out = new Float32Array(Math.round(1.6 * SAMPLE_RATE))
  addClick(out, 0.05, [620, 1090, 1710, 2430], 0.28, 1)
  addNoiseBurst(out, g, 0.05, 0.12, 0.5, 900, 5000, 0.03)
  addClick(out, 0.7, [780, 1330, 2010], 0.18, 0.5)
  return normalise(lowpass(out, 6000), 0.8)
}

function rattle(seed: string): Float32Array {
  const g = new Gen(seed)
  const r = g.rng
  const out = new Float32Array(Math.round(1.5 * SAMPLE_RATE))
  let at = 0.05
  for (let i = 0; i < 9; i++) {
    addNoiseBurst(out, g, at, 0.05, r.range(0.3, 1), 1200, 6000, 0.015)
    at += r.range(0.04, 0.16)
  }
  return normalise(out, 0.7)
}

function train(seed: string): Float32Array {
  const g = new Gen(seed)
  const seconds = 14
  const n = Math.round(seconds * SAMPLE_RATE)
  const rumble = lowpass(g.noise(n), 140)
  const hiss = bandpass(g.noise(n), 1800, 4200)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const bell = Math.sin((Math.PI * i) / n) ** 2
    const clack = Math.max(0, sine(6.5, t)) ** 6
    out[i] = (rumble[i] * 6 * bell + hiss[i] * 0.5 * bell * bell * (0.5 + clack)) * (0.75 + 0.25 * clack)
  }
  return normalise(out, 0.85)
}

function announce(seed: string): Float32Array {
  const g = new Gen(seed)
  const r = g.rng
  const out = new Float32Array(Math.round(6 * SAMPLE_RATE))
  addClick(out, 0.1, [740, 1480], 0.5, 0.9)
  addClick(out, 0.95, [587, 1174], 0.6, 0.9)
  // A muffled, wordless voice: band-limited noise gated into syllables.
  const voice = bandpass(g.noise(out.length), 350, 1500)
  let t = 2.2
  while (t < 5.4) {
    const len = r.range(0.07, 0.2)
    const a = Math.floor(t * SAMPLE_RATE)
    const b = Math.min(out.length, Math.floor((t + len) * SAMPLE_RATE))
    for (let i = a; i < b; i++) out[i] += voice[i] * Math.sin((Math.PI * (i - a)) / (b - a)) * 2.4
    t += len + r.range(0.03, 0.12)
  }
  return normalise(lowpass(out, 2200), 0.8)
}

function stepPavement(seed: string): Float32Array {
  const g = new Gen(seed)
  const r = g.rng
  const lenSeconds = 0.11
  const n = Math.round(lenSeconds * SAMPLE_RATE)
  const out = new Float32Array(n)

  // 1. Low-end thud (heel impact with pavement/ground)
  const f0 = r.range(85, 120)
  addClick(out, 0.005, [f0, f0 * 1.4], 0.035, 0.75)

  // 2. Mid-frequency scuff / sole friction on asphalt/stone
  addNoiseBurst(out, g, 0.005, 0.045, 0.45, 350, 1600, 0.018)

  // 3. Subtle micro-grit texture
  addNoiseBurst(out, g, 0.008, 0.025, 0.18, 1800, 3400, 0.01)

  // Lowpass filter to avoid harsh digital clicks
  return normalise(lowpass(out, 1800), 0.45)
}

function stepBridge(seed: string): Float32Array {
  const g = new Gen(seed)
  const r = g.rng
  const lenSeconds = 0.14
  const n = Math.round(lenSeconds * SAMPLE_RATE)
  const out = new Float32Array(n)

  // 1. Steel plate resonant modes (hollow metallic ring)
  const fBase = r.range(380, 460)
  const freqs = [fBase, fBase * 1.62, fBase * 2.45, fBase * 3.8]
  addClick(out, 0.005, freqs, 0.055, 0.7)

  // 2. Hollow deck cavity thud
  const fLow = r.range(170, 220)
  addClick(out, 0.005, [fLow], 0.04, 0.6)

  // 3. Crisp metallic transient / contact click
  addClick(out, 0.003, [1600, 2400], 0.015, 0.35)
  addNoiseBurst(out, g, 0.004, 0.04, 0.4, 800, 4200, 0.018)

  // Retain metallic presence without piercing high frequencies
  return normalise(lowpass(out, 3600), 0.52)
}

/** Everything the game can play, as raw samples. */
export function makeSamples(): Record<SoundName, Float32Array> {
  return {
    traffic: loop('traffic', 6, (g, n, t) => {
      const x = lowpass(g.noise(n), 170)
      for (let i = 0; i < n; i++) {
        const s = t(i)
        x[i] *= 1 + 0.35 * sine(1 / 6, s) + 0.2 * sine(3 / 6, s, 1.3)
      }
      const high = lowpass(highpass(g.noise(n), 600), 1400)
      for (let i = 0; i < n; i++) x[i] = x[i] * 8 + high[i] * 0.4 * (1 + 0.5 * sine(2 / 6, t(i), 0.4))
      return x
    }),
    hum: loop('hum', 4, (g, n, t) => {
      const x = lowpass(g.noise(n), 220)
      for (let i = 0; i < n; i++) {
        const s = t(i)
        x[i] = x[i] * 3 + sine(50, s) * 0.5 + sine(100, s, 0.7) * 0.28 + sine(150, s, 1.9) * 0.12 + sine(250, s, 0.2) * 0.04
      }
      return x
    }),
    vent: loop('vent', 4, (g, n, t) => {
      const x = bandpass(g.noise(n), 220, 1300)
      for (let i = 0; i < n; i++) x[i] = x[i] * (1 + 0.18 * sine(7, t(i))) * (1 + 0.1 * sine(0.5, t(i)))
      return x
    }),
    fan: loop('fan', 4, (g, n, t) => {
      const x = lowpass(g.noise(n), 900)
      for (let i = 0; i < n; i++) {
        const s = t(i)
        x[i] = x[i] * 2.4 * (1 + 0.3 * Math.max(0, sine(9, s))) + sine(96, s) * 0.28
      }
      return x
    }),
    rail: loop('rail', 6, (g, n, t) => {
      const x = lowpass(g.noise(n), 110)
      const hiss = lowpass(highpass(g.noise(n), 2500), 5000)
      for (let i = 0; i < n; i++) x[i] = x[i] * 10 * (1 + 0.3 * sine(1 / 6, t(i), 2)) + hiss[i] * 0.25 + sine(60, t(i)) * 0.15
      return x
    }),
    engine: loop('engine', 3, (g, n, t) => {
      const x = lowpass(g.noise(n), 260)
      for (let i = 0; i < n; i++) {
        const s = t(i)
        let v = 0
        for (let k = 1; k <= 7; k++) v += sine(42 * k, s, k) / k
        x[i] = x[i] * 2 + v * 0.55 * (1 + 0.1 * sine(5, s))
      }
      return lowpass(x, 700)
    }),
    birdA: bird('birdA'),
    birdB: bird('birdB'),
    dishesA: dishes('dishesA'),
    dishesB: dishes('dishesB'),
    shutter: shutter('shutter', 1.7),
    shutterRise: shutter('shutterRise', 3.4),
    thump: thump('thump', 72),
    pipe: pipe('pipe'),
    clank: clank('clank'),
    rattle: rattle('rattle'),
    train: train('train'),
    announce: announce('announce'),
    stepPavementA: stepPavement('stepPavementA'),
    stepPavementB: stepPavement('stepPavementB'),
    stepPavementC: stepPavement('stepPavementC'),
    stepBridgeA: stepBridge('stepBridgeA'),
    stepBridgeB: stepBridge('stepBridgeB'),
    stepBridgeC: stepBridge('stepBridgeC'),
  }
}
