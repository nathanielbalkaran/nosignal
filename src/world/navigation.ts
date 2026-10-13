import type { NavEdge, NavGraph } from './build.ts'

/** Graph analysis over the pedestrian navigation graph. Development checks only. */

export interface Route {
  nodes: string[]
  edges: number[]
  length: number
}

function adjacency(g: NavGraph): Map<string, { to: string; edge: number }[]> {
  const adj = new Map<string, { to: string; edge: number }[]>()
  for (const id of g.nodes.keys()) adj.set(id, [])
  g.edges.forEach((e, i) => {
    adj.get(e.a)?.push({ to: e.b, edge: i })
    adj.get(e.b)?.push({ to: e.a, edge: i })
  })
  return adj
}

/**
 * Collapses `ids` into a single node `into` (placed at the first one). Edge
 * order is preserved, so edge indices stay valid against the original graph.
 * Used to treat all station entrances as one destination.
 */
export function mergeNodes(g: NavGraph, ids: readonly string[], into: string): NavGraph {
  const first = g.nodes.get(ids[0])
  if (!first) throw new Error(`Unknown node "${ids[0]}"`)
  const rename = (id: string) => (ids.includes(id) ? into : id)
  const nodes = new Map([...g.nodes].filter(([id]) => !ids.includes(id)))
  nodes.set(into, { id: into, at: first.at })
  const edges = g.edges.map((e) => ({ ...e, a: rename(e.a), b: rename(e.b) }))
  if (edges.some((e) => e.a === into && e.b === into)) throw new Error(`Merging ${ids.join(', ')} would create a self-loop`)
  return { nodes, edges }
}

export function degree(g: NavGraph, id: string): number {
  return g.edges.filter((e) => e.a === id || e.b === id).length
}

export function shortestRoute(g: NavGraph, from: string, to: string): Route | null {
  const adj = adjacency(g)
  const dist = new Map<string, number>([[from, 0]])
  const prev = new Map<string, { node: string; edge: number }>()
  const open = new Set([from])
  while (open.size > 0) {
    let current = ''
    let best = Infinity
    for (const id of open) {
      const d = dist.get(id) ?? Infinity
      if (d < best) {
        best = d
        current = id
      }
    }
    open.delete(current)
    if (current === to) break
    for (const { to: next, edge } of adj.get(current) ?? []) {
      const d = best + g.edges[edge].length
      if (d < (dist.get(next) ?? Infinity)) {
        dist.set(next, d)
        prev.set(next, { node: current, edge })
        open.add(next)
      }
    }
  }
  if (!dist.has(to)) return null
  const nodes = [to]
  const edges: number[] = []
  let cur = to
  while (cur !== from) {
    const p = prev.get(cur)
    if (!p) return null
    nodes.unshift(p.node)
    edges.unshift(p.edge)
    cur = p.node
  }
  return { nodes, edges, length: dist.get(to) ?? 0 }
}

/** Maximum number of routes from → to that share no street segment (unit-capacity max flow). */
export function edgeDisjointRouteCount(g: NavGraph, from: string, to: string): number {
  const adj = adjacency(g)
  // Residual capacity per directed use of each undirected edge.
  const capacity = new Map<string, number>()
  const key = (edge: number, toward: string) => `${edge}>${toward}`
  g.edges.forEach((e, i) => {
    capacity.set(key(i, e.a), 1)
    capacity.set(key(i, e.b), 1)
  })
  let flow = 0
  for (;;) {
    const prev = new Map<string, { node: string; edge: number }>()
    const queue = [from]
    const seen = new Set([from])
    while (queue.length > 0 && !seen.has(to)) {
      const cur = queue.shift() as string
      for (const { to: next, edge } of adj.get(cur) ?? []) {
        if (seen.has(next) || (capacity.get(key(edge, next)) ?? 0) <= 0) continue
        seen.add(next)
        prev.set(next, { node: cur, edge })
        queue.push(next)
      }
    }
    if (!seen.has(to)) return flow
    let cur = to
    while (cur !== from) {
      const p = prev.get(cur) as { node: string; edge: number }
      capacity.set(key(p.edge, cur), (capacity.get(key(p.edge, cur)) ?? 0) - 1)
      capacity.set(key(p.edge, p.node), (capacity.get(key(p.edge, p.node)) ?? 0) + 1)
      cur = p.node
    }
    flow++
  }
}

/** Independent cycles in the graph (E − V + components). */
export function loopCount(g: NavGraph): number {
  const adj = adjacency(g)
  const seen = new Set<string>()
  let components = 0
  for (const id of g.nodes.keys()) {
    if (seen.has(id)) continue
    components++
    const stack = [id]
    seen.add(id)
    while (stack.length > 0) {
      const cur = stack.pop() as string
      for (const { to } of adj.get(cur) ?? []) {
        if (!seen.has(to)) {
          seen.add(to)
          stack.push(to)
        }
      }
    }
  }
  return g.edges.length - g.nodes.size + components
}

/**
 * Picks up to `count` routes, shortest first, each sharing at most
 * `maxOverlap` of its length with every route already picked.
 */
export function diverseRoutes(g: NavGraph, from: string, to: string, count = 3, maxOverlap = 0.5): Route[] {
  const adj = adjacency(g)
  const shortest = shortestRoute(g, from, to)
  if (!shortest) return []
  const limit = shortest.length * 2.5
  const all: Route[] = []

  const nodes = [from]
  const edges: number[] = []
  const visited = new Set([from])
  const walk = (cur: string, len: number) => {
    if (all.length > 20000 || len > limit) return
    if (cur === to) {
      all.push({ nodes: [...nodes], edges: [...edges], length: len })
      return
    }
    for (const { to: next, edge } of adj.get(cur) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      nodes.push(next)
      edges.push(edge)
      walk(next, len + g.edges[edge].length)
      edges.pop()
      nodes.pop()
      visited.delete(next)
    }
  }
  walk(from, 0)
  all.sort((a, b) => a.length - b.length)

  const picked: Route[] = []
  for (const route of all) {
    const ok = picked.every((p) => {
      const shared = route.edges.filter((e) => p.edges.includes(e)).reduce((s, e) => s + g.edges[e].length, 0)
      return shared / route.length <= maxOverlap
    })
    if (ok) picked.push(route)
    if (picked.length >= count) break
  }
  return picked
}

export function describeEdge(e: NavEdge): string {
  return e.street ? e.street.name.en : e.kind
}
