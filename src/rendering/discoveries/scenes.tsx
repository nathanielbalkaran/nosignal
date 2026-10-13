import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PlaneGeometry, PointLight, SRGBColorSpace, Vector3, type PerspectiveCamera } from 'three'
import { ambientAudio } from '../../audio/ambient.ts'
import { buttonClick, cradle, dialTone, disconnect, dispense, meow } from '../../audio/interact.ts'
import { CALL_SECONDS, CAT_SECONDS, discoveries, type PhoneMessage } from '../../game/discoveries.ts'
import { session, type Place } from '../../game/session.ts'
import { playerState } from '../../player/playerState.ts'
import { placeDiscoveries } from '../../world/discoveries.ts'
import { world } from '../../world/index.ts'
import { Geo } from '../geo/Geo.ts'
import { retroTexture } from '../geo/retroTextures.ts'
import { catAnim } from './catAnim.ts'
import { useHold } from './hold.ts'
import { canGeometry, handsetGeometry } from './street.ts'

/*
 * The two short fixed-camera scenes: the vending machine and the payphone.
 * Both are built once, far from the district, and only shown while the player
 * is in them. The city stays visible behind them (the camera simply moves up
 * close), so neither needs scenery of its own beyond the object in frame.
 * The cat has no scene of its own; it is petted in first person.
 *
 * The scenes live in a ref rather than state: they are imperative Three.js
 * objects that the frame loop mutates, the same way the restaurant rig does.
 */

/** Where the two close-ups sit in world space, well clear of the district. */
const FAR = new Vector3(1000, 0, 1060)

interface Shot {
  fov: number
  pos: Vector3
  target: Vector3
}

const SHOTS: Partial<Record<Place, Shot>> = {
  VENDING: { fov: 46, pos: new Vector3(0.15, 1.2, 2.1), target: new Vector3(0.05, 0.95, 0.2) },
  PHONE: { fov: 40, pos: new Vector3(0, 1.55, 0.85), target: new Vector3(0, 1.5, 0) },
}

function label(paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  paint(ctx, w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.magFilter = t.minFilter = NearestFilter
  t.generateMipmaps = false
  return t
}

interface Scenes {
  root: Group
  machine: Group
  booth: Group
  can: Group
  cans: Mesh[]
  button: Mesh
  handset: Group
  dispose(): void
}

function createScenes(): Scenes {
  const root = new Group()
  root.position.copy(FAR)
  root.visible = false
  const disposables: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x)
    return x
  }

  const lit = own(new MeshStandardMaterial({ vertexColors: true, map: retroTexture('plaster'), roughness: 1, metalness: 0 }))
  const steel = own(new MeshStandardMaterial({ vertexColors: true, map: retroTexture('metal'), roughness: 0.8, metalness: 0.1 }))

  const machineGeo = new Geo()
  machineGeo.span(-0.46, 0, -0.36, 0.46, 1.75, 0.36, '#5d6a5e', { grime: 0.7 })
  machineGeo.span(-0.48, 0, -0.38, 0.48, 0.08, 0.38, '#4c5156')
  machineGeo.span(-0.48, 1.7, -0.38, 0.48, 1.86, 0.38, '#3d4a42')
  machineGeo.span(-0.32, 0.85, 0.34, 0.24, 1.55, 0.38, '#4c5156')
  machineGeo.span(-0.26, 0.9, 0.37, 0.26, 1.5, 0.39, '#1c242e')
  ;['#a85a3a', '#c9b24a', '#d8d2c0', '#8a3a34', '#c9b24a', '#d8d2c0'].forEach((c, i) => machineGeo.cyl(-0.18 + (i % 3) * 0.16, 0.95 + Math.floor(i / 3) * 0.26, 0.41, 0.05, 0.16, c, 6))
  machineGeo.span(-0.26, 0.3, 0.34, 0.26, 0.62, 0.42, '#7a7f83')
  machineGeo.span(-0.22, 0.34, 0.4, 0.22, 0.56, 0.44, '#2a2e32')
  machineGeo.span(0.22, 0.62, 0.34, 0.34, 0.86, 0.4, '#4c5156')
  const machine = new Group()
  machine.add(new Mesh(own(machineGeo.build()), lit))

  const brand = own(label((ctx, w, h) => {
    ctx.fillStyle = '#8c3d36'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#e6d8b0'
    ctx.font = '700 30px "PingFang HK", "Noto Sans TC", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('寶記飲品', w / 2, h / 2)
  }, 256, 48))
  const brandMesh = new Mesh(own(new PlaneGeometry(0.52, 0.1)), own(new MeshBasicMaterial({ map: brand })))
  brandMesh.position.set(0, 1.63, 0.37)
  machine.add(brandMesh)

  // The three buttons. The middle one is the one that gets pressed.
  const button = new Mesh(own(new PlaneGeometry(0.05, 0.04)), own(new MeshBasicMaterial({ color: '#e8b86a' })))
  button.position.set(0.34, 1.18, 0.365)
  machine.add(button)
  for (const [y, color] of [[1.04, '#5a5a5c'], [1.32, '#e8b86a']] as const) {
    const b = new Mesh(own(new PlaneGeometry(0.05, 0.04)), own(new MeshBasicMaterial({ color })))
    b.position.set(0.34, y, 0.365)
    machine.add(b)
  }

  const can = new Group()
  can.visible = false
  const cans = [
    new Mesh(own(canGeometry('#a85a3a', '#e6d8b0').build()), lit),
    new Mesh(own(canGeometry('#c9b24a', '#f0e6c0').build()), lit),
    new Mesh(own(canGeometry('#d8d2c0', '#6a5538').build()), lit),
  ]
  for (const m of cans) can.add(m)
  machine.add(can)
  root.add(machine)

  const boothGeo = new Geo()
  boothGeo.span(-0.38, 0.9, -0.28, 0.38, 2.05, -0.2, '#5a6066')
  boothGeo.span(-0.4, 2.0, -0.28, 0.4, 2.08, 0.34, '#4c5156')
  boothGeo.span(-0.4, 0.9, -0.06, -0.34, 2.05, 0.34, '#4c5156')
  boothGeo.span(0.34, 0.9, -0.06, 0.4, 2.05, 0.34, '#4c5156')
  boothGeo.span(-0.16, 1.15, -0.2, 0.16, 1.85, 0.02, '#6a7074', { grime: 0.75 })
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) boothGeo.span(-0.07 + c * 0.05, 1.28 + r * 0.06, 0.0, -0.04 + c * 0.05, 1.31 + r * 0.06, 0.03, '#cfc6a8')
  boothGeo.span(-0.12, 1.18, 0.0, 0.12, 1.26, 0.02, '#8a8474')
  boothGeo.span(-0.3, 1.05, -0.2, 0.3, 1.1, 0.22, '#7a7f83')
  const booth = new Group()
  booth.add(new Mesh(own(boothGeo.build()), steel))

  const card = own(label((ctx, w, h) => {
    ctx.fillStyle = '#cfc6a8'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#3a342c'
    ctx.font = '16px "VT323", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('本地通話  $1', w / 2, 22)
    ctx.fillText('請先投幣', w / 2, 44)
  }, 160, 64))
  const cardMesh = new Mesh(own(new PlaneGeometry(0.22, 0.09)), own(new MeshBasicMaterial({ map: card })))
  cardMesh.position.set(0, 1.22, 0.03)
  booth.add(cardMesh)

  const handset = new Group()
  handset.add(new Mesh(own(handsetGeometry().build()), steel))
  booth.add(handset)
  root.add(booth)

  const lamp = new PointLight('#ffd9a0', 9, 6, 1.6)
  lamp.position.set(0.3, 1.9, 1.6)
  root.add(lamp)

  return { root, machine, booth, can, cans, button, handset, dispose: () => { for (const d of disposables) d.dispose() } }
}

const DRINK_INDEX = { tea: 0, lemon: 1, soy: 2 } as const

/** Which part of a call is making a sound, so the tones stay sparse. */
const CALL: Record<PhoneMessage, { from: number; until: number; every: number; sound: 'busy' | 'voice' | 'murmur' }> = {
  disconnected: { from: 1.4, until: 6, every: 0.34, sound: 'busy' },
  announcement: { from: 3.2, until: 10, every: 0.85, sound: 'voice' },
  chatter: { from: 1.6, until: 8, every: 0.6, sound: 'murmur' },
}

export function DiscoveryScenes() {
  const getCamera = useThree((s) => () => s.camera as PerspectiveCamera)
  const scenes = useHold(createScenes)
  const getScene = () => scenes.current
  const discs = useMemo(() => placeDiscoveries(world), [])

  const prev = useRef({ cat: 0, dispense: 0, phone: 'down' as 'down' | 'up', tone: 0, dial: 0, dead: false, take: 0, meowCooldown: 0, humCooldown: 0, arcadeCooldown: 0 })
  const look = useMemo(() => new Vector3(), [])

  useFrame(function tick(_, rawDt) {
    const dt = Math.min(rawDt, 0.1)
    const snap = session.getSnapshot()
    const playing = snap.state === 'PLAYING'
    const d = discoveries.getSnapshot()
    const p = prev.current
    const built = getScene()

    // The cat, petted in first person out in the street.
    const petting = d.cat > 0 && d.cat < CAT_SECONDS
    if (petting && (p.cat === 0 || d.cat < p.cat) && playing) meow()
    catAnim.active = petting
    catAnim.t = petting ? d.cat / CAT_SECONDS : 0
    p.cat = d.cat

    // Proximity ambient sounds — only while on the street, not interacting.
    if (playing && snap.view === 'STREET' && !petting) {
      const px = playerState.x, pz = playerState.z
      p.meowCooldown = Math.max(0, p.meowCooldown - dt)
      p.humCooldown = Math.max(0, p.humCooldown - dt)
      p.arcadeCooldown = Math.max(0, p.arcadeCooldown - dt)
      for (const disc of discs) {
        const dx = px - disc.at[0], dz = pz - disc.at[1]
        const dist = Math.hypot(dx, dz)
        if (disc.kind === 'cat' && dist < 5 && p.meowCooldown <= 0) {
          meow()
          p.meowCooldown = 12 + Math.random() * 14
        }
        if (disc.kind === 'vending' && dist < 4 && p.humCooldown <= 0) {
          ambientAudio.play('hum', 0.06, 1.0, 600)
          p.humCooldown = 8
        }
        if (disc.kind === 'arcade' && dist < 8 && p.arcadeCooldown <= 0) {
          ambientAudio.play('birdA', 0.04, 0.7, 2200)
          p.arcadeCooldown = 5 + Math.random() * 6
        }
      }
    }

    const view = snap.view
    const active = view === 'VENDING' || view === 'PHONE'
    built.root.visible = active
    built.machine.visible = view === 'VENDING'
    built.booth.visible = view === 'PHONE'
    if (playing && (active || petting) && !snap.fading) discoveries.tick(dt)

    const camera = getCamera()
    if (!active) {
      if (view === 'STREET' && camera.fov !== 70) {
        camera.fov = 70
        camera.updateProjectionMatrix()
      }
      return
    }

    // The can: drops into the slot, sits there, and is lifted out as the player leaves.
    if (d.drink) {
      const fall = Math.min(1, Math.max(0, (d.dispense - 0.9) / 0.45))
      p.take = snap.place === 'STREET' ? p.take + dt : 0
      const lift = Math.min(1, p.take / 0.4) ** 2
      built.can.position.set(0.04 * lift, 0.86 - (1 - (1 - fall) ** 3) * 0.28 + lift * 0.5, 0.5 + lift * 0.9)
      built.can.visible = d.vending === 'dispense' && d.dispense > 0.9
      built.cans.forEach((m, i) => (m.visible = i === DRINK_INDEX[d.drink!]))
    } else built.can.visible = false
    if (d.dispense > 0 && p.dispense === 0 && playing) {
      buttonClick()
      dispense()
    }
    p.dispense = d.dispense
    built.button.position.z = d.vending === 'dispense' ? 0.34 : 0.365

    // The handset: resting, or lifted toward the camera.
    const up = d.phone === 'up'
    if (up !== (p.phone === 'up')) {
      if (playing) cradle()
      p.dial = 0
      p.dead = false
    }
    p.phone = d.phone
    built.handset.position.set(up ? 0.16 : 0, up ? 1.42 : 1.72, up ? 0.34 : 0.05)
    built.handset.rotation.set(up ? 0.4 : 0, up ? -0.3 : 0, up ? 1.1 : 0)
    if (playing && up && d.message) playCall(d.message, d.phoneTime, dt, p)

    const shot = SHOTS[view]!
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov
      camera.updateProjectionMatrix()
    }
    const t = d.phoneTime + d.dispense
    camera.position.set(FAR.x + shot.pos.x + Math.sin(t * 0.4) * 0.003, FAR.y + shot.pos.y + Math.sin(t * 0.7) * 0.003, FAR.z + shot.pos.z)
    camera.up.set(0, 1, 0)
    look.set(FAR.x + shot.target.x, FAR.y + shot.target.y + Math.sin(t * 0.5) * 0.003, FAR.z + shot.target.z)
    camera.lookAt(look)
  })

  return <primitive object={scenes.current.root} />
}

function playCall(message: PhoneMessage, time: number, dt: number, p: { tone: number; dial: number; dead: boolean }) {
  if (time >= CALL_SECONDS - 0.5) {
    if (!p.dead) {
      p.dead = true
      disconnect()
    }
    return
  }
  // A dial tone for the first moment, before anything answers.
  if (time < 1.3) {
    p.dial += dt
    if (p.dial > 0.95) {
      p.dial = 0
      dialTone()
    }
    return
  }
  const part = CALL[message]
  if (time < part.from || time > part.until) return
  p.tone += dt
  if (p.tone < part.every) return
  p.tone = 0
  if (part.sound === 'busy') ambientAudio.play('pipe', 0.1, 2.4, 650)
  else if (part.sound === 'voice') ambientAudio.play('announce', 0.08, 1, 1400)
  else ambientAudio.play('announce', 0.05, 1.35, 650)
}
