import type { Vec2 } from './geometry2d.ts'
import type { DeadEnd, DistrictLayout, LayoutStreet } from './types.ts'

/*
 * The district. North is -z, east is +x.
 *
 * A compact, tangled Kowloon-style neighbourhood south of Hoi Pong Road, a
 * fenced trunk road with the station on its far side. There is no sidewalk
 * along the trunk: buildings stand against its railings, and the only ways to
 * the road are the market (footbridge stairs), Wing On Lane, Chung Wo Street
 * and Ching Wan Road, which each end at a gap in the railing.
 *
 * Shun Hing Street is the one wide commercial street. Everything else is a
 * mix of bending side streets, narrow lanes and alleys, with three locked
 * service alleys (Tai Ping Alley, Yi Wo Lane and a short link east of the
 * centre) that end at gates. Blocks are derived from the street graph.
 *
 * The player starts in the south-west corner (Tak On Street and Lok Wo Lane).
 */

const TRUNK_WEST: Vec2 = [-240, -72]
const TRUNK_EAST: Vec2 = [240, -98]

function trunkAt(x: number): Vec2 {
  const t = (x - TRUNK_WEST[0]) / (TRUNK_EAST[0] - TRUNK_WEST[0])
  return [x, TRUNK_WEST[1] + t * (TRUNK_EAST[1] - TRUNK_WEST[1])]
}

/** Segment across the trunk road at x, spanning `half` metres either side of the centreline. */
function acrossTrunk(x: number, half: number): readonly [Vec2, Vec2] {
  const c = trunkAt(x)
  const dx = TRUNK_EAST[0] - TRUNK_WEST[0]
  const dz = TRUNK_EAST[1] - TRUNK_WEST[1]
  const len = Math.hypot(dx, dz)
  const n: Vec2 = [-dz / len, dx / len]
  return [
    [c[0] - n[0] * half, c[1] - n[1] * half],
    [c[0] + n[0] * half, c[1] + n[1] * half],
  ]
}

const TRUNK_DIR: Vec2 = (() => {
  const dx = TRUNK_EAST[0] - TRUNK_WEST[0]
  const dz = TRUNK_EAST[1] - TRUNK_WEST[1]
  const len = Math.hypot(dx, dz)
  return [dx / len, dz / len]
})()

/*
 * The station entrances are not on a plaza. Each is the end of a short, narrow
 * pocket (11 m wide, 10-13 m deep) cut into the north frontage of the trunk
 * road, between buildings that stand on the pavement edge like their
 * neighbours. `*_POCKET` is the pocket's x range; `*_FACE` is the z of the
 * entrance wall at its back.
 */
const EAST_POCKET: readonly [number, number] = [74.5, 85.5]
const WEST_POCKET: readonly [number, number] = [-3.5, 7.5]
const EAST_FACE = -112
const WEST_FACE = -107.5
/** The entrance building behind each face is this deep (the stairwell recess is cut into it). */
const SLAB = 5

const NORTH_STAIR_TOP: Vec2 = [-48.6, -93.35]
const NORTH_STAIR_BOTTOM: Vec2 = [NORTH_STAIR_TOP[0] + TRUNK_DIR[0] * 12, NORTH_STAIR_TOP[1] + TRUNK_DIR[1] * 12]


type Kind = 'main' | 'street' | 'market' | 'lane' | 'alley'
const CARRIAGEWAY: Record<Kind, number> = { main: 7, street: 5, market: 0, lane: 0, alley: 0 }

function street(
  id: string,
  en: string,
  zh: string,
  kind: Kind,
  width: number,
  nodes: readonly string[],
  extra: { blocked?: number; ends?: readonly [DeadEnd, DeadEnd] } = {},
): LayoutStreet {
  return {
    id,
    name: { en, zh },
    kind,
    width,
    carriageway: CARRIAGEWAY[kind],
    nodes,
    ...(extra.blocked === undefined ? {} : { blocked: { at: extra.blocked, ends: extra.ends ?? ['service', 'gate'] } }),
  }
}

export const DISTRICT: DistrictLayout = {
  nodes: [
    // Hoi Pong Road (trunk). TW / TE continue off-map into the haze.
    { id: 'TW', at: trunkAt(-240) },
    { id: 'TNW', at: trunkAt(-54) },
    { id: 'T2', at: trunkAt(-50), navAt: [-47, -73.5] },
    { id: 'TSW', at: trunkAt(-10) },
    // The mouths of the two station entrances: each is a notch in the north frontage.
    { id: 'TQ1', at: trunkAt(WEST_POCKET[0]) },
    { id: 'TQ2', at: trunkAt(WEST_POCKET[1]) },
    { id: 'T3', at: trunkAt(15) },
    { id: 'TS', at: trunkAt(35) },
    { id: 'T4', at: trunkAt(65) },
    { id: 'TP1', at: trunkAt(EAST_POCKET[0]) },
    { id: 'TP2', at: trunkAt(EAST_POCKET[1]) },
    { id: 'T5', at: trunkAt(105) },
    { id: 'TSE', at: trunkAt(112) },
    { id: 'TE', at: trunkAt(240) },

    // West edge, and the start corner.
    { id: 'SQ', at: [-96, 52] },
    { id: 'A1', at: [-104, 28] },
    { id: 'M1', at: [-101, -4] },
    { id: 'P1', at: [-76, -30] },
    { id: 'a', at: [-70, 10] },
    { id: 'b', at: [-82, 32] },

    // Kam Fung Street: the market, then south.
    { id: 'K1', at: [-50, -34] },
    { id: 'K2', at: [-34, -10] },
    { id: 'K3', at: [-58, 16] },
    { id: 'L1', at: [-58, 46] },

    // Shun Hing Street zig-zags east.
    { id: 'J1', at: [-22, -46] },
    { id: 'J2', at: [6, -38] },
    { id: 'J3', at: [34, -52] },
    { id: 'J4', at: [63, -38] },
    { id: 'M5', at: [97, -56] },

    // The tangle in the middle.
    { id: 'C1', at: [-14, -12] },
    { id: 'C2', at: [16, -16] },
    { id: 'C3', at: [44, -6] },
    { id: 'C4', at: [80, -24] },
    { id: 'D1', at: [-28, 20] },
    { id: 'D2', at: [2, 10] },
    { id: 'D3', at: [30, 12] },
    { id: 'w', at: [82, 4] },

    // East edge and the southern lane.
    { id: 'E2', at: [116, -30] },
    { id: 'E3', at: [100, -6] },
    { id: 'L6', at: [106, 20] },
    { id: 'L5', at: [76, 38] },
    { id: 'L4', at: [44, 30] },
    { id: 'L3', at: [6, 44] },
    { id: 'L2', at: [-26, 34] },

    // North side of the trunk road.
    { id: 'FBN', at: [-34, -93.2] },
    { id: 'STW', at: [2, WEST_FACE + 3] },
    { id: 'ST', at: [80, EAST_FACE + 3] },
  ],

  streets: [
    {
      id: 'hoi-pong-road',
      name: { en: 'Hoi Pong Road', zh: '海旁道' },
      kind: 'trunk',
      width: 21,
      carriageway: 14,
      nodes: ['TW', 'TNW', 'T2', 'TSW', 'TQ1', 'TQ2', 'T3', 'TS', 'T4', 'TP1', 'TP2', 'T5', 'TSE', 'TE'],
      fenced: true,
      crossings: ['T3', 'T4', 'T5'],
      frontInset: 7.5,
    },

    // The edge of the district.
    street('tak-on-street', 'Tak On Street', '德安街', 'street', 8, ['SQ', 'A1', 'M1']),
    street('shun-hing-west', 'Shun Hing Street', '順興街', 'street', 9, ['M1', 'P1', 'K1']),
    street('kam-fung-market', 'Kam Fung Street', '金鳳街', 'market', 10, ['K1', 'T2']),
    street('ching-wan-road', 'Ching Wan Road', '青雲道', 'street', 11, ['T5', 'M5', 'E2', 'E3', 'L6', 'L5']),
    street('lok-wo-lane', 'Lok Wo Lane', '樂和里', 'lane', 5, ['SQ', 'L1', 'L2', 'L3', 'L4', 'L5']),

    // The commercial street, and the three ways it meets the trunk road.
    street('shun-hing-street', 'Shun Hing Street', '順興街', 'main', 12, ['K1', 'J1', 'J2', 'J3', 'J4', 'M5']),
    street('chung-wo-street', 'Chung Wo Street', '中和街', 'street', 10, ['J4', 'T4']),
    street('wing-on-lane', 'Wing On Lane', '永安里', 'alley', 3.2, ['J2', 'T3']),
    street('tai-ping-alley', 'Tai Ping Alley', '太平巷', 'alley', 3.4, ['J1', 'TSW'], { blocked: 0.6, ends: ['service', 'retaining'] }),

    // Kam Fung Street south of the market.
    street('kam-fung-south', 'Kam Fung Street', '金鳳街', 'street', 8, ['K1', 'K2', 'K3', 'L1']),

    // West of the market.
    street('tak-shing-alley', 'Tak Shing Alley', '德成巷', 'alley', 3.4, ['M1', 'a', 'K2']),
    street('fuk-wing-lane', 'Fuk Wing Lane', '福榮里', 'alley', 3.4, ['SQ', 'b', 'K3']),

    // The tangle.
    street('po-sin-street', 'Po Sin Street', '寶善街', 'street', 7, ['K2', 'C1']),
    street('po-sin-lane', 'Po Sin Lane', '寶善里', 'alley', 3.6, ['C1', 'C2']),
    street('cheung-fat-street', 'Cheung Fat Street', '長發街', 'street', 7, ['C2', 'C3']),
    street('shui-hing-lane', 'Shui Hing Lane', '瑞興里', 'alley', 4, ['C3', 'C4']),
    street('san-tai-street', 'San Tai Street', '新泰街', 'street', 8, ['J4', 'C4']),
    street('kam-yuen-alley', 'Kam Yuen Alley', '金源巷', 'alley', 3.6, ['E3', 'w']),
    street('wah-fu-alley', 'Wah Fu Alley', '華富巷', 'alley', 3.6, ['C4', 'w', 'L5']),
    street('hing-wah-alley', 'Hing Wah Alley', '興華巷', 'alley', 3.4, ['D2', 'C2']),
    street('lung-hing-alley', 'Lung Hing Alley', '隆興巷', 'alley', 3.4, ['J1', 'C1']),
    street('cheung-fat-lane', 'Cheung Fat Lane', '長發里', 'lane', 5, ['J2', 'C2']),
    street('tung-lok-street', 'Tung Lok Street', '同樂街', 'street', 6.5, ['D1', 'D2', 'D3']),
    street('yi-wo-lane', 'Yi Wo Lane', '義和里', 'alley', 3.2, ['K3', 'D1'], { blocked: 0.5, ends: ['gate', 'service'] }),
    street('fuk-tai-alley', 'Fuk Tai Alley', '福泰巷', 'alley', 3.4, ['C1', 'D1']),
    street('tin-hau-alley', 'Tin Hau Alley', '天后巷', 'alley', 3.6, ['D1', 'L2']),
    street('man-yuen-alley', 'Man Yuen Alley', '文苑巷', 'alley', 4, ['D3', 'L4']),
    street('sheung-tai-alley', 'Sheung Tai Alley', '上泰巷', 'alley', 3.2, ['C3', 'D3'], { blocked: 0.5, ends: ['construction', 'gate'] }),
  ],

  blocks: [
    {
      // Everything outside the ring of streets, south of the trunk road.
      id: 'OUTER',
      outline: ['TW', 'T2', 'K1', 'P1', 'M1', 'A1', 'SQ', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'E3', 'E2', 'M5', 'T5', 'TSE', 'TE', [240, 170], [-240, 170]],
      insets: { 'TW|T2': 7, 'T5|TSE': 7, 'TSE|TE': 7 },
    },
    {
      id: 'NORTH-W',
      outline: ['TW', [-240, -220], [-54, -220], 'TNW'],
      insets: { 'TW|TNW': 7 },
    },
    {
      // Set back to leave a promenade from the footbridge to the station.
      id: 'NORTH-PROMENADE',
      outline: ['TNW', [-54, -220], [-10, -220], 'TSW', 'T2'],
      insets: { 'TNW|T2': 13, 'T2|TSW': 13 },
    },
    {
      // The north frontage: ordinary tall buildings on the pavement edge (3 m behind the railing; 6.5 m
      // behind it beside the promenade), with a pocket cut for each station entrance.
      id: 'NORTH-STATION',
      outline: [
        'TSW',
        [-10, -220],
        [112, -220],
        'TSE',
        'T5',
        'TP2',
        [EAST_POCKET[1], EAST_FACE - SLAB],
        [EAST_POCKET[0], EAST_FACE - SLAB],
        'TP1',
        'T4',
        'TS',
        'T3',
        'TQ2',
        [WEST_POCKET[1], WEST_FACE - SLAB],
        [WEST_POCKET[0], WEST_FACE - SLAB],
        'TQ1',
      ],
      insets: {
        'TSW|TQ1': 13,
        'TQ2|T3': 13,
        'T3|TS': 10,
        'TS|T4': 10,
        'T4|TP1': 10,
        'TP2|T5': 10,
        'T5|TSE': 8,
      },
    },
    {
      // The entrance buildings at the back of each pocket: a slim block, residential floors above the
      // station door, that reads as one more tall building in the row.
      id: 'STATION',
      outline: [
        [EAST_POCKET[0], EAST_FACE],
        [EAST_POCKET[1], EAST_FACE],
        [EAST_POCKET[1], EAST_FACE - SLAB],
        [EAST_POCKET[0], EAST_FACE - SLAB],
      ],
      role: 'station',
    },
    {
      id: 'STATION-W',
      outline: [
        [WEST_POCKET[0], WEST_FACE],
        [WEST_POCKET[1], WEST_FACE],
        [WEST_POCKET[1], WEST_FACE - SLAB],
        [WEST_POCKET[0], WEST_FACE - SLAB],
      ],
      role: 'station',
    },
    {
      id: 'NORTH-E',
      outline: ['TSE', [112, -220], [240, -220], 'TE'],
      insets: { 'TSE|TE': 7 },
    },
  ],

  walkways: [
    { from: 'T3', to: 'STW', kind: 'crossing' },
    { from: 'T4', to: 'ST', kind: 'crossing' },
    { from: 'T5', to: 'ST', kind: 'crossing' },
    { from: 'T2', to: 'FBN', kind: 'footbridge' },
    { from: 'FBN', to: 'STW', kind: 'sidewalk' },
  ],

  footbridge: {
    deckHeight: 6,
    decks: [
      { from: [-50, -71.5], to: [-50, -93.5], width: 3.2 },
      { from: [-51.6, -93.3], to: [-48.3, -93.3], width: 3.2 },
    ],
    stairs: [
      { bottom: [-50, -59], top: [-50, -71.8], width: 2.8 },
      { bottom: NORTH_STAIR_BOTTOM, top: NORTH_STAIR_TOP, width: 2.6 },
    ],
    columns: [
      [-50, -74],
      [-50, -91],
    ],
    parapets: [
      [
        [-51.6, -71.5],
        [-51.6, -94.9],
      ],
      [
        [-48.4, -71.5],
        [-48.4, -91.7],
      ],
      [
        [-51.6, -94.9],
        [-48.6, -94.9],
      ],
    ],
  },

  market: {
    from: 'K1',
    to: 'T2',
    start: 5,
    end: 30,
    rowOffset: 3.6,
    stallLength: 2.6,
    stallDepth: 1.8,
    gap: 0.5,
  },

  cornerBuilding: { corner: 'J4', neighbours: ['M5', 'C4'], size: [16, 16], height: 40, cornerRadius: 7 },
  restaurant: { corner: 'C2', neighbours: ['C1', 'D2'], size: [12, 10], height: 8 },
  station: {
    blocks: ['STATION', 'STATION-W'],
    entrances: [
      { node: 'ST', width: 11 },
      { node: 'STW', width: 11 },
    ],
    height: 18,
  },

  spawn: { node: 'SQ', at: [-96, 52], facing: [1, -1] },

  routes: [
    { name: 'Shun Hing Street, past the corner building', via: ['SQ', 'A1', 'M1', 'P1', 'K1', 'J1', 'J2', 'J3', 'J4', 'T4', 'ST'] },
    { name: 'Through the market and over the footbridge', via: ['SQ', 'L1', 'K3', 'K2', 'K1', 'T2', 'FBN', 'STW'] },
    { name: 'Backstreets to Wing On Lane', via: ['SQ', 'b', 'K3', 'K2', 'C1', 'C2', 'J2', 'T3', 'STW'] },
  ],

  barriers: [acrossTrunk(-58, 8), acrossTrunk(128, 8)],
}
