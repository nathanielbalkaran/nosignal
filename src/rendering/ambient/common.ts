import { BoxGeometry, CanvasTexture, Group, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PlaneGeometry, SRGBColorSpace, type Material, type Object3D, type Texture } from 'three'
import type { World } from '../../world/build.ts'
import type { FacadeSpec } from '../../world/facades.ts'
import type { Vec2 } from '../../world/geometry2d.ts'

/*
 * Shared plumbing for the ambient layer: anchoring objects to a facade, cached
 * materials, and the small interface every piece of ambient life implements.
 */

export interface PlayerPose {
  x: number
  z: number
  yaw: number
}

export interface Ambient {
  object: Object3D
  /** `time` is seconds since the scene mounted; `dt` the frame time. */
  update(time: number, dt: number, player: PlayerPose): void
  dispose(): void
}

/** The facade's local frame: x along the front, y up, z out into the street. Mirrors makeContext. */
export interface Frame {
  ox: number
  oz: number
  ux: number
  uz: number
  nx: number
  nz: number
  width: number
  yaw: number
}

export function frameOf(spec: FacadeSpec): Frame {
  const width = Math.hypot(spec.b[0] - spec.a[0], spec.b[1] - spec.a[1])
  let ux = (spec.b[0] - spec.a[0]) / width
  let uz = (spec.b[1] - spec.a[1]) / width
  let ox = spec.a[0]
  let oz = spec.a[1]
  if (-uz * spec.outward[0] + ux * spec.outward[1] < 0) {
    ux = -ux
    uz = -uz
    ox = spec.b[0]
    oz = spec.b[1]
  }
  return { ox, oz, ux, uz, nx: -uz, nz: ux, width, yaw: Math.atan2(-uz, ux) }
}

export function toWorld(f: Frame, x: number, z: number): Vec2 {
  return [f.ox + f.ux * x + f.nx * z, f.oz + f.uz * x + f.nz * z]
}

/** A group whose children are positioned in the facade's local frame. */
export function anchorTo(f: Frame): Group {
  const g = new Group()
  g.position.set(f.ox, 0, f.oz)
  g.rotation.y = f.yaw
  return g
}

const basics = new Map<string, MeshBasicMaterial>()
const standards = new Map<string, MeshStandardMaterial>()

/** Unlit, fogged. Cached by colour. */
export function basic(color: string, extra: { opacity?: number } = {}): MeshBasicMaterial {
  const key = `${color}:${extra.opacity ?? 1}`
  let m = basics.get(key)
  if (!m) {
    m = new MeshBasicMaterial({ color, ...(extra.opacity === undefined ? {} : { opacity: extra.opacity, transparent: true, depthWrite: false }) })
    basics.set(key, m)
  }
  return m
}

/** Lit like the rest of the scenery. Cached by colour. */
export function lit(color: string): MeshStandardMaterial {
  let m = standards.get(color)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 1, metalness: 0 })
    standards.set(color, m)
  }
  return m
}

export function disposeMaterials() {
  for (const m of basics.values()) m.dispose()
  for (const m of standards.values()) m.dispose()
  basics.clear()
  standards.clear()
}

export const unitPlane = new PlaneGeometry(1, 1)
export const unitBox = new BoxGeometry(1, 1, 1)
/** A plane that spans x 0 to 1, so scaling x grows it away from the origin. */
export const halfPlane = new PlaneGeometry(1, 1).translate(0.5, 0, 0)

export function canvasTexture(size: [number, number], paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = size[0]
  canvas.height = size[1]
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  paint(ctx, size[0], size[1])
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.magFilter = t.minFilter = NearestFilter
  t.generateMipmaps = false
  return t
}

export function disposeObject(root: Object3D, extra: Material[] = []) {
  root.traverse((o) => {
    const m = o as { geometry?: { dispose(): void } }
    if (m.geometry && m.geometry !== unitPlane && m.geometry !== unitBox && m.geometry !== halfPlane) m.geometry.dispose()
  })
  for (const m of extra) m.dispose()
}

/** Distance in the ground plane. */
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz)

/** Whether a ground point is inside the player's view cone (ignores buildings, so it is conservative). */
export function inView(p: PlayerPose, x: number, z: number, halfAngle = 1.05): boolean {
  const dx = x - p.x
  const dz = z - p.z
  // Camera looks along (-sin yaw, -cos yaw).
  const fx = -Math.sin(p.yaw)
  const fz = -Math.cos(p.yaw)
  const d = Math.hypot(dx, dz) || 1
  return (dx * fx + dz * fz) / d > Math.cos(halfAngle)
}

/** A point is safe to spawn or remove something at: far away in the haze, or behind the player. */
export function unseen(p: PlayerPose, x: number, z: number): boolean {
  const d = dist(p.x, p.z, x, z)
  return d > 80 || !inView(p, x, z)
}

function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
  const d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax)
  const d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx)
  const d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** Whether a building taller than a person stands between the player and a ground point. */
export function occluded(world: World, p: PlayerPose, x: number, z: number): boolean {
  const minX = Math.min(p.x, x) - 1
  const maxX = Math.max(p.x, x) + 1
  const minZ = Math.min(p.z, z) - 1
  const maxZ = Math.max(p.z, z) + 1
  for (const prism of world.prisms) {
    if (prism.height < 2.6) continue
    const poly = prism.footprint
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      if (Math.max(a[0], b[0]) < minX || Math.min(a[0], b[0]) > maxX || Math.max(a[1], b[1]) < minZ || Math.min(a[1], b[1]) > maxZ) continue
      if (segmentsCross(p.x, p.z, x, z, a[0], a[1], b[0], b[1])) return true
    }
  }
  return false
}

/** Somewhere the player cannot see right now: in the haze, outside the view, or behind a building. */
export function hiddenFrom(world: World, p: PlayerPose, x: number, z: number): boolean {
  return unseen(p, x, z) || occluded(world, p, x, z)
}

/** Rounds each corner within `r` metres of it, so a turn never swings wide of the street. */
export function roundCorners(points: Vec2[], r: number, rounds: number): Vec2[] {
  const dirOf = (a: Vec2, b: Vec2): Vec2 => {
    const l = dist(a[0], a[1], b[0], b[1]) || 1
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
  }
  let pts: Vec2[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const rin = Math.min(r, dist(points[i - 1][0], points[i - 1][1], p[0], p[1]) / 2)
    const rout = Math.min(r, dist(p[0], p[1], points[i + 1][0], points[i + 1][1]) / 2)
    const din = dirOf(points[i - 1], p)
    const dout = dirOf(p, points[i + 1])
    pts.push([p[0] - din[0] * rin, p[1] - din[1] * rin], p, [p[0] + dout[0] * rout, p[1] + dout[1] * rout])
  }
  pts.push(points[points.length - 1])
  for (let k = 0; k < rounds; k++) {
    const next: Vec2[] = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  return pts
}

