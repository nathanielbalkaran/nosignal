import {
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { createTrainAudio, type TrainAudioController } from '../../audio/trainCinematic.ts'
import type { Place } from '../../game/session.ts'
import { retroTexture } from '../geo/retroTextures.ts'
import { buildTrainInterior } from './trainInterior.ts'
import { createTrainScenery } from './trainScenery.ts'

/*
 * Complete 3D commuter train cinematic rig:
 * - Interior carriage, worn seats, grab rails, swaying straps
 * - Dynamic moving exterior scenery across 3 parallax layers
 * - Fluorescent lighting & warm morning directional sunlight through the window
 * - 4 fixed cinematic camera positions with smooth transitions
 * - Integrated train audio playback
 */

export const TRAIN_ORIGIN = new Vector3(1000, 0, 1300)

interface CinematicShot {
  fov: number
  pos: Vector3
  target: Vector3
}

// 4 Cinematic Camera Framing Targets
const SHOTS: readonly CinematicShot[] = [
  // Shot 1 (0-5s): Departure. Seated perspective looking toward window
  {
    fov: 54,
    pos: new Vector3(0.2, 1.15, 0.0),
    target: new Vector3(-1.3, 1.25, 0.35),
  },
  // Shot 2 (5-12s): The City Passing. Closer framing right against the window
  {
    fov: 48,
    pos: new Vector3(-0.7, 1.22, 0.25),
    target: new Vector3(-2.4, 1.25, 0.65),
  },
  // Shot 3 (12-20s): Sunrise. Wider interior view across carriage showing opening skyline
  {
    fov: 60,
    pos: new Vector3(0.65, 1.32, -0.85),
    target: new Vector3(-1.3, 1.22, 0.2),
  },
  // Shot 4 (20-25s): Final Frame. Seated perspective looking out the window as morning settles
  {
    fov: 54,
    pos: new Vector3(0.2, 1.15, 0.0),
    target: new Vector3(-1.3, 1.25, 0.35),
  },
]

export interface TrainRig {
  root: Group
  update(dt: number, view: Place, camera: PerspectiveCamera): void
  dispose(): void
}

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return x * x * (3 - 2 * x)
}

export function createTrainRig(): TrainRig {
  const root = new Group()
  root.position.copy(TRAIN_ORIGIN)
  root.visible = false

  const disposables: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x)
    return x
  }

  // 1. Train Carriage Interior
  const carriageGroup = new Group()
  root.add(carriageGroup)

  const { lit, glow, straps } = buildTrainInterior()
  const interiorLitMat = own(
    new MeshStandardMaterial({
      vertexColors: true,
      map: retroTexture('metal'),
      roughness: 0.9,
      metalness: 0.1,
      side: DoubleSide,
      fog: false,
    })
  )
  const interiorGlowMat = own(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, fog: false }))

  carriageGroup.add(new Mesh(own(lit.build()), interiorLitMat))
  carriageGroup.add(new Mesh(own(glow.build()), interiorGlowMat))

  // Hanging hand straps (mesh instances that sway)
  const strapGroup = new Group()
  carriageGroup.add(strapGroup)
  const strapMat = own(new MeshStandardMaterial({ color: '#555b60', roughness: 0.9, fog: false }))
  const strapRingMat = own(new MeshStandardMaterial({ color: '#e0ded6', roughness: 0.8, fog: false }))
  const strapGeo = own(new BoxGeometry(0.02, 0.14, 0.02))
  const ringGeo = own(new BoxGeometry(0.08, 0.08, 0.02))

  const strapMeshes: Group[] = []
  for (const s of straps) {
    const sg = new Group()
    sg.position.set(s.x, s.y, s.z)
    const band = new Mesh(strapGeo, strapMat)
    band.position.y = -0.07
    const ring = new Mesh(ringGeo, strapRingMat)
    ring.position.y = -0.16
    sg.add(band, ring)
    strapGroup.add(sg)
    strapMeshes.push(sg)
  }

  // 2. Interior & Exterior Lights
  // Fluorescent interior lighting
  const hemiLight = new HemisphereLight('#fff6e6', '#2b333a', 1.3)
  const ceilingLamp1 = new PointLight('#fff3db', 12, 7, 1.6)
  ceilingLamp1.position.set(0.0, 2.1, -1.5)
  const ceilingLamp2 = new PointLight('#fff3db', 12, 7, 1.6)
  ceilingLamp2.position.set(0.0, 2.1, 1.5)
  carriageGroup.add(hemiLight, ceilingLamp1, ceilingLamp2)

  // Morning sunlight through the window
  const sunLight = new DirectionalLight('#f0a575', 0.0)
  sunLight.position.set(-15, 10, -5)
  sunLight.target.position.set(0, 1.2, 0)
  root.add(sunLight)
  root.add(sunLight.target)

  // 3. Moving Exterior Scenery
  const scenery = createTrainScenery()
  root.add(scenery.group)

  // Playback state
  let time = 0
  let audio: TrainAudioController | null = null
  let wasInside = false

  // Camera interpolation state
  const camPos = new Vector3()
  const lookAt = new Vector3()
  const currentPos = new Vector3()
  const currentLook = new Vector3()

  return {
    root,
    update(dt: number, view: Place, camera: PerspectiveCamera) {
      const inside = view === 'TRAIN'
      root.visible = inside

      if (!inside) {
        if (wasInside) {
          wasInside = false
          audio?.stop()
          audio = null
          time = 0
          if (camera.fov !== 70) {
            camera.fov = 70
            camera.updateProjectionMatrix()
          }
        }
        return
      }

      if (!wasInside) {
        wasInside = true
        time = 0
        audio = createTrainAudio()
      }

      time += dt

      // 1. Train speed curve:
      // t = 0..2.2s: stopped at station (speed = 0)
      // t = 2.2..6.5s: doors closed, train smoothly accelerates
      // t >= 6.5s: steady cruising speed
      const speed = smoothstep(2.2, 6.5, time)
      audio?.update(time, dt, speed)

      let shotBlend: number
      let fromShot: CinematicShot
      let toShot: CinematicShot

      if (time < 8.5) {
        // Shot 1: Departure (0 to 8.5s)
        fromShot = toShot = SHOTS[0]
        shotBlend = 1
      } else if (time < 22.0) {
        // Shot 2: The City Passing (8.5 to 22s)
        if (time < 9.3) {
          fromShot = SHOTS[0]
          toShot = SHOTS[1]
          shotBlend = smoothstep(8.5, 9.3, time)
        } else {
          fromShot = toShot = SHOTS[1]
          shotBlend = 1
        }
      } else if (time < 34.0) {
        // Shot 3: Sunrise (22 to 34s)
        if (time < 22.8) {
          fromShot = SHOTS[1]
          toShot = SHOTS[2]
          shotBlend = smoothstep(22.0, 22.8, time)
        } else {
          fromShot = toShot = SHOTS[2]
          shotBlend = 1
        }
      } else {
        // Shot 4: Final Frame (34 to 51.5s)
        if (time < 34.8) {
          fromShot = SHOTS[2]
          toShot = SHOTS[3]
          shotBlend = smoothstep(34.0, 34.8, time)
        } else {
          fromShot = toShot = SHOTS[3]
          shotBlend = 1
        }
      }

      // 2. Animate Scenery & Dawn
      scenery.update(time, dt, speed)

      // 3. Morning sunlight intensity & color (realistic, understated pale morning light)
      if (time > 20.0) {
        const dawnK = smoothstep(20.0, 36.0, time)
        sunLight.intensity = dawnK * 1.35
        const warmSun = new Color('#b89684').lerp(new Color('#dfbda8'), dawnK)
        sunLight.color.copy(warmSun)
      } else {
        sunLight.intensity = 0
      }

      // 4. Subtle carriage vibration & hanging straps sway
      const vibration = speed * (Math.sin(time * 42.0) * 0.0025 + Math.cos(time * 31.0) * 0.0018)
      const swayZ = speed * Math.sin(time * 2.8) * 0.005
      carriageGroup.position.set(0, vibration, swayZ)

      // Hand straps swaying with acceleration and track rhythm
      const strapSwing = speed * (Math.sin(time * 3.2) * 0.05 + Math.cos(time * 1.6) * 0.03)
      for (let i = 0; i < strapMeshes.length; i++) {
        const mesh = strapMeshes[i]
        const phase = i * 0.4
        mesh.rotation.z = strapSwing + Math.sin(time * 3.6 + phase) * 0.012 * speed
        mesh.rotation.x = Math.sin(time * 2.2 + phase) * 0.008 * speed
      }

      // 5. Camera positioning with smooth transitions and subtle handheld drift
      const targetPos = currentPos.lerpVectors(fromShot.pos, toShot.pos, shotBlend)
      const targetLook = currentLook.lerpVectors(fromShot.target, toShot.target, shotBlend)
      const targetFov = fromShot.fov + (toShot.fov - fromShot.fov) * shotBlend

      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = targetFov
        camera.updateProjectionMatrix()
      }

      // Subtle atmospheric handheld/train sway drift
      const driftX = Math.sin(time * 0.65) * 0.004
      const driftY = Math.sin(time * 1.1) * 0.003 + vibration
      const driftZ = Math.cos(time * 0.5) * 0.003

      camPos.copy(targetPos).add(TRAIN_ORIGIN)
      camPos.x += driftX
      camPos.y += driftY
      camPos.z += driftZ

      lookAt.copy(targetLook).add(TRAIN_ORIGIN)
      lookAt.y += Math.sin(time * 0.75) * 0.003

      camera.position.copy(camPos)
      camera.up.set(0, 1, 0)
      camera.lookAt(lookAt)
    },

    dispose() {
      audio?.dispose()
      audio = null
      scenery.dispose()
      for (const d of disposables) d.dispose()
      for (const m of [interiorLitMat, interiorGlowMat, strapMat, strapRingMat]) m.dispose()
      root.clear()
    },
  }
}
