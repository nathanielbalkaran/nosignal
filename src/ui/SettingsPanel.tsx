import { type } from './typography.ts'
import { useSyncExternalStore, type CSSProperties } from 'react'
import { settings, type ViewBobbingSetting } from '../game/settings.ts'

const panel: CSSProperties = {
  marginTop: 10,
  padding: '10px 14px 12px',
  minWidth: 260,
  background: 'rgba(14, 13, 20, 0.72)',
  border: '1px solid rgba(232, 228, 220, 0.22)',
  ...type.label,
  cursor: 'default',
}

const heading: CSSProperties = {
  ...type.small,
  letterSpacing: '0.15em',
  opacity: 0.9,
  marginBottom: 8,
}

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '2px 0',
}

const label: CSSProperties = {
  ...type.small,
  color: 'rgba(232, 228, 220, 0.75)',
  letterSpacing: '0.12em',
}

const btnGroup: CSSProperties = {
  display: 'flex',
  gap: 5,
}

const optBtn = (active: boolean): CSSProperties => ({
  background: active ? 'rgba(217, 163, 106, 0.22)' : 'transparent',
  border: `1px solid ${active ? '#d9a36a' : 'rgba(232, 228, 220, 0.25)'}`,
  color: active ? '#f2efe6' : 'rgba(232, 228, 220, 0.55)',
  font: 'inherit',
  ...type.small,
  fontSize: 12,
  padding: '2px 8px',
  cursor: 'pointer',
  letterSpacing: '0.1em',
  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
})

const OPTIONS: readonly ViewBobbingSetting[] = ['OFF', 'LOW', 'NORMAL']

/** Settings panel in the pause menu for gameplay preferences like view bobbing. */
export function SettingsPanel() {
  const current = useSyncExternalStore(settings.subscribe, settings.getViewBobbing)

  return (
    <div style={panel} onClick={(e) => e.stopPropagation()} role="group" aria-label="Settings">
      <div style={heading}>SETTINGS</div>
      <div style={row}>
        <span style={label} id="view-bobbing-label">VIEW BOBBING</span>
        <div style={btnGroup} role="radiogroup" aria-labelledby="view-bobbing-label">
          {OPTIONS.map((opt) => {
            const active = current === opt
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
    </div>
  )
}
