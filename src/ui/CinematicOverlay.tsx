import { useEffect, useState, type CSSProperties } from 'react'
import { session, useGame } from '../game/session.ts'
import { PRIMARY, SECONDARY, type } from './typography.ts'

/*
 * Cinematic Overlay for the commuter train ending:
 * "What you run from, you end up chasing."
 *
 * Displays the protagonist's reflective inner monologue as subtle,
 * fading subtitles near the bottom of the screen during the morning montage.
 *
 * Handles Space / Escape skipping, smooth cuts, and final transition
 * to the completion screen.
 */

interface MonologueLine {
  text: string
  start: number
  end: number
}

const MONOLOGUE: readonly MonologueLine[] = [
  // Shot 1 (0 - 8.5s): Departure
  { text: 'Made it.', start: 2.2, end: 4.8 },
  { text: 'Nine minutes. All that just to get on a train.', start: 5.6, end: 9.0 },

  // Shot 2 (8.5 - 22.0s): The City Passing
  { text: 'Funny. I spent the whole night trying to get out of here.', start: 10.4, end: 14.5 },
  { text: "I couldn't wait to leave.", start: 15.5, end: 18.5 },
  { text: 'So why was I in such a hurry to get back?', start: 19.8, end: 23.5 },

  // Shot 3 (22.0 - 34.0s): Sunrise Opening Up
  { text: 'Back...', start: 24.8, end: 27.2 },
  { text: 'I remember leaving.', start: 28.2, end: 31.0 },
  { text: 'I remember why I left.', start: 32.0, end: 34.8 },

  // Shot 4 (34.0 - 52.0s): Final Frame & Ambiguous Landmark
  { text: "I just don't remember deciding to come back.", start: 36.0, end: 40.2 },
  { text: 'Which way is this train going?', start: 41.5, end: 45.2 },
]

const TOTAL_DURATION_SEC = 52.0
const CUT_TO_BLACK_START_SEC = 47.2
const TITLE_START_SEC = 48.2

const fadeCurtain: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#000',
  pointerEvents: 'none',
  zIndex: 11,
  transition: 'opacity 0.6s ease',
}

const overlayWrap: CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const subtitleWrap: CSSProperties = {
  position: 'fixed',
  bottom: '12%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(780px, calc(100vw - 48px))',
  textAlign: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 10,
}

const subtitleText: CSSProperties = {
  fontFamily: SECONDARY,
  fontSize: 'clamp(19px, 2.6vw, 26px)',
  letterSpacing: '0.14em',
  color: '#e8e4dc',
  lineHeight: 1.45,
  margin: 0,
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 16px rgba(0, 0, 0, 0.85)',
  transition: 'opacity 0.4s ease',
}

const titleOverlayWrap: CSSProperties = {
  marginTop: 'auto',
  marginBottom: 'auto',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  zIndex: 12,
  transition: 'opacity 1.4s ease',
}

const titleText: CSSProperties = {
  ...type.display,
  fontFamily: PRIMARY,
  fontSize: 'clamp(36px, 6vw, 64px)',
  letterSpacing: '0.36em',
  color: '#e8e4dc',
  margin: 0,
  paddingLeft: '0.36em',
  textShadow: '0 2px 14px rgba(0, 0, 0, 0.85)',
}

const finalSubtext: CSSProperties = {
  ...type.body,
  fontFamily: SECONDARY,
  fontSize: 'clamp(15px, 2.2vw, 20px)',
  letterSpacing: '0.18em',
  color: '#d9a36a',
  margin: 0,
  opacity: 0.9,
  textShadow: '0 1px 8px rgba(0, 0, 0, 0.8)',
}

const skipHint: CSSProperties = {
  ...type.small,
  fontFamily: SECONDARY,
  letterSpacing: '0.22em',
  color: '#e8e4dc',
  opacity: 0.4,
  marginBottom: 24,
  transition: 'opacity 0.4s ease',
}

function getActiveSubtitle(time: number): { text: string; opacity: number } | null {
  for (const line of MONOLOGUE) {
    if (time >= line.start && time <= line.end) {
      const duration = line.end - line.start
      const fadeTime = Math.min(0.65, duration / 3)
      let opacity = 1
      if (time < line.start + fadeTime) {
        opacity = (time - line.start) / fadeTime
      } else if (time > line.end - fadeTime) {
        opacity = (line.end - time) / fadeTime
      }
      return { text: line.text, opacity }
    }
  }
  return null
}

export function CinematicOverlay() {
  const { state } = useGame()
  const [elapsed, setElapsed] = useState(0)

  // Keyboard controls: Space or Escape to skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault()
        session.finishCinematic()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Timer loop
  useEffect(() => {
    const start = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const secs = (now - start) / 1000
      setElapsed(secs)

      if (secs >= TOTAL_DURATION_SEC) {
        window.clearInterval(timer)
        session.finishCinematic()
      }
    }, 50)

    return () => window.clearInterval(timer)
  }, [])

  if (state !== 'CINEMATIC') return null

  // Fading curtain logic:
  // Initial fade in from black: 0 to 1.0s
  // Final cut to black: 47.2s to 48.0s
  let curtainOpacity = 0
  if (elapsed < 1.0) {
    curtainOpacity = Math.max(0, 1.0 - elapsed / 1.0)
  } else if (elapsed > CUT_TO_BLACK_START_SEC) {
    curtainOpacity = Math.min(1.0, (elapsed - CUT_TO_BLACK_START_SEC) / 0.8)
  }

  // Active monologue subtitle
  const subtitle = getActiveSubtitle(elapsed)

  // Final NO SIGNAL title overlay during cut to black
  const showTitle = elapsed >= TITLE_START_SEC
  const titleOpacity = showTitle ? Math.min(1.0, (elapsed - TITLE_START_SEC) / 1.4) : 0

  return (
    <>
      <div style={{ ...fadeCurtain, opacity: curtainOpacity }} aria-hidden />

      {/* Subtitle stream near bottom of screen */}
      {subtitle && elapsed < CUT_TO_BLACK_START_SEC && (
        <div style={subtitleWrap}>
          <p style={{ ...subtitleText, opacity: subtitle.opacity }}>
            "{subtitle.text}"
          </p>
        </div>
      )}

      <div style={overlayWrap}>
        <div style={{ height: 40 }} />

        {/* Final frame title overlay */}
        <div style={{ ...titleOverlayWrap, opacity: titleOpacity }}>
          <h1 style={titleText}>NO SIGNAL</h1>
          <p style={finalSubtext}>Somewhere, the city is waking up.</p>
        </div>

        {/* Skip indicator */}
        <div style={{ ...skipHint, opacity: elapsed > CUT_TO_BLACK_START_SEC ? 0 : 0.4 }}>
          [SPACE / ESC] SKIP
        </div>
      </div>
    </>
  )
}
