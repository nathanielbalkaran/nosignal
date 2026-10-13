import { type } from './typography.ts'
import type { CSSProperties } from 'react'
import { formatMinutes } from '../game/clock.ts'
import { session, useGame } from '../game/session.ts'
import { hintStyle, LOCK_HINT, restartGame, screen } from './theme.ts'

const wrap: CSSProperties = { ...screen, background: '#000', zIndex: 12 }
const title: CSSProperties = { ...type.display, fontSize: 'clamp(32px, 5vw, 56px)', margin: 0, paddingLeft: '0.3em' }
const time: CSSProperties = { ...type.clock, margin: '24px 0 8px', color: '#d9a36a' }
const line: CSSProperties = { ...type.body, margin: 0, opacity: 0.8 }
const buttons: CSSProperties = { display: 'flex', gap: 22, marginTop: 46 }

function remainingText(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  const parts: string[] = []
  if (m > 0) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  if (s > 0 || m === 0) parts.push(`${s} second${s === 1 ? '' : 's'}`)
  return `${parts.join(' ')} remaining.`
}

/** Win and loss screen: fades to black, then the text. All figures come from the game clock. */
export function EndScreen() {
  const { state, result, lockBlocked } = useGame()
  if (!result) return null
  const won = state === 'WON'
  return (
    <div style={wrap} className="ns-fade-black">
      <div className="ns-fade-late" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 style={title}>{won ? 'YOU MADE IT.' : 'TRAIN DEPARTED'}</h1>
        <p style={time}>{formatMinutes(result.elapsedMs)} AM</p>
        <p style={line}>{won ? remainingText(result.remainingMs) : 'You missed your train.'}</p>
        <div style={buttons}>
          <button type="button" className="ns-btn" onClick={restartGame}>{won ? 'PLAY AGAIN' : 'TRY AGAIN'}</button>
          <button type="button" className="ns-btn" onClick={() => session.toTitle()}>MAIN MENU</button>
        </div>
        {lockBlocked && <p style={hintStyle}>{LOCK_HINT}</p>}
      </div>
    </div>
  )
}
