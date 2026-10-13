import {
  add,
  boundsOf,
  centroid,
  convexOverlap,
  cross,
  distance,
  dot,
  insetPolygon,
  length,
  lerp,
  normalize,
  perp,
  pointInPolygon,
  rectFromSegment,
  scale,
  seededRandom,
  signedArea,
  sub,
  type Bounds,
  type Vec2,
} from './geometry2d.ts'
import { deriveFaces } from './faces.ts'
import { buildFacadeSpecs, type FacadeSpec } from './facades.ts'
import { placeDiscoveries, type Discovery } from './discoveries.ts'
import { placeProps, type Cable, type Corridor, type PlacementReport, type PropInstance, type StreetPlate } from './props.ts'
import type {
  DeadEnd,
  DistrictLayout,
  LayoutBlock,
  LayoutCornerFeature,
  LayoutNode,
  LayoutStreet,
  StreetKind,
  WalkwayKind,
} from './types.ts'

export type PrismKind = 'lot' | 'base' | 'corner-building' | 'restaurant' | 'station'

/** The street-facing edge of a lot. */
export interface LotFront {
  a: Vec2
  b: Vec2
  /** Unit vector pointing from the facade into the street. */
  outward: Vec2
  street: LayoutStreet
}

/** A vertical extrusion of a footprint polygon. */
export interface Prism {
  footprint: Vec2[]
  base: number
  height: number
  color: string
  kind: PrismKind
  /** Stable identity, used to seed everything generated for the building. */
  id?: string
  storeys?: number
  front?: LotFront
}

/** Solid for collision. `top` is the height below which it blocks the player. */
export interface Obstacle {
  poly: Vec2[]
  bounds: Bounds
  top: number
  kind: 'block' | 'railing' | 'stall' | 'column' | 'barrier' | 'gate' | 'prop'
}

/** Oriented rectangle on the ground plane. */
export interface OrientedRect {
  center: Vec2
  axis: Vec2
  halfLength: number
  halfWidth: number
  poly: Vec2[]
  bounds: Bounds
}

export interface Ramp extends OrientedRect {
  bottom: Vec2
  top: Vec2
  rise: number
}

export interface Deck extends OrientedRect {
  height: number
}

export interface StreetSegment {
  street: LayoutStreet
  a: Vec2
  b: Vec2
}

export interface Railing {
  a: Vec2
  b: Vec2
  height: number
  /** Ground level under each end (non-zero for footbridge parapets). */
  baseA: number
  baseB: number
}

export type StallKind = 'produce' | 'tarp' | 'open' | 'storage' | 'kiosk' | 'shutter'

/** One market stall. `rect` is its solid footprint, `out` points from its back into the aisle. */
export interface Stall {
  rect: OrientedRect
  color: string
  kind: StallKind
  out: Vec2
  /** Counter height, lowest awning edge, and how far the awning reaches past the footprint. */
  counter: number
  awning: number
  proj: number
  /** Awning rolled up / structure folded away. */
  folded: boolean
  /** Warm light on. */
  lit: boolean
  /** Stable 0..1 value for small cosmetic choices. */
  seed: number
}

/** A locked gate across a blocked alley. */
export interface Gate {
  /** The solid footprint: as wide as the alley, deep enough to hold the dressing on both faces. */
  rect: OrientedRect
  height: number
  streetId: string
  centre: Vec2
  /** Unit vector along the street, from its first node to its second. */
  dir: Vec2
  /** Half the alley's width, and the distance from the centre to each face. */
  halfWidth: number
  faceOffset: number
  ends: readonly [DeadEnd, DeadEnd]
}

export interface Crossing {
  rect: OrientedRect
}

export interface BuiltBlock {
  layout: LayoutBlock
  outline: Vec2[]
  footprint: Vec2[]
  /** Footprint index of the vertex generated for each outline vertex. */
  sourceIndex: number[]
}

export interface NavNode {
  id: string
  at: Vec2
}

export interface NavEdge {
  a: string
  b: string
  length: number
  kind: WalkwayKind | 'street'
  street?: LayoutStreet
}

export interface NavGraph {
  nodes: Map<string, NavNode>
  edges: NavEdge[]
}

export interface StationEntrance {
  node: string
  /** The footprint edge the entrance sits on. */
  facade: [Vec2, Vec2]
  /** Doorway centre on the facade. */
  at: Vec2
  outward: Vec2
  width: number
}

export interface Landmark {
  id: string
  label: string
  at: Vec2
}

export interface World {
  layout: DistrictLayout
  nodes: Map<string, LayoutNode>
  segments: StreetSegment[]
  blocks: BuiltBlock[]
  prisms: Prism[]
  obstacles: Obstacle[]
  ramps: Ramp[]
  decks: Deck[]
  railings: Railing[]
  gates: Gate[]
  parapets: Railing[]
  stalls: Stall[]
  columns: OrientedRect[]
  crossings: Crossing[]
  station: { entrances: StationEntrance[] }
  cornerBuilding: { footprint: Vec2[]; crown: Vec2[] }
  restaurant: { footprint: Vec2[] }
  navigation: NavGraph
  spawn: { node: string; at: Vec2; yaw: number }
  /** Arriving within `radius` of any entrance node reaches the station. */
  goal: { entrances: { node: string; at: Vec2 }[]; radius: number }
  landmarks: Landmark[]
  /** Phase 2: deterministic props, their placement report and the walkable corridors they respect. */
  props: PropInstance[]
  plates: StreetPlate[]
  cables: Cable[]
  corridors: Corridor[]
  keepouts: Vec2[][]
  placement: PlacementReport
  /** Facade decisions for every building front, plus the landmark buildings. */
  facades: FacadeSpec[]
  /** The five optional discoveries (cat, vending machine, payphone, stairwell, arcade), placed after everything else. */
  discoveries: Discovery[]
}

const STOREY = 3
const GROUND_STOREY = 4.5
const BASE_HEIGHT = 6.5
const RAILING_HEIGHT = 1.1
const STALL_HEIGHT = 2.3
const GATE_HEIGHT = 2.8
const GATE_FACE = 1.6
const DEAD_END_SHELF = 0.75
const DEAD_END_HEIGHT = 12

const STOREYS: Record<StreetKind, [number, number]> = {
  trunk: [12, 22],
  main: [8, 15],
  street: [6, 12],
  market: [5, 9],
  lane: [5, 9],
  alley: [4, 8],
}

const FRONTAGE: Record<StreetKind, [number, number]> = {
  trunk: [9, 16],
  main: [6, 10],
  street: [5, 9],
  market: [4.5, 7],
  lane: [5, 9],
  alley: [4, 7],
}

const LOT_DEPTH: Record<StreetKind, number> = {
  trunk: 16,
  main: 13,
  street: 12,
  market: 11,
  lane: 11,
  alley: 9,
}

const LOT_COLORS = ['#8c8579', '#9a9286', '#7d7a74', '#a39b8c', '#868c8a', '#958a7e', '#7f8584', '#a8a090']

export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function orientedRect(a: Vec2, b: Vec2, width: number): OrientedRect {
  const axis = normalize(sub(b, a))
  const poly = rectFromSegment(a, b, width)
  return {
    center: lerp(a, b, 0.5),
    axis,
    halfLength: distance(a, b) / 2,
    halfWidth: width / 2,
    poly,
    bounds: boundsOf(poly),
  }
}

function obstacle(poly: Vec2[], top: number, kind: Obstacle['kind']): Obstacle {
  return { poly, bounds: boundsOf(poly), top, kind }
}

export function buildWorld(layout: DistrictLayout): World {
  const nodes = new Map(layout.nodes.map((n) => [n.id, n]))
  const node = (id: string): LayoutNode => {
    const n = nodes.get(id)
    if (!n) throw new Error(`Unknown node "${id}"`)
    return n
  }

  const streetByEdge = new Map<string, LayoutStreet>()
  const segments: StreetSegment[] = []
  for (const street of layout.streets) {
    for (let i = 0; i < street.nodes.length - 1; i++) {
      const a = street.nodes[i]
      const b = street.nodes[i + 1]
      streetByEdge.set(edgeKey(a, b), street)
      segments.push({ street, a: node(a).at, b: node(b).at })
    }
  }

  // Blocks: outline offset inward by the half-width of each adjoining street.
  const derived: LayoutBlock[] = deriveFaces(
    new Map(layout.nodes.map((n) => [n.id, n.at])),
    layout.streets.flatMap((st) => st.nodes.slice(0, -1).map((id, i) => [id, st.nodes[i + 1]] as const)),
  ).map((outline, i) => ({ id: `F${i + 1}`, outline }))
  const blocks: BuiltBlock[] = [...layout.blocks, ...derived].map((block) => {
    const outline = block.outline.map((p) => (typeof p === 'string' ? node(p).at : p))
    const overrides = new Map(Object.entries(block.insets ?? {}).map(([k, v]) => [edgeKey(...(k.split('|') as [string, string])), v]))
    const insets = block.outline.map((p, i) => {
      const q = block.outline[(i + 1) % block.outline.length]
      if (typeof p !== 'string' || typeof q !== 'string') return 0
      const key = edgeKey(p, q)
      const override = overrides.get(key)
      if (override !== undefined) return override
      const street = streetByEdge.get(key)
      return street ? (street.frontInset ?? street.width / 2) : 0
    })
    const { points, sourceIndex } = insetPolygon(outline, insets)
    return { layout: block, outline, footprint: points, sourceIndex }
  })
  const blockById = new Map(blocks.map((b) => [b.layout.id, b]))

  const cornerBuilding = cornerFeature(layout.cornerBuilding, blocks, layout.cornerBuilding.cornerRadius)
  const restaurant = cornerFeature(layout.restaurant, blocks, 0)
  const reserved = [cornerBuilding.footprint, restaurant.footprint]

  const prisms: Prism[] = []
  const obstacles: Obstacle[] = []

  for (const block of blocks) {
    obstacles.push(obstacle(block.footprint, Infinity, 'block'))
    if (block.layout.role === 'station') {
      prisms.push({ footprint: block.footprint, base: 0, height: layout.station.height, color: '#d8cfb8', kind: 'station' })
      continue
    }
    const { points: base } = insetPolygon(block.footprint, block.footprint.map(() => 0.3))
    prisms.push({ footprint: base, base: 0, height: BASE_HEIGHT, color: '#6f6a64', kind: 'base' })
    prisms.push(...generateLots(block, streetByEdge, reserved))
  }

  prisms.push({
    footprint: cornerBuilding.footprint,
    base: 0,
    height: layout.cornerBuilding.height,
    color: '#6f9c94',
    kind: 'corner-building',
  })
  prisms.push({
    footprint: cornerBuilding.crown,
    base: layout.cornerBuilding.height,
    height: 9,
    color: '#86b3aa',
    kind: 'corner-building',
  })
  prisms.push({ footprint: restaurant.footprint, base: 0, height: layout.restaurant.height, color: '#a8473b', kind: 'restaurant' })

  // Fenced roads: railings along both kerbs, with gaps at the crossings.
  const railings: Railing[] = []
  const crossings: Crossing[] = []
  for (const street of layout.streets) {
    if (!street.fenced) continue
    const pts = street.nodes.map((id) => node(id).at)
    const crossingPoints = (street.crossings ?? []).map((id) => node(id).at)
    for (const crossingAt of crossingPoints) {
      const i = nearestSegment(pts, crossingAt)
      const dir = normalize(sub(pts[i + 1], pts[i]))
      const n = perp(dir)
      crossings.push({ rect: orientedRect(add(crossingAt, scale(n, street.carriageway / 2)), sub(crossingAt, scale(n, street.carriageway / 2)), 4) })
    }
    for (const side of [1, -1]) {
      const offset = (street.carriageway / 2 + 0.1) * side
      for (let i = 0; i < pts.length - 1; i++) {
        const dir = normalize(sub(pts[i + 1], pts[i]))
        const n = scale(perp(dir), offset)
        const a = add(pts[i], n)
        const b = add(pts[i + 1], n)
        for (const [s, e] of subtractGaps(a, b, crossingPoints.map((c) => add(c, n)), 2.5)) {
          railings.push({ a: s, b: e, height: RAILING_HEIGHT, baseA: 0, baseB: 0 })
          obstacles.push(obstacle(rectFromSegment(s, e, 0.12), RAILING_HEIGHT, 'railing'))
        }
      }
    }
  }

  // Locked gates across blocked alleys.
  const gates: Gate[] = []
  for (const street of layout.streets) {
    if (!street.blocked) continue
    if (street.nodes.length !== 2) throw new Error(`Blocked street ${street.id} must have exactly two nodes`)
    const a = node(street.nodes[0]).at
    const b = node(street.nodes[1]).at
    const centre = lerp(a, b, street.blocked.at)
    const dir = normalize(sub(b, a))
    const n = scale(perp(dir), street.width / 2 + 0.2)
    // A solid building end across the alley. The faces sit GATE_FACE either side of the centre; the
    // collision reaches DEAD_END_SHELF further, so anything dressed on a face stands in front of the
    // wall and cannot be walked into.
    const rect = orientedRect(add(centre, n), sub(centre, n), (GATE_FACE + DEAD_END_SHELF) * 2)
    gates.push({ rect, height: GATE_HEIGHT, streetId: street.id, centre, dir, halfWidth: street.width / 2, faceOffset: GATE_FACE, ends: street.blocked.ends })
    obstacles.push(obstacle(rect.poly, DEAD_END_HEIGHT, 'gate'))
  }

  for (const [a, b] of layout.barriers) {
    obstacles.push(obstacle(rectFromSegment(a, b, 1.4), Infinity, 'barrier'))
  }

  // Footbridge.
  const fb = layout.footbridge
  const decks: Deck[] = fb.decks.map((d) => ({ ...orientedRect(d.from, d.to, d.width), height: fb.deckHeight }))
  const ramps: Ramp[] = fb.stairs.map((s) => ({ ...orientedRect(s.bottom, s.top, s.width), bottom: s.bottom, top: s.top, rise: fb.deckHeight }))
  const columns = fb.columns.map((c) => orientedRect(add(c, [0, -0.3]), add(c, [0, 0.3]), 0.6))
  for (const c of columns) obstacles.push(obstacle(c.poly, fb.deckHeight - 0.5, 'column'))
  const parapets: Railing[] = fb.parapets.map(([a, b]) => ({ a, b, height: RAILING_HEIGHT, baseA: fb.deckHeight, baseB: fb.deckHeight }))
  for (const r of ramps) {
    const n = scale(perp(r.axis), r.halfWidth)
    for (const side of [n, scale(n, -1)]) {
      parapets.push({ a: add(r.bottom, side), b: add(r.top, side), height: RAILING_HEIGHT, baseA: 0, baseB: r.rise })
    }
  }

  // Market stalls: a hand-composed run per side (older stalls squeezed in where the shopfronts allow),
  // with breaks for doorways, a cluster of equipment, and a couple of early openers.
  const stalls: Stall[] = []
  const m = layout.market
  const mA = node(m.from).at
  const mB = node(m.to).at
  const mDir = normalize(sub(mB, mA))
  const mN = perp(mDir)
  const random = seededRandom('market')
  type Row = [kind: StallKind, s: number, len: number, depth: number, counter: number, awning: number, proj: number, flags?: string]
  // Flags: f = folded awning, l = warm light, w = projects into the aisle.
  const rows: Record<'1' | '-1', Row[]> = {
    '1': [
      ['produce', 4.2, 3.4, 1.6, 0.85, 2.15, 0.6],
      ['tarp', 7.9, 2.2, 1.4, 0.8, 2.0, 0.9, 'w'],
      ['storage', 10.4, 2.1, 1.2, 0.7, 2.4, 0, 'f'],
      ['kiosk', 16.2, 1.7, 1.5, 1.0, 2.35, 0.2],
      ['shutter', 18.6, 4.4, 0.5, 1.0, 2.7, 0.9],
      ['open', 23.4, 3.0, 1.7, 0.8, 2.3, 0.85, 'l'],
      ['tarp', 28.9, 2.6, 1.3, 0.9, 2.1, 0.7],
    ],
    '-1': [
      ['shutter', 5.4, 3.8, 0.5, 1.0, 2.6, 0.8],
      ['produce', 9.9, 2.8, 1.9, 0.9, 2.2, 0.7, 'w'],
      ['produce', 12.9, 2.2, 1.5, 0.8, 2.3, 0.2, 'f'],
      ['storage', 15.5, 2.6, 1.3, 0.75, 2.4, 0.4],
      ['kiosk', 22.0, 1.9, 1.8, 1.05, 2.4, 0.25, 'l'],
      ['tarp', 24.9, 3.4, 1.5, 0.85, 2.05, 0.8],
      ['open', 29.0, 2.0, 1.4, 0.8, 2.25, 0.6],
    ],
  }
  const palettes = ['#6d5a4a', '#5a6258', '#645560', '#58606a', '#6b6048', '#5c4a46']
  for (const side of [1, -1] as const) {
    for (const [kind, s, len, depth, counter, awning, proj, flags = ''] of rows[String(side) as '1' | '-1']) {
      const back = flags.includes('w') ? 4.55 : 4.7 + random() * 0.15
      const out = scale(mN, -side)
      const c0 = add(add(mA, scale(mDir, s)), scale(mN, side * (back - depth / 2)))
      const c1 = add(c0, scale(mDir, len))
      const rect = orientedRect(c0, c1, depth)
      stalls.push({
        rect,
        color: palettes[Math.floor(random() * palettes.length)],
        kind,
        out,
        counter,
        awning,
        proj,
        folded: flags.includes('f'),
        lit: flags.includes('l'),
        seed: random(),
      })
      obstacles.push(obstacle(rect.poly, STALL_HEIGHT, 'stall'))
    }
  }

  // Station entrances: each sits on the footprint edge closest to its node.
  const stationFootprints = layout.station.blocks.map((id) => {
    const b = blockById.get(id)
    if (!b) throw new Error(`Unknown station block "${id}"`)
    return b.footprint
  })
  const entrances = layout.station.entrances.map((e) => ({
    node: e.node,
    width: e.width,
    ...stationFacade(stationFootprints, node(e.node).at),
  }))

  const navigation = buildNavGraph(layout, nodes)
  const spawnDir = normalize(layout.spawn.facing)

  const world: World = {
    layout,
    nodes,
    segments,
    blocks,
    prisms,
    obstacles,
    ramps,
    decks,
    railings,
    gates,
    parapets,
    stalls,
    columns,
    crossings,
    station: { entrances },
    cornerBuilding,
    restaurant: { footprint: restaurant.footprint },
    navigation,
    spawn: { node: layout.spawn.node, at: layout.spawn.at, yaw: Math.atan2(-spawnDir[0], -spawnDir[1]) },
    goal: { entrances: entrances.map((e) => ({ node: e.node, at: node(e.node).at })), radius: 4 },
    landmarks: [
      { id: 'footbridge', label: 'Footbridge', at: lerp(fb.decks[0].from, fb.decks[0].to, 0.5) },
      { id: 'market', label: 'Market', at: add(mA, scale(mDir, (m.start + m.end) / 2)) },
      { id: 'corner-building', label: 'Corner building', at: centroid(cornerBuilding.footprint) },
      { id: 'restaurant', label: 'Restaurant', at: centroid(restaurant.footprint) },
      ...entrances.map((e, i) => ({ id: `station-${e.node}`, label: i === 0 ? 'Station' : 'Station (west)', at: e.at })),
    ],
    props: [],
    plates: [],
    cables: [],
    corridors: [],
    keepouts: [],
    placement: { attempts: 0, rejected: 0, rejectedBy: {}, byType: {}, occluders: 0 },
    facades: [],
    discoveries: [],
  }

  placeProps(world)
  world.facades = buildFacadeSpecs(world)
  world.discoveries = placeDiscoveries(world)
  return world
}

function nearestSegment(pts: Vec2[], p: Vec2): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const ab = sub(pts[i + 1], pts[i])
    const t = Math.max(0, Math.min(1, dot(sub(p, pts[i]), ab) / dot(ab, ab)))
    const d = distance(p, add(pts[i], scale(ab, t)))
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/** Splits segment a→b around gap centres (projected onto it), each gap `half` either side. */
function subtractGaps(a: Vec2, b: Vec2, gapCentres: Vec2[], half: number): [Vec2, Vec2][] {
  const len = distance(a, b)
  const dir = normalize(sub(b, a))
  const cuts = gapCentres
    .map((c) => dot(sub(c, a), dir))
    .filter((t) => t > -half && t < len + half)
    .sort((x, y) => x - y)
  const pieces: [Vec2, Vec2][] = []
  let start = 0
  for (const t of cuts) {
    if (t - half > start) pieces.push([add(a, scale(dir, start)), add(a, scale(dir, t - half))])
    start = Math.max(start, t + half)
  }
  if (start < len) pieces.push([add(a, scale(dir, start)), b])
  return pieces
}

function cornerFeature(
  feature: LayoutCornerFeature,
  blocks: readonly BuiltBlock[],
  radius: number,
): { footprint: Vec2[]; crown: Vec2[] } {
  // The block with `corner` between exactly the two named neighbours.
  const [n0, n1] = feature.neighbours
  let found: { block: BuiltBlock; vi: number; forward: boolean } | null = null
  for (const block of blocks) {
    const o = block.layout.outline
    const vi = o.indexOf(feature.corner)
    if (vi < 0) continue
    const after = o[(vi + 1) % o.length]
    const before = o[(vi - 1 + o.length) % o.length]
    if (after === n0 && before === n1) found = { block, vi, forward: true }
    else if (after === n1 && before === n0) found = { block, vi, forward: false }
  }
  if (!found) throw new Error(`No block has corner ${feature.corner} between ${n0} and ${n1}`)
  const { block, vi, forward } = found
  const fp = block.footprint
  const ci = block.sourceIndex[vi]
  const corner = fp[ci]
  const toAfter = normalize(sub(fp[(ci + 1) % fp.length], corner))
  const toBefore = normalize(sub(fp[(ci - 1 + fp.length) % fp.length], corner))
  const u = forward ? toAfter : toBefore
  const v = forward ? toBefore : toAfter
  const [a, b] = feature.size
  const far = add(add(corner, scale(u, a)), scale(v, b))

  const footprint: Vec2[] = []
  if (radius > 0) {
    // Rounded corner: quadratic curve from one face to the other through the corner.
    const p0 = add(corner, scale(v, radius))
    const p2 = add(corner, scale(u, radius))
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      const q = add(add(scale(p0, (1 - t) * (1 - t)), scale(corner, 2 * (1 - t) * t)), scale(p2, t * t))
      footprint.push(q)
    }
  } else {
    footprint.push(corner)
  }
  footprint.push(add(corner, scale(u, a)), far, add(corner, scale(v, b)))

  const crownCentre = add(add(corner, scale(u, radius * 0.9)), scale(v, radius * 0.9))
  const crown: Vec2[] = []
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2
    crown.push(add(crownCentre, [Math.cos(t) * 3.2, Math.sin(t) * 3.2]))
  }
  return { footprint: signedArea(footprint) < 0 ? footprint.reverse() : footprint, crown }
}

function generateLots(block: BuiltBlock, streetByEdge: Map<string, LayoutStreet>, reserved: Vec2[][]): Prism[] {
  const fp = block.footprint
  const n = fp.length
  const orientation = signedArea(fp) > 0 ? 1 : -1
  const random = seededRandom(`lots:${block.layout.id}`)

  // Which street (if any) each footprint edge faces. Outline edge i→i+1 becomes the
  // footprint edge that starts at the last vertex generated for outline vertex i.
  const edgeStreet: (LayoutStreet | undefined)[] = new Array(n).fill(undefined)
  const outline = block.layout.outline
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i]
    const q = outline[(i + 1) % outline.length]
    if (typeof p !== 'string' || typeof q !== 'string') continue
    const lastOfI = (i + 1 < outline.length ? block.sourceIndex[i + 1] : n) - 1
    edgeStreet[lastOfI] = streetByEdge.get(edgeKey(p, q))
  }

  const lots: Prism[] = []
  let lotNumber = 0
  for (let i = 0; i < n; i++) {
    const street = edgeStreet[i]
    if (!street) continue
    const a = fp[i]
    const b = fp[(i + 1) % n]
    const c = fp[(i + 2) % n]
    const edgeLen = distance(a, b)
    const dir = normalize(sub(b, a))
    const inward = scale(perp(dir), orientation)
    const depth = LOT_DEPTH[street.kind]

    // Leave room at the far corner for the next edge's first lot.
    const nextDir = normalize(sub(c, b))
    const convex = cross(dir, nextDir) * orientation > 1e-6
    const interior = Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(dir, nextDir))))
    const nextStreet = edgeStreet[(i + 1) % n]
    let reserve = 0
    if (convex && nextStreet && interior < (150 * Math.PI) / 180) {
      reserve = Math.min(LOT_DEPTH[nextStreet.kind] / Math.max(Math.sin(interior), 0.3), edgeLen / 2)
    }
    const usable = edgeLen - reserve
    const [fMin, fMax] = FRONTAGE[street.kind]
    const [sMin, sMax] = STOREYS[street.kind]

    let s = 0
    while (s < usable - 2) {
      let w = fMin + random() * (fMax - fMin)
      if (usable - (s + w) < fMin * 0.6) w = usable - s
      const p0 = add(a, scale(dir, s))
      const p1 = add(a, scale(dir, s + w))
      s += w

      let lot: Vec2[] | null = null
      for (const f of [1, 0.66, 0.4]) {
        const d = scale(inward, depth * f)
        const quad: Vec2[] = [p0, p1, add(p1, d), add(p0, d)]
        if (quad.every((q) => pointInPolygon(lerp(q, centroid(quad), 0.01), fp))) {
          lot = quad
          break
        }
      }
      if (!lot) continue
      if (reserved.some((r) => convexOverlap(lot, r))) continue

      const storeys = sMin + Math.floor(random() * (sMax - sMin + 1))
      lots.push({
        footprint: lot,
        base: 0,
        height: GROUND_STOREY + (storeys - 1) * STOREY,
        color: LOT_COLORS[Math.floor(random() * LOT_COLORS.length)],
        kind: 'lot',
        id: `${block.layout.id}.${lotNumber++}`,
        storeys,
        front: { a: p0, b: p1, outward: scale(inward, -1), street },
      })
    }
  }
  return lots
}

function stationFacade(footprints: Vec2[][], entrance: Vec2): Pick<StationEntrance, 'facade' | 'at' | 'outward'> {
  let best = 0
  let bestDist = Infinity
  let footprint = footprints[0]
  for (const fp of footprints) for (let i = 0; i < fp.length; i++) {
    const a = fp[i]
    const b = fp[(i + 1) % fp.length]
    const ab = sub(b, a)
    const t = Math.max(0, Math.min(1, dot(sub(entrance, a), ab) / dot(ab, ab)))
    const d = distance(entrance, add(a, scale(ab, t)))
    if (d < bestDist) {
      bestDist = d
      best = i
      footprint = fp
    }
  }
  const a = footprint[best]
  const b = footprint[(best + 1) % footprint.length]
  const ab = sub(b, a)
  const t = dot(sub(entrance, a), ab) / dot(ab, ab)
  const onFacade = add(a, scale(ab, t))
  const outward = normalize(sub(entrance, onFacade))
  return { facade: [a, b], at: onFacade, outward }
}

function buildNavGraph(layout: DistrictLayout, nodes: Map<string, LayoutNode>): NavGraph {
  const navNodes = new Map<string, NavNode>()
  const navNode = (id: string) => {
    const n = nodes.get(id)
    if (!n) throw new Error(`Unknown node "${id}"`)
    if (!navNodes.has(id)) navNodes.set(id, { id, at: n.navAt ?? n.at })
    return navNodes.get(id) as NavNode
  }
  const edges: NavEdge[] = []
  for (const street of layout.streets) {
    if (street.fenced || street.blocked) continue
    for (let i = 0; i < street.nodes.length - 1; i++) {
      const a = navNode(street.nodes[i])
      const b = navNode(street.nodes[i + 1])
      edges.push({ a: a.id, b: b.id, length: length(sub(b.at, a.at)), kind: 'street', street })
    }
  }
  for (const w of layout.walkways) {
    const a = navNode(w.from)
    const b = navNode(w.to)
    edges.push({ a: a.id, b: b.id, length: length(sub(b.at, a.at)), kind: w.kind })
  }
  return { nodes: navNodes, edges }
}
