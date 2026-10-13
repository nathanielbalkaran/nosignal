import { SCENE } from '../config/scene.ts'

/** Pre-dawn lighting: a cool sky fill and one dim directional light, all static and shadowless. */
export function Lighting() {
  const { hemisphere, fill } = SCENE.lighting
  return (
    <>
      <hemisphereLight args={[hemisphere.sky, hemisphere.ground, hemisphere.intensity]} />
      <directionalLight color={fill.color} intensity={fill.intensity} position={[fill.position[0], fill.position[1], fill.position[2]]} />
    </>
  )
}
