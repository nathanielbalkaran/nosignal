import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { session } from '../../game/session.ts'
import { playerState } from '../../player/playerState.ts'
import { world } from '../../world/index.ts'
import { disposeMaterials, type Ambient } from './common.ts'
import { createEvents } from './events.ts'
import { createMotion } from './motion.ts'
import { createPedestrians } from './pedestrians.ts'
import { createRestaurant } from './restaurant.ts'
import { createWindows } from './windows.ts'

/**
 * The quiet signs of a city waking up: wall fans, swinging signs, a few lit
 * windows, the open restaurant, three passers-by and two small events. Time
 * only advances while the game is being played, so pausing freezes it all.
 * Everything animates by transform or colour outside React state.
 */
/** Development only: `?live` keeps the ambient layer running while the pointer is not locked, for screenshots. */
const FORCE_LIVE = import.meta.env.DEV && new URLSearchParams(window.location.search).has('live')

export function AmbientLife() {
  const parts = useMemo<Ambient[]>(() => [createMotion(world), createWindows(world), createRestaurant(world), createPedestrians(world), createEvents(world)], [])
  const time = useRef(0)

  useEffect(
    () => () => {
      for (const p of parts) p.dispose()
      disposeMaterials()
    },
    [parts],
  )

  useFrame((_, rawDt) => {
    if (!FORCE_LIVE && session.getStatus() !== 'playing') return
    const dt = Math.min(rawDt, 0.1)
    time.current += dt
    for (const p of parts) p.update(time.current, dt, playerState)
  })

  return (
    <group>
      {parts.map((p, i) => (
        <primitive key={i} object={p.object} />
      ))}
    </group>
  )
}
