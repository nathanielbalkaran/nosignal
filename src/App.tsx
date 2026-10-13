import { lazy, Suspense, useEffect } from 'react'
import { attachSession, useGame } from './game/session.ts'
import { GameCanvas } from './rendering/GameCanvas.tsx'
import { EndScreen } from './ui/EndScreen.tsx'
import { Hud } from './ui/Hud.tsx'
import { MusicUI } from './ui/MusicUI.tsx'
import { PauseMenu } from './ui/PauseMenu.tsx'
import { TitleScreen } from './ui/TitleScreen.tsx'

// Dead-code eliminated in production builds, so no dev tooling ships.
const DevTools = import.meta.env.DEV ? lazy(() => import('./dev/DevTools.tsx')) : null

export function App() {
  const { state } = useGame()
  useEffect(() => attachSession(), [])

  return (
    <>
      <GameCanvas />
      <Hud />
      {state === 'TITLE' && <TitleScreen />}
      {state === 'PAUSED' && <PauseMenu />}
      {(state === 'WON' || state === 'LOST') && <EndScreen />}
      <MusicUI />
      {DevTools && (
        <Suspense fallback={null}>
          <DevTools />
        </Suspense>
      )}
    </>
  )
}
