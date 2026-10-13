import { type } from './typography.ts'
import { useSyncExternalStore, type CSSProperties } from 'react'
import { mixer, type Channel } from '../audio/mixer.ts'

const panel: CSSProperties = {
  marginTop: 10,
  padding: '10px 14px 12px',
  minWidth: 260,
  background: 'rgba(14, 13, 20, 0.72)',
  border: '1px solid rgba(232, 228, 220, 0.22)',
  ...type.label,
  cursor: 'default',
}
const heading: CSSProperties = { ...type.small, opacity: 0.9, marginBottom: 6 }
const muteButton: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(232, 228, 220, 0.3)',
  color: 'inherit',
  font: 'inherit',
  ...type.small,
  padding: '0 6px',
  cursor: 'pointer',
}
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }
const label: CSSProperties = { width: 110, color: 'rgba(232, 228, 220, 0.75)' }
const value: CSSProperties = { ...type.readout, width: 48, textAlign: 'right', color: '#f2efe6' }
const slider: CSSProperties = { flex: 1, accentColor: '#e8e4dc', cursor: 'pointer' }

const CHANNELS: readonly { channel: Channel; text: string }[] = [
  { channel: 'music', text: 'Music' },
  { channel: 'ambience', text: 'Ambience' },
]

/** Compact per-channel volume sliders for the pause menu. */
export function AudioSliders() {
  const volumes = useSyncExternalStore(mixer.subscribe, mixer.getVolumes)
  const muted = useSyncExternalStore(mixer.subscribe, mixer.isMusicMuted)

  return (
    // Clicks here must not reach the overlay behind, which resumes play.
    <div style={panel} onClick={(e) => e.stopPropagation()} role="group" aria-label="Audio">
      <div style={{ ...heading, display: 'flex', justifyContent: 'space-between' }}>
        <span>AUDIO</span>
        <button type="button" style={muteButton} aria-pressed={muted} onClick={() => mixer.setMusicMuted(!muted)}>
          {muted ? 'MUSIC MUTED' : 'MUTE MUSIC'}
        </button>
      </div>
      {CHANNELS.map(({ channel, text }) => {
        const pct = Math.round(volumes[channel] * 100)
        const id = `volume-${channel}`
        return (
          <div key={channel} style={row}>
            <label htmlFor={id} style={label}>{text}</label>
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              style={slider}
              aria-valuetext={`${pct}%`}
              onChange={(e) => mixer.set(channel, Number(e.target.value) / 100)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <span style={value} aria-hidden="true">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}
