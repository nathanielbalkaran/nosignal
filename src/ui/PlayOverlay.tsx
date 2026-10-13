import type { CSSProperties } from 'react'
import { ambientAudio } from '../audio/ambient.ts'
import { music } from '../audio/music/player.ts'
import { session, useSessionStatus } from '../game/session.ts'
import { AudioSliders } from './AudioSliders.tsx'
import { MusicSelector } from './MusicSelector.tsx'

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  background: 'rgba(14, 13, 20, 0.55)',
  cursor: 'pointer',
  userSelect: 'none',
}

const title: CSSProperties = { fontSize: 44, letterSpacing: '0.3em', fontWeight: 600, margin: 0 }
const hint: CSSProperties = { fontSize: 14, opacity: 0.75, letterSpacing: '0.08em', margin: 0 }

/** Click-to-play gate required by pointer lock. Shown before starting and while paused. */
export function PlayOverlay() {
  const status = useSessionStatus()
  if (status === 'playing') return null

  return (
    <div style={backdrop} onClick={() => {
        ambientAudio.unlock()
        music.unlock()
        session.requestPlay()
      }}>
      <h1 style={title}>NO SIGNAL</h1>
      <p style={hint}>{status === 'ready' ? 'Click to begin' : 'Paused · click to resume'}</p>
      <p style={hint}>WASD to walk · mouse to look · Esc to pause</p>
      <MusicSelector />
      <AudioSliders />
    </div>
  )
}
