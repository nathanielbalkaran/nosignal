/**
 * Phase 2 environment tuning. Everything that decides how dense, cluttered or
 * obstructed the district feels lives here, so it can be refined without
 * touching the generators.
 *
 * The world is fully deterministic: the same seed and the same densities always
 * produce the same district. Change `seed` to get a different (but equally
 * stable) arrangement.
 */
export const ENVIRONMENT = {
  seed: 'no-signal/phase2/v1',

  /** Multipliers on how much of each kind of thing is placed. 1 = authored default, 0 = none. */
  density: {
    /** Wall-side clutter: crates, bins, boxes, carts, bicycles, plants. */
    clutter: 1,
    /** Parked cars, vans, trucks, scooters, motorcycles. */
    vehicles: 1,
    /** Trees, planters, potted plants, shrubs. */
    vegetation: 1,
    /** Scaffolding, hoardings, barriers and site materials in the construction area. */
    construction: 1,
    /** How many storefronts carry a fascia or projecting sign. */
    signage: 1,
    /** Share of upper windows that are lit. */
    litWindows: 1,
    /**
     * How often stretches of street get a large obstruction and how often
     * junction approaches are partly hidden. 0 gives open streets.
     */
    occlusion: 1,
  },

  /** Walkable space the placement keeps free, on top of the player radius (metres). */
  clearance: { margin: 0.3 },

  render: {
    /** Cell size for merging static geometry into frustum-cullable chunks. */
    chunkSize: 48,
    /** Finer chunks for small detail and props, so they can be switched off by distance more closely. */
    detailChunk: 24,
    propChunk: 32,
    /** Beyond this distance (to the edge of a chunk's bounds) small facade detail is not drawn. */
    detailDistance: 30,
    /** Beyond this distance props are not drawn. */
    propDistance: 85,
  },
} as const
