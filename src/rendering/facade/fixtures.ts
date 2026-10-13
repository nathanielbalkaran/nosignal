import type { World } from '../../world/build.ts'
import { DIRECTION_LABEL, FOOTBRIDGE_LABEL, TRANSIT_LABELS } from '../../world/signage.ts'
import { Sink, type Layers } from '../geo/layers.ts'
import type { SignAtlas } from '../geo/textures.ts'

/** Street-name plates on walls at junctions, and a few quiet transit signs near the trunk road. */
export function buildPlates(layers: Layers, atlas: SignAtlas, world: World) {
  for (const p of world.plates) {
    let zh: string
    let en: string
    if (p.kind === 'direction') {
      zh = `${DIRECTION_LABEL.zh} ${p.arrow === 'left' ? '←' : '→'}`
      en = DIRECTION_LABEL.en
    } else if (p.kind === 'street') {
      const street = world.layout.streets.find((s) => s.id === p.ref)
      if (!street) continue
      zh = street.name.zh
      en = street.name.en.toUpperCase()
    } else {
      const t = TRANSIT_LABELS[Number(p.ref)]
      if (!t) continue
      zh = t.zh
      en = t.en
    }
    const uv = atlas.plate(zh, en, p.kind === 'street' ? 'street' : 'transit')
    const g = new Sink(layers, 'base', p.at[0], p.at[1]).signs
    const hw = p.kind === 'direction' ? 0.95 : p.kind === 'street' ? 0.7 : 0.55
    const hh = p.kind === 'direction' ? 0.24 : 0.17
    const nx = p.outward[0]
    const nz = p.outward[1]
    const ux = nz
    const uz = -nx
    const o = 0.05
    const cx = p.at[0] + nx * o
    const cz = p.at[1] + nz * o
    const y = p.height
    g.quad(
      [cx - ux * hw, y - hh, cz - uz * hw],
      [cx + ux * hw, y - hh, cz + uz * hw],
      [cx + ux * hw, y + hh, cz + uz * hw],
      [cx - ux * hw, y + hh, cz - uz * hw],
      '#ffffff',
      undefined,
      uv,
    )
  }
}

/** Slack overhead cable bundles between facades. */
export function buildCables(layers: Layers, world: World) {
  for (const c of world.cables) {
    const g = new Sink(layers, 'base', (c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2).detail
    const segs = 8
    for (const off of [0, 0.09]) {
      let prev: [number, number, number] | null = null
      for (let i = 0; i <= segs; i++) {
        const t = i / segs
        const p: [number, number, number] = [
          c.a[0] + (c.b[0] - c.a[0]) * t,
          c.ya + (c.yb - c.ya) * t - c.sag * 4 * t * (1 - t) - off,
          c.a[1] + (c.b[1] - c.a[1]) * t,
        ]
        if (prev) g.rod(prev, p, 0.012, '#17181a', 3)
        prev = p
      }
    }
  }
}

/** A modest sign on the footbridge. (The station draws its own boards in station.ts.) */
export function buildLandmarkSigns(layers: Layers, atlas: SignAtlas, world: World) {
  const uvBridge = atlas.fascia(FOOTBRIDGE_LABEL.zh, FOOTBRIDGE_LABEL.en, 'green')
  const h = world.layout.footbridge.deckHeight
  const deck = world.decks[0]
  if (deck) {
    const g = new Sink(layers, 'base', deck.center[0], deck.center[1]).signsLit
    const ax = deck.axis[0]
    const az = deck.axis[1]
    // The board hangs on the roof fascia on both long sides, facing the road.
    for (const side of [1, -1]) {
      const nx = -az * side
      const nz = ax * side
      const ux = nz
      const uz = -nx
      const hw = 1.8
      const y0 = h + 2.55
      const o = deck.halfWidth + 0.06
      const cx = deck.center[0] + nx * o
      const cz = deck.center[1] + nz * o
      g.quad(
        [cx - ux * hw, y0, cz - uz * hw],
        [cx + ux * hw, y0, cz + uz * hw],
        [cx + ux * hw, y0 + hw / 2, cz + uz * hw],
        [cx - ux * hw, y0 + hw / 2, cz - uz * hw],
        '#ffffff',
        undefined,
        uvBridge,
      )
    }
  }
}
