import { type } from './typography.ts'
import { useSyncExternalStore, type CSSProperties } from 'react'
import { music } from '../audio/music/player.ts'
import { TRACKS } from '../audio/music/tracks.ts'

const panel: CSSProperties = {
  marginTop: 10,
  padding: '10px 14px 12px',
  minWidth: 260,
  background: 'rgba(14, 13, 20, 0.72)',
  border: '1px solid rgba(232, 228, 220, 0.22)',
  ...type.readout,
  cursor: 'default',
}

const heading: CSSProperties = { ...type.readout, letterSpacing: '0.15em', opacity: 0.9 }
const sub: CSSProperties = { ...type.readoutSmall, letterSpacing: '0.15em', opacity: 0.55, marginBottom: 8 }
const foot: CSSProperties = { ...type.readoutSmall, opacity: 0.55, marginTop: 8 }

const row = (selected: boolean): CSSProperties => ({
  display: 'flex',
  gap: 10,
  width: '100%',
  padding: '2px 4px',
  background: selected ? 'rgba(232, 228, 220, 0.14)' : 'transparent',
  border: 0,
  color: selected ? '#f2efe6' : 'rgba(232, 228, 220, 0.6)',
  font: 'inherit',
  letterSpacing: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
})

/** Compact soundtrack picker. Reusable; shown in the pause overlay. */
export function MusicSelector() {
  const { index } = useSyncExternalStore(music.subscribeState, music.getState)

  return (
    // Clicks here must not reach the overlay behind, which resumes play.
    <div style={panel} onClick={(e) => e.stopPropagation()}>
      <div style={heading}>NO SIGNAL FM</div>
      <div style={sub}>ORIGINAL SOUNDTRACK</div>
      {TRACKS.map((track, i) => (
        <button key={track.file} type="button" style={row(i === index)} onClick={() => music.select(i)} aria-pressed={i === index}>
          <span style={{ width: 10 }}>{i === index ? '>' : ''}</span>
          <span>{String(i + 1).padStart(2, '0')}</span>
          <span>{track.title}</span>
        </button>
      ))}
      <div style={foot}>N next · B previous</div>
    </div>
  )
}
