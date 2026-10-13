import type { Vec2 } from './geometry2d.ts'

/**
 * Authored description of the district. Everything in the world is derived
 * from one of these, so the same layout always produces the same district.
 */

export type StreetKind = 'trunk' | 'main' | 'street' | 'market' | 'lane' | 'alley'

export interface LayoutNode {
  id: string
  at: Vec2
  /** Where pedestrians actually stand for this node, if not at its centre (e.g. a sidewalk beside a fenced road). */
  navAt?: Vec2
}

export interface StreetName {
  en: string
  zh: string
}

export interface LayoutStreet {
  id: string
  name: StreetName
  kind: StreetKind
  /** Building line to building line, in metres. */
  width: number
  /** Vehicle carriageway width. 0 for pedestrian streets. */
  carriageway: number
  /** Polyline through node ids. */
  nodes: readonly string[]
  /** Pedestrian railings line both kerbs; the carriageway can only be crossed at `crossings`. */
  fenced?: boolean
  crossings?: readonly string[]
  /** Distance from the centreline to the building line, if not width / 2. */
  frontInset?: number
  /**
   * A locked gate across a two-node street, `at` of the way along it from the
   * first node. The street stays on the map and in the scenery, but nobody
   * can walk through, and it is left out of the navigation graph.
   */
  blocked?: { at: number; ends: readonly [DeadEnd, DeadEnd] }
}

/**
 * Why a blocked alley ends, as seen from each of its two nodes (in the order
 * of `nodes`): a building's service entrance, a gated private courtyard, a
 * construction closure, or a retaining wall where the ground steps up.
 */
export type DeadEnd = 'service' | 'gate' | 'construction' | 'retaining'

/** A node id (offset by the adjoining streets) or a raw facade point. */
export type OutlinePoint = string | Vec2

export interface LayoutBlock {
  id: string
  outline: readonly OutlinePoint[]
  /** Per-edge inset overrides keyed by "nodeA|nodeB". */
  insets?: Readonly<Record<string, number>>
  role?: 'buildings' | 'station'
}

export type WalkwayKind = 'sidewalk' | 'crossing' | 'footbridge'

/** Pedestrian connection that is not simply "walk down a street". */
export interface LayoutWalkway {
  from: string
  to: string
  kind: WalkwayKind
}

export interface LayoutCornerFeature {
  /** Node id of the block corner the feature occupies. */
  corner: string
  /** The two nodes on either side of that corner in its block; picks the block. The first sets the first size axis. */
  neighbours: readonly [string, string]
  /** Footprint along the edge toward the first and second neighbour. */
  size: Vec2
  height: number
}

export interface LayoutFootbridge {
  deckHeight: number
  decks: readonly { from: Vec2; to: Vec2; width: number }[]
  stairs: readonly { bottom: Vec2; top: Vec2; width: number }[]
  columns: readonly Vec2[]
  /** Visual parapets along deck edges (stair parapets are generated). */
  parapets: readonly (readonly [Vec2, Vec2])[]
}

export interface LayoutMarket {
  /** Stalls are laid out along the street segment from → to. */
  from: string
  to: string
  start: number
  end: number
  rowOffset: number
  stallLength: number
  stallDepth: number
  gap: number
}

export interface DistrictLayout {
  nodes: readonly LayoutNode[]
  streets: readonly LayoutStreet[]
  /**
   * Blocks that are not enclosed by streets (the surroundings and the north
   * side). Every enclosed block is derived from the street graph.
   */
  blocks: readonly LayoutBlock[]
  walkways: readonly LayoutWalkway[]
  footbridge: LayoutFootbridge
  market: LayoutMarket
  cornerBuilding: LayoutCornerFeature & { cornerRadius: number }
  restaurant: LayoutCornerFeature
  /** Reaching any entrance counts as arriving. `width` is the width of the pocket the entrance sits at the back of, in metres. */
  station: { blocks: readonly string[]; entrances: readonly { node: string; width: number }[]; height: number }
  spawn: { node: string; at: Vec2; facing: Vec2 }
  /** The intended ways to the station, as navigation node sequences from spawn to entrance. */
  routes: readonly { name: string; via: readonly string[] }[]
  /** Invisible walls that stop the player leaving the district along through-roads. */
  barriers: readonly (readonly [Vec2, Vec2])[]
}
