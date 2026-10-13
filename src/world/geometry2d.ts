/**
 * Plain 2D geometry on the ground plane. A Vec2 is [x, z] in world metres.
 * This module has no Three.js dependency so it can run in Node for checks.
 */
export type Vec2 = readonly [number, number]
export type Polygon = readonly Vec2[]

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]]
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]]
export const scale = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s]
export const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1]
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0]
export const length = (a: Vec2): number => Math.hypot(a[0], a[1])
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1])
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
export const perp = (a: Vec2): Vec2 => [-a[1], a[0]]

export function normalize(a: Vec2): Vec2 {
  const l = length(a)
  return l > 0 ? [a[0] / l, a[1] / l] : [0, 0]
}

/** Positive when the polygon winds counter-clockwise in (x, z) coordinates. */
export function signedArea(poly: Polygon): number {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    area += a[0] * b[1] - b[0] * a[1]
  }
  return area / 2
}

export function centroid(poly: Polygon): Vec2 {
  let x = 0
  let z = 0
  for (const p of poly) {
    x += p[0]
    z += p[1]
  }
  return [x / poly.length, z / poly.length]
}

export function pointInPolygon(p: Vec2, poly: Polygon): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a[1] > p[1] !== b[1] > p[1]) {
      const x = ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      if (p[0] < x) inside = !inside
    }
  }
  return inside
}

export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a)
  const len2 = dot(ab, ab)
  if (len2 === 0) return a
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2))
  return [a[0] + ab[0] * t, a[1] + ab[1] * t]
}

export function closestPointOnBoundary(p: Vec2, poly: Polygon): { point: Vec2; dist: number } {
  let best: Vec2 = poly[0]
  let bestDist = Infinity
  for (let i = 0; i < poly.length; i++) {
    const c = closestPointOnSegment(p, poly[i], poly[(i + 1) % poly.length])
    const d = distance(p, c)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return { point: best, dist: bestDist }
}

/**
 * Offsets every edge of a simple polygon inward by its own distance and
 * returns the mitred result. `sourceIndex[i]` is the output index of the
 * vertex generated for input vertex i.
 */
export function insetPolygon(poly: Polygon, insets: readonly number[]): { points: Vec2[]; sourceIndex: number[] } {
  const n = poly.length
  const inward = signedArea(poly) > 0 ? 1 : -1
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n]
    const dir = normalize(sub(b, a))
    const normal = scale(perp(dir), inward)
    return { origin: add(a, scale(normal, insets[i])), dir, normal }
  })

  const points: Vec2[] = []
  const sourceIndex: number[] = []
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n]
    const next = lines[i]
    const denom = cross(prev.dir, next.dir)
    sourceIndex.push(points.length)
    if (Math.abs(denom) < 1e-3) {
      // Collinear edges: keep a vertex on each offset line (a step if insets differ).
      const a = add(poly[i], scale(prev.normal, insets[(i - 1 + n) % n]))
      const b = add(poly[i], scale(next.normal, insets[i]))
      points.push(a)
      if (distance(a, b) > 1e-6) points.push(b)
      continue
    }
    const t = cross(sub(next.origin, prev.origin), next.dir) / denom
    points.push(add(prev.origin, scale(prev.dir, t)))
  }
  return { points, sourceIndex }
}

/** Rectangle around the segment a→b, `width` wide, optionally extended past both ends. */
export function rectFromSegment(a: Vec2, b: Vec2, width: number, extend = 0): Vec2[] {
  const dir = normalize(sub(b, a))
  const n = scale(perp(dir), width / 2)
  const a2 = sub(a, scale(dir, extend))
  const b2 = add(b, scale(dir, extend))
  return [add(a2, n), add(b2, n), sub(b2, n), sub(a2, n)]
}

export interface Bounds {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

export function boundsOf(points: Polygon): Bounds {
  const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity }
  for (const p of points) {
    b.minX = Math.min(b.minX, p[0])
    b.maxX = Math.max(b.maxX, p[0])
    b.minZ = Math.min(b.minZ, p[1])
    b.maxZ = Math.max(b.maxZ, p[1])
  }
  return b
}

/** Separating-axis overlap test for two convex polygons. Touching does not count. */
export function convexOverlap(a: Polygon, b: Polygon, epsilon = 1e-3): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const axis = perp(sub(poly[(i + 1) % poly.length], poly[i]))
      let minA = Infinity
      let maxA = -Infinity
      let minB = Infinity
      let maxB = -Infinity
      for (const p of a) {
        const d = dot(p, axis)
        minA = Math.min(minA, d)
        maxA = Math.max(maxA, d)
      }
      for (const p of b) {
        const d = dot(p, axis)
        minB = Math.min(minB, d)
        maxB = Math.max(maxB, d)
      }
      const scaleEps = epsilon * length(axis)
      if (maxA <= minB + scaleEps || maxB <= minA + scaleEps) return false
    }
  }
  return true
}

export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(sub(b, a), sub(c, a))
  const d2 = cross(sub(b, a), sub(d, a))
  const d3 = cross(sub(d, c), sub(a, c))
  const d4 = cross(sub(d, c), sub(b, c))
  return d1 * d2 < 0 && d3 * d4 < 0
}

export function segmentHitsPolygon(a: Vec2, b: Vec2, poly: Polygon): boolean {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true
  for (let i = 0; i < poly.length; i++) {
    if (segmentsIntersect(a, b, poly[i], poly[(i + 1) % poly.length])) return true
  }
  return false
}

/** Deterministic PRNG (mulberry32) seeded from a string. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
