import { useSyncExternalStore, type CSSProperties } from 'react'
import { mixer, type Channel } from '../audio/mixer.ts'
import { SECONDARY } from './typography.ts'

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const heading: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '0.16em',
  color: '#f2efe6',
}

const muteBtn = (muted: boolean): CSSProperties => ({
  background: muted ? 'rgba(217, 163, 106, 0.22)' : 'rgba(232, 228, 220, 0.04)',
  border: `1px solid ${muted ? '#d9a36a' : 'rgba(232, 228, 220, 0.25)'}`,
  color: muted ? '#ffffff' : 'rgba(232, 228, 220, 0.75)',
  fontFamily: "'Pixelify Sans', ui-monospace, monospace",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.14em',
  padding: '4px 12px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
})

const sliderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const label: CSSProperties = {
  width: 90,
  fontSize: 13,
  letterSpacing: '0.12em',
  color: 'rgba(232, 228, 220, 0.75)',
  flexShrink: 0,
}

const valueReadout: CSSProperties = {
  fontFamily: SECONDARY,
  fontSize: 22,
  letterSpacing: '0.04em',
  width: 44,
  textAlign: 'right',
  color: '#f2efe6',
  flexShrink: 0,
}

const CHANNELS: readonly { channel: Channel; text: string }[] = [
  { channel: 'music', text: 'MUSIC' },
  { channel: 'ambience', text: 'AMBIENCE' },
  { channel: 'sfx', text: 'SFX' },
]

/** Audio level sliders and mute toggle for the pause menu. */
export function AudioSliders() {
  const volumes = useSyncExternalStore(mixer.subscribe, mixer.getVolumes)
  const muted = useSyncExternalStore(mixer.subscribe, mixer.isMusicMuted)

  return (
    <div style={wrap} onClick={(e) => e.stopPropagation()} role="group" aria-label="Audio">
      <div style={headerRow}>
        <span style={heading}>AUDIO LEVELS</span>
        <button
          type="button"
          style={muteBtn(muted)}
          aria-pressed={muted}
          onClick={() => mixer.setMusicMuted(!muted)}
        >
          {muted ? 'MUSIC MUTED' : 'MUTE MUSIC'}
        </button>
      </div>

      {CHANNELS.map(({ channel, text }) => {
        const pct = Math.round(volumes[channel] * 100)
        const id = `volume-${channel}`
        return (
          <div key={channel} style={sliderRow}>
            <label htmlFor={id} style={label}>{text}</label>
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              className="ns-slider"
              aria-valuetext={`${pct}%`}
              onChange={(e) => mixer.set(channel, Number(e.target.value) / 100)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <span style={valueReadout} aria-hidden="true">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}
