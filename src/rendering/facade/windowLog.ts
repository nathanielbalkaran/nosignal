/**
 * Every plain, dark window the facade builder draws, in facade-local metres.
 * The ambient layer picks a few of these to light up now and then, so it
 * covers real windows instead of guessing where they are.
 */
export interface WindowRecord {
  facade: string
  x0: number
  x1: number
  y0: number
  y1: number
  /** Depth of the glass in front of the wall plane. */
  z: number
}

export const windowLog: WindowRecord[] = []
