import { type } from './typography.ts'
import type { CSSProperties } from 'react'
import { session, useGame } from '../game/session.ts'
import { AudioSliders } from './AudioSliders.tsx'
import { MusicSelector } from './MusicSelector.tsx'
import { hintStyle, LOCK_HINT, restartGame, resumeGame, screen } from './theme.ts'

const wrap: CSSProperties = { ...screen, background: 'rgba(8, 8, 14, 0.78)', overflowY: 'auto', justifyContent: 'flex-start', padding: '5vh 0' }
const title: CSSProperties = { ...type.heading, margin: '0 0 22px', paddingLeft: '0.3em' }
const buttons: CSSProperties = { display: 'flex', gap: 14, marginBottom: 6 }

/** Pause menu. Compact, mouse-driven; reuses the existing music selector and sliders. */
export function PauseMenu() {
  const { lockBlocked } = useGame()
  return (
    <div style={wrap} className="ns-fade-in">
      <h1 style={title}>PAUSED</h1>
      <div style={buttons}>
        <button type="button" className="ns-btn" onClick={resumeGame}>RESUME</button>
        <button type="button" className="ns-btn" onClick={restartGame}>RESTART</button>
        <button type="button" className="ns-btn" onClick={() => session.toTitle()}>MAIN MENU</button>
      </div>
      {lockBlocked && <p style={hintStyle}>{LOCK_HINT}</p>}
      <MusicSelector />
      <AudioSliders />
    </div>
  )
}
