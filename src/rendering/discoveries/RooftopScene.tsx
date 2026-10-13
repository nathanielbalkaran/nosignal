import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, Vector3, type PerspectiveCamera } from 'three'
import { ventGust } from '../../audio/interact.ts'
import { session, type Place } from '../../game/session.ts'
import { retroTexture } from '../geo/retroTextures.ts'
import { useHold } from './hold.ts'
import { buildRoof } from './rooftop.ts'

/*
 * The rooftop, as two fixed shots: standing by the stair door, and sitting in
 * the plastic chair. Built once, far from the district, and only shown while
 * the player is up there. No walking; the camera does all the moving.
 */

const FAR = new Vector3(1000, 0, 1120)

interface Shot {
  fov: number
  pos: Vector3
  target: Vector3
}

const SHOTS: Partial<Record<Place, Shot>> = {
  // Just outside the stair door, looking across the roof.
  ROOF: { fov: 68, pos: new Vector3(1.7, 1.6, 0.2), target: new Vector3(-0.2, 1.2, 2.2) },
  // Seated in the chair, low, looking out over the parapet.
  ROOF_SEAT: { fov: 70, pos: new Vector3(1.6, 0.95, 0.3), target: new Vector3(-1, 1.6, -16) },
}

interface Roof {
  root: Group
  window: PointLight
  dispose(): void
}

function createRoof(): Roof {
  const root = new Group()
  root.position.copy(FAR)
  root.visible = false
  const disposables: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x)
    return x
  }
  const { solid, glow, city } = buildRoof()
  const lit = own(new MeshStandardMaterial({ vertexColors: true, map: retroTexture('concrete'), roughness: 1, metalness: 0 }))
  root.add(new Mesh(own(solid.build({ tile: 2 })), lit))
  root.add(new Mesh(own(glow.build()), own(new MeshBasicMaterial({ vertexColors: true }))))
  const cityMesh = new Mesh(own(city.build()), own(new MeshBasicMaterial({ vertexColors: true, fog: false })))
  cityMesh.position.y = -0.01
  root.add(cityMesh)

  const hemi = new HemisphereLight('#8aa0b8', '#4a4038', 0.7)
  const moon = new PointLight('#b9c6d6', 18, 30, 1.4)
  moon.position.set(-4, 9, 6)
  // A little warmth from a neighbour's window, falling across the parapet.
  const window = new PointLight('#e0b06a', 4, 16, 1.8)
  window.position.set(-2, 3, -9)
  root.add(hemi, moon, window)
  return { root, window, dispose: () => { for (const d of disposables) d.dispose(); root.clear() } }
}

export function RooftopScene() {
  const getCamera = useThree((s) => () => s.camera as PerspectiveCamera)
  const roofs = useHold(createRoof)
  const getRoof = () => roofs.current
  const look = useMemo(() => new Vector3(), [])
  const gust = useRef({ t: 0, next: 20 })

  useFrame(function tick(_, rawDt) {
    const dt = Math.min(rawDt, 0.1)
    const snap = session.getSnapshot()
    const view = snap.view
    const up = view === 'ROOF' || view === 'ROOF_SEAT'
    const roof = getRoof()
    roof.root.visible = up
    if (!up) return

    const drift = gust.current
    if (snap.state === 'PLAYING') {
      drift.t += dt
      if (drift.t > drift.next) {
        drift.t = 0
        drift.next = 25 + Math.random() * 30
        ventGust()
      }
      // The neighbour's light wavers, barely.
      roof.window.intensity = 4 * (0.92 + 0.08 * Math.sin(drift.t * 1.7))
    }

    const shot = SHOTS[view]
    if (!shot) return
    const camera = getCamera()
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov
      camera.updateProjectionMatrix()
    }
    const t = drift.t
    camera.position.set(FAR.x + shot.pos.x + Math.sin(t * 0.31) * 0.006, FAR.y + shot.pos.y + Math.sin(t * 0.6) * 0.004, FAR.z + shot.pos.z)
    camera.up.set(0, 1, 0)
    look.set(FAR.x + shot.target.x, FAR.y + shot.target.y + Math.sin(t * 0.4) * 0.004, FAR.z + shot.target.z)
    camera.lookAt(look)
  })

  return <primitive object={roofs.current.root} />
}
