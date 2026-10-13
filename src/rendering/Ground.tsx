import { useMemo } from 'react'
import { RepeatWrapping } from 'three'
import { SCENE } from '../config/scene.ts'
import { retroTexture } from './geo/retroTextures.ts'

export function Ground() {
  const { size, color } = SCENE.ground

  const map = useMemo(() => {
    const t = retroTexture('pavement').clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(size / 4, size / 4)
    return t
  }, [size])

  return (
    <mesh rotation-x={-Math.PI / 2}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color={color} map={map} roughness={1} metalness={0} />
    </mesh>
  )
}
