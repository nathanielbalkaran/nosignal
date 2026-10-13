import { seededRandom } from './geometry2d.ts'

/**
 * Deterministic random helpers. Nothing here touches Math.random, so every
 * generator that uses them is reproducible from its seed string.
 */
export class Rng {
  private readonly next: () => number

  constructor(seed: string) {
    this.next = seededRandom(seed)
  }

  float(): number {
    return this.next()
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))]
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0
    for (const e of entries) total += e[1]
    let r = this.next() * total
    for (const e of entries) {
      r -= e[1]
      if (r <= 0) return e[0]
    }
    return entries[entries.length - 1][0]
  }

  /** Roughly normal, mean 0, standard deviation 1. */
  gauss(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function lattice(seed: number, ix: number, iz: number): number {
  let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth 2D value noise in [0, 1], stable for a given seed. */
export function valueNoise(seed: string, x: number, z: number): number {
  const s = hashString(seed)
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const u = fx * fx * (3 - 2 * fx)
  const v = fz * fz * (3 - 2 * fz)
  const a = lattice(s, ix, iz)
  const b = lattice(s, ix + 1, iz)
  const c = lattice(s, ix, iz + 1)
  const d = lattice(s, ix + 1, iz + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
