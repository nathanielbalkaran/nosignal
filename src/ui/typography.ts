import type { CSSProperties } from 'react'

/*
 * Player-facing type. Pixelify Sans for words, VT323 for numbers and the radio.
 * Self-hosted from public/fonts (both SIL Open Font License; licences alongside).
 * The HTML UI renders at native resolution, never in the low-res 3D buffer.
 * Keep sizes at or above the minimums here so pixel text stays readable.
 */
export const PRIMARY = "'Pixelify Sans', 'PingFang HK', 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', 'Heiti TC', ui-monospace, monospace"
export const SECONDARY = "'VT323', ui-monospace, monospace"

const word = (size: number, spacing = '0.08em'): CSSProperties => ({ fontFamily: PRIMARY, fontSize: size, letterSpacing: spacing, fontWeight: 400 })
const digits = (size: number, spacing = '0.04em'): CSSProperties => ({ fontFamily: SECONDARY, fontSize: size, letterSpacing: spacing, fontWeight: 400, lineHeight: 1.1 })

export const type = {
  /** Main title and big end-screen headline. */
  display: { ...word(64, '0.3em'), fontWeight: 600 } as CSSProperties,
  heading: { ...word(36, '0.3em'), fontWeight: 600 } as CSSProperties,
  body: word(18),
  label: word(16, '0.1em'),
  small: word(14, '0.12em'),
  prompt: word(18, '0.18em'),
  /** Clock readouts. */
  clock: digits(40, '0.1em'),
  readout: digits(22),
  readoutSmall: digits(18),
} as const
