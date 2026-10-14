import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { PerspectiveCamera } from 'three'
import { session } from '../../game/session.ts'
import { createTrainRig } from './trainRig.ts'

/*
 * React Three.js component for the commuter train cinematic ending.
 * Mounted in GameCanvas. Follows session view.
 * The train rig owns the interior, moving scenery, camera and audio.
 */

export function TrainScene() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const rig = useMemo(() => createTrainRig(), [])
  useEffect(() => () => rig.dispose(), [rig])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const snap = session.getSnapshot()
    rig.update(dt, snap.view, camera)
  })

  return <primitive object={rig.root} />
}
