import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'

/*
 * Tiny cached greyscale-ish surface textures. They multiply with vertex colours,
 * so one shared texture serves every building: the vertex colour decides the hue,
 * the texture adds staining, uneven fade and grit. Nearest filtering, no mipmaps.
 */

export type RetroSurface = 'concrete' | 'plaster' | 'asphalt' | 'pavement' | 'metal' | 'fabric'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Recipe {
  size: number
  seed: number
  base: number
  /** Per-pixel noise amplitude. */
  grit: number
  /** Number of dark stain blotches and their strength. */
  stains: number
  stainDark: number
  /** Vertical rain streaks. */
  streaks: number
  /** Pavement-style grid joints / block lines. */
  joints: number
  /** Light flecks (aggregate in asphalt). */
  flecks: number
}

const RECIPES: Record<RetroSurface, Recipe> = {
  concrete: { size: 128, seed: 11, base: 0.86, grit: 0.07, stains: 9, stainDark: 0.2, streaks: 7, joints: 0, flecks: 0 },
  plaster: { size: 128, seed: 23, base: 0.9, grit: 0.045, stains: 7, stainDark: 0.14, streaks: 4, joints: 0, flecks: 0 },
  asphalt: { size: 128, seed: 37, base: 0.82, grit: 0.09, stains: 6, stainDark: 0.22, streaks: 0, joints: 0, flecks: 90 },
  metal: { size: 64, seed: 53, base: 0.88, grit: 0.05, stains: 7, stainDark: 0.22, streaks: 14, joints: 0, flecks: 40 },
  fabric: { size: 64, seed: 61, base: 0.9, grit: 0.06, stains: 9, stainDark: 0.13, streaks: 5, joints: 0, flecks: 0 },
  pavement: { size: 64, seed: 41, base: 0.86, grit: 0.07, stains: 5, stainDark: 0.16, streaks: 0, joints: 16, flecks: 0 },
}

const cache = new Map<RetroSurface, CanvasTexture>()

export function retroTexture(kind: RetroSurface): CanvasTexture {
  const hit = cache.get(kind)
  if (hit) return hit
  const r = RECIPES[kind]
  const n = r.size
  const rand = rng(r.seed)
  const v = new Float32Array(n * n).fill(r.base)
  const at = (x: number, y: number) => ((y + n) % n) * n + ((x + n) % n)

  // Soft dark blotches (wrap around so the tile repeats cleanly).
  for (let i = 0; i < r.stains; i++) {
    const cx = rand() * n
    const cy = rand() * n
    const rad = n * (0.1 + rand() * 0.2)
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++) {
        const d = Math.hypot(x, y) / rad
        if (d < 1) v[at(Math.floor(cx + x), Math.floor(cy + y))] -= (1 - d) * r.stainDark * (0.5 + rand() * 0.5)
      }
  }
  // Rain streaks running down from the top of a patch.
  for (let i = 0; i < r.streaks; i++) {
    const x = Math.floor(rand() * n)
    const y0 = Math.floor(rand() * n)
    const len = Math.floor(n * (0.2 + rand() * 0.5))
    for (let k = 0; k < len; k++) v[at(x, y0 + k)] -= 0.1 * (1 - k / len)
  }
  for (let i = 0; i < r.flecks; i++) v[at(Math.floor(rand() * n), Math.floor(rand() * n))] += 0.14
  const cell = r.joints
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let a = v[at(x, y)] + (rand() - 0.5) * 2 * r.grit
      if (cell && (x % cell === 0 || y % cell === 0)) a -= 0.2
      v[at(x, y)] = a
    }

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = n
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  const img = ctx.createImageData(n, n)
  for (let i = 0; i < n * n; i++) {
    const g = Math.max(0, Math.min(1, v[i]))
    // Faint warm bias in the lights, cool in the darks.
    img.data[i * 4] = g * 255 * (0.97 + g * 0.03)
    img.data[i * 4 + 1] = g * 255
    img.data[i * 4 + 2] = g * 255 * (1.02 - g * 0.03)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.magFilter = t.minFilter = NearestFilter
  t.generateMipmaps = false
  cache.set(kind, t)
  return t
}
