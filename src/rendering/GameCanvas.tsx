import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { SCENE, retroDpr } from '../config/scene.ts'
import { AmbientAudio } from '../audio/AmbientAudio.tsx'
import { PlayerController } from '../player/PlayerController.tsx'
import { AmbientLife } from './ambient/AmbientLife.tsx'
import { Ground } from './Ground.tsx'
import { Lighting } from './Lighting.tsx'
import { Sky } from './Sky.tsx'
import { Skyline } from './Skyline.tsx'
import { WorldView } from './world/WorldView.tsx'

/** Re-derives the pixel ratio so the drawing buffer is RETRO_RENDER_HEIGHT tall whatever the viewport height. */
function RetroResolution() {
  const height = useThree((s) => s.size.height)
  const setDpr = useThree((s) => s.setDpr)
  useEffect(() => setDpr(retroDpr(height)), [height, setDpr])
  return null
}

export function GameCanvas() {
  const { camera, sky, fog } = SCENE

  return (
    <Canvas
      dpr={retroDpr(window.innerHeight)}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
      camera={{ fov: camera.fov, near: camera.near, far: camera.far }}
    >
      <color attach="background" args={[sky]} />
      <fogExp2 attach="fog" args={[fog.color, fog.density]} />
      <RetroResolution />
      <Sky />
      <Skyline />
      <Lighting />
      <Ground />
      <WorldView />
      <AmbientLife />
      <AmbientAudio />
      <PlayerController />
    </Canvas>
  )
}
