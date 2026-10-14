import { useSyncExternalStore, type CSSProperties } from 'react'
import { music } from '../audio/music/player.ts'
import { TRACKS } from '../audio/music/tracks.ts'
import { SECONDARY } from './typography.ts'

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const trackGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px 12px',
}

const foot: CSSProperties = {
  fontFamily: SECONDARY,
  fontSize: 16,
  letterSpacing: '0.1em',
  color: 'rgba(232, 228, 220, 0.55)',
  marginTop: 2,
}

/** Track selector for the NO SIGNAL FM original soundtrack. */
export function MusicSelector() {
  const { index } = useSyncExternalStore(music.subscribeState, music.getState)

  return (
    <div style={wrap} onClick={(e) => e.stopPropagation()}>
      <div style={trackGrid}>
        {TRACKS.map((track, i) => {
          const selected = i === index
          return (
            <button
              key={track.file}
              type="button"
              className={`ns-track-btn ${selected ? 'active' : ''}`}
              onClick={() => music.select(i)}
              aria-pressed={selected}
            >
              <span style={{ color: selected ? '#d9a36a' : 'rgba(232, 228, 220, 0.35)', width: 12 }}>
                {selected ? '▶' : ''}
              </span>
              <span style={{ fontFamily: SECONDARY, fontSize: 18, width: 22, opacity: selected ? 1 : 0.65 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.title}
              </span>
            </button>
          )
        })}
      </div>
      <div style={foot}>[ N ] NEXT TRACK · [ B ] PREVIOUS TRACK</div>
    </div>
  )
}
