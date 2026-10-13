import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { playerState } from '../player/playerState.ts'
import { ambientAudio } from './ambient.ts'

/** Wires the ambient soundscape to the session and the frame loop. Renders nothing. */
export function AmbientAudio() {
  useEffect(() => ambientAudio.attach(), [])
  useFrame((_, dt) => ambientAudio.update(Math.min(dt, 0.1), playerState.x, playerState.z))
  return null
}
