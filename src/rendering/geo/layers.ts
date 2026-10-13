import { Matrix4 } from 'three'
import { Geo } from './Geo.ts'

/**
 * Static geometry is merged by material kind and by spatial chunk, so the
 * renderer can frustum-cull a chunk as a whole and switch off small detail at a
 * distance. One draw call per (chunk, layer).
 */
export type LayerName =
  /** Walls, roofs, windows, shutters. Always drawn. */
  | 'base'
  /** Small facade detail: AC units, grilles, pipes, balconies. Dropped at a distance. */
  | 'detail'
  /** Props and street furniture. */
  | 'props'
  /** Unlit warm or cool light sources: lit windows, shop interiors, lamp heads. */
  | 'emissive'
  /** Textured signs, lit only by the scene. */
  | 'signs'
  /** Textured signs with their own light. */
  | 'signsLit'
  /** Alpha-tested wire mesh. */
  | 'mesh'
  /** Additive light pools on the ground. */
  | 'glow'

export const LAYER_NAMES: readonly LayerName[] = ['base', 'detail', 'props', 'emissive', 'signs', 'signsLit', 'mesh', 'glow']

export interface ChunkEntry {
  layer: LayerName
  ix: number
  iz: number
  geo: Geo
}

export class Layers {
  private readonly map = new Map<string, ChunkEntry>()
  private readonly size: number

  /** Chunk size per layer: detail is chunked finer so it can be dropped close to the player. */
  private readonly sizes: Partial<Record<LayerName, number>>

  constructor(chunkSize: number, sizes: Partial<Record<LayerName, number>> = {}) {
    this.size = chunkSize
    this.sizes = sizes
  }

  at(layer: LayerName, x: number, z: number): Geo {
    const size = this.sizes[layer] ?? this.size
    const ix = Math.floor(x / size)
    const iz = Math.floor(z / size)
    const key = `${layer}:${ix}:${iz}`
    let e = this.map.get(key)
    if (!e) {
      e = { layer, ix, iz, geo: new Geo() }
      this.map.set(key, e)
    }
    return e.geo
  }

  entries(): IterableIterator<ChunkEntry> {
    return this.map.values()
  }
}

/**
 * The geometry for one object across layers, so a builder can write solid
 * parts, lights, mesh and glow in a single local frame.
 */
export class Sink {
  readonly solid: Geo
  readonly emissive: Geo
  readonly mesh: Geo
  readonly glow: Geo
  readonly detail: Geo
  readonly signs: Geo
  readonly signsLit: Geo

  constructor(layers: Layers, layer: 'base' | 'detail' | 'props', x: number, z: number) {
    this.solid = layers.at(layer, x, z)
    this.detail = layers.at('detail', x, z)
    this.emissive = layers.at('emissive', x, z)
    this.mesh = layers.at('mesh', x, z)
    this.glow = layers.at('glow', x, z)
    this.signs = layers.at('signs', x, z)
    this.signsLit = layers.at('signsLit', x, z)
  }

  private all(): Geo[] {
    return [...new Set([this.solid, this.detail, this.emissive, this.mesh, this.glow, this.signs, this.signsLit])]
  }

  /** Applies a world transform (translation and yaw) to every layer for the duration of `fn`. */
  at(x: number, y: number, z: number, yaw: number, fn: () => void) {
    const m = new Matrix4().makeRotationY(yaw).setPosition(x, y, z)
    const gs = this.all()
    for (const g of gs) g.push(m)
    fn()
    for (const g of gs) g.pop()
  }

  /** Applies an arbitrary world transform for the duration of `fn`. */
  with(m: Matrix4, fn: () => void) {
    const gs = this.all()
    for (const g of gs) g.push(m)
    fn()
    for (const g of gs) g.pop()
  }
}
