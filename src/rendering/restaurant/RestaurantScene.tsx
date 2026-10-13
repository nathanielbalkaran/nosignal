import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { PerspectiveCamera } from 'three'
import { ambientAudio } from '../../audio/ambient.ts'
import { restaurant } from '../../game/restaurant.ts'
import { session } from '../../game/session.ts'
import { createRestaurantRig } from './rig.ts'

/**
 * The two fixed restaurant scenes. Shown only while the player is inside; the rig sets the
 * camera then, and the street controller stands down (see `PlayerController`).
 */
export function RestaurantScene() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const rig = useMemo(() => createRestaurantRig((level) => ambientAudio.setWindowVehicle(level)), [])
  useEffect(() => () => rig.dispose(), [rig])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const snap = session.getSnapshot()
    const playing = snap.state === 'PLAYING'
    rig.update(dt, snap.view, playing, camera)
    // The counter script runs on game time, and not while the screen is fading.
    if (playing && snap.view === 'COUNTER' && !snap.fading) restaurant.tick(dt)
  })

  return <primitive object={rig.root} />
}
