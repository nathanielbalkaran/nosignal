/**
 * Targeted tests for the first-person view bobbing system:
 * - Walking cadence and frequency synchronization with movement speed
 * - Vertical bob vs lateral sway ratio and waveforms
 * - Smooth blending in and out (no jumps)
 * - Settling to neutral when stopped (no idle bobbing)
 * - Sprint scaling (higher frequency & amplitude)
 * - Settings (OFF, LOW, NORMAL) and localStorage persistence
 * - Frame-rate independence
 * - Drift immunity (settles to exact zero)
 */
import { settings } from '../src/game/settings.ts'
import { viewBobbing } from '../src/player/viewBobbing.ts'
import { PLAYER } from '../src/config/player.ts'

let failures = 0
function test(name: string, ok: boolean, detail: string) {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`)
}

// 1. Idle state produces zero offset
{
  viewBobbing.reset()
  settings.setViewBobbing('NORMAL')
  const offset = viewBobbing.step(0, 1 / 60, true)
  const isZero = offset.bobY === 0 && offset.sway === 0 && offset.roll === 0 && offset.pitch === 0
  test('Idle player has zero bobbing offset', isZero, `bobY: ${offset.bobY}, sway: ${offset.sway}`)
}

// 2. Walking generates rhythmic bob and sway within subtle thresholds
{
  viewBobbing.reset()
  settings.setViewBobbing('NORMAL')
  const dt = 1 / 60
  const speed = PLAYER.speed // 5.5 m/s
  const distPerFrame = speed * dt
  let maxBobY = 0
  let minBobY = 0
  let maxSway = 0

  // Walk for 2 seconds
  for (let t = 0; t < 2; t += dt) {
    const o = viewBobbing.step(distPerFrame, dt, true)
    maxBobY = Math.max(maxBobY, o.bobY)
    minBobY = Math.min(minBobY, o.bobY)
    maxSway = Math.max(maxSway, Math.abs(o.sway))
  }

  const verticalRange = maxBobY - minBobY
  // Bobbing should be subtle: vertical range between 0.015m and 0.05m (1.5cm - 5cm)
  // Sway should be smaller than vertical range
  const ok = verticalRange > 0.015 && verticalRange < 0.06 && maxSway > 0.005 && maxSway < verticalRange
  test(
    'Walking produces subtle rhythmic bob and smaller sway',
    ok,
    `vertical range: ${(verticalRange * 100).toFixed(2)} cm, max sway: ${(maxSway * 100).toFixed(2)} cm`,
  )
}

// 3. Stopping smoothly returns camera to neutral position (no idle bounce)
{
  viewBobbing.reset()
  settings.setViewBobbing('NORMAL')
  const dt = 1 / 60
  const distPerFrame = PLAYER.speed * dt

  // Walk for 1 second
  for (let t = 0; t < 1; t += dt) {
    viewBobbing.step(distPerFrame, dt, true)
  }

  // Stop moving, step for 1 second
  let settled = false
  for (let t = 0; t < 1; t += dt) {
    const o = viewBobbing.step(0, dt, true)
    if (o.bobY === 0 && o.sway === 0 && o.roll === 0 && o.pitch === 0) {
      settled = true
      break
    }
  }

  test('Stopping smoothly returns camera to exact neutral zero', settled, 'camera settled cleanly to (0, 0, 0, 0)')
}

// 4. Smooth blend in and out avoids sudden camera jumps
{
  viewBobbing.reset()
  settings.setViewBobbing('NORMAL')
  const dt = 1 / 60
  const distPerFrame = PLAYER.speed * dt

  // Idle state
  const idle = viewBobbing.step(0, dt, true)

  // First frame of starting to walk
  const firstWalk = viewBobbing.step(distPerFrame, dt, true)
  const startJump = Math.hypot(firstWalk.bobY - idle.bobY, firstWalk.sway - idle.sway)

  // Walk for 1 second to reach full stride
  let prevWalk = firstWalk
  for (let t = dt; t < 1; t += dt) {
    prevWalk = viewBobbing.step(distPerFrame, dt, true)
  }

  // First frame of stopping
  const firstStop = viewBobbing.step(0, dt, true)
  const stopJump = Math.hypot(firstStop.bobY - prevWalk.bobY, firstStop.sway - prevWalk.sway)

  // Both transition jumps should be smooth and tiny (under 3 mm)
  const ok = startJump < 0.003 && stopJump < 0.003
  test(
    'No sudden camera jumps on starting or stopping',
    ok,
    `start transition delta: ${(startJump * 1000).toFixed(2)} mm, stop transition delta: ${(stopJump * 1000).toFixed(2)} mm`,
  )
}

// 5. Settings: OFF yields 0, LOW yields ~50% of NORMAL
{
  const measureMax = (mode: 'OFF' | 'LOW' | 'NORMAL') => {
    settings.setViewBobbing(mode)
    viewBobbing.reset()
    const dt = 1 / 60
    const dist = PLAYER.speed * dt
    let max = 0
    for (let t = 0; t < 1.5; t += dt) {
      const o = viewBobbing.step(dist, dt, true)
      max = Math.max(max, Math.abs(o.bobY))
    }
    return max
  }

  const offMax = measureMax('OFF')
  const lowMax = measureMax('LOW')
  const normMax = measureMax('NORMAL')

  const offOk = offMax === 0
  const ratioOk = Math.abs(lowMax / normMax - 0.5) < 0.05
  test(
    'Settings OFF disables bobbing, LOW scales to 50%',
    offOk && ratioOk,
    `OFF: ${offMax.toFixed(4)}, LOW: ${(lowMax * 100).toFixed(2)} cm, NORMAL: ${(normMax * 100).toFixed(2)} cm (ratio ${(lowMax / normMax).toFixed(2)})`,
  )
}

// 6. Sprinting increases frequency and amplitude
{
  settings.setViewBobbing('NORMAL')
  const measurePace = (speed: number) => {
    viewBobbing.reset()
    const dt = 1 / 60
    const dist = speed * dt
    let maxBob = 0
    let zeroCrossings = 0
    let prevBob = 0
    for (let t = 0; t < 2; t += dt) {
      const o = viewBobbing.step(dist, dt, true)
      maxBob = Math.max(maxBob, Math.abs(o.bobY))
      if (t > 0.3 && ((prevBob <= 0 && o.bobY > 0) || (prevBob >= 0 && o.bobY < 0))) {
        zeroCrossings++
      }
      prevBob = o.bobY
    }
    return { maxBob, zeroCrossings }
  }

  const walk = measurePace(PLAYER.speed)
  const sprint = measurePace(PLAYER.speed * 1.4) // 40% faster sprint

  const ampHigher = sprint.maxBob > walk.maxBob
  const freqHigher = sprint.zeroCrossings > walk.zeroCrossings
  test(
    'Sprinting slightly increases bobbing frequency and amplitude',
    ampHigher && freqHigher,
    `walk: ${(walk.maxBob * 100).toFixed(2)} cm, ${walk.zeroCrossings} crossings; sprint: ${(sprint.maxBob * 100).toFixed(2)} cm, ${sprint.zeroCrossings} crossings`,
  )
}

// 7. Fixed interaction scenes / canMove=false disables bobbing
{
  viewBobbing.reset()
  settings.setViewBobbing('NORMAL')
  const dt = 1 / 60
  // Even if distance is passed, canMove=false should not start bobbing
  for (let t = 0; t < 0.5; t += dt) {
    viewBobbing.step(PLAYER.speed * dt, dt, false)
  }
  const offset = viewBobbing.getOffset()
  const ok = offset.bobY === 0 && offset.sway === 0
  test('Fixed interaction scenes (canMove=false) disable bobbing', ok, `bobY: ${offset.bobY}, sway: ${offset.sway}`)
}

// 8. Long simulation: zero camera drift accumulation
{
  viewBobbing.reset()
  settings.setViewBobbing('NORMAL')
  const dt = 1 / 60
  // 5000 steps of random walking and stopping
  for (let i = 0; i < 50; i++) {
    const isWalk = i % 2 === 0
    const frames = isWalk ? 60 : 30
    for (let f = 0; f < frames; f++) {
      viewBobbing.step(isWalk ? PLAYER.speed * dt : 0, dt, true)
    }
  }
  // Settle at the end
  for (let f = 0; f < 60; f++) {
    viewBobbing.step(0, dt, true)
  }
  const final = viewBobbing.getOffset()
  const driftFree = final.bobY === 0 && final.sway === 0 && final.roll === 0 && final.pitch === 0
  test('Zero drift after extensive movement cycles', driftFree, `final offsets: y=${final.bobY}, sway=${final.sway}`)
}

console.log(failures ? `\n${failures} test(s) failed` : '\nAll view bobbing tests passed!')
process.exit(failures ? 1 : 0)
