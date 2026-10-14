import { closestPointOnBoundary, dot, pointInPolygon, sub, type Vec2 } from './geometry2d.ts'
import type { Obstacle, OrientedRect, Ramp, World } from './build.ts'

/**
 * Player collision: a vertical circle that walks on the ground or on
 * footbridge surfaces. No physics engine; just push-out against polygons
 * and a "can I stand here" height rule.
 */

export const PLAYER_RADIUS = 0.35

/*
 * Obstacles are looked up through a coarse grid, so collision cost stays flat
 * however many props the district holds. The grid is built lazily and rebuilt
 * if obstacles are added afterwards.
 */
const GRID_CELL = 8
/** Obstacles wider than this (whole city blocks) are scanned every time instead of being gridded. */
const GRID_MAX_SPAN = 48

interface ObstacleGrid {
  count: number
  cells: Map<number, Obstacle[]>
  big: Obstacle[]
}
const gridCache = new WeakMap<World, ObstacleGrid>()
const cellKey = (ix: number, iz: number) => ix * 65536 + iz

function obstacleGrid(world: World): ObstacleGrid {
  const cached = gridCache.get(world)
  if (cached && cached.count === world.obstacles.length) return cached
  const grid: ObstacleGrid = { count: world.obstacles.length, cells: new Map(), big: [] }
  for (const o of world.obstacles) {
    const b = o.bounds
    if (b.maxX - b.minX > GRID_MAX_SPAN || b.maxZ - b.minZ > GRID_MAX_SPAN) {
      grid.big.push(o)
      continue
    }
    for (let ix = Math.floor(b.minX / GRID_CELL); ix <= Math.floor(b.maxX / GRID_CELL); ix++) {
      for (let iz = Math.floor(b.minZ / GRID_CELL); iz <= Math.floor(b.maxZ / GRID_CELL); iz++) {
        const k = cellKey(ix, iz)
        const list = grid.cells.get(k)
        if (list) list.push(o)
        else grid.cells.set(k, [o])
      }
    }
  }
  gridCache.set(world, grid)
  return grid
}

/** Obstacles that could be within `r` of `p`. May include a few that are not. */
export function obstaclesNear(world: World, p: Vec2, r: number): readonly Obstacle[] {
  const g = obstacleGrid(world)
  const x0 = Math.floor((p[0] - r) / GRID_CELL)
  const x1 = Math.floor((p[0] + r) / GRID_CELL)
  const z0 = Math.floor((p[1] - r) / GRID_CELL)
  const z1 = Math.floor((p[1] + r) / GRID_CELL)
  if (x0 === x1 && z0 === z1) {
    const list = g.cells.get(cellKey(x0, z0))
    if (!list) return g.big
    return g.big.length === 0 ? list : [...g.big, ...list]
  }
  const out: Obstacle[] = [...g.big]
  for (let ix = x0; ix <= x1; ix++) {
    for (let iz = z0; iz <= z1; iz++) {
      for (const o of g.cells.get(cellKey(ix, iz)) ?? []) if (!out.includes(o)) out.push(o)
    }
  }
  return out
}
/** Largest height change between frames that counts as walking, not falling. */
export const STEP_HEIGHT = 0.45

export interface PlayerPosition {
  x: number
  z: number
  y: number
}

export function inRect(r: OrientedRect, p: Vec2): boolean {
  const d = sub(p, r.center)
  const u = dot(d, r.axis)
  const v = d[0] * -r.axis[1] + d[1] * r.axis[0]
  return Math.abs(u) <= r.halfLength && Math.abs(v) <= r.halfWidth
}

/**
 * Whether the player is currently standing on the elevated footbridge or its stairs.
 * When on the ground below the footbridge deck (Hoi Pong Road carriageway/pavement),
 * y is near 0 and this returns false.
 */
export function isPlayerOnFootbridge(world: World, x: number, z: number, y: number): boolean {
  if (y > 1.0) return true
  const p: Vec2 = [x, z]
  for (const r of world.ramps) {
    if (inRect(r, p)) return true
  }
  for (const d of world.decks) {
    if (y > 1.0 && inRect(d, p)) return true
  }
  return false
}

function rampHeight(r: Ramp, p: Vec2): number {
  const t = dot(sub(p, r.bottom), r.axis) / (r.halfLength * 2)
  return Math.max(0, Math.min(1, t)) * r.rise
}

function nearBounds(b: { minX: number; minZ: number; maxX: number; maxZ: number }, p: Vec2, r: number): boolean {
  return p[0] > b.minX - r && p[0] < b.maxX + r && p[1] > b.minZ - r && p[1] < b.maxZ + r
}

/**
 * Height the player would stand at on `p`, given they are currently at `y`.
 * Prefers the highest surface reachable by a step; null if none.
 */
export function standingHeight(world: World, p: Vec2, y: number): number | null {
  let best: number | null = 0 <= y + STEP_HEIGHT && 0 >= y - STEP_HEIGHT ? 0 : null
  const consider = (h: number) => {
    if (h <= y + STEP_HEIGHT && h >= y - STEP_HEIGHT && (best === null || h > best)) best = h
  }
  for (const r of world.ramps) if (inRect(r, p)) consider(rampHeight(r, p))
  for (const d of world.decks) if (inRect(d, p)) consider(d.height)
  return best
}

/** Pushes the circle at `p` out of every solid active at height `y`. Returns null if it stays stuck. */
export function resolvePenetration(world: World, p: Vec2, y: number, radius = PLAYER_RADIUS): Vec2 | null {
  let q: Vec2 = p
  for (let iter = 0; iter < 4; iter++) {
    let moved = false
    for (const o of obstaclesNear(world, q, radius)) {
      if (y >= o.top || !nearBounds(o.bounds, q, radius)) continue
      const pushed = pushOut(q, o.poly, radius)
      if (pushed) {
        q = pushed
        moved = true
      }
    }
    for (const r of world.ramps) {
      if (!nearBounds(r.bounds, q, radius)) continue
      const { point, dist } = closestPointOnBoundary(q, r.poly)
      const inside = pointInPolygon(q, r.poly)
      if (!inside && dist >= radius) continue
      // The stair is solid only where it rises above what the player can step onto.
      if (rampHeight(r, inside ? q : point) <= y + STEP_HEIGHT) continue
      const pushed = pushOut(q, r.poly, radius)
      if (pushed) {
        q = pushed
        moved = true
      }
    }
    if (!moved) return q
  }
  return isBlocked(world, q, y, radius) ? null : q
}

function pushOut(p: Vec2, poly: readonly Vec2[], radius: number): Vec2 | null {
  const { point, dist } = closestPointOnBoundary(p, poly)
  const inside = pointInPolygon(p, poly)
  if (!inside && dist >= radius) return null
  if (dist < 1e-9) return null
  const nx = (p[0] - point[0]) / dist
  const nz = (p[1] - point[1]) / dist
  const sign = inside ? -1 : 1
  return [point[0] + nx * sign * radius * 1.001, point[1] + nz * sign * radius * 1.001]
}

export function isBlocked(world: World, p: Vec2, y: number, radius = PLAYER_RADIUS): boolean {
  for (const o of obstaclesNear(world, p, radius)) {
    if (y >= o.top || !nearBounds(o.bounds, p, radius)) continue
    if (pointInPolygon(p, o.poly) || closestPointOnBoundary(p, o.poly).dist < radius * 0.999) return true
  }
  for (const r of world.ramps) {
    if (!nearBounds(r.bounds, p, radius)) continue
    const inside = pointInPolygon(p, r.poly)
    const { point, dist } = closestPointOnBoundary(p, r.poly)
    if (!inside && dist >= radius * 0.999) continue
    if (rampHeight(r, inside ? p : point) > y + STEP_HEIGHT) return true
  }
  return false
}

function tryMove(world: World, from: PlayerPosition, dx: number, dz: number): PlayerPosition | null {
  const target: Vec2 = [from.x + dx, from.z + dz]
  const y0 = standingHeight(world, target, from.y)
  if (y0 === null) return null
  const resolved = resolvePenetration(world, target, y0)
  if (!resolved) return null
  const y1 = standingHeight(world, resolved, from.y)
  if (y1 === null) return null
  return { x: resolved[0], z: resolved[1], y: y1 }
}

/**
 * Longest single collision step. Well under the player radius, so no move can
 * carry the circle past a thin railing or across a deck edge in one step.
 */
export const MAX_COLLISION_STEP = 0.12

function moveStep(world: World, from: PlayerPosition, dx: number, dz: number): PlayerPosition {
  return tryMove(world, from, dx, dz) ?? tryMove(world, from, dx, 0) ?? tryMove(world, from, 0, dz) ?? from
}

/** Moves the player by (dx, dz), sliding along walls and stopping at drops. */
export function movePlayer(world: World, from: PlayerPosition, dx: number, dz: number): PlayerPosition {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_COLLISION_STEP))
  let p = from
  for (let i = 0; i < steps; i++) {
    const next = moveStep(world, p, dx / steps, dz / steps)
    if (next === p) break
    p = next
  }
  return p
}
