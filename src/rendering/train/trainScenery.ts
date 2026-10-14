import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { Geo } from '../geo/Geo.ts'
import { retroTexture } from '../geo/retroTextures.ts'

/*
 * NO SIGNAL — Commuter Train Exterior Scenery & Cinematic Polish
 *
 * Visual Direction:
 * - Gritty, low-poly, PS1-inspired Hong Kong aesthetic.
 * - Deep 3-layer parallax:
 *   1. Foreground: Viaduct parapet, catenary masts, overhead power cables, trackside signals (26 m/s).
 *   2. Midground: Continuous authored narrative journey (~470m) moving at 10 m/s:
 *      - Zone 1 (0-10s): Dense, claustrophobic tenement alley close to windows.
 *      - Zone 2 (10-22s): Widening avenue, neon signs, cross streets, elevated walkways.
 *      - Zone 3 (22-34s): THE CINEMATIC REVEAL. Midground buildings drop away completely! Open viaduct
 *        high above the city grid, revealing hundreds of layered skyline towers, distant mountain
 *        ridges, and an understated, realistic dawn sky.
 *      - Zone 4 (34-45s): Re-entry into dense neighborhood, passing directly alongside the
 *        unmistakable covered pedestrian footbridge from Hoi Pong Road as the monologue asks
 *        "Which way is this train going?".
 *      - Zone 5 (45-52s): Deep pre-dawn shadows fading into black.
 *   3. Background: Expansive layered mountain ridges, distant skyscraper silhouettes, and valley floor (2.2 m/s).
 *   4. Sky Backdrop: Atmospheric, understated pre-dawn sunrise with cool blue-grey zenith,
 *      dusky lavender/rose mid-tier, and soft amber horizon glow.
 */

export interface SceneryRig {
  group: Group
  update(time: number, dt: number, speed: number): void
  dispose(): void
}

const PALETTE = {
  // Viaduct & Trackside
  viaductWall: '#4e545a',
  viaductTop: '#646a70',
  trackBallast: '#2c2a28',
  catenarySteel: '#565e64',
  catenaryWire: '#3a4046',
  cableTray: '#363c40',
  signalGreen: '#32e080',
  signalAmber: '#f2a632',
  signalRed: '#e24238',

  // Hong Kong Urban Tenements (Tong Lau & Slab Blocks)
  concreteWeathered: '#585c62',
  concreteDark: '#3e4248',
  ochreFaded: '#6e5f52',
  ochreDark: '#564a3e',
  mintFaded: '#4e5e56',
  peachFaded: '#6a524e',
  rustRoof: '#5a423c',
  windowDark: '#1a2028',
  windowWarm: '#ffc978',
  windowCool: '#a8c2d8',
  waterTankMetal: '#687278',
  waterTankDark: '#444c52',
  acUnit: '#788086',
  tileGrime: '#464a50',

  // Neon & Street Lighting
  neonRed: '#e84236',
  neonGreen: '#34d278',
  neonCyan: '#38c6d8',
  neonAmber: '#f6aa3c',
  streetlampSodium: '#e8a248',

  // Footbridge Landmark (Matching Hoi Pong Road)
  footbridgeRoof: '#7f9a8e',
  footbridgeRoofTrim: '#62786d',
  footbridgeSteel: '#4d5553',
  footbridgeSteelLight: '#6a726f',
  footbridgeConcrete: '#6c6a64',
  footbridgeDeckDark: '#5a5853',
  footbridgePanel1: '#7a8478',
  footbridgePanel2: '#6f7a6b',
  footbridgeLamp: '#d8d2b4',
  footbridgeNosing: '#9c8f4a',

  // Background Skyline & Mountains
  mountainFar: '#2a3344',
  mountainMid: '#384254',
  skylineFar: '#323c4e',
  skylineMid: '#3f4b5e',
  groundValley: '#242a34',

  // Pre-dawn & Dawn Sky Gradients (Understated, realistic)
  skyZenithNight: new Color('#131a26'),
  skyMidNight: new Color('#242c3d'),
  skyLowNight: new Color('#363e52'),
  skyHorizonNight: new Color('#464e62'),

  skyZenithDawn: new Color('#1c283c'),
  skyMidDawn: new Color('#38435a'),
  skyPinkDawn: new Color('#685264'),
  skyAmberDawn: new Color('#a87462'),
  skyHorizonDawn: new Color('#d29574'),
}

// Portable canvas interface supporting browser and headless node environments
interface TextureCanvas {
  width: number
  height: number
  getContext(contextId: string): unknown
}

function getCanvas(w: number, h: number): TextureCanvas {
  const doc = (globalThis as unknown as { document?: { createElement(tag: string): TextureCanvas } }).document
  if (doc) {
    const canvas = doc.createElement('canvas')
    canvas.width = w
    canvas.height = h
    return canvas
  }
  const dummyCtx = {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    strokeRect() {},
    fillText() {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  }
  return {
    width: w,
    height: h,
    getContext: () => dummyCtx,
  }
}

// Generate realistic understated morning sky texture (64x256 NearestFilter for PS1 feel)
function createSkyTexture(): { texture: CanvasTexture; update(dawnAmount: number): void } {
  const canvas = getCanvas(64, 256)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = canvas.getContext('2d') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const texture = new CanvasTexture(canvas as any)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = texture.minFilter = NearestFilter
  texture.generateMipmaps = false

  function paint(dawnAmount: number) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    const zenith = PALETTE.skyZenithNight.clone().lerp(PALETTE.skyZenithDawn, dawnAmount)
    const mid = PALETTE.skyMidNight.clone().lerp(PALETTE.skyMidDawn, dawnAmount)
    const pink = PALETTE.skyLowNight.clone().lerp(PALETTE.skyPinkDawn, dawnAmount)
    const amber = PALETTE.skyHorizonNight.clone().lerp(PALETTE.skyAmberDawn, dawnAmount)
    const horizon = PALETTE.skyHorizonNight.clone().lerp(PALETTE.skyHorizonDawn, dawnAmount)

    grad.addColorStop(0.0, zenith.getStyle())
    grad.addColorStop(0.38, mid.getStyle())
    grad.addColorStop(0.68, pink.getStyle())
    grad.addColorStop(0.88, amber.getStyle())
    grad.addColorStop(1.0, horizon.getStyle())

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 256)

    // Soft, diffuse atmospheric morning sunrise bloom (natural, gentle horizon glow)
    if (dawnAmount > 0.15) {
      const sunAlpha = Math.min(0.85, (dawnAmount - 0.15) * 1.2)
      const sunGrad = ctx.createRadialGradient(32, 222, 2, 32, 222, 38)
      sunGrad.addColorStop(0.0, `rgba(255, 225, 175, ${sunAlpha * 0.9})`)
      sunGrad.addColorStop(0.3, `rgba(235, 175, 130, ${sunAlpha * 0.6})`)
      sunGrad.addColorStop(0.65, `rgba(185, 115, 110, ${sunAlpha * 0.22})`)
      sunGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = sunGrad
      ctx.fillRect(0, 165, 64, 91)
    }

    texture.needsUpdate = true
  }

  paint(0)
  return { texture, update: paint }
}

// Authentic Mei Wah Cafe neon sign texture
function createLandmarkSignTexture(): CanvasTexture {
  const canvas = getCanvas(160, 80)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = canvas.getContext('2d') as any
  ctx.fillStyle = '#16191e'
  ctx.fillRect(0, 0, 160, 80)
  ctx.strokeStyle = '#c43228'
  ctx.lineWidth = 4
  ctx.strokeRect(3, 3, 154, 74)

  ctx.fillStyle = '#e84236'
  ctx.font = '700 28px "PingFang HK", "Noto Sans TC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('美華冰室', 80, 30)

  ctx.fillStyle = '#ffd175'
  ctx.font = '16px "VT323", monospace'
  ctx.fillText('MEI WAH CAFE', 80, 58)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const texture = new CanvasTexture(canvas as any)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  return texture
}

export function createTrainScenery(): SceneryRig {
  const group = new Group()
  const disposables: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x)
    return x
  }

  // =========================================================================
  // 1. SKY BACKDROP (Positioned at X = -135, expansive coverage)
  // =========================================================================
  const skyTex = createSkyTexture()
  own(skyTex.texture)
  const skyMat = own(
    new MeshBasicMaterial({
      map: skyTex.texture,
      side: DoubleSide,
      fog: false,
      depthWrite: false,
    })
  )
  const skyMesh = own(new Mesh(new PlaneGeometry(260, 95), skyMat))
  skyMesh.position.set(-135, 22, 0)
  skyMesh.rotation.y = Math.PI / 2
  skyMesh.renderOrder = -50
  group.add(skyMesh)

  // =========================================================================
  // 2. LAYER 3: BACKGROUND SKYLINE, MOUNTAIN RIDGES & VALLEY FLOOR (X = -45 to -95)
  // =========================================================================
  const bgGeo = new Geo()
  const bgLength = 180

  // 2a. Distant Jagged Mountains (X = -82 to -95)
  const mountainSegments = 36
  const segW = bgLength / mountainSegments
  for (let i = 0; i < mountainSegments; i++) {
    const z0 = -bgLength / 2 + i * segW
    const z1 = z0 + segW
    const zMid = (z0 + z1) / 2
    // High mountain back ridge
    const h1 = 32 + Math.sin(i * 0.72) * 9 + Math.cos(i * 1.45) * 6
    bgGeo.tri([-90, -10, z0], [-90, -10, z1], [-90, h1, zMid], PALETTE.mountainFar)

    // Overlapping front mountain ridge
    const h2 = 22 + Math.cos(i * 0.94 + 1.2) * 7 + Math.sin(i * 1.8) * 4
    bgGeo.tri([-76, -10, z0], [-76, -10, z1], [-76, h2, zMid], PALETTE.mountainMid)
  }

  // 2b. Distant High-Rise Skyline Towers (X = -48 to -68)
  const bgTowers = [
    { x: -62, z: -80, w: 14, d: 16, h: 46, spire: 9 },
    { x: -55, z: -68, w: 12, d: 13, h: 38, spire: 5 },
    { x: -68, z: -54, w: 16, d: 18, h: 52, spire: 12 },
    { x: -52, z: -40, w: 10, d: 12, h: 34, spire: 0 },
    { x: -60, z: -28, w: 13, d: 15, h: 42, spire: 7 },
    { x: -54, z: -14, w: 11, d: 13, h: 36, spire: 4 },
    { x: -65, z: 2, w: 15, d: 17, h: 48, spire: 10 },
    { x: -50, z: 16, w: 10, d: 11, h: 32, spire: 0 },
    { x: -58, z: 30, w: 14, d: 15, h: 44, spire: 8 },
    { x: -66, z: 46, w: 16, d: 18, h: 50, spire: 11 },
    { x: -53, z: 62, w: 12, d: 13, h: 37, spire: 5 },
    { x: -62, z: 78, w: 13, d: 14, h: 43, spire: 6 },
  ]
  for (const t of bgTowers) {
    const x0 = t.x - t.w / 2
    const x1 = t.x + t.w / 2
    const z0 = t.z - t.d / 2
    const z1 = t.z + t.d / 2
    // Tower body
    bgGeo.span(x0, -10, z0, x1, t.h, z1, PALETTE.skylineFar)
    // Stepped crown / penthouse
    bgGeo.span(x0 + 1.2, t.h, z0 + 1.2, x1 - 1.2, t.h + 2.5, z1 - 1.2, PALETTE.skylineMid)
    // Communication spire
    if (t.spire > 0) {
      bgGeo.cyl(t.x, t.h + 2.5, t.z, 0.16, t.spire, '#283244', 4)
      bgGeo.cyl(t.x, t.h + 2.5 + t.spire, t.z, 0.08, 1.8, '#d44', 4)
    }

    // Windows pattern (scattered early-morning lights)
    const floors = Math.floor(t.h / 3.2)
    for (let f = 3; f < floors; f += 2) {
      const wy = f * 3.2
      if ((f * 7 + t.z) % 3 === 0) {
        bgGeo.span(x1 - 0.05, wy, z0 + 1.5, x1 + 0.05, wy + 1.2, z0 + 3.2, PALETTE.windowWarm)
      }
    }
  }

  // 2c. Lower Valley & District Grid below viaduct (X = -28 to -45, Y = -18 to -4)
  // Low warehouse roofs and street blocks far below the elevated train
  for (let z = -bgLength / 2 + 6; z < bgLength / 2; z += 18) {
    const lowH = -4 + Math.sin(z * 0.3) * 2.5
    bgGeo.span(-38, -20, z - 7, -26, lowH, z + 7, PALETTE.groundValley)
    // Low street sodium points along district grid
    bgGeo.box(-25.8, lowH + 0.5, z, 0.4, 0.4, 0.4, PALETTE.streetlampSodium)
  }

  const bgMat = own(new MeshBasicMaterial({ vertexColors: true, map: retroTexture('plaster'), side: DoubleSide, fog: false }))
  const bgMeshA = new Mesh(own(bgGeo.build({ tile: 6 })), bgMat)
  const bgMeshB = new Mesh(bgMeshA.geometry, bgMat)
  group.add(bgMeshA, bgMeshB)

  // =========================================================================
  // 3. LAYER 2: MIDGROUND NARRATIVE JOURNEY (~470m continuous authored track)
  // Progresses from claustrophobic density -> reveal -> footbridge landmark -> dense
  // =========================================================================
  const midGeo = new Geo()

  // Helper to build a detailed low-poly Hong Kong tenement block
  function addTenement(
    xMid: number,
    zMid: number,
    w: number,
    d: number,
    h: number,
    colorHex: string,
    options: {
      balconies?: boolean
      acUnits?: boolean
      waterTank?: boolean
      shopSign?: { color: string }
      litRatio?: number
      baseY?: number
    } = {}
  ) {
    const y0 = options.baseY ?? -12.0
    const x0 = xMid - w / 2
    const x1 = xMid + w / 2
    const z0 = zMid - d / 2
    const z1 = zMid + d / 2

    // Main building mass with grime shading towards bottom
    midGeo.span(x0, y0, z0, x1, h, z1, colorHex, { grime: 0.65 })
    // Rooftop lip / parapet
    midGeo.span(x0 - 0.12, h, z0 - 0.12, x1 + 0.12, h + 0.55, z1 + 0.12, PALETTE.tileGrime)

    // Facade details on track-facing wall (at x1)
    const floorH = 2.8
    const floors = Math.floor((h - Math.max(0, y0)) / floorH)
    const bays = Math.max(1, Math.floor(d / 2.2))
    const baySpacing = d / bays

    for (let f = 1; f < floors; f++) {
      const wy = y0 + f * floorH
      if (wy > h - 1.2) continue

      for (let b = 0; b < bays; b++) {
        const wz = z0 + 0.6 + b * baySpacing
        const isLit = (f * 5 + b * 11 + Math.abs(zMid)) % (options.litRatio ?? 6) === 0
        const winColor = isLit ? PALETTE.windowWarm : PALETTE.windowDark
        midGeo.span(x1 - 0.04, wy, wz, x1 + 0.04, wy + 1.4, wz + 1.2, winColor)

        // Projecting air conditioner unit under some windows
        if (options.acUnits && (f + b) % 3 === 0) {
          midGeo.box(x1 + 0.28, wy - 0.25, wz + 0.6, 0.5, 0.38, 0.6, PALETTE.acUnit)
        }

        // Projecting cantilevered balcony
        if (options.balconies && f % 2 === 1 && wy > 1.0) {
          midGeo.span(x1, wy - 0.1, wz - 0.15, x1 + 0.8, wy, wz + 1.35, PALETTE.concreteDark)
          midGeo.span(x1 + 0.74, wy, wz - 0.15, x1 + 0.8, wy + 0.9, wz + 1.35, PALETTE.catenarySteel)
        }
      }
    }

    // Rooftop water tank on steel tripod
    if (options.waterTank) {
      const tx = xMid
      const tz = zMid
      midGeo.cyl(tx - 0.6, h + 0.2, tz - 0.6, 0.04, 0.9, PALETTE.waterTankDark, 4)
      midGeo.cyl(tx + 0.6, h + 0.2, tz - 0.6, 0.04, 0.9, PALETTE.waterTankDark, 4)
      midGeo.cyl(tx - 0.6, h + 0.2, tz + 0.6, 0.04, 0.9, PALETTE.waterTankDark, 4)
      midGeo.cyl(tx + 0.6, h + 0.2, tz + 0.6, 0.04, 0.9, PALETTE.waterTankDark, 4)
      midGeo.cyl(tx, h + 1.05, tz, 0.95, 1.4, PALETTE.waterTankMetal, 6)
      midGeo.cyl(tx, h + 1.75, tz, 0.65, 0.3, PALETTE.waterTankDark, 5)
    }

    // Projecting vertical neon shop sign
    if (options.shopSign) {
      const signY = Math.min(h - 2, 4.5)
      const signZ = zMid
      midGeo.span(x1, signY - 0.05, signZ - 0.05, x1 + 1.4, signY + 0.05, signZ + 0.05, '#333')
      midGeo.span(x1 + 0.8, signY - 2.2, signZ - 0.06, x1 + 1.3, signY + 1.2, signZ + 0.06, options.shopSign.color)
    }
  }

  // Helper to build elevated pedestrian walkway between two buildings
  function addElevatedWalkway(x: number, y: number, z: number, length: number) {
    // Deck
    midGeo.span(x - 1.2, y, z - length / 2, x + 1.2, y + 0.25, z + length / 2, PALETTE.concreteDark)
    // Enclosed glass/mesh walls
    midGeo.span(x - 1.2, y + 0.25, z - length / 2, x - 1.15, y + 2.2, z + length / 2, PALETTE.footbridgeSteel)
    midGeo.span(x + 1.15, y + 0.25, z - length / 2, x + 1.2, y + 2.2, z + length / 2, PALETTE.footbridgeSteel)
    // Roof
    midGeo.span(x - 1.3, y + 2.2, z - length / 2, x + 1.3, y + 2.4, z + length / 2, PALETTE.footbridgeRoof)
    // Support pier to ground
    midGeo.cyl(x, -12, z, 0.35, y + 12, PALETTE.concreteWeathered, 5)
  }

  // --- ZONE 1 (Z = +15 to -65, ~80m): Claustrophobic Old Quarter (t = 0 to 8.5s) ---
  // High, tightly packed tenement walls passing very close to the track
  const z1Blocks = [
    { x: -5.6, z: 8, w: 6.5, d: 13, h: 18, c: PALETTE.ochreDark, balconies: true, tank: true },
    { x: -8.8, z: -8, w: 8.0, d: 15, h: 22, c: PALETTE.concreteWeathered, ac: true },
    { x: -5.4, z: -24, w: 6.0, d: 12, h: 16, c: PALETTE.mintFaded, balconies: true, tank: true },
    { x: -8.2, z: -40, w: 7.5, d: 14, h: 20, c: PALETTE.peachFaded, ac: true },
    { x: -5.2, z: -56, w: 6.0, d: 13, h: 17, c: PALETTE.ochreFaded, balconies: true, tank: true },
  ]
  for (const b of z1Blocks) {
    addTenement(b.x, b.z, b.w, b.d, b.h, b.c, {
      balconies: b.balconies,
      acUnits: b.ac,
      waterTank: b.tank,
      litRatio: 5,
    })
  }

  // --- ZONE 2 (Z = -65 to -190, ~125m): Widening Avenues & Commercial Transition (t = 8.5 to 22.0s) ---
  // Stepped-back facades, cross streets, neon signs, elevated walkways
  const z2Blocks = [
    { x: -9.5, z: -74, w: 8.0, d: 14, h: 16, c: PALETTE.ochreFaded, neon: PALETTE.neonGreen },
    { x: -14.0, z: -92, w: 10.0, d: 16, h: 18, c: PALETTE.concreteWeathered },
    { x: -10.0, z: -110, w: 8.5, d: 13, h: 14, c: PALETTE.peachFaded, neon: PALETTE.neonRed },
    { x: -15.5, z: -128, w: 11.0, d: 18, h: 19, c: PALETTE.mintFaded },
    { x: -10.5, z: -146, w: 9.0, d: 14, h: 13, c: PALETTE.ochreDark, neon: PALETTE.neonAmber },
    { x: -16.0, z: -164, w: 10.5, d: 16, h: 17, c: PALETTE.concreteWeathered },
    { x: -11.0, z: -182, w: 8.5, d: 12, h: 11, c: PALETTE.peachFaded },
  ]
  for (const b of z2Blocks) {
    addTenement(b.x, b.z, b.w, b.d, b.h, b.c, {
      waterTank: true,
      acUnits: true,
      shopSign: b.neon ? { color: b.neon } : undefined,
      litRatio: 7,
    })
  }
  // Elevated walkway crossing an alley in Zone 2
  addElevatedWalkway(-12.5, 4.2, -118, 14)

  // --- ZONE 3 (Z = -190 to -290, ~100m): THE CINEMATIC REVEAL (t = 22.0 to 34.0s) ---
  // Midground buildings drop away completely! The train emerges onto high elevated viaduct
  // over the wide valley/harbour basin.
  // Down below (Y = -14 to -22): Street grid, warehouse roofs, glowing sodium streetlamps
  for (let z = -195; z >= -285; z -= 18) {
    // Low street blocks 18m below track
    midGeo.span(-24, -22, z - 7, -12, -14, z + 7, PALETTE.concreteDark)
    // Low street pavement and sodium lamp posts far below
    midGeo.span(-11.8, -14.2, z - 9, -8.0, -14.0, z + 9, '#2a2e34')
    midGeo.cyl(-9.5, -14.0, z, 0.1, 4.2, '#484e54', 4)
    midGeo.box(-9.5, -9.8, z, 0.45, 0.3, 0.45, PALETTE.streetlampSodium)
  }

  // --- ZONE 4 (Z = -290 to -405, ~115m): RE-ENTRY & HOI PONG ROAD FOOTBRIDGE (t = 34.0 to 45.0s) ---
  // Buildings gradually close back in
  const z4Blocks = [
    { x: -12.5, z: -298, w: 9.0, d: 14, h: 13, c: PALETTE.concreteWeathered },
    { x: -8.8, z: -316, w: 7.5, d: 13, h: 15, c: PALETTE.peachFaded },
    { x: -11.0, z: -334, w: 8.5, d: 14, h: 16, c: PALETTE.mintFaded },
    { x: -7.5, z: -352, w: 7.0, d: 13, h: 15, c: PALETTE.rustRoof },
    // Building right next to footbridge (Z = -370)
    { x: -8.5, z: -370, w: 7.0, d: 15, h: 16, c: PALETTE.ochreFaded, tank: true },
    { x: -6.0, z: -388, w: 6.2, d: 13, h: 17, c: PALETTE.mintFaded, balconies: true },
    { x: -8.0, z: -402, w: 7.8, d: 14, h: 20, c: PALETTE.concreteWeathered, ac: true },
  ]
  for (const b of z4Blocks) {
    addTenement(b.x, b.z, b.w, b.d, b.h, b.c, {
      waterTank: b.tank,
      balconies: b.balconies,
      acUnits: b.ac,
      litRatio: 6,
    })
  }

  // --- THE ICONIC HOI PONG ROAD PEDESTRIAN FOOTBRIDGE (Positioned at Z = -370) ---
  // Modeled authentically to match Footbridge.tsx from the game:
  // Pitched green roof, steel frames, concrete deck, colored side panels, stairs, warm canopy lamps
  const fbZ = -370
  const fbDeckY = 1.6
  const fbDeckW = 3.2
  const fbSpanX0 = -13.5
  const fbSpanX1 = -4.2

  // Footbridge main deck slab
  midGeo.span(fbSpanX0, fbDeckY - 0.35, fbZ - fbDeckW / 2, fbSpanX1, fbDeckY, fbZ + fbDeckW / 2, PALETTE.footbridgeConcrete)
  midGeo.span(fbSpanX0, fbDeckY - 0.7, fbZ - fbDeckW / 2 + 0.2, fbSpanX1, fbDeckY - 0.35, fbZ + fbDeckW / 2 - 0.2, PALETTE.footbridgeDeckDark)

  // Under-deck steel girders
  midGeo.span(fbSpanX0, fbDeckY - 0.65, fbZ - 0.1, fbSpanX1, fbDeckY - 0.35, fbZ + 0.1, PALETTE.footbridgeSteel)

  // Concrete support piers descending to ground street level (Y = -12)
  midGeo.cyl(-9.0, -12, fbZ, 0.45, fbDeckY + 12 - 0.35, PALETTE.footbridgeConcrete, 6)
  midGeo.cyl(-5.2, -12, fbZ, 0.4, fbDeckY + 12 - 0.35, PALETTE.footbridgeConcrete, 6)

  // Guard rails & colored panels on both sides
  for (const side of [-1, 1]) {
    const rZ = fbZ + side * (fbDeckW / 2 - 0.08)
    // Handrail
    midGeo.span(fbSpanX0, fbDeckY + 1.05, rZ - 0.04, fbSpanX1, fbDeckY + 1.12, rZ + 0.04, PALETTE.catenarySteel)
    // Lower colored panels (matching Hoi Pong Road green/grey tones)
    midGeo.span(fbSpanX0, fbDeckY + 0.08, rZ - 0.03, fbSpanX1, fbDeckY + 0.55, rZ + 0.03, PALETTE.footbridgePanel1)
    // Vertical railing stanchions
    for (let px = fbSpanX0 + 0.8; px <= fbSpanX1 - 0.8; px += 1.8) {
      midGeo.cyl(px, fbDeckY, rZ, 0.035, 1.1, PALETTE.footbridgeSteelLight, 4)
    }
  }

  // Pitched steel roof canopy
  const roofY = fbDeckY + 2.7
  midGeo.span(fbSpanX0 - 0.4, roofY, fbZ - fbDeckW / 2 - 0.4, fbSpanX1 + 0.4, roofY + 0.14, fbZ + fbDeckW / 2 + 0.4, PALETTE.footbridgeRoof)
  // Dark edge trim
  midGeo.span(fbSpanX0 - 0.4, roofY - 0.12, fbZ - fbDeckW / 2 - 0.42, fbSpanX1 + 0.4, roofY, fbZ - fbDeckW / 2 - 0.36, PALETTE.footbridgeRoofTrim)
  midGeo.span(fbSpanX0 - 0.4, roofY - 0.12, fbZ + fbDeckW / 2 + 0.36, fbSpanX1 + 0.4, roofY, fbZ + fbDeckW / 2 + 0.42, PALETTE.footbridgeRoofTrim)

  // Canopy support posts
  for (let px = fbSpanX0 + 0.5; px <= fbSpanX1 - 0.5; px += 2.4) {
    midGeo.cyl(px, fbDeckY, fbZ - fbDeckW / 2 + 0.1, 0.045, 2.7, PALETTE.footbridgeSteel, 4)
    midGeo.cyl(px, fbDeckY, fbZ + fbDeckW / 2 - 0.1, 0.045, 2.7, PALETTE.footbridgeSteel, 4)
    // Warm glowing ceiling lamps under canopy
    midGeo.box(px, roofY - 0.08, fbZ, 0.35, 0.1, 0.8, PALETTE.footbridgeLamp)
  }

  // Staircase flight descending towards street
  const stairSteps = 16
  const stairW = 2.2
  for (let s = 0; s < stairSteps; s++) {
    const t = s / stairSteps
    const sy = fbDeckY - t * 4.2
    const sz = fbZ + fbDeckW / 2 + s * 0.45
    midGeo.span(-5.5 - stairW / 2, sy - 0.25, sz, -5.5 + stairW / 2, sy, sz + 0.48, PALETTE.footbridgeDeckDark)
    // Yellow nosing line on steps
    midGeo.span(-5.5 - stairW / 2 + 0.1, sy - 0.02, sz + 0.42, -5.5 + stairW / 2 - 0.1, sy + 0.01, sz + 0.48, PALETTE.footbridgeNosing)
  }

  // --- ZONE 5 (Z = -405 to -470, ~65m): Dense Urban Shadows to Black (t = 45.0 to 52.0s) ---
  const z5Blocks = [
    { x: -5.4, z: -418, w: 6.2, d: 13, h: 19, c: PALETTE.ochreDark },
    { x: -8.2, z: -436, w: 8.0, d: 15, h: 22, c: PALETTE.concreteWeathered },
    { x: -6.0, z: -454, w: 6.5, d: 13, h: 18, c: PALETTE.peachFaded },
  ]
  for (const b of z5Blocks) {
    addTenement(b.x, b.z, b.w, b.d, b.h, b.c, { acUnits: true, waterTank: true, litRatio: 8 })
  }

  const midMat = own(new MeshBasicMaterial({ vertexColors: true, map: retroTexture('plaster'), side: DoubleSide, fog: false }))
  const midMesh = new Mesh(own(midGeo.build({ tile: 4 })), midMat)
  group.add(midMesh)

  // Distinctive Mei Wah Cafe rooftop sign mounted right behind the footbridge at Z = -370
  const landmarkGroup = new Group()
  const landmarkTex = own(createLandmarkSignTexture())
  const landmarkMat = own(new MeshBasicMaterial({ map: landmarkTex, side: DoubleSide, fog: false }))
  const landmarkGeo = own(new PlaneGeometry(3.6, 1.8))
  const landmarkMesh = new Mesh(landmarkGeo, landmarkMat)
  landmarkMesh.position.set(-6.2, 5.2, 0)
  landmarkMesh.rotation.y = Math.PI / 2

  const lmFrameGeo = new Geo()
  lmFrameGeo.span(-6.3, 3.8, -1.6, -6.1, 5.2, -1.4, '#444a50')
  lmFrameGeo.span(-6.3, 3.8, 1.4, -6.1, 5.2, 1.6, '#444a50')
  const lmFrameMesh = new Mesh(own(lmFrameGeo.build({ tile: 4 })), midMat)
  landmarkGroup.add(lmFrameMesh, landmarkMesh)
  group.add(landmarkGroup)

  // =========================================================================
  // 4. LAYER 1: FOREGROUND TRACKSIDE VIADUCT, CATENARY MASTS & POWER CABLES (X = -1.8 to -3.8)
  // Fast parallax, seamless looping chunk (26 m/s)
  // =========================================================================
  const fgGeo = new Geo()
  const fgLength = 60

  // 4a. Concrete Parapet Wall (just below window sill at Y = 0.82)
  fgGeo.span(-2.35, -0.6, -fgLength / 2, -1.9, 0.74, fgLength / 2, PALETTE.viaductWall)
  fgGeo.span(-2.4, 0.74, -fgLength / 2, -1.85, 0.81, fgLength / 2, PALETTE.viaductTop)
  // Track ballast bed
  fgGeo.span(-2.7, -0.65, -fgLength / 2, -1.4, -0.45, fgLength / 2, PALETTE.trackBallast)
  // Cable tray with conduit
  fgGeo.span(-2.0, 0.25, -fgLength / 2, -1.88, 0.42, fgLength / 2, PALETTE.cableTray)

  // 4b. Catenary Electrification Masts every 15 meters along track
  for (let cz = -fgLength / 2; cz <= fgLength / 2; cz += 15) {
    // Vertical steel H-beam mast
    fgGeo.cyl(-2.25, 0.74, cz, 0.055, 3.6, PALETTE.catenarySteel, 4)
    // Cantilever support arm reaching out over the track
    fgGeo.span(-2.25, 4.15, cz - 0.04, -1.25, 4.25, cz + 0.04, PALETTE.catenarySteel)
    fgGeo.rod([-2.25, 3.6, cz], [-1.45, 4.18, cz], 0.025, PALETTE.catenarySteel, 4)

    // Trackside railway aspect signals on select masts
    if (cz === 0 || cz === 30) {
      fgGeo.box(-2.05, 1.5, cz, 0.14, 0.52, 0.14, '#1c1f22')
      fgGeo.cyl(-1.96, 1.62, cz, 0.042, 0.06, PALETTE.signalGreen, 5)
      fgGeo.cyl(-1.96, 1.48, cz, 0.042, 0.06, PALETTE.signalAmber, 5)
      fgGeo.cyl(-1.96, 1.34, cz, 0.042, 0.06, PALETTE.signalRed, 5)
    }

    // Concrete mast foundation block
    fgGeo.box(-2.25, 0.85, cz, 0.28, 0.26, 0.28, PALETTE.concreteDark)
  }

  // 4c. Continuous Overhead Electrification Wires (Catenary & Contact wire)
  // Running through upper view of the window
  fgGeo.rod([-1.48, 4.16, -fgLength / 2], [-1.48, 4.16, fgLength / 2], 0.012, PALETTE.catenaryWire, 3)
  fgGeo.rod([-1.48, 3.62, -fgLength / 2], [-1.48, 3.62, fgLength / 2], 0.009, PALETTE.catenaryWire, 3)

  const fgMat = own(new MeshBasicMaterial({ vertexColors: true, map: retroTexture('concrete'), side: DoubleSide, fog: false }))
  const fgMeshA = new Mesh(own(fgGeo.build({ tile: 3 })), fgMat)
  const fgMeshB = new Mesh(fgMeshA.geometry, fgMat)
  group.add(fgMeshA, fgMeshB)

  // =========================================================================
  // ANIMATION & MOTION CONTROLLER
  // =========================================================================
  let fgScroll = 0
  let bgScroll = 0
  let midJourneyPos = 0

  return {
    group,
    update(time: number, dt: number, speed: number) {
      // 1. Motion physics: Train moves in -Z, scenery scrolls in +Z
      // Layer 1: Foreground trackside rushes past rapidly (26 m/s)
      fgScroll += speed * 26.0 * dt
      const fz = fgScroll % fgLength
      fgMeshA.position.z = fz
      fgMeshB.position.z = fz - fgLength

      // Layer 3: Distant mountains & skyline move with slow, majestic parallax (2.2 m/s)
      bgScroll += speed * 2.2 * dt
      const bz = bgScroll % bgLength
      bgMeshA.position.z = bz
      bgMeshB.position.z = bz - bgLength

      // Layer 2: Midground continuous narrative journey (10.0 m/s)
      // Travels through the 470m authored progression from t = 0 to t = 50s
      // Synchronized with monologue and cinematic reveal
      midJourneyPos += speed * 10.0 * dt
      midMesh.position.z = midJourneyPos
      landmarkGroup.position.z = -370 + midJourneyPos

      // 2. Realistic Sunrise Progression:
      // t = 0 - 8.5s: deep pre-dawn (05:21 AM)
      // t = 8.5 - 22.0s: dawn subtly stirs along horizon
      // t = 22.0 - 34.0s: THE GRAND REVEAL (soft morning light illuminates mountains and skyline)
      // t = 34.0 - 52.0s: settled, peaceful dawn
      let dawnAmount: number
      if (time <= 8.5) {
        dawnAmount = 0.04 * (time / 8.5)
      } else if (time <= 22.0) {
        dawnAmount = 0.04 + 0.38 * ((time - 8.5) / 13.5)
      } else if (time <= 34.0) {
        // Grand reveal dawn bloom
        dawnAmount = 0.42 + 0.52 * ((time - 22.0) / 12.0)
      } else {
        dawnAmount = 0.94 + 0.06 * Math.min(1, (time - 34.0) / 10.0)
      }

      skyTex.update(dawnAmount)

      // Background mountain tint shifts subtly with morning dawn
      if (dawnAmount > 0.2) {
        const bgTint = new Color('#323c4e').lerp(new Color('#4e4456'), dawnAmount * 0.6)
        bgMat.color.copy(bgTint)
      }
    },

    dispose() {
      for (const d of disposables) d.dispose()
      group.clear()
    },
  }
}
