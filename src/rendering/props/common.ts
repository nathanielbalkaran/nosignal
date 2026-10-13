import type { PropInstance } from '../../world/props.ts'
import type { Sink } from '../geo/layers.ts'

/** Deterministic number in [0, 1) from a prop's variant and a salt. */
export function hv(variant: number, salt: number): number {
  const h = Math.sin(variant * 12.9898 + salt * 78.233) * 43758.5453
  return h - Math.floor(h)
}

export function pickV<T>(items: readonly T[], variant: number, salt: number): T {
  return items[Math.min(items.length - 1, Math.floor(hv(variant, salt) * items.length))]
}

export type PropBuilder = (s: Sink, p: PropInstance) => void

/** Muted street palettes, shared by several prop types. */
export const PLASTIC = ['#a4423b', '#3f6c93', '#4f7f58', '#c18a3a', '#7f7f86', '#b9b2a0']
export const CARDBOARD = ['#a8916b', '#9c8660', '#b09c76', '#8f7b58']
export const GLASS = '#232b35'
export const TYRE = '#1e1f22'
export const STEEL = '#80858a'
export const DARK_STEEL = '#4a4e53'
export const FOLIAGE = ['#4b684c', '#3e5c45', '#55734f', '#44634a']
