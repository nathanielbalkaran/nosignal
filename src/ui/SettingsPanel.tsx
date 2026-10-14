import { useSyncExternalStore, type CSSProperties } from 'react'
import { settings, type ViewBobbingSetting } from '../game/settings.ts'
import { useGame } from '../game/session.ts'
import { hintStyle, LOCK_HINT } from './theme.ts'

const OPTIONS: readonly ViewBobbingSetting[] = ['OFF', 'LOW', 'NORMAL']

const panelWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

const sectionRow: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const rowTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '0.16em',
  color: '#f2efe6',
  margin: 0,
}

const rowDesc: CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.08em',
  color: 'rgba(232, 228, 220, 0.65)',
  margin: 0,
  lineHeight: 1.4,
}

const btnGroup: CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 4,
}

const optBtn = (active: boolean): CSSProperties => ({
  background: active ? 'rgba(217, 163, 106, 0.22)' : 'rgba(232, 228, 220, 0.04)',
  border: `1px solid ${active ? '#d9a36a' : 'rgba(232, 228, 220, 0.2)'}`,
  color: active ? '#ffffff' : 'rgba(232, 228, 220, 0.6)',
  fontFamily: "'Pixelify Sans', ui-monospace, monospace",
  fontSize: 14,
  fontWeight: active ? 600 : 400,
  padding: '8px 22px',
  cursor: 'pointer',
  letterSpacing: '0.14em',
  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
  boxShadow: active ? '0 0 10px rgba(217, 163, 106, 0.2)' : 'none',
})

const divider: CSSProperties = {
  height: 1,
  background: 'rgba(232, 228, 220, 0.12)',
  margin: '2px 0',
}

const keymapGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '10px 24px',
  marginTop: 6,
}

const keymapRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 0',
  borderBottom: '1px solid rgba(232, 228, 220, 0.08)',
}

const keymapLabel: CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.12em',
  color: 'rgba(232, 228, 220, 0.75)',
}

const CONTROLS_LIST = [
  { keys: 'W A S D', label: 'WALK / STRAFE' },
  { keys: 'MOUSE', label: 'LOOK AROUND' },
  { keys: 'E', label: 'INTERACT / ENTER' },
  { keys: 'T', label: 'CHECK CLOCK' },
  { keys: 'R', label: 'VIEW RECEIPT' },
  { keys: 'N / B', label: 'RADIO NEXT / PREV' },
  { keys: 'ESC', label: 'PAUSE MENU' },
  { keys: 'M', label: 'MAP (DEV)' },
]

/** Settings panel for the pause menu: View Bobbing and Gameplay Preferences. */
export function SettingsPanel() {
  const currentBobbing = useSyncExternalStore(settings.subscribe, settings.getViewBobbing)
  const { lockBlocked } = useGame()

  return (
    <div style={panelWrap} onClick={(e) => e.stopPropagation()} role="group" aria-label="Settings">
      <div className="ns-section-header">
        <h2 className="ns-section-title">SETTINGS</h2>
        <span className="ns-section-subhead">GAMEPLAY PREFERENCES</span>
      </div>

      <div style={sectionRow}>
        <div style={rowTitle}>VIEW BOBBING</div>
        <div style={rowDesc}>Simulate realistic camera bob and subtle sway while walking and sprinting.</div>
        <div style={btnGroup} role="radiogroup" aria-label="View bobbing amount">
          {OPTIONS.map((opt) => {
            const active = currentBobbing === opt
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={active}
                style={optBtn(active)}
                onClick={() => settings.setViewBobbing(opt)}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      <div style={divider} />

      <div style={sectionRow}>
        <div style={rowTitle}>CONTROLS & SHORTCUTS</div>
        <div style={rowDesc}>Standard keybindings for district exploration and radio control.</div>
        <div style={keymapGrid}>
          {CONTROLS_LIST.map(({ keys, label }) => (
            <div key={label} style={keymapRow}>
              <span className="ns-keycap">{keys}</span>
              <span style={keymapLabel}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {lockBlocked && (
        <div style={{ marginTop: 8 }}>
          <p style={hintStyle}>{LOCK_HINT}</p>
        </div>
      )}
    </div>
  )
}
