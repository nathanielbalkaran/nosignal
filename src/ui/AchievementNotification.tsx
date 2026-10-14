import { useEffect, useState, type CSSProperties } from 'react'
import { ACHIEVEMENT_DEFS, useAchievements, type AchievementDef } from '../game/achievements.ts'
import { PRIMARY } from './typography.ts'

/*
 * A small, non-intrusive achievement notification in the top-right corner.
 * Appears for ~4 seconds, fades out; never interrupts gameplay. Reuses the
 * existing retro UI palette and fonts.
 */

const SHOW_MS = 4000
const FADE_MS = 600

const wrap: CSSProperties = {
  position: 'fixed',
  top: 24,
  right: 22,
  width: 220,
  padding: '10px 14px 12px',
  background: 'rgba(14, 13, 20, 0.90)',
  border: '1px solid rgba(232, 228, 220, 0.35)',
  color: '#e8e4dc',
  fontFamily: PRIMARY,
  zIndex: 20,
  pointerEvents: 'none',
  userSelect: 'none',
  transition: `opacity ${FADE_MS}ms ease`,
}

const label: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.26em',
  color: '#d9a36a',
  margin: '0 0 4px',
}

const title: CSSProperties = {
  fontSize: 15,
  letterSpacing: '0.18em',
  fontWeight: 600,
  margin: '0 0 3px',
}

const desc: CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.08em',
  opacity: 0.72,
  margin: 0,
}

export function AchievementNotification() {
  const { latest } = useAchievements()
  const [currentDef, setCurrentDef] = useState<AchievementDef | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!latest) return
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === latest) ?? null
    if (!def) return
    const showTimer = window.setTimeout(() => {
      setCurrentDef(def)
      setVisible(true)
    }, 0)
    const fadeTimer = window.setTimeout(() => {
      setVisible(false)
    }, SHOW_MS)

    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(fadeTimer)
    }
  }, [latest])

  if (!currentDef) return null

  return (
    <div style={{ ...wrap, opacity: visible ? 1 : 0 }}>
      <p style={label}>ACHIEVEMENT UNLOCKED</p>
      <p style={title}>{currentDef.title}</p>
      <p style={desc}>{currentDef.description}</p>
    </div>
  )
}
