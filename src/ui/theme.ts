import { PRIMARY, type } from './typography.ts'
import type { CSSProperties } from 'react'
import { ambientAudio } from '../audio/ambient.ts'
import { music } from '../audio/music/player.ts'
import { session, type GameMode } from '../game/session.ts'


export const screen: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: PRIMARY,
  color: '#e8e4dc',
  userSelect: 'none',
  zIndex: 10,
}

export const hintStyle: CSSProperties = { ...type.label, color: '#d9a36a', margin: '14px 0 0', textAlign: 'center' }

/** Audio is created inside the click that starts play (browsers require a gesture). */
function unlockAudio() {
  ambientAudio.unlock()
  music.unlock()
}

export function startGame(mode: GameMode) {
  unlockAudio()
  session.start(mode)
}
export function restartGame() {
  unlockAudio()
  session.restart()
}
export function resumeGame() {
  unlockAudio()
  session.resume()
}

export const LOCK_HINT = 'Mouse capture was blocked. Click again to retry.'
