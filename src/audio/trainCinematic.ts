import { ambientAudio } from './ambient.ts'

/*
 * Procedural Web Audio soundscape for the train cinematic sequence.
 * Generates:
 * - Train door closing chimes, pneumatic sliding, and heavy latch thud
 * - Traction motor inverter whine during acceleration
 * - Gentle railway track clatter (rhythmic wheel-on-rail clicks)
 * - Deep rolling rail rumble and subtle carriage rattling
 * - Distant city ambient fade-out
 * All sounds scale with the user's Ambience slider.
 */

export interface TrainAudioController {
  update(time: number, dt: number, speed: number): void
  stop(): void
  dispose(): void
}

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

export function createTrainAudio(): TrainAudioController {
  const ctx = ambientAudio.getCtx()
  if (!ctx) {
    return {
      update() {},
      stop() {},
      dispose() {},
    }
  }

  // Master bus for train cinematic sound effects
  const masterBus = ctx.createGain()
  const ambienceBus = ambientAudio.getAmbienceBus()
  if (ambienceBus) {
    masterBus.connect(ambienceBus)
  } else {
    masterBus.connect(ctx.destination)
  }

  const noiseBuffer = createNoiseBuffer(ctx, 3.0)

  // 1. Traction motor inverter (VVVF)
  const motorOsc1 = ctx.createOscillator()
  const motorOsc2 = ctx.createOscillator()
  const motorGain = ctx.createGain()
  motorOsc1.type = 'sawtooth'
  motorOsc2.type = 'sine'
  motorOsc1.frequency.value = 85
  motorOsc2.frequency.value = 170

  const motorFilter = ctx.createBiquadFilter()
  motorFilter.type = 'lowpass'
  motorFilter.frequency.value = 450

  motorOsc1.connect(motorFilter)
  motorOsc2.connect(motorFilter)
  motorFilter.connect(motorGain)
  motorGain.connect(masterBus)
  motorGain.gain.value = 0

  motorOsc1.start()
  motorOsc2.start()

  // 2. Rolling wheel-rail rumble (filtered noise loop)
  const rumbleSource = ctx.createBufferSource()
  rumbleSource.buffer = noiseBuffer
  rumbleSource.loop = true
  const rumbleFilter = ctx.createBiquadFilter()
  rumbleFilter.type = 'lowpass'
  rumbleFilter.frequency.value = 140
  const rumbleGain = ctx.createGain()
  rumbleGain.gain.value = 0

  rumbleSource.connect(rumbleFilter)
  rumbleFilter.connect(rumbleGain)
  rumbleGain.connect(masterBus)
  rumbleSource.start()

  // 3. Track rhythm generator
  let nextClack = 3.2
  let doorChimeFired = false
  let doorSlideFired = false
  let doorThudFired = false
  let nextRattle = 4.5

  function playTone(freq: number, duration: number, gainVal: number, delay = 0) {
    if (!ctx) return
    const now = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    g.gain.setValueAtTime(0.001, now)
    g.gain.linearRampToValueAtTime(gainVal, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(g)
    g.connect(masterBus)
    osc.start(now)
    osc.stop(now + duration)
  }

  function playDoorSlide() {
    if (!ctx) return
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1400, now)
    filter.frequency.exponentialRampToValueAtTime(450, now + 1.2)
    filter.Q.value = 2.0

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.001, now)
    g.gain.linearRampToValueAtTime(0.18, now + 0.2)
    g.gain.linearRampToValueAtTime(0.12, now + 1.0)
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.3)

    src.connect(filter)
    filter.connect(g)
    g.connect(masterBus)
    src.start(now)
    src.stop(now + 1.35)
  }

  function playDoorThud() {
    if (!ctx) return
    const now = ctx.currentTime
    // Low heavy thud
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(80, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2)
    oscGain.gain.setValueAtTime(0.4, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc.connect(oscGain)
    oscGain.connect(masterBus)
    osc.start(now)
    osc.stop(now + 0.25)

    // Rubber contact click
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 350
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.2, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    src.connect(f)
    f.connect(g)
    g.connect(masterBus)
    src.start(now)
    src.stop(now + 0.12)
  }

  function playWheelClick(gainScale: number) {
    if (!ctx) return
    const now = ctx.currentTime
    // Dual wheel click "ka-tunk"
    for (const offset of [0, 0.08]) {
      const t = now + offset
      const osc = ctx.createOscillator()
      const og = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(140 + Math.random() * 40, t)
      og.gain.setValueAtTime(0.18 * gainScale, t)
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      osc.connect(og)
      og.connect(masterBus)
      osc.start(t)
      osc.stop(t + 0.06)

      const noise = ctx.createBufferSource()
      noise.buffer = noiseBuffer
      const nf = ctx.createBiquadFilter()
      nf.type = 'bandpass'
      nf.frequency.value = 800 + Math.random() * 400
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0.12 * gainScale, t)
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      noise.connect(nf)
      nf.connect(ng)
      ng.connect(masterBus)
      noise.start(t)
      noise.stop(t + 0.05)
    }
  }

  function playCarriageRattle() {
    if (!ctx) return
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 2200 + Math.random() * 800
    f.Q.value = 4.0
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.03 + Math.random() * 0.03, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    src.connect(f)
    f.connect(g)
    g.connect(masterBus)
    src.start(now)
    src.stop(now + 0.2)
  }

  let stopped = false

  return {
    update(time: number, _dt: number, speed: number) {
      if (stopped || !ctx) return
      const now = ctx.currentTime

      // 1. Door sequence
      if (!doorChimeFired && time >= 0.4) {
        doorChimeFired = true
        // Japanese/MTR style two-tone warning chime: G5 -> E5
        playTone(784, 0.22, 0.12, 0.0)
        playTone(659, 0.35, 0.12, 0.22)
      }
      if (!doorSlideFired && time >= 0.95) {
        doorSlideFired = true
        playDoorSlide()
      }
      if (!doorThudFired && time >= 2.2) {
        doorThudFired = true
        playDoorThud()
      }

      // 2. Traction motor inverter pitch & gain
      if (time >= 2.3 && speed > 0.01) {
        // Accelerating VVVF sound glides up smoothly with speed
        const targetPitch = 70 + speed * 220 + Math.sin(time * 6.0) * 4
        motorOsc1.frequency.setTargetAtTime(targetPitch, now, 0.1)
        motorOsc2.frequency.setTargetAtTime(targetPitch * 1.5, now, 0.1)
        const targetGain = Math.min(0.14, speed * 0.14)
        motorGain.gain.setTargetAtTime(targetGain, now, 0.15)
      } else {
        motorGain.gain.setTargetAtTime(0, now, 0.1)
      }

      // 3. Rolling wheel rail rumble
      if (speed > 0.05) {
        const rumbleTarget = Math.min(0.25, speed * 0.25)
        rumbleGain.gain.setTargetAtTime(rumbleTarget, now, 0.2)
        rumbleFilter.frequency.setTargetAtTime(90 + speed * 70, now, 0.2)
      } else {
        rumbleGain.gain.setTargetAtTime(0, now, 0.1)
      }

      // 4. Rhythmic rail clacks
      if (speed > 0.2 && time >= nextClack) {
        playWheelClick(Math.min(1.0, speed))
        // Distance between rail joints: faster train = shorter interval
        const interval = Math.max(0.65, 1.4 / Math.max(0.2, speed))
        nextClack = time + interval + (Math.random() - 0.5) * 0.06
      }

      // 5. Subtle carriage rattling & suspension creaks
      if (speed > 0.3 && time >= nextRattle) {
        playCarriageRattle()
        nextRattle = time + 2.0 + Math.random() * 3.5
      }
    },

    stop() {
      if (stopped || !ctx) return
      stopped = true
      const now = ctx.currentTime
      masterBus.gain.setTargetAtTime(0, now, 0.2)
      window.setTimeout(() => {
        try {
          motorOsc1.stop()
          motorOsc2.stop()
          rumbleSource.stop()
          masterBus.disconnect()
        } catch {
          // Ignore
        }
      }, 350)
    },

    dispose() {
      this.stop()
    },
  }
}
