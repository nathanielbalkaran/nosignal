import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import type { SignTone } from '../../world/signage.ts'

/*
 * Small procedural textures: a sign atlas, a protective-mesh pattern and a soft
 * glow. All are drawn with the canvas at start-up, so there are no image
 * assets to license or ship.
 */

/** System CJK fonts, in order of preference, then a generic fallback. */
const CJK_FONT = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "Heiti TC", "Hiragino Sans CNS", "Noto Sans CJK TC", "Source Han Sans TC", "WenQuanYi Micro Hei", sans-serif'
const LATIN_FONT = '"Helvetica Neue", Arial, "Liberation Sans", sans-serif'

interface TonePalette {
  bg: string
  fg: string
  rim: string
}

const TONES: Readonly<Record<SignTone, TonePalette>> = {
  white: { bg: '#d6d3c8', fg: '#9c3b33', rim: '#8a877c' },
  cream: { bg: '#cbbf9c', fg: '#5b3a2b', rim: '#8d8062' },
  yellow: { bg: '#c9a84e', fg: '#2b2a28', rim: '#8d7633' },
  red: { bg: '#8c3d36', fg: '#ecdcae', rim: '#5d2723' },
  green: { bg: '#3f6a56', fg: '#ebe6d2', rim: '#284636' },
  blue: { bg: '#38587c', fg: '#e8e8de', rim: '#243a54' },
  charcoal: { bg: '#2b2d31', fg: '#d9b86a', rim: '#17181b' },
  teal: { bg: '#2f6b69', fg: '#eae8da', rim: '#1e4745' },
}

export const PLATE_PALETTE: TonePalette = { bg: '#28445f', fg: '#eef0ea', rim: '#e4e6de' }
export const TRANSIT_PALETTE: TonePalette = { bg: '#2c5a86', fg: '#f0f2ec', rim: '#dfe4e6' }

const CELL_H = { w: 256, h: 64 }
const CELL_V = { w: 64, h: 256 }
const H_COLS = 6
const H_ROWS = 32
const V_COLS = 12
const V_ROWS = 8
const ATLAS_W = CELL_H.w * H_COLS + CELL_V.w * V_COLS
const ATLAS_H = CELL_H.h * H_ROWS

type Painter = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void

export type UvRect = readonly [number, number, number, number]

/**
 * A texture atlas filled on demand. Asking for a slot returns its UV rectangle
 * straight away; the pixels are painted once, in `finish()`.
 */
export class SignAtlas {
  private readonly slots = new Map<string, UvRect>()
  private readonly jobs: { x: number; y: number; w: number; h: number; paint: Painter }[] = []
  private nextH = 0
  private nextV = 0
  texture: Texture | null = null

  private uv(x: number, y: number, w: number, h: number): UvRect {
    // Canvas y runs down, texture v runs up.
    const inset = 0.5
    return [(x + inset) / ATLAS_W, 1 - (y + h - inset) / ATLAS_H, (x + w - inset) / ATLAS_W, 1 - (y + inset) / ATLAS_H]
  }

  private slot(key: string, vertical: boolean, paint: Painter): UvRect {
    const existing = this.slots.get(key)
    if (existing) return existing
    let x: number
    let y: number
    const cell = vertical ? CELL_V : CELL_H
    if (vertical) {
      if (this.nextV >= V_COLS * V_ROWS) throw new Error('Sign atlas is full (vertical signs)')
      const i = this.nextV++
      x = CELL_H.w * H_COLS + (i % V_COLS) * CELL_V.w
      y = Math.floor(i / V_COLS) * CELL_V.h
    } else {
      if (this.nextH >= H_COLS * H_ROWS) throw new Error('Sign atlas is full (horizontal signs)')
      const i = this.nextH++
      x = (i % H_COLS) * CELL_H.w
      y = Math.floor(i / H_COLS) * CELL_H.h
    }
    const rect = this.uv(x, y, cell.w, cell.h)
    this.slots.set(key, rect)
    this.jobs.push({ x, y, w: cell.w, h: cell.h, paint })
    return rect
  }

  /** A horizontal shop sign: Chinese name with an optional English line. */
  fascia(zh: string, en: string | undefined, tone: SignTone): UvRect {
    return this.slot(`f:${zh}:${en ?? ''}:${tone}`, false, (c, x, y, w, h) => paintBoard(c, x, y, w, h, TONES[tone], zh, en))
  }

  /** A tall projecting sign with the name stacked top to bottom. */
  vertical(zh: string, tone: SignTone): UvRect {
    return this.slot(`v:${zh}:${tone}`, true, (c, x, y, w, h) => paintVertical(c, x, y, w, h, TONES[tone], zh))
  }

  plate(zh: string, en: string, kind: 'street' | 'transit'): UvRect {
    const pal = kind === 'street' ? PLATE_PALETTE : TRANSIT_PALETTE
    return this.slot(`p:${kind}:${zh}:${en}`, false, (c, x, y, w, h) => paintBoard(c, x, y, w, h, pal, zh, en, true))
  }

  finish(): Texture {
    if (this.texture) return this.texture
    const canvas = document.createElement('canvas')
    canvas.width = ATLAS_W
    canvas.height = ATLAS_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.fillStyle = '#444'
    ctx.fillRect(0, 0, ATLAS_W, ATLAS_H)
    for (const j of this.jobs) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(j.x, j.y, j.w, j.h)
      ctx.clip()
      j.paint(ctx, j.x, j.y, j.w, j.h)
      ctx.restore()
    }
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.generateMipmaps = true
    t.minFilter = LinearMipmapLinearFilter
    t.magFilter = LinearFilter
    t.anisotropy = 4
    this.texture = t
    return t
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: string, font: string, x: number, y: number) {
  ctx.font = `${weight} ${size}px ${font}`
  const w = ctx.measureText(text).width
  ctx.save()
  ctx.translate(x, y)
  if (w > maxWidth) ctx.scale(maxWidth / w, 1)
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

function paintBoard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pal: TonePalette, zh: string, en?: string, plate = false) {
  ctx.fillStyle = pal.rim
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = pal.bg
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
  if (plate) {
    ctx.strokeStyle = pal.rim
    ctx.lineWidth = 1.5
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12)
  }
  ctx.fillStyle = pal.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (en) {
    fitText(ctx, zh, w - 28, 32, '700', CJK_FONT, x + w / 2, y + h * 0.4)
    fitText(ctx, en, w - 28, 12, '700', LATIN_FONT, x + w / 2, y + h * 0.8)
  } else {
    fitText(ctx, zh, w - 28, 44, '700', CJK_FONT, x + w / 2, y + h / 2 + 1)
  }
}

function paintVertical(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pal: TonePalette, zh: string) {
  ctx.fillStyle = pal.rim
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = pal.bg
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
  ctx.fillStyle = pal.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const chars = [...zh]
  const step = Math.min(50, (h - 16) / chars.length)
  const top = y + h / 2 - ((chars.length - 1) * step) / 2
  chars.forEach((ch, i) => {
    ctx.font = `700 ${Math.min(44, step * 0.92)}px ${CJK_FONT}`
    ctx.fillText(ch, x + w / 2, top + i * step + 1)
  })
}

let atlas: SignAtlas | null = null
export function signAtlas(): SignAtlas {
  atlas ??= new SignAtlas()
  return atlas
}

/** A grid of thin wire on a transparent background, for protective mesh and fences. Use with alphaTest. */
export function makeMeshTexture(): Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  const step = 8
  for (let i = 0; i < size; i += step) {
    ctx.fillRect(i, 0, 2, size)
    ctx.fillRect(0, i, size, 2)
  }
  const t = new CanvasTexture(canvas)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

/** A soft round glow: bright centre fading to nothing. Used for light pools and lamp halos. */
export function makeGlowTexture(): Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}
