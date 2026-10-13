import { Matrix4, Vector3 } from 'three'
import { FACADE, type FacadeSpec } from '../../world/facades.ts'
import { Rng } from '../../world/rng.ts'
import type { Geo, P3, RGB } from '../geo/Geo.ts'
import { rgb, shade } from '../geo/Geo.ts'
import { Sink, type Layers } from '../geo/layers.ts'
import type { SignAtlas } from '../geo/textures.ts'

/** A static point light the scene may use for a lit shopfront. */
export interface LightSpot {
  x: number
  y: number
  z: number
  color: string
  intensity: number
  distance: number
}

/** A stretch of facade wall at one depth: floors above an overhang or setback sit on a different plane. */
export interface Plane {
  y0: number
  y1: number
  z: number
}

/**
 * Everything a facade drawing routine needs. The local frame has x along the
 * front (0 to width), y up and z out into the street.
 */
export interface FacadeContext {
  spec: FacadeSpec
  rng: Rng
  s: Sink
  base: Geo
  detail: Geo
  emissive: Geo
  atlas: SignAtlas
  lights: LightSpot[]
  W: number
  H: number
  G: number
  floors: number
  storey: number
  planes: Plane[]
  wall: RGB
  trim: RGB
  /** Local to world, for placing lights. */
  toWorld(x: number, y: number, z: number): P3
  /** Depth of the wall plane for the floor whose base is at y. */
  zAt(y: number): number
}

/** Height at which a stepped building pulls back, or null if it does not. */
export function stepHeight(spec: FacadeSpec): number | null {
  const G = FACADE.groundHeight
  const floors = Math.max(1, Math.round((spec.height - G) / FACADE.storeyHeight))
  if (spec.setback <= 0 || floors < 3) return null
  const storey = (spec.height - G) / floors
  return G + Math.max(1, Math.min(floors - 1, spec.setbackFrom - 1)) * storey
}

export function makeContext(layers: Layers, atlas: SignAtlas, spec: FacadeSpec, lights: LightSpot[]): { ctx: FacadeContext; frame: Matrix4 } {
  const W = Math.hypot(spec.b[0] - spec.a[0], spec.b[1] - spec.a[1])
  let ux = (spec.b[0] - spec.a[0]) / W
  let uz = (spec.b[1] - spec.a[1]) / W
  let ox = spec.a[0]
  let oz = spec.a[1]
  let nx = -uz
  let nz = ux
  if (nx * spec.outward[0] + nz * spec.outward[1] < 0) {
    ux = -ux
    uz = -uz
    ox = spec.b[0]
    oz = spec.b[1]
    nx = -uz
    nz = ux
  }
  const frame = new Matrix4().makeBasis(new Vector3(ux, 0, uz), new Vector3(0, 1, 0), new Vector3(nx, 0, nz)).setPosition(ox, 0, oz)

  const cx = (spec.a[0] + spec.b[0]) / 2
  const cz = (spec.a[1] + spec.b[1]) / 2
  const s = new Sink(layers, 'base', cx, cz)

  const G = FACADE.groundHeight
  const H = spec.height
  const floors = Math.max(1, Math.round((H - G) / FACADE.storeyHeight))
  const storey = (H - G) / floors
  const useSetback = spec.setback > 0 && floors >= 3
  const lowerFloors = useSetback ? Math.max(1, Math.min(floors - 1, spec.setbackFrom - 1)) : floors
  const ySet = G + lowerFloors * storey
  const zAt = (y: number): number => {
    if (useSetback && y >= ySet - 1e-6) return -spec.setback
    if (spec.overhang > 0 && y >= G + storey - 1e-6) return spec.overhang
    return 0
  }

  const planes: Plane[] = []
  const edges = [0, G]
  for (let f = 1; f <= floors; f++) edges.push(G + f * storey)
  for (let i = 0; i < edges.length - 1; i++) {
    const z = zAt(edges[i])
    const last = planes[planes.length - 1]
    if (last && Math.abs(last.z - z) < 1e-6) last.y1 = edges[i + 1]
    else planes.push({ y0: edges[i], y1: edges[i + 1], z })
  }

  const v = new Vector3()
  const ctx: FacadeContext = {
    spec,
    rng: new Rng(`${spec.seed}:geo`),
    s,
    base: s.solid,
    detail: s.detail,
    emissive: s.emissive,
    atlas,
    lights,
    W,
    H,
    G,
    floors,
    storey,
    planes,
    wall: rgb(spec.wall),
    trim: rgb(spec.trim),
    toWorld: (x, y, z) => {
      v.set(x, y, z).applyMatrix4(frame)
      return [v.x, v.y, v.z]
    },
    zAt,
  }
  return { ctx, frame }
}

/** A flat rectangle facing out of the wall, at depth z. */
export function front(g: Geo, x0: number, y0: number, x1: number, y1: number, z: number, color: RGB | string, colors?: readonly [RGB | string, RGB | string, RGB | string, RGB | string]) {
  g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, colors)
}

/** A rectangle whose bottom edge is darker than its top. */
export function frontGrad(g: Geo, x0: number, y0: number, x1: number, y1: number, z: number, color: RGB, bottom: number, top = 1) {
  const lo = shade(color, bottom)
  const hi = shade(color, top)
  g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, [lo, lo, hi, hi])
}

/** A vertical bar drawn as one flat quad. */
export function bar(g: Geo, x: number, y0: number, y1: number, z: number, w: number, color: RGB | string) {
  front(g, x - w / 2, y0, x + w / 2, y1, z, color)
}
