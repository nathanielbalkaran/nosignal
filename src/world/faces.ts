import { signedArea, type Vec2 } from './geometry2d.ts'

/**
 * Finds every enclosed region of a planar street graph, as a cycle of node
 * ids. The unbounded outside is dropped. Streets are straight segments between
 * nodes; dead-end stubs are not supported (a blocked alley is a full edge).
 */
export function deriveFaces(positions: ReadonlyMap<string, Vec2>, edges: readonly (readonly [string, string])[]): string[][] {
  const around = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    const list = around.get(a) ?? []
    if (!list.includes(b)) list.push(b)
    around.set(a, list)
  }
  for (const [a, b] of edges) {
    link(a, b)
    link(b, a)
  }
  const angle = (from: string, to: string) => {
    const a = positions.get(from) as Vec2
    const b = positions.get(to) as Vec2
    return Math.atan2(b[1] - a[1], b[0] - a[0])
  }
  for (const [id, list] of around) list.sort((p, q) => angle(id, p) - angle(id, q))

  /** Next half-edge: at `v`, turn to the neighbour just before `u` in angular order. */
  const next = (u: string, v: string): [string, string] => {
    const list = around.get(v) as string[]
    const i = list.indexOf(u)
    return [v, list[(i - 1 + list.length) % list.length]]
  }

  const seen = new Set<string>()
  const faces: string[][] = []
  for (const [a, b] of edges) {
    for (const start of [[a, b], [b, a]] as [string, string][]) {
      if (seen.has(start.join('>'))) continue
      const face: string[] = []
      let half = start
      while (!seen.has(half.join('>'))) {
        seen.add(half.join('>'))
        face.push(half[0])
        half = next(half[0], half[1])
      }
      faces.push(face)
    }
  }

  const areas = faces.map((f) => signedArea(f.map((id) => positions.get(id) as Vec2)))
  // The outside face encloses everything, so it has the largest area and the opposite sign to the rest.
  let outer = 0
  areas.forEach((a, i) => {
    if (Math.abs(a) > Math.abs(areas[outer])) outer = i
  })
  const outerSign = Math.sign(areas[outer])
  return faces.filter((_, i) => Math.sign(areas[i]) !== outerSign && Math.abs(areas[i]) > 1e-6)
}
