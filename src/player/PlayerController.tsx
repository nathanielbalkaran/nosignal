import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PLAYER } from '../config/player.ts'
import { session } from '../game/session.ts'
import { world } from '../world/index.ts'
import { keyboard } from './keyboard.ts'
import { followEyeHeight, stepMovement, type MoveInput, type Velocity } from './movement.ts'
import { playerState } from './playerState.ts'

/** Some browsers report a huge movement on the first event after locking. */
const MAX_MOUSE_DELTA = 250
/** Longest frame simulated in one go; slower frames run in slow motion rather than lurching. */
const MAX_FRAME_TIME = 0.05

/** First-person movement: pointer-lock mouse look plus WASD on the collision world. */
export function PlayerController() {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  const velocity = useRef<Velocity>({ x: 0, z: 0 })
  const eyeY = useRef(playerState.y)

  useEffect(() => {
    const detachKeys = keyboard.attach()

    session.setLockHandler(() => {
      canvas.requestPointerLock()?.catch(() => {
        // Browsers refuse re-locking for about a second after Escape; the next click works.
      })
    })

    const onLockChange = () => {
      if (document.pointerLockElement === canvas) {
        session.setStatus('playing')
      } else {
        keyboard.clear()
        if (session.getStatus() === 'playing') session.setStatus('paused')
      }
    }
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return
      if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) return
      playerState.yaw -= e.movementX * PLAYER.lookSensitivity
      playerState.pitch = Math.max(
        -PLAYER.maxPitch,
        Math.min(PLAYER.maxPitch, playerState.pitch - e.movementY * PLAYER.lookSensitivity),
      )
    }

    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      detachKeys()
      session.setLockHandler(null)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [canvas])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_FRAME_TIME)
    if (session.getStatus() === 'playing') {
      const input: MoveInput = { forward: 0, strafe: 0 }
      if (keyboard.isDown('KeyW', 'ArrowUp')) input.forward += 1
      if (keyboard.isDown('KeyS', 'ArrowDown')) input.forward -= 1
      if (keyboard.isDown('KeyD', 'ArrowRight')) input.strafe += 1
      if (keyboard.isDown('KeyA', 'ArrowLeft')) input.strafe -= 1
      const next = stepMovement(world, playerState, velocity.current, input, playerState.yaw, dt)
      playerState.x = next.x
      playerState.z = next.z
      playerState.y = next.y
    } else {
      velocity.current.x = 0
      velocity.current.z = 0
    }

    eyeY.current = followEyeHeight(eyeY.current, playerState.y, dt)
    camera.position.set(playerState.x, eyeY.current + PLAYER.eyeHeight, playerState.z)
    camera.rotation.set(playerState.pitch, playerState.yaw, 0, 'YXZ')
  })

  return null
}
