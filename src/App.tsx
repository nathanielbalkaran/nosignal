import { lazy, Suspense, useEffect } from 'react'
import { attachSession, useGame } from './game/session.ts'
import { GameCanvas } from './rendering/GameCanvas.tsx'
import { AchievementNotification } from './ui/AchievementNotification.tsx'
import { DiscoveryUI } from './ui/DiscoveryUI.tsx'
import { EndScreen } from './ui/EndScreen.tsx'
import { Hud } from './ui/Hud.tsx'
import { MusicUI } from './ui/MusicUI.tsx'
import { PauseMenu } from './ui/PauseMenu.tsx'
import { RestaurantUI } from './ui/RestaurantUI.tsx'
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
      <RestaurantUI />
      <DiscoveryUI />
      {state === 'TITLE' && <TitleScreen />}
      {state === 'PAUSED' && <PauseMenu />}
      {(state === 'WON' || state === 'LOST') && <EndScreen />}
      <AchievementNotification />
      <MusicUI />
      {DevTools && (
        <Suspense fallback={null}>
          <DevTools />
        </Suspense>
      )}
    </>
  )
}
