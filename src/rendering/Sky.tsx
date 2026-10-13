import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BackSide, Color, Float32BufferAttribute, Mesh, SphereGeometry } from 'three'
import { SCENE } from '../config/scene.ts'

/** A vertex-coloured dome that follows the camera: dark overhead, brightening towards the horizon, with a faint warm patch to the east. */
export function Sky() {
  const ref = useRef<Mesh>(null)
  const geometry = useMemo(() => {
    const d = SCENE.skyDome
    const g = new SphereGeometry(d.radius, 24, 14)
    const zenith = new Color(d.zenith)
    const mid = new Color(d.mid)
    const horizon = new Color(d.horizon)
    const glow = new Color(d.glow)
    const pos = g.getAttribute('position')
    const colors: number[] = []
    const c = new Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const h = Math.max(0, y / d.radius)
      if (h < 0.35) c.copy(horizon).lerp(mid, Math.pow(h / 0.35, 0.7))
      else c.copy(mid).lerp(zenith, Math.min(1, (h - 0.35) / 0.65))
      // East is +x. A little warmth right at the horizon.
      const east = Math.max(0, x / d.radius) * Math.max(0, 1 - h / 0.18)
      c.lerp(glow, east * 0.55 * Math.max(0, 1 - Math.abs(z / d.radius) * 1.2))
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} geometry={geometry} renderOrder={-10} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}
