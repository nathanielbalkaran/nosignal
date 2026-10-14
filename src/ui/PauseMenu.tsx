import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { session, useGame } from '../game/session.ts'
import { AudioSliders } from './AudioSliders.tsx'
import { MusicSelector } from './MusicSelector.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'
import { restartGame, resumeGame } from './theme.ts'
import { ACHIEVEMENT_DEFS, useAchievements } from '../game/achievements.ts'
import { SECONDARY } from './typography.ts'

type Section = 'SETTINGS' | 'MUSIC' | 'ACHIEVEMENTS'
type NavItemId = 'RESUME' | 'RESTART' | 'SETTINGS' | 'MUSIC' | 'ACHIEVEMENTS' | 'MAIN MENU'

interface NavItem {
  id: NavItemId
  label: string
  isSection: boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'RESUME', label: 'RESUME', isSection: false },
  { id: 'RESTART', label: 'RESTART', isSection: false },
  { id: 'SETTINGS', label: 'SETTINGS', isSection: true },
  { id: 'MUSIC', label: 'MUSIC', isSection: true },
  { id: 'ACHIEVEMENTS', label: 'ACHIEVEMENTS', isSection: true },
  { id: 'MAIN MENU', label: 'MAIN MENU', isSection: false },
]

/* --- Achievements subcomponent --- */
const achProgressWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 16,
}

const achProgressBarTrack: CSSProperties = {
  height: 6,
  background: 'rgba(232, 228, 220, 0.12)',
  border: '1px solid rgba(232, 228, 220, 0.18)',
  position: 'relative',
}

const achProgressBarFill = (pct: number): CSSProperties => ({
  height: '100%',
  width: `${pct}%`,
  background: 'linear-gradient(90deg, #d9a36a, #f0c28d)',
  boxShadow: '0 0 8px rgba(217, 163, 106, 0.4)',
  transition: 'width 0.3s ease',
})

const achGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px 12px',
}

const achCard = (unlocked: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '8px 12px',
  background: unlocked ? 'rgba(217, 163, 106, 0.08)' : 'rgba(232, 228, 220, 0.03)',
  border: `1px solid ${unlocked ? 'rgba(217, 163, 106, 0.35)' : 'rgba(232, 228, 220, 0.1)'}`,
  opacity: unlocked ? 1 : 0.45,
  transition: 'border-color 0.15s',
})

const achCardHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const achTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.14em',
  color: '#f2efe6',
  margin: 0,
}

const achTag = (unlocked: boolean): CSSProperties => ({
  fontFamily: SECONDARY,
  fontSize: 14,
  letterSpacing: '0.1em',
  color: unlocked ? '#d9a36a' : 'rgba(232, 228, 220, 0.35)',
})

const achDesc: CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.06em',
  color: 'rgba(232, 228, 220, 0.7)',
  margin: 0,
  lineHeight: 1.3,
}

function AchievementsSection() {
  const { unlocked } = useAchievements()
  const count = unlocked.size
  const total = ACHIEVEMENT_DEFS.length
  const pct = Math.round((count / total) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
      <div className="ns-section-header">
        <h2 className="ns-section-title">ACHIEVEMENTS</h2>
        <span className="ns-section-subhead">{count} / {total} DISCOVERED ({pct}%)</span>
      </div>

      <div style={achProgressWrap}>
        <div style={achProgressBarTrack}>
          <div style={achProgressBarFill(pct)} />
        </div>
      </div>

      <div style={achGrid}>
        {ACHIEVEMENT_DEFS.map((def) => {
          const done = unlocked.has(def.id)
          return (
            <div key={def.id} style={achCard(done)}>
              <div style={achCardHeader}>
                <span style={achTitle}>{done ? `◆ ${def.title}` : '◇ ???'}</span>
                <span style={achTag(done)}>{done ? 'UNLOCKED' : 'LOCKED'}</span>
              </div>
              <p style={achDesc}>
                {done ? def.description : 'Undiscovered district secret.'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Redesigned early-GTA-inspired two-column pause menu for No Signal. */
export function PauseMenu() {
  const { mode } = useGame()
  const [activeSection, setActiveSection] = useState<Section>('SETTINGS')
  const focusedIndexRef = useRef<number>(2) // Index of 'SETTINGS' initially
  const navRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleAction = (item: NavItem) => {
    switch (item.id) {
      case 'RESUME':
        resumeGame()
        break
      case 'RESTART':
        restartGame()
        break
      case 'SETTINGS':
      case 'MUSIC':
      case 'ACHIEVEMENTS':
        setActiveSection(item.id)
        break
      case 'MAIN MENU':
        session.toTitle()
        break
    }
  }

  // Keyboard navigation: Escape to resume, Arrow Up/Down to navigate vertical menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        resumeGame()
        return
      }

      // If user is actively adjusting sliders with arrow keys, let that handle it
      if (e.target instanceof HTMLInputElement && e.target.type === 'range') {
        return
      }

      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        const next = (focusedIndexRef.current + 1) % NAV_ITEMS.length
        focusedIndexRef.current = next
        const nextItem = NAV_ITEMS[next]
        if (nextItem.isSection) {
          setActiveSection(nextItem.id as Section)
        }
        navRefs.current[next]?.focus()
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        const next = (focusedIndexRef.current - 1 + NAV_ITEMS.length) % NAV_ITEMS.length
        focusedIndexRef.current = next
        const nextItem = NAV_ITEMS[next]
        if (nextItem.isSection) {
          setActiveSection(nextItem.id as Section)
        }
        navRefs.current[next]?.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ns-pause-overlay ns-fade-in" role="dialog" aria-modal="true" aria-label="Pause Menu">
      <div className="ns-pause-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <header className="ns-pause-header">
          <h1 className="ns-pause-title">PAUSED</h1>
          <span className="ns-pause-subtitle">
            {mode === 'PLAY' ? 'PLAY MODE · 05:12 AM' : 'EXPLORE MODE · NO LIMIT'}
          </span>
        </header>

        {/* Two-column layout */}
        <div className="ns-pause-grid">
          {/* Left Column: Large Vertical Navigation */}
          <nav className="ns-pause-nav" aria-label="Pause navigation">
            {NAV_ITEMS.map((item, idx) => {
              const isSelectedSection = item.isSection && activeSection === item.id
              return (
                <button
                  key={item.id}
                  ref={(el) => { navRefs.current[idx] = el }}
                  type="button"
                  className={`ns-pause-nav-btn ${isSelectedSection ? 'active' : ''}`}
                  onClick={() => {
                    focusedIndexRef.current = idx
                    handleAction(item)
                  }}
                  onMouseEnter={() => {
                    if (item.isSection) {
                      setActiveSection(item.id as Section)
                    }
                    focusedIndexRef.current = idx
                  }}
                  aria-current={isSelectedSection ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  {isSelectedSection && <span className="ns-pause-nav-arrow" aria-hidden="true">▶</span>}
                </button>
              )
            })}
          </nav>

          {/* Right Column: Active Section Content */}
          <section className="ns-pause-panel" aria-live="polite">
            {activeSection === 'SETTINGS' && <SettingsPanel />}

            {activeSection === 'MUSIC' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onClick={(e) => e.stopPropagation()}>
                <div className="ns-section-header">
                  <h2 className="ns-section-title">NO SIGNAL FM</h2>
                  <span className="ns-section-subhead">ORIGINAL SOUNDTRACK · 98.4 MHZ</span>
                </div>
                <MusicSelector />
                <div style={{ height: 1, background: 'rgba(232, 228, 220, 0.12)', margin: '4px 0' }} />
                <AudioSliders />
              </div>
            )}

            {activeSection === 'ACHIEVEMENTS' && <AchievementsSection />}
          </section>
        </div>
      </div>
    </div>
  )
}
