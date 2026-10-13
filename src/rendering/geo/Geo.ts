import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Vector3 } from 'three'

/** [x, y, z] */
export type P3 = readonly [number, number, number]
/** Linear-space colour, as stored in vertex colours. */
export type RGB = readonly [number, number, number]

const colorCache = new Map<string, RGB>()
const tmpColor = new Color()

/** sRGB hex to the linear values three.js expects in vertex colours. Cached. */
export function rgb(hex: string): RGB {
  let c = colorCache.get(hex)
  if (!c) {
    tmpColor.set(hex)
    c = [tmpColor.r, tmpColor.g, tmpColor.b]
    colorCache.set(hex, c)
  }
  return c
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function shade(a: RGB, k: number): RGB {
  return [a[0] * k, a[1] * k, a[2] * k]
}

type ColorArg = RGB | string
const toRgb = (c: ColorArg): RGB => (typeof c === 'string' ? rgb(c) : c)

export interface BoxOptions {
  /** Colour multiplier at the bottom of the box (1 = none). Gives walls a grimy lower edge. */
  grime?: number
  /** Faces to leave out. */
  skip?: readonly ('+x' | '-x' | '+y' | '-y' | '+z' | '-z')[]
}

/**
 * Accumulates flat-shaded, vertex-coloured triangles into one geometry. A
 * transform stack lets a prop be written in its own local space and baked into
 * world space as it is added, so a whole district merges into a handful of
 * meshes.
 */
export class Geo {
  private readonly pos: number[] = []
  private readonly nor: number[] = []
  private readonly col: number[] = []
  private readonly uvs: number[] = []
  private m = new Matrix4()
  private readonly stack: Matrix4[] = []
  private readonly v = new Vector3()
  private readonly e1 = new Vector3()
  private readonly e2 = new Vector3()

  get triangleCount(): number {
    return this.pos.length / 9
  }

  /** Replaces the current transform. */
  set(m: Matrix4): this {
    this.m.copy(m)
    return this
  }

  reset(): this {
    this.m.identity()
    this.stack.length = 0
    return this
  }

  push(local: Matrix4): this {
    this.stack.push(this.m.clone())
    this.m.multiply(local)
    return this
  }

  pop(): this {
    const prev = this.stack.pop()
    if (prev) this.m.copy(prev)
    return this
  }

  /** Runs `fn` with a translation and Y rotation applied. */
  at(x: number, y: number, z: number, yaw: number, fn: () => void): this {
    this.push(new Matrix4().makeRotationY(yaw).setPosition(x, y, z))
    fn()
    return this.pop()
  }

  private world(p: P3, out: number[]) {
    this.v.set(p[0], p[1], p[2]).applyMatrix4(this.m)
    out.push(this.v.x, this.v.y, this.v.z)
  }

  /** One triangle from three local points, wound counter-clockwise seen from the front. */
  tri(a: P3, b: P3, c: P3, ca: ColorArg, cb: ColorArg = ca, cc: ColorArg = ca, uv?: readonly [number, number, number, number, number, number]) {
    const w: number[] = []
    this.world(a, w)
    this.world(b, w)
    this.world(c, w)
    this.e1.set(w[3] - w[0], w[4] - w[1], w[5] - w[2])
    this.e2.set(w[6] - w[0], w[7] - w[1], w[8] - w[2])
    this.e1.cross(this.e2)
    const len = this.e1.length()
    if (len < 1e-9) return
    this.e1.divideScalar(len)
    for (let i = 0; i < 3; i++) {
      this.pos.push(w[i * 3], w[i * 3 + 1], w[i * 3 + 2])
      this.nor.push(this.e1.x, this.e1.y, this.e1.z)
      const k = toRgb(i === 0 ? ca : i === 1 ? cb : cc)
      this.col.push(k[0], k[1], k[2])
      this.uvs.push(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0)
    }
  }

  /**
   * A quad a-b-c-d, counter-clockwise seen from the front. Colours can vary per
   * corner. `uv` is [u0, v0, u1, v1] mapped bottom-left to top-right.
   */
  quad(a: P3, b: P3, c: P3, d: P3, color: ColorArg, colors?: readonly [ColorArg, ColorArg, ColorArg, ColorArg], uv?: readonly [number, number, number, number]) {
    const k = colors ?? [color, color, color, color]
    const [u0, v0, u1, v1] = uv ?? [0, 0, 1, 1]
    this.tri(a, b, c, k[0], k[1], k[2], [u0, v0, u1, v0, u1, v1])
    this.tri(a, c, d, k[0], k[2], k[3], [u0, v0, u1, v1, u0, v1])
  }

  /** Axis-aligned (in the current local space) box from its centre and full sizes. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: ColorArg, o: BoxOptions = {}) {
    const x0 = cx - sx / 2
    const x1 = cx + sx / 2
    const y0 = cy - sy / 2
    const y1 = cy + sy / 2
    const z0 = cz - sz / 2
    const z1 = cz + sz / 2
    const top = toRgb(color)
    const bottom = o.grime !== undefined ? shade(top, o.grime) : top
    const skip = o.skip
    const side = [bottom, bottom, top, top] as const
    if (!skip?.includes('+x')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], top, side)
    if (!skip?.includes('-x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], top, side)
    if (!skip?.includes('+y')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top)
    if (!skip?.includes('-y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], bottom)
    if (!skip?.includes('+z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], top, side)
    if (!skip?.includes('-z')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], top, side)
  }

  /** Box from a minimum and maximum corner. */
  span(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: ColorArg, o?: BoxOptions) {
    this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, o)
  }

  /**
   * A (possibly tapered) prism along the segment p0 to p1. With few sides it
   * reads as a pole, pipe, bamboo cane or wheel at street scale.
   */
  rod(p0: P3, p1: P3, r0: number, color: ColorArg, sides = 5, r1: number = r0, caps = false) {
    const ax = new Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
    const len = ax.length()
    if (len < 1e-6) return
    ax.divideScalar(len)
    const helper = Math.abs(ax.y) < 0.95 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
    const u = new Vector3().crossVectors(ax, helper).normalize()
    const w = new Vector3().crossVectors(ax, u).normalize()
    const ring = (centre: P3, r: number, i: number): P3 => {
      const t = (i / sides) * Math.PI * 2
      const c = Math.cos(t)
      const s = Math.sin(t)
      return [centre[0] + (u.x * c + w.x * s) * r, centre[1] + (u.y * c + w.y * s) * r, centre[2] + (u.z * c + w.z * s) * r]
    }
    for (let i = 0; i < sides; i++) {
      const a0 = ring(p0, r0, i)
      const a1 = ring(p0, r0, i + 1)
      const b0 = ring(p1, r1, i)
      const b1 = ring(p1, r1, i + 1)
      // Outward-facing winding: (a0, a1, b1, b0) is counter-clockwise from outside for this basis.
      this.quad(a0, a1, b1, b0, color)
    }
    if (caps) {
      for (let i = 1; i < sides - 1; i++) {
        this.tri(ring(p1, r1, 0), ring(p1, r1, i), ring(p1, r1, i + 1), color)
        this.tri(ring(p0, r0, 0), ring(p0, r0, i + 1), ring(p0, r0, i), color)
      }
    }
  }

  /** Vertical cylinder or cone frustum standing on y0. */
  cyl(cx: number, y0: number, cz: number, r: number, height: number, color: ColorArg, sides = 6, rTop: number = r, cap = true) {
    this.rod([cx, y0, cz], [cx, y0 + height, cz], r, color, sides, rTop, false)
    if (cap) {
      const top = y0 + height
      for (let i = 1; i < sides - 1; i++) {
        const p = (k: number): P3 => [cx + Math.cos((k / sides) * Math.PI * 2) * rTop, top, cz + Math.sin((k / sides) * Math.PI * 2) * rTop]
        this.tri([cx + rTop, top, cz], p(i + 1), p(i), color)
      }
    }
  }

  /** A low-poly rounded lump: a squashed icosahedron, with a little colour variation per face. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: ColorArg, variation = 0.12, seed = 0) {
    const base = toRgb(color)
    ICO_FACES.forEach((f, i) => {
      const h = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453
      const k = 1 + (h - Math.floor(h) - 0.5) * 2 * variation
      const p = (idx: number): P3 => [cx + ICO_VERTS[idx][0] * rx, cy + ICO_VERTS[idx][1] * ry, cz + ICO_VERTS[idx][2] * rz]
      this.tri(p(f[0]), p(f[1]), p(f[2]), shade(base, k))
    })
  }

  /**
   * `worldUv` replaces the UVs with world-space ones (one texture tile per
   * `tile` metres, projected along each face's dominant axis), so a shared
   * surface texture keeps a constant texel size on every wall.
   */
  build(worldUv?: { tile: number }): BufferGeometry {
    const g = new BufferGeometry()
    if (worldUv) {
      const k = 1 / worldUv.tile
      for (let i = 0; i < this.pos.length / 3; i++) {
        const x = this.pos[i * 3]
        const y = this.pos[i * 3 + 1]
        const z = this.pos[i * 3 + 2]
        const nx = Math.abs(this.nor[i * 3])
        const ny = Math.abs(this.nor[i * 3 + 1])
        const nz = Math.abs(this.nor[i * 3 + 2])
        if (ny >= nx && ny >= nz) {
          this.uvs[i * 2] = x * k
          this.uvs[i * 2 + 1] = z * k
        } else if (nx > nz) {
          this.uvs[i * 2] = z * k
          this.uvs[i * 2 + 1] = y * k
        } else {
          this.uvs[i * 2] = x * k
          this.uvs[i * 2 + 1] = y * k
        }
      }
    }
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

const T = (1 + Math.sqrt(5)) / 2
const ICO_RAW: readonly (readonly [number, number, number])[] = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
  [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
  [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
]
const ICO_VERTS = ICO_RAW.map(([x, y, z]) => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l] as const
})
const ICO_FACES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]
