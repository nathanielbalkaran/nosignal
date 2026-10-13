import type { World } from './build.ts'
import { isBlocked } from './collision.ts'
import type { Bounds, Vec2 } from './geometry2d.ts'

/**
 * Ground-level walkability grid built from the real collision rules.
 * Footbridge stairs count as solid here; the bridge is checked separately.
 */
export interface WalkGrid {
  bounds: Bounds
  cell: number
  cols: number
  rows: number
  /** 0 = blocked, 1 = free, 2 = free and reachable from the spawn. */
  state: Uint8Array
}

/** `radius` is the clearance the walker needs; 0 matches the player's own collision radius. */
export function buildWalkGrid(world: World, cell = 0.5, margin = 25, radius = 0): WalkGrid {
  const pts = [...world.navigation.nodes.values()].map((n) => n.at)
  const bounds: Bounds = {
    minX: Math.min(...pts.map((p) => p[0])) - margin,
    maxX: Math.max(...pts.map((p) => p[0])) + margin,
    minZ: Math.min(...pts.map((p) => p[1])) - margin,
    maxZ: Math.max(...pts.map((p) => p[1])) + margin,
  }
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cell)
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell)
  const state = new Uint8Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p: Vec2 = [bounds.minX + (c + 0.5) * cell, bounds.minZ + (r + 0.5) * cell]
      state[r * cols + c] = isBlocked(world, p, radius) ? 0 : 1
    }
  }
  const grid = { bounds, cell, cols, rows, state }

  const start = cellIndex(grid, world.spawn.at)
  if (start !== null && state[start] === 1) {
    state[start] = 2
    const queue = [start]
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi]
      const c = i % cols
      const r = (i - c) / cols
      for (const [dc, dr] of NEIGHBOURS4) {
        const nc = c + dc
        const nr = r + dr
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
        const ni = nr * cols + nc
        if (state[ni] === 1) {
          state[ni] = 2
          queue.push(ni)
        }
      }
    }
  }
  return grid
}

const NEIGHBOURS4: Vec2[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

const NEIGHBOURS8: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
]

export function cellIndex(grid: WalkGrid, p: Vec2): number | null {
  const c = Math.floor((p[0] - grid.bounds.minX) / grid.cell)
  const r = Math.floor((p[1] - grid.bounds.minZ) / grid.cell)
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null
  return r * grid.cols + c
}

export function isReachable(grid: WalkGrid, p: Vec2): boolean {
  const i = cellIndex(grid, p)
  return i !== null && grid.state[i] === 2
}

/** True if any reachable cell touches the edge of the grid (the player could leave the district). */
export function leaksToEdge(grid: WalkGrid): boolean {
  const { cols, rows, state } = grid
  for (let c = 0; c < cols; c++) if (state[c] === 2 || state[(rows - 1) * cols + c] === 2) return true
  for (let r = 0; r < rows; r++) if (state[r * cols] === 2 || state[r * cols + cols - 1] === 2) return true
  return false
}

/** Walking distance between two points over reachable cells, or null. */
export function walkingDistance(grid: WalkGrid, from: Vec2, to: Vec2): number | null {
  return findPath(grid, from, to)?.length ?? null
}

/** A* over reachable cells (8-connected). Returns cell-centre waypoints and path length in metres. */
export function findPath(grid: WalkGrid, from: Vec2, to: Vec2): { points: Vec2[]; length: number } | null {
  const start = cellIndex(grid, from)
  const goal = cellIndex(grid, to)
  if (start === null || goal === null || grid.state[start] !== 2 || grid.state[goal] !== 2) return null
  const { cols, state } = grid
  const gc = goal % cols
  const gr = (goal - gc) / cols
  const h = (i: number) => {
    const c = i % cols
    const r = (i - c) / cols
    const dx = Math.abs(c - gc)
    const dz = Math.abs(r - gr)
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
  }
  const g = new Map<number, number>([[start, 0]])
  const came = new Map<number, number>()
  const heap = new MinHeap()
  heap.push(start, h(start))
  const closed = new Set<number>()
  const centre = (i: number): Vec2 => {
    const c = i % cols
    const r = (i - c) / cols
    return [grid.bounds.minX + (c + 0.5) * grid.cell, grid.bounds.minZ + (r + 0.5) * grid.cell]
  }
  while (heap.size > 0) {
    const i = heap.pop()
    if (i === goal) {
      const points: Vec2[] = [centre(i)]
      for (let k = came.get(i); k !== undefined; k = came.get(k)) points.unshift(centre(k))
      return { points, length: (g.get(i) ?? 0) * grid.cell }
    }
    if (closed.has(i)) continue
    closed.add(i)
    const c = i % cols
    const r = (i - c) / cols
    const gi = g.get(i) ?? 0
    for (const [dc, dr, cost] of NEIGHBOURS8) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= grid.rows) continue
      const ni = nr * cols + nc
      if (state[ni] !== 2 || closed.has(ni)) continue
      // No corner cutting through blocked cells.
      if (dc !== 0 && dr !== 0 && (state[r * cols + nc] !== 2 || state[nr * cols + c] !== 2)) continue
      const ng = gi + cost
      if (ng < (g.get(ni) ?? Infinity)) {
        g.set(ni, ng)
        came.set(ni, i)
        heap.push(ni, ng + h(ni))
      }
    }
  }
  return null
}

class MinHeap {
  private items: number[] = []
  private keys: number[] = []

  get size() {
    return this.items.length
  }

  push(item: number, key: number) {
    this.items.push(item)
    this.keys.push(key)
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.keys[parent] <= this.keys[i]) break
      this.swap(i, parent)
      i = parent
    }
  }

  pop(): number {
    const top = this.items[0]
    const lastItem = this.items.pop() as number
    const lastKey = this.keys.pop() as number
    if (this.items.length > 0) {
      this.items[0] = lastItem
      this.keys[0] = lastKey
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r
        if (m === i) break
        this.swap(i, m)
        i = m
      }
    }
    return top
  }

  private swap(a: number, b: number) {
    ;[this.items[a], this.items[b]] = [this.items[b], this.items[a]]
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
  }
}
