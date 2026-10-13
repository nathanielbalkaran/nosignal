import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { music } from '../audio/music/player.ts'
import { ARTIST, NOTICE_SECONDS, TRACKS } from '../audio/music/tracks.ts'

const FADE_MS = 600

const box: CSSProperties = {
  position: 'fixed',
  left: 16,
  bottom: 16,
  padding: '6px 10px 7px',
  background: 'rgba(14, 13, 20, 0.72)',
  border: '1px solid rgba(232, 228, 220, 0.22)',
  fontFamily: '"Courier New", ui-monospace, monospace',
  fontSize: 12,
  lineHeight: 1.35,
  letterSpacing: '0.04em',
  color: '#e8e4dc',
  pointerEvents: 'none',
  userSelect: 'none',
  transition: `opacity ${FADE_MS}ms linear`,
  zIndex: 5,
}

const station: CSSProperties = { fontSize: 10, letterSpacing: '0.2em', opacity: 0.6, marginBottom: 3 }
const count: CSSProperties = { opacity: 0.6, marginTop: 3 }

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLInputElement && target.type === 'range') return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

/** Music hotkeys (N next, B previous) and the bottom-left now-playing notification. */
export function MusicUI() {
  const notice = useSyncExternalStore(music.subscribeNotice, music.getNotice)
  // Id of the last notification whose time ran out; a newer notice is visible again.
  const [expiredId, setExpiredId] = useState(0)

  useEffect(() => music.attach(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      switch (e.code) {
        case 'KeyN':
          music.next()
          break
        case 'KeyB':
          music.previous()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setExpiredId(notice.id), NOTICE_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (!notice) return null
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div style={{ ...box, opacity: notice.id === expiredId ? 0 : 1 }} aria-live="polite">
      <div style={station}>NO SIGNAL FM</div>
      <div>{TRACKS[notice.index].title}</div>
      <div style={{ opacity: 0.75 }}>{ARTIST}</div>
      <div style={count}>
        {pad(notice.index + 1)} / {pad(TRACKS.length)}
      </div>
    </div>
  )
}
