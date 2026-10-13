import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { session } from '../game/session.ts'
import { enterableEntrance } from '../world/goal.ts'
import { world } from '../world/index.ts'
import { playerState } from './playerState.ts'

/** Entrance prompt and the E key. The prompt only changes the game store when it flips. */
export function StationInteraction() {
  useFrame(() => {
    if (session.getStatus() !== 'PLAYING') return
    const near = enterableEntrance(world, playerState) !== null
    session.setPrompt(near ? (session.getSnapshot().mode === 'PLAY' ? 'enter' : 'explore') : null)
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      // Re-check at the moment of the press; the prompt is only a hint.
      if (enterableEntrance(world, playerState) !== null) session.enterStation()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
