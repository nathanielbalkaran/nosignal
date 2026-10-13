import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { session } from '../game/session.ts'
import { SECONDARY } from './typography.ts'

/*
 * LAST STOP. A small character at the bottom of the screen, debris falling from
 * above, and a score that is just how long you lasted. Drawn on one canvas at a
 * low internal resolution and scaled up, so it looks like it belongs in the
 * cabinet. Nothing is saved and nothing carries over: retry starts clean.
 */

const WIDTH = 160
const HEIGHT = 200
/** A run ends on its own after this long, as a small mercy. */
const LIMIT = 40
const PLAYER_W = 12
const PLAYER_H = 8
const SPEED = 78

interface Debris {
  x: number
  y: number
  w: number
  h: number
  vy: number
  /** 0 floor, 1 beam, 2 narrow. */
  kind: number
}

interface Run {
  x: number
  t: number
  next: number
  debris: Debris[]
  over: boolean
  /** -1 left, 1 right, 0 still. */
  dir: number
}

const fresh = (): Run => ({ x: WIDTH / 2, t: 0, next: 0.6, debris: [], over: false, dir: 0 })

function step(run: Run, dt: number) {
  if (run.over) return
  run.t += dt
  run.x = Math.max(PLAYER_W / 2, Math.min(WIDTH - PLAYER_W / 2, run.x + run.dir * SPEED * dt))
  // The fall gets quicker, but only up to a point.
  const pace = 1 + Math.min(1.6, run.t / 18)
  run.next -= dt
  if (run.next <= 0) {
    run.next = Math.max(0.32, 0.85 - run.t / 90)
    const kind = run.t > 12 && Math.random() < 0.3 ? 2 : Math.random() < 0.5 ? 0 : 1
    const w = kind === 2 ? 6 : kind === 0 ? 22 : 14
    run.debris.push({ x: Math.random() * (WIDTH - w), y: -10, w, h: kind === 1 ? 6 : 4, vy: (28 + Math.random() * 18) * pace, kind })
  }
  const px0 = run.x - PLAYER_W / 2
  const py0 = HEIGHT - 16 - PLAYER_H
  for (const d of run.debris) {
    d.y += d.vy * dt
    const hit = d.x < px0 + PLAYER_W && d.x + d.w > px0 && d.y < py0 + PLAYER_H && d.y + d.h > py0
    if (hit) run.over = true
  }
  run.debris = run.debris.filter((d) => d.y < HEIGHT + 8)
  if (run.t >= LIMIT) run.over = true
}

const INK = '#d6e2c2'
const DIM = '#3c4a38'
const FRAME = '#10140e'

function draw(ctx: CanvasRenderingContext2D, run: Run) {
  ctx.fillStyle = FRAME
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  // A faint floor line and a scrolling suggestion of track.
  ctx.fillStyle = DIM
  const scroll = Math.floor(run.t * 30) % 12
  for (let y = scroll; y < HEIGHT; y += 12) ctx.fillRect(WIDTH / 2 - 1, y, 2, 5)
  ctx.fillRect(0, HEIGHT - 15, WIDTH, 1)

  ctx.fillStyle = INK
  for (const d of run.debris) {
    ctx.globalAlpha = d.kind === 2 ? 1 : 0.85
    ctx.fillRect(Math.round(d.x), Math.round(d.y), d.w, d.h)
  }
  ctx.globalAlpha = 1
  // The player: a small block with a lighter top, so it reads as a head and shoulders.
  const px = Math.round(run.x - PLAYER_W / 2)
  const py = HEIGHT - 16 - PLAYER_H
  ctx.fillRect(px, py + 3, PLAYER_W, PLAYER_H - 3)
  ctx.fillRect(px + 3, py, PLAYER_W - 6, 4)

  ctx.font = '8px "VT323", monospace'
  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  ctx.fillText('LAST STOP', 4, 10)
  ctx.textAlign = 'right'
  const score = Math.min(LIMIT, run.t).toFixed(0).padStart(4, '0')
  ctx.fillText(score, WIDTH - 4, 10)
}

const bezel: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  background: 'radial-gradient(circle at 50% 45%, #1a120c 0%, #0a090c 70%)',
  zIndex: 7,
}
const screen: CSSProperties = { width: 'min(480px, 70vw)', aspectRatio: `${WIDTH} / ${HEIGHT}`, imageRendering: 'pixelated', background: FRAME, border: '10px solid #2a2118', boxShadow: '0 0 0 2px #6a5438' }
const overStyle: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(8, 10, 8, 0.72)' }
const title: CSSProperties = { fontFamily: SECONDARY, fontSize: 42, letterSpacing: '0.14em', color: '#d6e2c2', margin: 0 }
const row: CSSProperties = { display: 'flex', gap: 10 }

export function ArcadeGame() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const run = useRef<Run>(fresh())
  const [over, setOver] = useState(false)
  const [survived, setSurvived] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    c.width = WIDTH
    c.height = HEIGHT
    let last = performance.now()
    let frame = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const playing = session.getSnapshot().state === 'PLAYING'
      if (playing && !run.current.over) step(run.current, dt)
      draw(ctx, run.current)
      if (run.current.over) {
        setOver(true)
        setSurvived(run.current.t >= LIMIT)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [attempt])

  useEffect(() => {
    const held = new Set<string>()
    const apply = () => {
      const left = held.has('ArrowLeft') || held.has('KeyA')
      const right = held.has('ArrowRight') || held.has('KeyD')
      run.current.dir = left === right ? 0 : left ? -1 : 1
    }
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (session.getSnapshot().state !== 'PLAYING') return
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault()
        held.add(e.code)
        apply()
      } else if (e.code === 'KeyR' && run.current.over) {
        run.current = fresh()
        setOver(false)
        setSurvived(false)
        setAttempt((n) => n + 1)
      } else if (e.code === 'KeyQ') session.leaveScene()
    }
    const up = (e: KeyboardEvent) => {
      held.delete(e.code)
      apply()
    }
    const blur = () => {
      held.clear()
      run.current.dir = 0
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const retry = () => {
    run.current = fresh()
    setOver(false)
    setSurvived(false)
    setAttempt((n) => n + 1)
  }

  return (
    <div style={bezel} className="ns-fade-in">
      <div style={{ position: 'relative' }}>
        <canvas ref={canvas} style={screen} />
        {over && (
          <div style={overStyle}>
            <p style={title}>{survived ? 'CLEAR' : 'GAME OVER'}</p>
            <div style={row}>
              <button type="button" className="ns-btn" onClick={retry}>[R] RETRY</button>
              <button type="button" className="ns-btn" onClick={() => session.leaveScene()}>[Q] EXIT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
