import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2, Vector3 } from 'three'
import { signedArea, type Vec2 } from '../../world/geometry2d.ts'

/** Accumulates flat-shaded, vertex-coloured triangles into one geometry. */
export class MeshAccumulator {
  private positions: number[] = []
  private normals: number[] = []
  private colors: number[] = []
  private readonly a = new Vector3()
  private readonly b = new Vector3()
  private readonly c = new Vector3()
  private readonly n = new Vector3()
  private readonly t = new Vector3()

  /** Adds a triangle, flipping its winding so it faces along `facing`. */
  triangle(p0: Vector3, p1: Vector3, p2: Vector3, facing: Vector3, color: Color) {
    this.t.subVectors(p1, p0)
    this.n.subVectors(p2, p0).cross(this.t).negate().normalize()
    const flip = this.n.dot(facing) < 0
    const verts = flip ? [p0, p2, p1] : [p0, p1, p2]
    const normal = facing.clone().normalize()
    for (const v of verts) {
      this.positions.push(v.x, v.y, v.z)
      this.normals.push(normal.x, normal.y, normal.z)
      this.colors.push(color.r, color.g, color.b)
    }
  }

  /** Flat polygon at height y facing up (or down). */
  polygon(points: readonly Vec2[], y: number, color: Color, up = true) {
    const contour = points.map((p) => new Vector2(p[0], p[1]))
    const faces = ShapeUtils.triangulateShape(contour, [])
    const facing = new Vector3(0, up ? 1 : -1, 0)
    for (const [i, j, k] of faces) {
      this.triangle(
        this.a.set(points[i][0], y, points[i][1]).clone(),
        this.b.set(points[j][0], y, points[j][1]).clone(),
        this.c.set(points[k][0], y, points[k][1]).clone(),
        facing,
        color,
      )
    }
  }

  /** Vertical extrusion of a footprint from y0 to y1, with a top cap. */
  prism(footprint: readonly Vec2[], y0: number, y1: number, color: Color) {
    const n = footprint.length
    const ccw = signedArea(footprint) > 0
    for (let i = 0; i < n; i++) {
      const p = footprint[i]
      const q = footprint[(i + 1) % n]
      const dx = q[0] - p[0]
      const dz = q[1] - p[1]
      const len = Math.hypot(dx, dz)
      if (len < 1e-6) continue
      // Outward normal is the right-hand side for counter-clockwise footprints.
      const outward = ccw ? new Vector3(dz / len, 0, -dx / len) : new Vector3(-dz / len, 0, dx / len)
      const a0 = new Vector3(p[0], y0, p[1])
      const b0 = new Vector3(q[0], y0, q[1])
      const b1 = new Vector3(q[0], y1, q[1])
      const a1 = new Vector3(p[0], y1, p[1])
      this.triangle(a0, b0, b1, outward, color)
      this.triangle(a0, b1, a1, outward, color)
    }
    this.polygon(footprint, y1, color)
  }

  build(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    // Top-down world-space UVs, one texture tile per 4 m (all road surfaces are flat).
    const uv: number[] = []
    for (let i = 0; i < this.positions.length; i += 3) uv.push(this.positions[i] / 4, this.positions[i + 2] / 4)
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    g.computeBoundingSphere()
    return g
  }
}
