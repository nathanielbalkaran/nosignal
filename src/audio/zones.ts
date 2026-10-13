import { world } from '../world/index.ts'
import type { Vec2 } from '../world/geometry2d.ts'

/*
 * Where each local sound lives. Loudness is plain distance attenuation:
 * 1 at the source, falling to 0 at `radius`.
 */

export interface Zone {
  at: readonly Vec2[]
  radius: number
}

export type ZoneName = 'restaurant' | 'market' | 'construction' | 'station' | 'residential'

const node = (id: string): Vec2 => world.nodes.get(id)!.at
const mid = (a: string, b: string): Vec2 => [(node(a)[0] + node(b)[0]) / 2, (node(a)[1] + node(b)[1]) / 2]

const restaurant = world.landmarks.find((l) => l.id === 'restaurant')!.at
const market = world.landmarks.find((l) => l.id === 'market')!.at

/** Backstreets: the middle of every lane and alley. */
const residentialPoints: Vec2[] = world.layout.streets.filter((s) => s.kind === 'lane' || s.kind === 'alley').map((s) => mid(s.nodes[0], s.nodes[s.nodes.length - 1]))

export const ZONES: Record<ZoneName, Zone> = {
  restaurant: { at: [restaurant], radius: 26 },
  market: { at: [market, node('K1')], radius: 34 },
  construction: { at: [mid('C2', 'C3')], radius: 30 },
  station: { at: world.goal.entrances.map((e) => e.at), radius: 48 },
  residential: { at: residentialPoints, radius: 22 },
}

export const ZONE_NAMES = Object.keys(ZONES) as ZoneName[]

/** Linear-ish falloff that is a little steeper near the edge. */
export function attenuate(distance: number, radius: number): number {
  if (distance >= radius) return 0
  const k = 1 - distance / radius
  return k * k
}

export function zoneLevel(zone: Zone, x: number, z: number): number {
  let best = 0
  for (const p of zone.at) best = Math.max(best, attenuate(Math.hypot(p[0] - x, p[1] - z), zone.radius))
  return best
}

const trunkA = node('TW')
const trunkB = node('TE')

/** 0 to 1: how close the player is to the trunk road, where the traffic is. */
export function trunkLevel(x: number, z: number): number {
  const dx = trunkB[0] - trunkA[0]
  const dz = trunkB[1] - trunkA[1]
  const len = Math.hypot(dx, dz)
  const d = Math.abs((x - trunkA[0]) * dz - (z - trunkA[1]) * dx) / len
  return Math.max(0, Math.min(1, 1 - (d - 8) / 60))
}
