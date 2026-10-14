import { type } from './typography.ts'
import type { CSSProperties } from 'react'
import { session, useGame } from '../game/session.ts'
import { AudioSliders } from './AudioSliders.tsx'
import { MusicSelector } from './MusicSelector.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'
import { hintStyle, LOCK_HINT, restartGame, resumeGame, screen } from './theme.ts'
import { ACHIEVEMENT_DEFS, useAchievements } from '../game/achievements.ts'

const wrap: CSSProperties = { ...screen, background: 'rgba(8, 8, 14, 0.78)', overflowY: 'auto', justifyContent: 'flex-start', padding: '5vh 0' }
const sectionTitle: CSSProperties = { ...type.heading, margin: '0 0 22px', paddingLeft: '0.3em' }
const buttons: CSSProperties = { display: 'flex', gap: 14, marginBottom: 6 }

const achSection: CSSProperties = { marginTop: 28, width: 'min(480px, calc(100vw - 48px))', paddingLeft: '0.3em' }
const achHeading: CSSProperties = { ...type.label, letterSpacing: '0.22em', color: '#d9a36a', margin: '0 0 10px' }
const achProgress: CSSProperties = { ...type.small, letterSpacing: '0.14em', opacity: 0.55, margin: '0 0 14px' }
const achList: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }
const achItem = (unlocked: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 12px',
  background: 'rgba(232, 228, 220, 0.04)',
  border: `1px solid ${unlocked ? 'rgba(217, 163, 106, 0.35)' : 'rgba(232, 228, 220, 0.10)'}`,
  opacity: unlocked ? 1 : 0.45,
})
const achTitle: CSSProperties = { ...type.small, letterSpacing: '0.2em', fontWeight: 600, margin: 0 }
const achDesc: CSSProperties = { ...type.small, fontSize: 12, opacity: 0.65, margin: 0 }

function AchievementsSection() {
  const { unlocked } = useAchievements()
  const count = unlocked.size
  const total = ACHIEVEMENT_DEFS.length
  return (
    <div style={achSection}>
      <p style={achHeading}>ACHIEVEMENTS</p>
      <p style={achProgress}>{count} / {total} DISCOVERED</p>
      <ul style={achList}>
        {ACHIEVEMENT_DEFS.map((def) => {
          const done = unlocked.has(def.id)
          return (
            <li key={def.id} style={achItem(done)}>
              <span style={achTitle}>{done ? def.title : '???'}</span>
              {done && <span style={achDesc}>{def.description}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Pause menu. Compact, mouse-driven; reuses the existing music selector and sliders. */
export function PauseMenu() {
  const { lockBlocked } = useGame()
  return (
    <div style={wrap} className="ns-fade-in">
      <h1 style={sectionTitle}>PAUSED</h1>
      <div style={buttons}>
        <button type="button" className="ns-btn" onClick={resumeGame}>RESUME</button>
        <button type="button" className="ns-btn" onClick={restartGame}>RESTART</button>
        <button type="button" className="ns-btn" onClick={() => session.toTitle()}>MAIN MENU</button>
      </div>
      {lockBlocked && <p style={hintStyle}>{LOCK_HINT}</p>}
      <SettingsPanel />
      <MusicSelector />
      <AudioSliders />
      <AchievementsSection />
    </div>
  )
}
