import type { LayoutStreet } from './types.ts'

/**
 * What kind of place a street is. Zones decide which props, signs and facade
 * types a street gets, so different streets read as different places.
 */
export type Zone = 'commercial' | 'avenue' | 'residential' | 'market' | 'construction' | 'trunk'

const ZONE_BY_STREET: Readonly<Record<string, Zone>> = {
  'hoi-pong-road': 'trunk',
  // The main commercial spine and the streets that feed it.
  'shun-hing-street': 'commercial',
  'shun-hing-west': 'commercial',
  'tak-on-street': 'commercial',
  'chung-wo-street': 'commercial',
  'kam-fung-south': 'commercial',
  // The one wide street with room for trees and street furniture.
  'ching-wan-road': 'avenue',
  'kam-fung-market': 'market',
  // One concentrated building site, off the three designed routes.
  'cheung-fat-street': 'construction',
}

export function zoneOf(street: LayoutStreet): Zone {
  return ZONE_BY_STREET[street.id] ?? 'residential'
}

export const CONSTRUCTION_STREET = 'cheung-fat-street'
/** The street used as the polished representative street (Phase 2, step 5). */
export const SHOWCASE_STREET = 'shun-hing-street'

/*
 * Local character: how busy a street is, on top of its zone. The default is
 * quiet; places that are meant to be busy say so. Prop placement multiplies its
 * densities by these, so a back alley can be nearly empty and a delivery street
 * can be crowded without a separate rule set per street.
 */
export interface Character {
  /** Wall-side clutter multiplier. */
  clutter: number
  /** Kerbside vehicle multiplier. */
  vehicles: number
  /** Share of upper windows with an external AC unit, relative to the street style (facades). */
  ac: number
  /** Multiplier on shop signage (facades). */
  signage: number
  /** Share of ground floors that are shuttered rather than open for business (facades). */
  shuttered: number
}

const BY_KIND: Readonly<Record<LayoutStreet['kind'], Character>> = {
  trunk: { clutter: 0, vehicles: 0, ac: 1, signage: 1, shuttered: 0.8 },
  main: { clutter: 0.55, vehicles: 0.6, ac: 0.7, signage: 1, shuttered: 0.82 },
  street: { clutter: 0.4, vehicles: 0.45, ac: 0.6, signage: 0.75, shuttered: 0.85 },
  market: { clutter: 0.9, vehicles: 0.7, ac: 0.35, signage: 0.9, shuttered: 0.9 },
  lane: { clutter: 0.3, vehicles: 0.25, ac: 0.45, signage: 0.5, shuttered: 0.9 },
  alley: { clutter: 0.14, vehicles: 0.05, ac: 0.3, signage: 0.2, shuttered: 0.95 },
}

const CHARACTER: Readonly<Record<string, Partial<Character>>> = {
  // The busy end of the district: deliveries, crates, plenty of signs.
  'shun-hing-street': { clutter: 0.6, vehicles: 0.65 },
  'chung-wo-street': { clutter: 0.55, vehicles: 0.6 },
  // Residential backstreets: a few plants, bins and the odd bicycle by an entrance.
  'po-sin-street': { clutter: 0.5, vehicles: 0.3, signage: 0.45 },
  'tung-lok-street': { clutter: 0.45, vehicles: 0.3, signage: 0.4 },
  'san-tai-street': { clutter: 0.4, vehicles: 0.3, signage: 0.45 },
  // Genuinely quiet streets: almost nothing in them.
  'ching-wan-road': { clutter: 0.2, vehicles: 0.4 },
  'lok-wo-lane': { clutter: 0.2, vehicles: 0.15 },
  'tak-on-street': { clutter: 0.25, vehicles: 0.25 },
  'shun-hing-west': { clutter: 0.3, vehicles: 0.3 },
  'kam-fung-south': { clutter: 0.3, vehicles: 0.3 },
  'cheung-fat-street': { signage: 0.2, ac: 0.4 },
}

export function characterOf(street: LayoutStreet): Character {
  return { ...BY_KIND[street.kind], ...CHARACTER[street.id] }
}
