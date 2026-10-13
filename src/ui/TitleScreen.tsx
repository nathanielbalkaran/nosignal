import { type } from './typography.ts'
import type { CSSProperties } from 'react'
import { useGame } from '../game/session.ts'
import { hintStyle, LOCK_HINT, screen, startGame } from './theme.ts'

const wrap: CSSProperties = {
  ...screen,
  background: 'radial-gradient(ellipse at center, rgba(10, 10, 16, 0.78) 0%, rgba(6, 6, 10, 0.94) 100%)',
}
const title: CSSProperties = { ...type.display, fontSize: 'clamp(40px, 8vw, 84px)', margin: 0, paddingLeft: '0.3em' }
const time: CSSProperties = { ...type.clock, margin: '32px 0 12px', color: '#d9a36a' }
const lines: CSSProperties = { ...type.body, lineHeight: 1.7, margin: 0, textAlign: 'center', opacity: 0.8 }
const buttons: CSSProperties = { display: 'flex', gap: 22, margin: '48px 0 44px' }
const controls: CSSProperties = { ...type.small, lineHeight: 1.9, opacity: 0.6 }

/** Shown until the player picks a mode. The scene stays mounted behind it. */
export function TitleScreen() {
  const { lockBlocked } = useGame()
  return (
    <div style={wrap} className="ns-fade-in">
      <h1 style={title}>NO SIGNAL</h1>
      <p style={time}>05:12 AM</p>
      <p style={lines}>
        Your phone is dead.
        <br />
        Your train departs at 05:21.
      </p>
      <div style={buttons}>
        <button type="button" className="ns-btn" onClick={() => startGame('PLAY')}>PLAY</button>
        <button type="button" className="ns-btn" onClick={() => startGame('EXPLORE')}>EXPLORE</button>
      </div>
      <div style={controls}>
        <div>WASD — MOVE</div>
        <div>MOUSE — LOOK</div>
        <div>E — INTERACT</div>
        <div>T — CHECK TIME</div>
        <div>ESC — PAUSE</div>
      </div>
      {lockBlocked && <p style={hintStyle}>{LOCK_HINT}</p>}
    </div>
  )
}
