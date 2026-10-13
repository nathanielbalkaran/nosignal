import { useEffect, useState, type CSSProperties } from 'react'
import { clock, formatClock } from '../game/clock.ts'
import { session, useGame } from '../game/session.ts'
import { PRIMARY, type } from './typography.ts'

const SHOW_MS = 3000
const WARNING_MS = 4000

const base: CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  fontFamily: PRIMARY,
  color: '#e8e4dc',
  textAlign: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
  transition: 'opacity 0.6s ease',
  zIndex: 6,
}
const watch: CSSProperties = {
  ...base,
  top: 28,
  padding: '8px 16px',
  background: 'rgba(14, 13, 20, 0.72)',
  border: '1px solid rgba(232, 228, 220, 0.22)',
}
const warning: CSSProperties = { ...base, ...type.readout, top: 100, letterSpacing: '0.2em', color: '#d9a36a' }
const prompt: CSSProperties = { ...base, ...type.prompt, bottom: '22%', padding: '6px 14px', background: 'rgba(14, 13, 20, 0.6)' }

/** Wristwatch (T), the single two-minute warning, and the station entrance prompt. */
export function Hud() {
  const { state, mode, runId, warningRun, prompt: promptKind } = useGame()
  const playing = state === 'PLAYING'

  // Wristwatch: `watchId` restarts the 3 s window on every press of T.
  const [watchId, setWatchId] = useState(0)
  const [watchVisible, setWatchVisible] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (session.getStatus() !== 'PLAYING') return
      setWatchId((n) => n + 1)
      setWatchVisible(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!watchVisible) return
    const hide = window.setTimeout(() => setWatchVisible(false), SHOW_MS)
    const refresh = window.setInterval(() => tick((n) => n + 1), 200)
    return () => {
      window.clearTimeout(hide)
      window.clearInterval(refresh)
    }
  }, [watchVisible, watchId])

  // Warning: fires once per run; shown for a few seconds, then dismissed.
  const [dismissedRun, setDismissedRun] = useState(0)
  const warningVisible = warningRun !== 0 && warningRun === runId && dismissedRun !== runId
  useEffect(() => {
    if (!warningRun) return
    const t = window.setTimeout(() => setDismissedRun(warningRun), WARNING_MS)
    return () => window.clearTimeout(t)
  }, [warningRun])

  const clockText = mode === 'PLAY' ? formatClock(clock.elapsedMs()) : formatClock(0)

  return (
    <>
      <div style={{ ...watch, opacity: playing && watchVisible ? 1 : 0 }} aria-hidden={!watchVisible}>
        <div style={type.clock}>{clockText}</div>
        {mode === 'PLAY' && <div style={{ ...type.readoutSmall, letterSpacing: '0.12em', opacity: 0.7, marginTop: 4 }}>TRAIN DEPARTS 05:21</div>}
      </div>
      <div style={{ ...warning, opacity: playing && warningVisible ? 0.9 : 0 }} role="status">02:00 REMAINING</div>
      {playing && promptKind && (
        <div style={prompt}>{promptKind === 'enter' ? 'E — ENTER STATION' : 'STATION ENTRANCE'}</div>
      )}
    </>
  )
}
