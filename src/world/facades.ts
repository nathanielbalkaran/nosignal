import { ENVIRONMENT } from '../config/environment.ts'
import type { Prism, World } from './build.ts'
import { distance, dot, normalize, perp, pointInPolygon, scale, signedArea, sub, add, type Vec2 } from './geometry2d.ts'
import { Rng, hashString } from './rng.ts'
import { CATEGORY_WEIGHTS, SHOP_LABELS, type ShopCategory, type SignTone } from './signage.ts'
import { SHOWCASE_STREET, characterOf, zoneOf, type Zone } from './zones.ts'

/*
 * Facade decisions for every building front. This is pure data: what kind of
 * building it is, how its windows are arranged, what the ground floor holds and
 * which signs it carries. The renderer turns a spec into geometry, seeding its
 * own detail from `seed`, so the same world always draws the same facades.
 *
 * Street identity comes from a palette per street plus a few street-wide
 * habits (bay width, balcony and grille frequency), so each street reads as its
 * own place while buildings on it still differ from one another.
 */

/** Must match the building generator in build.ts. */
export const FACADE = { groundHeight: 4.5, storeyHeight: 3 } as const

export type BuildingKind = 'tenement' | 'slab' | 'shophouse' | 'stepped' | 'tower' | 'restaurant'
export type FacadeSource = 'lot' | 'side' | 'corner-building' | 'restaurant'
export type WindowKind = 'sliding' | 'casement' | 'louvre' | 'ribbon' | 'tall'
export type RooftopFeature = 'tank' | 'hut' | 'antenna' | 'shack' | 'laundry' | 'billboard' | 'dish'
export type GroundKind = 'shop' | 'convenience' | 'restaurant' | 'bakery' | 'garage' | 'entranceOnly'

export interface SignSpec {
  /** Index into SHOP_LABELS, or a named special label. */
  label: number | 'restaurant' | 'convenience'
  tone: SignTone
  lit: boolean
  /** Horizontal position along the facade, 0 to 1. */
  at: number
  width: number
  height: number
  /** Height of the sign's bottom edge. */
  y: number
}

export interface GroundSpec {
  kind: GroundKind
  shutter: 'closed' | 'half' | 'open'
  shutterColor: string
  /** Door position along the facade: left, right, or none. */
  door: 'left' | 'right' | 'none'
  awning: { color: string; depth: number } | null
  lit: boolean
}

export interface FacadeSpec {
  id: string
  seed: string
  source: FacadeSource
  kind: BuildingKind
  a: Vec2
  b: Vec2
  outward: Vec2
  streetId: string
  zone: Zone
  width: number
  /** Depth of the building behind the front. */
  depth: number
  /** Overall height to the roof. */
  height: number
  storeys: number
  wall: string
  trim: string
  tile: string
  accent: string
  /** How streaked and dirty the wall is, 0 to 1. */
  stain: number
  /** Upper floors project this far into the street. */
  overhang: number
  /** Storey above which the front steps back, 0 for none. */
  setbackFrom: number
  setback: number
  bays: number
  windowKind: WindowKind
  balconies: 'none' | 'alternate' | 'every'
  grille: number
  ac: number
  pipes: number
  conduit: boolean
  litWindows: number
  ground: GroundSpec
  rooftop: RooftopFeature[]
  vegetation: boolean
  fascia: SignSpec | null
  vertical: SignSpec[]
  wallLamp: boolean
}

interface Palette {
  wall: readonly string[]
  trim: string
  tile: string
}

const PALETTES: Readonly<Record<string, Palette>> = {
  cream: { wall: ['#c2b79a', '#b6ab90', '#cbc1a5', '#bcb094'], trim: '#867e6c', tile: '#8f9487' },
  green: { wall: ['#8c9f90', '#7f9285', '#97a799', '#7a8d80'], trim: '#5d6a60', tile: '#a2ab9f' },
  grey: { wall: ['#999a96', '#8c8e8a', '#a3a39c', '#92948f'], trim: '#6a6c69', tile: '#7e8582' },
  beige: { wall: ['#b4a58b', '#a79a82', '#bdb098', '#aa9d86'], trim: '#7a6f5d', tile: '#8c8a7c' },
  blue: { wall: ['#8993a2', '#7c8697', '#949dab', '#808a99'], trim: '#5b6575', tile: '#8a9399' },
  charcoal: { wall: ['#66686b', '#5b5d60', '#707174', '#626467'], trim: '#46484a', tile: '#6b7172' },
  teal: { wall: ['#6f9690', '#648a85', '#7aa099', '#5f827d'], trim: '#476660', tile: '#8aa39d' },
  red: { wall: ['#a1564c', '#94503f', '#a8645a'], trim: '#6d3d36', tile: '#8e8c82' },
}

const PALETTE_KEYS = ['cream', 'green', 'grey', 'beige', 'blue', 'charcoal'] as const

/** Hand-picked identities for the main streets. Everything else is chosen by hashing the street id. */
const STREET_PALETTE: Readonly<Record<string, readonly [string, string]>> = {
  'shun-hing-street': ['cream', 'green'],
  'shun-hing-west': ['beige', 'grey'],
  'tak-on-street': ['grey', 'cream'],
  'chung-wo-street': ['blue', 'grey'],
  'kam-fung-market': ['green', 'cream'],
  'kam-fung-south': ['beige', 'teal'],
  'ching-wan-road': ['grey', 'blue'],
  'cheung-fat-street': ['grey', 'charcoal'],
  'lok-wo-lane': ['cream', 'green'],
  'po-sin-street': ['green', 'beige'],
  'tung-lok-street': ['blue', 'cream'],
  'san-tai-street': ['charcoal', 'beige'],
}

interface StreetStyle {
  primary: string
  secondary: string
  bayWidth: number
  balcony: number
  grille: number
  ac: number
  windowKind: WindowKind
}

const styleCache = new Map<string, StreetStyle>()
function streetStyle(streetId: string, zone: Zone): StreetStyle {
  let s = styleCache.get(streetId)
  if (s) return s
  const h = hashString(`style:${streetId}`)
  const pair = STREET_PALETTE[streetId] ?? [PALETTE_KEYS[h % PALETTE_KEYS.length], PALETTE_KEYS[(h >>> 5) % PALETTE_KEYS.length]]
  const windows: readonly WindowKind[] = ['sliding', 'casement', 'louvre', 'tall']
  s = {
    primary: pair[0],
    secondary: pair[1],
    bayWidth: 2.3 + ((h >>> 9) % 10) / 10,
    balcony: zone === 'commercial' ? 0.45 : 0.3 + ((h >>> 13) % 5) / 10,
    grille: 0.25 + ((h >>> 17) % 6) / 10,
    ac: 0.25 + ((h >>> 21) % 4) / 10,
    windowKind: windows[(h >>> 25) % windows.length],
  }
  styleCache.set(streetId, s)
  return s
}

/** Multiplies a #rrggbb colour's brightness. */
function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`
}

/** Businesses this close to the cha chaan teng are shut; it is the one lit place on its corner. */
const RESTAURANT_QUIET_RADIUS = 26

const AWNING_COLORS = ['#7a4a45', '#4a6a74', '#6e7a58', '#8a7a52', '#5d5f6a', '#8a6048']
const SHUTTER_COLORS = ['#8c9096', '#767b82', '#9a9c94', '#6d7a72', '#85796c', '#7b838c']
const TONES: readonly SignTone[] = ['white', 'cream', 'yellow', 'red', 'green', 'blue', 'charcoal', 'teal']

export function buildFacadeSpecs(world: World): FacadeSpec[] {
  const D = ENVIRONMENT.density
  const specs: FacadeSpec[] = []
  const lastLabel = new Map<string, number>()

  // Choose which shopfronts are open and lit, once, so they are sparse and spread out.
  const litPick = chooseLitShops(world)
  const restaurantAt = world.landmarks.find((l) => l.id === 'restaurant')?.at

  for (const prism of [...world.prisms, ...infillLots(world)]) {
    if (prism.kind !== 'lot' || !prism.front || !prism.id) continue
    const { a, b, outward, street } = prism.front
    const width = distance(a, b)
    if (width < 2.4) continue
    const zone = zoneOf(street)
    const rng = new Rng(`${ENVIRONMENT.seed}:facade:${prism.id}`)
    const style = streetStyle(street.id, zone)
    const storeys = prism.storeys ?? 6
    const lit = litPick.get(prism.id)
    const ch = characterOf(street)
    const quiet = street.kind === 'alley'
    const nearRestaurant = !!restaurantAt && distance(prism.footprint[0], restaurantAt) < RESTAURANT_QUIET_RADIUS

    // Wall colour: mostly the street's palette, sometimes its second, rarely a muted outlier.
    const roll = rng.float()
    let paletteKey = roll < 0.6 ? style.primary : roll < 0.86 ? style.secondary : rng.pick(PALETTE_KEYS)
    if (roll > 0.965) paletteKey = rng.chance(0.5) ? 'teal' : 'red'
    const palette = PALETTES[paletteKey]

    const depth = distance(prism.footprint[0], prism.footprint[3])
    let kind: BuildingKind
    const kr = rng.float()
    if (storeys <= 6) kind = kr < 0.55 ? 'tenement' : 'shophouse'
    else if (storeys <= 10) kind = kr < 0.4 ? 'slab' : kr < 0.78 ? 'tenement' : 'stepped'
    else kind = kr < 0.5 ? 'slab' : 'stepped'
    if (kind === 'stepped' && depth < 7) kind = 'slab'

    const bays = Math.max(1, Math.round(width / (style.bayWidth + rng.range(-0.25, 0.35))))
    const windowKind: WindowKind = kind === 'slab' && rng.chance(0.5) ? 'ribbon' : kind === 'tenement' && rng.chance(0.4) ? 'tall' : rng.chance(0.7) ? style.windowKind : rng.pick(['sliding', 'casement', 'louvre'] as const)

    const wantsShop = quiet ? rng.chance(0.08) : zone === 'residential' ? rng.chance(0.28) : zone === 'construction' ? rng.chance(0.4) : true
    const garage = zone !== 'market' && !lit && rng.chance(zone === 'residential' ? 0.06 : 0.04) && width > 4
    const groundKind: GroundKind = lit ?? (garage ? 'garage' : wantsShop ? 'shop' : 'entranceOnly')
    const isLitShop = lit !== undefined
    const door: GroundSpec['door'] = groundKind === 'entranceOnly' || (zone !== 'market' && groundKind !== 'convenience' && groundKind !== 'restaurant' && rng.chance(0.55)) ? (rng.chance(0.5) ? 'left' : 'right') : 'none'
    const awningChance = zone === 'market' ? 0.55 : zone === 'commercial' ? 0.4 : 0.18
    const ground: GroundSpec = {
      kind: groundKind,
      shutter: isLitShop ? (groundKind === 'bakery' ? 'half' : 'open') : nearRestaurant || rng.chance(ch.shuttered) ? 'closed' : 'half',
      shutterColor: rng.pick(SHUTTER_COLORS),
      door,
      awning: groundKind !== 'entranceOnly' && width > 3.4 && !nearRestaurant && rng.chance(awningChance * D.signage * Math.min(1, ch.signage + 0.25)) ? { color: rng.pick(AWNING_COLORS), depth: rng.range(0.9, 1.25) } : null,
      lit: isLitShop,
    }

    // Signs.
    const signRate = (zone === 'commercial' ? 0.92 : zone === 'market' ? 0.85 : zone === 'avenue' ? 0.75 : 0.45) * D.signage * ch.signage * (nearRestaurant ? 0.35 : 1)
    let fascia: SignSpec | null = null
    const vertical: SignSpec[] = []
    if (groundKind !== 'entranceOnly' && groundKind !== 'garage' && rng.chance(signRate)) {
      fascia = makeSign(rng, zone, groundKind, street.id, lastLabel, lastLabel.size, width, true, lit)
    }
    const vertChance = (zone === 'commercial' ? 0.62 : zone === 'avenue' ? 0.4 : zone === 'market' ? 0.3 : 0.14) * D.signage * ch.signage * (nearRestaurant ? 0.3 : 1)
    if (groundKind !== 'entranceOnly' && width > 3.2 && rng.chance(vertChance)) {
      vertical.push(makeSign(rng, zone, groundKind, street.id, lastLabel, lastLabel.size + 3, width, false, lit))
      if (zone === 'commercial' && width > 7 && rng.chance(0.3)) vertical.push(makeSign(rng, zone, groundKind, street.id, lastLabel, lastLabel.size + 5, width, false, undefined))
    }

    const overhangable = kind === 'tenement' || kind === 'slab'
    specs.push({
      id: prism.id,
      seed: `${ENVIRONMENT.seed}:facade:${prism.id}`,
      source: 'lot',
      kind,
      a,
      b,
      outward,
      streetId: street.id,
      zone,
      width,
      depth,
      height: prism.height,
      storeys,
      wall: darken(palette.wall[rng.int(0, palette.wall.length - 1)], quiet ? 0.78 : 1),
      trim: palette.trim,
      tile: palette.tile,
      accent: rng.pick(['#7a8f87', '#8a6b5a', '#6a7a8a', '#9a8a62']),
      stain: rng.range(0.25, 0.9),
      overhang: overhangable && width > 4.5 && rng.chance(0.2) ? rng.pick([0.35, 0.5]) : 0,
      setbackFrom: kind === 'stepped' ? Math.max(3, Math.round(storeys * rng.range(0.45, 0.65))) : 0,
      setback: kind === 'stepped' ? Math.min(depth * 0.25, rng.range(1.2, 2.4)) : 0,
      bays,
      windowKind,
      balconies: kind === 'tenement' && rng.chance(style.balcony * 1.4) ? (rng.chance(0.5) ? 'every' : 'alternate') : kind === 'shophouse' && rng.chance(0.2) ? 'every' : 'none',
      grille: Math.min(0.95, style.grille + rng.range(-0.15, 0.2) + (zone === 'residential' || quiet ? 0.2 : 0)),
      // Most buildings have none: a few carry a handful, rather than every wall wearing the same rash.
      ac: acShare(rng, style.ac * ch.ac, kind === 'slab'),
      pipes: quiet ? rng.int(2, 3) : width > 4 ? rng.int(1, zone === 'residential' ? 3 : 2) : 1,
      conduit: quiet || rng.chance(0.65),
      litWindows: (zone === 'residential' ? 0.065 : 0.04) * D.litWindows * (nearRestaurant ? 0.25 : 1),
      ground,
      // Infill sits on a shared base slab of unknown depth, so it carries no rooftop structures.
      rooftop: prism.id.startsWith('infill') ? [] : rooftopFor(rng, kind, storeys),
      vegetation: rng.chance(zone === 'residential' ? 0.5 : 0.22 * D.vegetation) && D.vegetation > 0,
      fascia,
      vertical,
      wallLamp: zone === 'residential' || street.kind === 'alley' ? rng.chance(0.55) : rng.chance(0.18),
    })
  }

  specs.push(...sideFacades(world, specs))
  specs.push(...landmarkFacades(world))
  return specs
}

/** Per-window chance of an external AC unit: none on about half the buildings, a few on the rest. */
function acShare(rng: Rng, styleAc: number, slab: boolean): number {
  if (!rng.chance(0.25 + styleAc * 0.9)) return 0
  return Math.min(0.4, styleAc * 0.55 + rng.range(0, 0.1) + (slab ? 0.05 : 0))
}

function rooftopFor(rng: Rng, kind: BuildingKind, storeys: number): RooftopFeature[] {
  const out: RooftopFeature[] = []
  if (rng.chance(0.75)) out.push('hut')
  if (rng.chance(0.55)) out.push('tank')
  if (rng.chance(0.5)) out.push('antenna')
  if (storeys <= 9 && rng.chance(0.28)) out.push('shack')
  if (rng.chance(0.3)) out.push('laundry')
  if (rng.chance(0.2)) out.push('dish')
  if (kind !== 'shophouse' && rng.chance(0.1)) out.push('billboard')
  return out
}

function makeSign(
  rng: Rng,
  zone: Zone,
  ground: GroundKind,
  streetId: string,
  lastLabel: Map<string, number>,
  _salt: number,
  facadeWidth: number,
  horizontal: boolean,
  lit: GroundKind | undefined,
): SignSpec {
  let label: SignSpec['label']
  let tone: SignTone
  if (ground === 'restaurant') {
    label = 'restaurant'
    tone = 'red'
  } else if (ground === 'convenience') {
    label = 'convenience'
    tone = 'white'
  } else {
    const category = rng.weighted(CATEGORY_WEIGHTS[zone] ?? CATEGORY_WEIGHTS.commercial) as ShopCategory
    const pool = SHOP_LABELS.map((l, i) => [l, i] as const).filter(([l]) => l.category === category)
    let pick = rng.pick(pool)
    // Avoid the same label twice in a row on a street.
    for (let i = 0; i < 3 && lastLabel.get(streetId) === pick[1]; i++) pick = rng.pick(pool)
    lastLabel.set(streetId, pick[1])
    label = pick[1]
    tone = rng.chance(0.75) ? rng.pick(pick[0].tones) : rng.pick(TONES)
  }
  const isLit = lit !== undefined ? true : rng.chance(0.1)
  if (horizontal) {
    const w = Math.min(facadeWidth * 0.88, rng.range(2.2, 4.2))
    return { label, tone, lit: isLit, at: 0.5 + rng.range(-0.04, 0.04), width: w, height: w / 4 * rng.range(0.9, 1.2), y: 3.6 }
  }
  const h = rng.range(1.5, 2.6)
  return { label, tone, lit: isLit, at: rng.chance(0.5) ? rng.range(0.08, 0.2) : rng.range(0.8, 0.92), width: h / 4, height: h, y: rng.range(3.1, 4.4) }
}

/** Picks the few shopfronts that are lit before dawn. Returns lot id to ground kind. */
function chooseLitShops(world: World): Map<string, GroundKind> {
  const rng = new Rng(`${ENVIRONMENT.seed}:lit-shops`)
  const lots = world.prisms.filter((p) => p.kind === 'lot' && p.front && p.id && distance(p.front.a, p.front.b) >= 5.5)
  const out = new Map<string, GroundKind>()
  const taken: Vec2[] = []
  const farFromTaken = (p: Prism): boolean => {
    const c = p.footprint[0]
    return taken.every((t) => distance(t, c) > 26)
  }
  const take = (streetId: string, kind: GroundKind, count: number, target?: Vec2) => {
    const pool = lots.filter((p) => p.front?.street.id === streetId && !out.has(p.id as string))
    // Near a target point first, so the showcase street gets its lit shops in the middle of its length.
    if (target) pool.sort((p, q) => distance(p.footprint[0], target) - distance(q.footprint[0], target))
    for (let n = 0; n < count && pool.length > 0; n++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const p = target ? pool[Math.min(pool.length - 1, attempt)] : pool[rng.int(0, pool.length - 1)]
        if (!farFromTaken(p)) continue
        out.set(p.id as string, kind)
        taken.push(p.footprint[0])
        break
      }
    }
  }
  take(SHOWCASE_STREET, 'convenience', 1, [-8, -38])
  take('ching-wan-road', 'convenience', 1)
  take(SHOWCASE_STREET, 'bakery', 1, [34, -46])
  take('kam-fung-south', 'bakery', 1)
  take('chung-wo-street', 'shop', 1)
  return out
}

/** Facades for the corner tower and the cha chaan teng, built from their exposed edges. */
function landmarkFacades(world: World): FacadeSpec[] {
  const out: FacadeSpec[] = []
  const blocks = world.blocks.map((b) => b.footprint)
  const make = (footprint: Vec2[], source: 'corner-building' | 'restaurant', height: number) => {
    const orient = signedArea(footprint) > 0 ? 1 : -1
    footprint.forEach((p, i) => {
      const q = footprint[(i + 1) % footprint.length]
      const width = distance(p, q)
      if (width < 1.0) return
      const dir = normalize(sub(q, p))
      const outward = scale(perp(dir), -orient)
      // Exposed edges face a street: just outside, no block covers the point.
      const mid = add(scale(add(p, q), 0.5), scale(outward, 0.6))
      if (blocks.some((poly) => pointInPolygon(mid, poly))) return
      const seed = `${source}.${i}`
      const tower = source === 'corner-building'
      const street = nearestStreet(world, mid)
      const zone = street ? zoneOf(street) : 'commercial'
      const palette = tower ? PALETTES.teal : PALETTES.red
      const restaurant = !tower
      const storeys = Math.round((height - FACADE.groundHeight) / FACADE.storeyHeight) + 1
      out.push({
        id: seed,
        seed: `${ENVIRONMENT.seed}:facade:${seed}`,
        source,
        kind: tower ? 'tower' : 'restaurant',
        a: p,
        b: q,
        outward,
        streetId: street?.id ?? '',
        zone,
        width,
        depth: 8,
        height,
        storeys,
        wall: palette.wall[0],
        trim: palette.trim,
        tile: palette.tile,
        accent: '#d9b46a',
        stain: 0.5,
        overhang: 0,
        setbackFrom: 0,
        setback: 0,
        bays: Math.max(1, Math.round(width / (tower ? 2.6 : 3))),
        windowKind: tower ? 'ribbon' : 'sliding',
        balconies: 'none',
        grille: tower ? 0.1 : 0.2,
        ac: tower ? 0.08 : 0.1,
        pipes: width > 4 ? 1 : 0,
        conduit: true,
        litWindows: tower ? 0.05 : 0.08,
        ground: {
          kind: restaurant ? 'restaurant' : 'shop',
          shutter: restaurant ? 'open' : 'closed',
          shutterColor: '#767b82',
          door: restaurant && width > 6 ? 'right' : 'none',
          awning: null,
          lit: restaurant,
        },
        rooftop: tower ? ['antenna', 'tank'] : ['tank', 'hut'],
        vegetation: false,
        fascia: restaurant && width > 5 ? { label: 'restaurant', tone: 'red', lit: true, at: 0.5, width: Math.min(width * 0.8, 6), height: 1.1, y: 3.5 } : null,
        vertical: restaurant && width > 5 ? [{ label: 'restaurant', tone: 'red', lit: true, at: 0.1, width: 0.65, height: 2.6, y: 3.2 }] : [],
        wallLamp: true,
      })
    })
  }
  make(world.restaurant.footprint, 'restaurant', world.layout.restaurant.height)
  make(world.cornerBuilding.footprint, 'corner-building', world.layout.cornerBuilding.height)
  return out
}

function nearestStreet(world: World, p: Vec2, within = Infinity, includeFenced = false) {
  let best: { street: (typeof world.segments)[number]['street']; d: number } | null = null
  for (const s of world.segments) {
    if (s.street.fenced && !includeFenced) continue
    const ab = sub(s.b, s.a)
    const t = Math.max(0, Math.min(1, dot(sub(p, s.a), ab) / dot(ab, ab)))
    const d = distance(p, add(s.a, scale(ab, t)))
    if (d > within + s.street.width / 2) continue
    if (!best || d < best.d) best = { street: s.street, d }
  }
  return best?.street
}

/** Wall colour for prisms the facade generator does not cover, kept in the same family. */
export function paletteWall(key: string): string {
  return (PALETTES[key] ?? PALETTES.grey).wall[0]
}

/**
 * Party walls that end up exposed, such as at the end of a block or a corner,
 * get a plain facade of their own so tall buildings are not blank slabs.
 */
function sideFacades(world: World, lots: readonly FacadeSpec[]): FacadeSpec[] {
  const out: FacadeSpec[] = []
  const byId = new Map(lots.map((l) => [l.id, l]))
  const prisms = world.prisms.filter((p) => p.kind === 'lot' && p.id && p.front && byId.has(p.id))
  const near = (a: Vec2, b: Vec2) => distance(a, b) < 0.05
  for (const prism of prisms) {
    const parent = byId.get(prism.id as string) as FacadeSpec
    if (parent.kind === 'stepped') continue
    const fp = prism.footprint
    const centre = scale(fp.reduce((acc, q) => add(acc, q), [0, 0] as Vec2), 1 / fp.length)
    for (const [i, j] of [[1, 2], [3, 0]] as const) {
      const a = fp[i]
      const b = fp[j]
      const depth = distance(a, b)
      // Hidden if a neighbouring lot shares the corner on the front line and is at least as deep.
      const front = fp[i === 1 ? 1 : 0]
      const hidden = prisms.some((q) => {
        if (q === prism) return false
        const qf = q.footprint
        const meets = i === 1 ? near(qf[0], front) : near(qf[1], front)
        return meets && distance(qf[0], qf[3]) >= depth * 0.98
      })
      if (hidden || depth < 2.4) continue
      const dir = normalize(sub(b, a))
      let outward = perp(dir)
      if (dot(outward, sub(scale(add(a, b), 0.5), centre)) < 0) outward = scale(outward, -1)
      const rng = new Rng(`${parent.seed}:side:${i}`)
      const bays = Math.max(1, Math.round(depth / 3.0))
      out.push({
        ...parent,
        id: `${parent.id}.s${i}`,
        seed: `${parent.seed}:side:${i}`,
        source: 'side',
        a,
        b,
        outward,
        width: depth,
        depth: distance(prism.footprint[0], prism.footprint[1]),
        overhang: 0,
        setback: 0,
        setbackFrom: 0,
        bays,
        windowKind: rng.pick(['casement', 'sliding', 'louvre'] as const),
        balconies: 'none',
        grille: 0.3,
        ac: parent.ac * 0.5,
        pipes: rng.int(1, 2),
        conduit: rng.chance(0.5),
        litWindows: 0.03,
        ground: { kind: 'entranceOnly', shutter: 'closed', shutterColor: parent.ground.shutterColor, door: 'none', awning: null, lit: false },
        rooftop: [],
        vegetation: rng.chance(0.5),
        fascia: null,
        vertical: [],
        wallLamp: false,
        stain: 0.8,
      })
    }
  }
  return out
}

/**
 * Low-rise infill for stretches of a block edge that no lot covers. These
 * exist only as facade data: the block's base prism supplies the volume.
 */
export function infillLots(world: World): Prism[] {
  const lots = world.prisms.filter((p) => p.kind === 'lot' && p.front)
  const out: Prism[] = []
  let n = 0
  for (const base of world.prisms) {
    if (base.kind !== 'base') continue
    const fp = base.footprint
    for (let i = 0; i < fp.length; i++) {
      const a = fp[i]
      const b = fp[(i + 1) % fp.length]
      const len = distance(a, b)
      if (len < 1.8) continue
      const t = normalize(sub(b, a))
      // Base footprints can be concave, so find the outside by testing a point just off the edge.
      let outward = perp(t)
      const mid = scale(add(a, b), 0.5)
      if (pointInPolygon(add(mid, scale(outward, 0.3)), fp)) outward = scale(outward, -1)
      const street = nearestStreet(world, add(scale(add(a, b), 0.5), scale(outward, 1.5)), 6, true)
      if (!street) continue

      // Intervals along the edge already faced by a lot.
      const covered: [number, number][] = []
      for (const lot of lots) {
        const f = lot.front
        if (!f) continue
        const da = sub(f.a, a)
        const db = sub(f.b, a)
        if (Math.abs(da[0] * t[1] - da[1] * t[0]) > 0.8 || Math.abs(db[0] * t[1] - db[1] * t[0]) > 0.8) continue
        // Lots on the same line further along (or on other blocks) must not count, and must not
        // be able to open "gaps" past the end of this edge.
        const s0 = dot(da, t)
        const s1 = dot(db, t)
        const lo = Math.min(s0, s1)
        const hi = Math.max(s0, s1)
        if (hi < 0.1 || lo > len - 0.1) continue
        covered.push([Math.max(0, lo), Math.min(len, hi)])
      }
      covered.sort((p, q) => p[0] - q[0])
      let cursor = 0
      const gaps: [number, number][] = []
      for (const [s0, s1] of covered) {
        if (s0 > cursor + 1.5) gaps.push([cursor, s0])
        cursor = Math.max(cursor, s1)
      }
      if (len > cursor + 1.5) gaps.push([cursor, len])
      const pieces: [number, number][] = []
      for (const [g0, g1] of gaps) {
        const count = Math.max(1, Math.round((g1 - g0) / 4.5))
        for (let k = 0; k < count; k++) pieces.push([g0 + ((g1 - g0) * k) / count, g0 + ((g1 - g0) * (k + 1)) / count])
      }
      for (const [g0, g1] of pieces) {
        const p0 = add(a, scale(t, g0))
        const p1 = add(a, scale(t, g1))
        const d = scale(outward, -6)
        out.push({
          footprint: [p0, p1, add(p1, d), add(p0, d)],
          base: 0,
          height: base.height,
          color: base.color,
          kind: 'lot',
          id: `infill.${n++}`,
          storeys: 2,
          front: { a: p0, b: p1, outward, street },
        })
      }
    }
  }
  return out
}
