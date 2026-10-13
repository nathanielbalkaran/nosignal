import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
  type PerspectiveCamera,
  type Texture,
} from 'three'
import { workerAnim } from '../../game/restaurant.ts'
import type { Place } from '../../game/session.ts'
import { receiptCanvas } from '../../ui/receiptArt.ts'
import { Rng } from '../../world/rng.ts'
import { makeFigure, type Figure } from '../ambient/figures.ts'
import { retroTexture } from '../geo/retroTextures.ts'
import { makeGlowTexture } from '../geo/textures.ts'
import { buildCar, buildInterior, COUNTER_TOP, LAMP, LANE_AT, ROOM, TABLE } from './interior.ts'

/*
 * The two fixed restaurant scenes. The whole interior (and the lane outside the
 * window) is built once, far from the district so the two never share a view,
 * and is only shown while the player is inside; the city is hidden meanwhile.
 * No physics, no pathing: a worker who breathes, writes and hands over a
 * receipt, steam, a ceiling fan, and now and then a car or a passer-by in the
 * lane. Everything moves by transform or colour.
 */

/** Where the interior sits in world space. */
export const ORIGIN = new Vector3(1000, 0, 1000)

interface Shot {
  fov: number
  pos: Vector3
  target: Vector3
}

const SHOTS: Partial<Record<Exclude<Place, 'STREET'>, Shot>> = {
  // Across the counter at the worker. The window is at the left edge.
  COUNTER: { fov: 56, pos: new Vector3(0.5, 1.5, 1.7), target: new Vector3(0.15, 1.28, -1.1) },
  // Seated at the window table, looking along it at the tea, the noodles and the lane.
  TABLE: { fov: 62, pos: new Vector3(TABLE.x, 1.17, TABLE.z + 1.1), target: new Vector3(TABLE.x, 0.84, TABLE.z - 0.75) },
}

const CJK = '"PingFang HK", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "Heiti TC", "Noto Sans CJK TC", sans-serif'

function canvasTex(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  paint(ctx)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.magFilter = t.minFilter = NearestFilter
  t.generateMipmaps = false
  return t
}

/** Wall menu: a red board with white lettering, a black felt board with price lines. */
function menuTextures(): { red: Texture; felt: Texture; window: Texture } {
  const red = canvasTex(256, 64, (ctx) => {
    ctx.fillStyle = '#8c2f29'
    ctx.fillRect(0, 0, 256, 64)
    ctx.strokeStyle = '#d6c79a'
    ctx.lineWidth = 2
    ctx.strokeRect(3, 3, 250, 58)
    ctx.fillStyle = '#f0e4be'
    ctx.textBaseline = 'middle'
    ctx.font = `700 17px ${CJK}`
    ctx.textAlign = 'left'
    const items = [
      ['奶茶', '14'],
      ['鴛鴦', '16'],
      ['公仔麵', '24'],
      ['餐蛋麵', '28'],
    ]
    items.forEach(([n, p], i) => {
      const x = 12 + (i % 2) * 124
      const y = 20 + Math.floor(i / 2) * 25
      ctx.fillText(n, x, y)
      ctx.textAlign = 'right'
      ctx.fillText('$' + p, x + 104, y)
      ctx.textAlign = 'left'
    })
  })
  const felt = canvasTex(160, 48, (ctx) => {
    ctx.fillStyle = '#24272a'
    ctx.fillRect(0, 0, 160, 48)
    ctx.fillStyle = '#ddd7c4'
    ctx.font = `700 15px ${CJK}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('常餐', 10, 14)
    ctx.font = '15px "VT323", monospace'
    ;['A $32', 'B $35', 'C $38'].forEach((s, i) => ctx.fillText(s, 10 + i * 50, 35))
    ctx.fillStyle = '#d9a36a'
    ctx.fillRect(8, 24, 144, 1)
  })
  // Lettering painted on the glass, seen from inside: mirrored, as it is in life.
  const window = canvasTex(128, 48, (ctx) => {
    ctx.clearRect(0, 0, 128, 48)
    ctx.translate(128, 0)
    ctx.scale(-1, 1)
    ctx.fillStyle = 'rgba(224, 196, 120, 0.9)'
    ctx.font = `700 24px ${CJK}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('美華冰室', 64, 20)
    ctx.font = '14px "VT323", monospace'
    ctx.fillStyle = 'rgba(224, 196, 120, 0.85)'
    ctx.fillText('MEI WAH CAFE', 64, 40)
  })
  return { red, felt, window }
}

class Steam {
  private readonly sprites: Sprite[] = []
  private readonly mats: SpriteMaterial[] = []
  private readonly at: [number, number, number]
  private readonly rise: number
  private readonly strength: number
  private readonly spread: number
  constructor(parent: Group, glow: Texture, at: [number, number, number], rise: number, strength: number, spread: number, count = 4) {
    this.at = at
    this.rise = rise
    this.strength = strength
    this.spread = spread
    for (let i = 0; i < count; i++) {
      const m = new SpriteMaterial({ map: glow, color: '#e8e2d2', transparent: true, opacity: 0, depthWrite: false, fog: false })
      const s = new Sprite(m)
      parent.add(s)
      this.sprites.push(s)
      this.mats.push(m)
    }
  }
  update(t: number) {
    const n = this.sprites.length
    this.sprites.forEach((s, i) => {
      const u = (t * 0.22 + i / n) % 1
      s.position.set(this.at[0] + Math.sin(t * 0.8 + i * 2.1) * this.spread * u, this.at[1] + u * this.rise, this.at[2] + Math.cos(t * 0.6 + i * 1.7) * this.spread * u * 0.6)
      const size = this.spread * (0.9 + u * 2.4)
      s.scale.set(size, size, 1)
      this.mats[i].opacity = this.strength * Math.sin(Math.PI * u) ** 1.4
    })
  }
}

export interface RestaurantRig {
  root: Group
  /** Frame update. `time` advances only while playing. */
  update(dt: number, view: Place, playing: boolean, camera: PerspectiveCamera): void
  dispose(): void
}

export function createRestaurantRig(onWindowVehicle: (level: number) => void): RestaurantRig {
  const root = new Group()
  root.position.copy(ORIGIN)
  root.visible = false
  const room = new Group()
  root.add(room)
  const rng = new Rng('restaurant:life')
  const disposables: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x)
    return x
  }

  // ----- static scenery -----
  const { lit, glow, out } = buildInterior()
  const plaster = retroTexture('plaster')
  const litMat = own(new MeshStandardMaterial({ vertexColors: true, map: plaster, roughness: 1, metalness: 0, side: DoubleSide, fog: false }))
  const basicMat = own(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, fog: false }))
  room.add(new Mesh(own(lit.build({ tile: 1.6 })), litMat))
  room.add(new Mesh(own(glow.build()), basicMat))
  // The lane has its own frame (x out from the window wall, z along the lane), turned to run along the back wall.
  const lane = new Group()
  lane.position.set(LANE_AT.x, 0, LANE_AT.z)
  lane.rotation.y = -Math.PI / 2
  lane.add(new Mesh(own(out.build()), basicMat))
  room.add(lane)

  // ----- signs on the walls -----
  const tex = menuTextures()
  for (const t of Object.values(tex)) own(t)
  const board = (map: Texture, w: number, h: number, x: number, y: number, z: number, transparent = false, ry = 0, tint = '#d9d2c0') => {
    const m = own(new MeshBasicMaterial({ map, color: tint, transparent, side: DoubleSide, fog: false, depthWrite: !transparent }))
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), m)
    mesh.position.set(x, y, z)
    mesh.rotation.y = ry
    room.add(mesh)
  }
  board(tex.red, 2.0, 0.5, -0.25, 2.42, ROOM.z0 + 0.02)
  board(tex.felt, 1.0, 0.33, -2.25, 2.45, ROOM.z0 + 0.02, false, 0, '#c8c2b0')
  // The mirrored lettering painted on the glass, seen from inside.
  board(tex.window, 0.7, 0.26, -2.62, 1.98, ROOM.z0 + 0.05, true)

  // ----- lights -----
  const hemi = new HemisphereLight('#ffe2b8', '#4a3a30', 1.35)
  const lamp1 = new PointLight('#ffcf8c', 12, 7.5, 1.6)
  lamp1.position.set(0.3, 2.1, -0.45)
  const lamp2 = new PointLight('#ffd7a0', 11, 7.5, 1.6)
  lamp2.position.set(1.7, 2.1, -0.45)
  const tableLamp = new PointLight('#ffc888', 8, 5, 1.6)
  tableLamp.position.set(TABLE.x, 2.0, TABLE.z + 0.2)
  const streetLamp = new PointLight('#ffb870', 30, 11, 1.6)
  streetLamp.position.set(LAMP.x - 1.0, LAMP.y - 0.2, LAMP.z)
  lane.add(streetLamp)
  room.add(hemi, lamp1, lamp2, tableLamp)

  // ----- the ceiling fan -----
  const fan = new Group()
  fan.position.set(0.5, ROOM.h - 0.28, 0.4)
  const fanMat = own(new MeshStandardMaterial({ color: '#4a3a2c', roughness: 1, fog: false }))
  const bladeGeo = own(new BoxGeometry(0.65, 0.012, 0.13))
  for (let i = 0; i < 3; i++) {
    const b = new Mesh(bladeGeo, fanMat)
    const a = (i * Math.PI * 2) / 3
    b.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4)
    b.rotation.y = -a
    fan.add(b)
  }
  const hub = new Mesh(own(new BoxGeometry(0.16, 0.1, 0.16)), fanMat)
  fan.add(hub)
  const rod = new Mesh(own(new BoxGeometry(0.02, 0.2, 0.02)), fanMat)
  rod.position.y = 0.15
  room.add(fan, rod)
  rod.position.set(0.5, ROOM.h - 0.12, 0.4)

  // ----- the worker, standing behind the counter, facing the player -----
  const worker: Figure = makeFigure('worker', 3)
  const WORKER_BASE = { x: 0.45, z: -0.98 }
  worker.group.position.set(WORKER_BASE.x, 0, WORKER_BASE.z)
  worker.group.rotation.y = 0.04
  room.add(worker.group)
  worker.pose(0, 0)

  // ----- the receipt, written on the counter and handed over -----
  const paperTex = own(new CanvasTexture(receiptCanvas()))
  paperTex.colorSpace = SRGBColorSpace
  paperTex.magFilter = NearestFilter
  paperTex.minFilter = NearestFilter
  paperTex.generateMipmaps = false
  const paperMat = own(new MeshBasicMaterial({ map: paperTex, transparent: true, side: DoubleSide, fog: false, color: '#e8e4d8' }))
  const paper = new Mesh(own(new PlaneGeometry(0.1, 0.19)), paperMat)
  paper.visible = false
  room.add(paper)

  // ----- steam: kettle, tea, noodles -----
  const glowTex = own(makeGlowTexture())
  const steams = [
    new Steam(room, glowTex, [-0.44, COUNTER_TOP + 0.42, -0.2], 0.55, 0.26, 0.06, 5),
    new Steam(room, glowTex, [TABLE.x + 0.3, TABLE.top + 0.1, TABLE.z + 0.22], 0.3, 0.24, 0.04, 4),
    new Steam(room, glowTex, [TABLE.x - 0.2, TABLE.top + 0.14, TABLE.z + 0.08], 0.34, 0.3, 0.07, 5),
    new Steam(room, glowTex, [-0.35, 1.62, ROOM.z0 + 0.45], 0.45, 0.2, 0.06, 4),
  ]

  // ----- the lane: a car now and then, a passer-by now and then -----
  const car = new Mesh(own(buildCar().build()), basicMat)
  car.position.set(-6.5, 0, 30)
  car.visible = false
  lane.add(car)
  const headMat = own(new SpriteMaterial({ map: glowTex, color: '#ffe2a8', transparent: true, opacity: 0.8, depthWrite: false, blending: AdditiveBlending, fog: false }))
  for (const sx of [-0.5, 0.5]) {
    const s = new Sprite(headMat)
    s.position.set(sx, 0.62, -2.45)
    s.scale.set(1.3, 1.3, 1)
    car.add(s)
  }
  const walkers: Figure[] = [makeFigure('commuter', 2), makeFigure('elder', 5)]
  for (const w of walkers) {
    w.group.visible = false
    lane.add(w.group)
  }

  const state = {
    t: 0,
    nextCar: 7,
    carZ: 0,
    carActive: false,
    nextWalker: 16,
    walkerIndex: 0,
    walkerActive: false,
    walkerS: 0,
    walkerDir: -1,
    walkerSpeed: 1.2,
    lastView: 'STREET' as Place,
  }

  const lookAt = new Vector3()
  const camPos = new Vector3()
  const smooth = (x: number) => x * x * (3 - 2 * x)

  function poseWorker(t: number) {
    const { body, armL, armR } = worker.rig
    const a = workerAnim
    // Breathing and a slow sway, always.
    const breathe = Math.sin(t * 1.6) * 0.012
    let lean = 0.2 + breathe
    const lJ = -0.55
    const lK = -0.55
    let rJ = -0.5
    let rK = -0.5
    let yaw = Math.sin(t * 0.45) * 0.05
    let scribble = 0

    if (a.action === 'write') {
      // Head down over the paper, right hand scratching at it.
      const d = Math.min(1, a.t / 0.5)
      lean = 0.2 + 0.2 * smooth(d) + breathe
      rJ = -0.5 - 0.3 * smooth(d)
      rK = -0.5 - 0.5 * smooth(d)
      scribble = Math.sin(a.t * 17) * 0.06 * smooth(d)
      yaw = -0.08 * smooth(d)
    } else if (a.action === 'hand') {
      // Looks up, offers the paper across the counter, then draws back.
      const reach = a.t < 1.6 ? smooth(Math.min(1, a.t / 0.9)) : 1 - smooth(Math.min(1, (a.t - 1.6) / 0.9))
      rJ = -0.5 - 0.6 * reach
      rK = -0.5 + 0.2 * reach
      lean = 0.2 + 0.1 * reach + breathe
    } else if (a.t < 0.7) {
      // A small nod when the player arrives.
      lean = 0.2 + Math.sin((a.t / 0.7) * Math.PI) * 0.12 + breathe
    }
    body.rotation.set(lean, yaw, 0)
    armL.joint.rotation.set(lJ, 0, 0.05)
    armL.knee.rotation.set(lK, 0, 0)
    armR.joint.rotation.set(rJ + scribble * 0.4, 0, -0.05)
    armR.knee.rotation.set(rK + scribble, 0, 0)
  }

  function updatePaper() {
    const a = workerAnim
    if (a.action === 'write') {
      paper.visible = true
      // Flat on the counter in front of the worker, drawn on.
      paper.position.set(WORKER_BASE.x + 0.1, COUNTER_TOP + 0.004, -0.34)
      paper.rotation.set(-Math.PI / 2, 0, 0.12)
      paper.scale.setScalar(1.15)
    } else if (a.action === 'hand') {
      paper.visible = true
      const k = smooth(Math.min(1, a.t / 1.6))
      // Slides forward and tilts up toward the player.
      paper.position.set(WORKER_BASE.x + 0.1 + 0.05 * k, COUNTER_TOP + 0.004 + 0.22 * k, -0.34 + 0.62 * k)
      paper.rotation.set(-Math.PI / 2 + 1.1 * k, 0, 0.12 * (1 - k))
      paper.scale.setScalar(1.15 + 0.7 * k)
    } else {
      paper.visible = false
    }
  }

  function updateLane(dt: number) {
    const s = state
    // The car.
    if (!s.carActive && s.t >= s.nextCar) {
      s.carActive = true
      s.carZ = 18
      car.visible = true
    }
    if (s.carActive) {
      s.carZ -= 6.2 * dt
      car.position.z = s.carZ
      onWindowVehicle(0.3 * Math.max(0, 1 - Math.abs(s.carZ) / 14))
      if (s.carZ < -18) {
        s.carActive = false
        car.visible = false
        s.nextCar = s.t + rng.range(22, 48)
        onWindowVehicle(0)
      }
    }
    // The passer-by.
    const w = walkers[s.walkerIndex]
    if (!s.walkerActive && s.t >= s.nextWalker) {
      s.walkerActive = true
      s.walkerDir = rng.chance(0.5) ? 1 : -1
      s.walkerS = 0
      s.walkerSpeed = s.walkerIndex === 0 ? 1.45 : 0.95
      w.group.visible = true
    }
    if (s.walkerActive) {
      s.walkerS += s.walkerSpeed * dt
      const z = -12 * s.walkerDir + s.walkerDir * s.walkerS
      w.group.position.set(-4.05, 0, z)
      w.group.rotation.y = s.walkerDir > 0 ? 0 : Math.PI
      w.pose(s.walkerS, s.walkerSpeed)
      if (s.walkerS > 24) {
        s.walkerActive = false
        w.group.visible = false
        s.walkerIndex = (s.walkerIndex + 1) % walkers.length
        s.nextWalker = s.t + rng.range(26, 60)
      }
    }
  }

  return {
    root,
    update(dt, view, playing, camera) {
      const inside = view === 'COUNTER' || view === 'TABLE'
      root.visible = inside
      if (!inside) {
        if (state.lastView !== 'STREET') {
          onWindowVehicle(0)
          if (camera.fov !== 70) {
            camera.fov = 70
            camera.updateProjectionMatrix()
          }
        }
        state.lastView = 'STREET'
        return
      }
      state.lastView = view
      if (playing) {
        state.t += dt
        fan.rotation.y += dt * 1.5
        poseWorker(state.t)
        updatePaper()
        for (const st of steams) st.update(state.t)
        updateLane(dt)
        // A slow flicker in the street lamp.
        streetLamp.intensity = 30 * (0.94 + 0.06 * Math.sin(state.t * 7.3) * Math.sin(state.t * 2.1))
      } else {
        onWindowVehicle(0)
      }

      // Camera: fixed shot, with a faint drift so it never looks pasted on.
      const shot = SHOTS[view]
      if (!shot) return
      if (camera.fov !== shot.fov) {
        camera.fov = shot.fov
        camera.updateProjectionMatrix()
      }
      const t = state.t
      camPos.copy(shot.pos)
      camPos.y += Math.sin(t * 0.7) * 0.004
      camPos.x += Math.sin(t * 0.37) * 0.004
      lookAt.copy(shot.target)
      lookAt.y += Math.sin(t * 0.5 + 1) * 0.004
      camera.position.copy(camPos).add(ORIGIN)
      camera.up.set(0, 1, 0)
      camera.lookAt(lookAt.add(ORIGIN))
    },
    dispose() {
      for (const d of disposables) d.dispose()
      for (const m of [litMat, basicMat, fanMat, paperMat, headMat] as Material[]) m.dispose()
      root.clear()
    },
  }
}

