import { Geo } from '../geo/Geo.ts'

/*
 * Low-poly early-GTA / PS1-aesthetic commuter train carriage interior.
 * Compact interior: worn fabric seats, aluminium window frames, rubber seals,
 * vertical handrails, overhead luggage racks, and fluorescent ceiling fixtures.
 */

export const CARRIAGE = {
  // Carriage interior bounds
  xMin: -1.3, // Window wall
  xMax: 1.1,  // Opposite wall
  yMin: 0.0,  // Floor
  yMax: 2.3,  // Ceiling
  zMin: -3.5,
  zMax: 3.5,
} as const

// Primary window cutout for the player's view
export const TRAIN_WINDOW = {
  x: -1.3,
  y0: 0.82,
  y1: 1.96,
  z0: -2.8,
  z1: 2.8,
} as const

export interface TrainInteriorGeo {
  lit: Geo
  glow: Geo
  straps: { x: number; y: number; z: number }[]
}

const PALETTE = {
  floor: '#262a2e',
  floorCenter: '#34383c',
  wallPanels: '#9aa099',
  wallDark: '#757c76',
  ceiling: '#a6aba5',
  windowFrame: '#656b70',
  windowSill: '#4e5357',
  rubberSeal: '#1e2124',
  seatFabric: '#2e4354',
  seatFabricWorn: '#263745',
  seatFrame: '#24282c',
  chromePole: '#b6bec4',
  fluorescentDiffuser: '#faf7ea',
}

export function buildTrainInterior(): TrainInteriorGeo {
  const lit = new Geo()
  const glow = new Geo()
  const straps: { x: number; y: number; z: number }[] = []

  const { xMin, xMax, yMin, yMax, zMin, zMax } = CARRIAGE

  // 1. Floor: dark ribbed transit rubber floor
  lit.span(xMin - 0.05, yMin - 0.05, zMin, xMax + 0.05, yMin, zMax, PALETTE.floor)
  lit.span(xMin + 0.35, yMin - 0.04, zMin, xMax - 0.15, yMin + 0.005, zMax, PALETTE.floorCenter)

  // 2. Ceiling: pale curved/stepped panels
  lit.span(xMin - 0.05, yMax, zMin, xMax + 0.05, yMax + 0.05, zMax, PALETTE.ceiling)
  // Ceiling side coves
  lit.span(xMin, yMax - 0.12, zMin, xMin + 0.22, yMax, zMax, PALETTE.wallPanels)
  lit.span(xMax - 0.22, yMax - 0.12, zMin, xMax, yMax, zMax, PALETTE.wallPanels)

  // 3. Fluorescent Light Fixtures along carriage centreline (X = 0.0)
  const lampX0 = -0.15
  const lampX1 = 0.15
  const lampZSegments = [
    { z0: -2.8, z1: -0.8 },
    { z0: -0.2, z1: 1.8 },
    { z0: 2.2, z1: 3.2 },
  ]
  for (const seg of lampZSegments) {
    // Housing
    lit.span(lampX0 - 0.03, yMax - 0.05, seg.z0 - 0.03, lampX1 + 0.03, yMax, seg.z1 + 0.03, '#4e5458')
    // Glowing diffuser
    glow.span(lampX0, yMax - 0.04, seg.z0, lampX1, yMax - 0.005, seg.z1, PALETTE.fluorescentDiffuser)
  }

  // 4. Window Wall (X = xMin = -1.3):
  // Clean panoramic window cutouts
  const wY0 = TRAIN_WINDOW.y0 // 0.82
  const wY1 = TRAIN_WINDOW.y1 // 1.96

  // Lower wall panel below window
  lit.span(xMin - 0.05, yMin, zMin, xMin + 0.02, wY0, zMax, PALETTE.wallPanels, { grime: 0.7 })

  // Upper wall panel above window
  lit.span(xMin - 0.05, wY1, zMin, xMin + 0.02, yMax - 0.12, zMax, PALETTE.wallPanels)

  // Window sections (3 large commuter windows separated by thin pillars)
  const windowSections = [
    { z0: -3.0, z1: -1.2 },
    { z0: -0.9, z1: 0.9 },
    { z0: 1.2, z1: 3.0 },
  ]

  // Pillars between windows and at ends
  lit.span(xMin - 0.05, wY0, zMin, xMin + 0.02, wY1, windowSections[0].z0, PALETTE.wallPanels)
  lit.span(xMin - 0.05, wY0, windowSections[0].z1, xMin + 0.02, wY1, windowSections[1].z0, PALETTE.wallPanels)
  lit.span(xMin - 0.05, wY0, windowSections[1].z1, xMin + 0.02, wY1, windowSections[2].z0, PALETTE.wallPanels)
  lit.span(xMin - 0.05, wY0, windowSections[2].z1, xMin + 0.02, wY1, zMax, PALETTE.wallPanels)

  // Window frames & rubber seals around each window
  for (const w of windowSections) {
    // Outer rubber seal
    lit.span(xMin - 0.03, wY0 - 0.02, w.z0 - 0.02, xMin + 0.01, wY0, w.z1 + 0.02, PALETTE.rubberSeal)
    lit.span(xMin - 0.03, wY1, w.z0 - 0.02, xMin + 0.01, wY1 + 0.02, w.z1 + 0.02, PALETTE.rubberSeal)
    lit.span(xMin - 0.03, wY0, w.z0 - 0.02, xMin + 0.01, wY1, w.z0, PALETTE.rubberSeal)
    lit.span(xMin - 0.03, wY0, w.z1, xMin + 0.01, wY1, w.z1 + 0.02, PALETTE.rubberSeal)

    // Aluminium metallic frame trim
    lit.span(xMin - 0.02, wY0 - 0.01, w.z0 - 0.01, xMin + 0.02, wY0, w.z1 + 0.01, PALETTE.windowFrame)
    lit.span(xMin - 0.02, wY1, w.z0 - 0.01, xMin + 0.02, wY1 + 0.01, w.z1 + 0.01, PALETTE.windowFrame)
    lit.span(xMin - 0.02, wY0, w.z0 - 0.01, xMin + 0.02, wY1, w.z0, PALETTE.windowFrame)
    lit.span(xMin - 0.02, wY0, w.z1, xMin + 0.02, wY1, w.z1 + 0.01, PALETTE.windowFrame)

    // Horizontal window sill ledge (protruding slightly into the carriage)
    lit.span(xMin, wY0 - 0.03, w.z0 - 0.02, xMin + 0.08, wY0, w.z1 + 0.02, PALETTE.windowSill)
  }

  // 5. Far Side Wall / Partition (X = xMax = 1.1)
  lit.span(xMax - 0.02, yMin, zMin, xMax + 0.05, yMax, zMax, PALETTE.wallDark, { grime: 0.6 })

  // Opposite side windows (matching cutouts)
  for (const w of windowSections) {
    lit.span(xMax - 0.02, wY0, w.z0, xMax, wY1, w.z1, '#2c333a')
  }

  // End partition walls (Z = zMin and Z = zMax)
  lit.span(xMin, yMin, zMin - 0.05, xMax, yMax, zMin, PALETTE.wallDark)
  lit.span(xMin, yMin, zMax, xMax, yMax, zMax + 0.05, PALETTE.wallDark)

  // End doors to adjacent carriage
  lit.span(-0.35, yMin, zMin - 0.02, 0.35, 1.95, zMin + 0.02, '#3c4246')
  lit.span(-0.35, yMin, zMax - 0.02, 0.35, 1.95, zMax + 0.02, '#3c4246')
  glow.span(-0.16, 1.1, zMin - 0.01, 0.16, 1.65, zMin + 0.01, '#222830')
  glow.span(-0.16, 1.1, zMax - 0.01, 0.16, 1.65, zMax + 0.01, '#222830')

  // 6. Seats: Low-profile, sleek commuter bench seats
  // Seat height 0.42m, low backrest ending at 0.72m (cleanly below the 0.82m window sill!)
  function buildBench(x0: number, x1: number, z0: number, z1: number) {
    const seatH = 0.42
    const backH = 0.30 // Total height = 0.72m (well below 0.82m window!)

    // Dark steel pedestal
    lit.span(x0 + 0.04, yMin, z0 + 0.05, x1 - 0.04, seatH - 0.05, z1 - 0.05, PALETTE.seatFrame)

    // Bench cushion
    lit.span(x0, seatH - 0.05, z0, x1, seatH, z1, PALETTE.seatFabric, { grime: 0.85 })

    // Low back cushion against the wall
    lit.span(x0, seatH, z0, x0 + 0.07, seatH + backH, z1, PALETTE.seatFabricWorn)

    // Clean divider armrests (neat low blocks, no vertical spikes)
    const numDividers = Math.max(2, Math.round((z1 - z0) / 0.55))
    const step = (z1 - z0) / numDividers
    for (let i = 0; i <= numDividers; i++) {
      const cz = z0 + i * step
      lit.span(x0 + 0.02, seatH, cz - 0.02, x1 - 0.02, seatH + 0.14, cz + 0.02, '#383e44')
    }
  }

  // Benches along the window wall (under windows, back against xMin wall, below sill)
  buildBench(xMin + 0.05, xMin + 0.52, -2.8, -1.4)
  buildBench(xMin + 0.05, xMin + 0.52, -0.7, 0.7)
  buildBench(xMin + 0.05, xMin + 0.52, 1.4, 2.8)

  // Benches along the opposite wall
  function buildOppositeBench(x0: number, x1: number, z0: number, z1: number) {
    const seatH = 0.42
    const backH = 0.30
    lit.span(x0 + 0.04, yMin, z0 + 0.05, x1 - 0.04, seatH - 0.05, z1 - 0.05, PALETTE.seatFrame)
    lit.span(x0, seatH - 0.05, z0, x1, seatH, z1, PALETTE.seatFabric, { grime: 0.85 })
    lit.span(x1 - 0.07, seatH, z0, x1, seatH + backH, z1, PALETTE.seatFabricWorn)
    const numDividers = Math.max(2, Math.round((z1 - z0) / 0.55))
    const step = (z1 - z0) / numDividers
    for (let i = 0; i <= numDividers; i++) {
      const cz = z0 + i * step
      lit.span(x0 + 0.02, seatH, cz - 0.02, x1 - 0.02, seatH + 0.14, cz + 0.02, '#383e44')
    }
  }
  buildOppositeBench(xMax - 0.52, xMax - 0.05, -2.8, -1.4)
  buildOppositeBench(xMax - 0.52, xMax - 0.05, -0.7, 0.7)
  buildOppositeBench(xMax - 0.52, xMax - 0.05, 1.4, 2.8)

  // 7. Stanchion Poles & Handrails
  // Place vertical chrome poles at door vestibules and aisle boundaries (not blocking the window view!)
  const polePositions = [
    { x: -0.65, z: -1.05 },
    { x: -0.65, z: 1.05 },
    { x: 0.45, z: -1.05 },
    { x: 0.45, z: 1.05 },
  ]
  for (const p of polePositions) {
    // Vertical pole floor to ceiling
    lit.cyl(p.x, yMin, p.z, 0.016, yMax - yMin - 0.06, PALETTE.chromePole, 6)
  }

  // Overhead horizontal handrails running down the car along the aisle
  const railX = -0.15
  lit.rod([railX, 2.02, zMin + 0.4], [railX, 2.02, zMax - 0.4], 0.014, PALETTE.chromePole, 6)

  // Hanging hand straps anchor points along the horizontal rail
  for (let sz = -2.6; sz <= 2.6; sz += 0.52) {
    straps.push({ x: railX, y: 2.02, z: sz })
  }

  return { lit, glow, straps }
}
