import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { MeshStandardMaterial, type Group } from 'three'
import { session } from '../../game/session.ts'
import { catAnim } from './catAnim.ts'
import { world } from '../../world/index.ts'
import { discoveryOf } from '../../world/discoveries.ts'
import { Geo } from '../geo/Geo.ts'
import { retroTexture } from '../geo/retroTextures.ts'

/*
 * The stray cat on its utility box (the box is baked into the street). Resting,
 * it only breathes; while petted it looks up, leans in and sweeps its tail.
 */

const FUR = '#6b645c'
const FUR_DARK = '#4e4944'

function buildCat(): Geo {
  const g = new Geo()
  g.blob(0, 0.12, 0.12, 0.2, 0.13, 0.3, FUR, 0.14, 3)
  g.blob(0, 0.08, 0.28, 0.1, 0.09, 0.1, '#8a8278', 0.1, 1)
  // Front paws, tucked.
  g.span(-0.09, 0, 0.22, -0.04, 0.1, 0.34, FUR_DARK)
  g.span(0.04, 0, 0.22, 0.09, 0.1, 0.34, FUR_DARK)
  g.span(-0.12, 0, -0.06, -0.05, 0.08, 0.06, FUR_DARK)
  g.span(0.05, 0, -0.06, 0.12, 0.08, 0.06, FUR_DARK)
  return g
}

function buildHead(): Geo {
  const g = new Geo()
  g.blob(0, 0, 0, 0.11, 0.1, 0.11, FUR, 0.1, 5)
  g.tri([-0.07, 0.08, -0.02], [-0.03, 0.08, -0.04], [-0.05, 0.2, -0.03], FUR_DARK)
  g.tri([0.03, 0.08, -0.04], [0.07, 0.08, -0.02], [0.05, 0.2, -0.03], FUR_DARK)
  g.span(-0.05, 0.02, 0.1, -0.03, 0.04, 0.12, '#2a2624')
  g.span(0.03, 0.02, 0.1, 0.05, 0.04, 0.12, '#2a2624')
  g.span(-0.015, -0.02, 0.11, 0.015, 0, 0.13, '#c9a98a')
  return g
}

function buildTail(): Geo {
  const g = new Geo()
  g.rod([0, 0, 0], [-0.15, -0.01, 0.12], 0.03, FUR, 5)
  g.rod([-0.15, -0.01, 0.12], [-0.09, 0.02, 0.28], 0.028, FUR, 5, 0.022)
  g.rod([-0.09, 0.02, 0.28], [0.03, 0.04, 0.34], 0.022, '#8a8278', 5, 0.016)
  return g
}

/** The cat itself, sitting on the baked utility box. */
export function Cat() {
  const d = useMemo(() => discoveryOf(world, 'cat'), [])
  const group = useRef<Group>(null)
  const head = useRef<Group>(null)
  const tail = useRef<Group>(null)
  const body = useRef<Group>(null)

  const { bodyGeo, headGeo, tailGeo, mat } = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, map: retroTexture('fabric'), roughness: 1, metalness: 0 })
    return { bodyGeo: buildCat().build(), headGeo: buildHead().build(), tailGeo: buildTail().build(), mat: m }
  }, [])

  useFrame(({ clock }) => {
    const root = group.current
    if (!root) return
    const show = session.getSnapshot().view === 'STREET'
    root.visible = show
    if (!show) return
    const u = catAnim.active ? catAnim.t : 0
    // Looks up at the hand, then settles back down.
    const look = Math.sin(Math.min(1, u) * Math.PI)
    if (head.current) head.current.rotation.x = -0.5 * look
    if (head.current) head.current.rotation.y = 0.25 * look
    // Breathing, a small lean into the hand, and the tail tip sweeping once.
    if (body.current) body.current.position.y = Math.sin(u * Math.PI) * 0.015 + Math.sin(clock.elapsedTime * 2.2) * 0.003
    if (tail.current) tail.current.rotation.y = Math.sin(u * Math.PI * 2) * 0.35 * look
  })

  return (
    <group ref={group} position={[d.at[0], 0.5, d.at[1]]} rotation={[0, d.yaw, 0]}>
      <group ref={body}>
        <mesh geometry={bodyGeo} material={mat} />
        <group ref={head} position={[0.02, 0.28, 0.32]}>
          <mesh geometry={headGeo} material={mat} />
        </group>
        <group ref={tail} position={[-0.05, 0.06, -0.14]}>
          <mesh geometry={tailGeo} material={mat} />
        </group>
      </group>
    </group>
  )
}
