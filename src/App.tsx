import { lazy, Suspense } from 'react'
import { GameCanvas } from './rendering/GameCanvas.tsx'
import { MusicUI } from './ui/MusicUI.tsx'
import { PlayOverlay } from './ui/PlayOverlay.tsx'

// Dead-code eliminated in production builds, so no dev tooling ships.
const DevTools = import.meta.env.DEV ? lazy(() => import('./dev/DevTools.tsx')) : null

export function App() {
  return (
    <>
      <GameCanvas />
      <PlayOverlay />
      <MusicUI />
      {DevTools && (
        <Suspense fallback={null}>
          <DevTools />
        </Suspense>
      )}
    </>
  )
}
