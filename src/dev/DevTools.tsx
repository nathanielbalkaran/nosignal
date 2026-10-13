import { useEffect, useState } from 'react'
import { placePlayer, playerState } from '../player/playerState.ts'
import { standingHeight } from '../world/collision.ts'
import { world } from '../world/index.ts'
import { DevHud } from './DevHud.tsx'
import { DevMap } from './DevMap.tsx'

/**
 * `?view=x,z,heading,pitch` starts at a fixed viewpoint (degrees, heading 0 = north,
 * add `,deck` to stand on the footbridge). `&clean` hides overlays for screenshots.
 */
function applyUrlOptions() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (view) {
    const [x, z, heading = 0, pitch = 0] = view.split(',').map(Number)
    const y = view.endsWith(',deck') ? (standingHeight(world, [x, z], world.layout.footbridge.deckHeight) ?? 0) : 0
    placePlayer(x, z, y, (-heading * Math.PI) / 180)
    playerState.pitch = (pitch * Math.PI) / 180
  }
  if (params.has('clean')) {
    const style = document.createElement('style')
    style.textContent = 'div:has(> h1), [data-dev-hud] { display: none !important; }'
    document.head.appendChild(style)
  }
}
applyUrlOptions()

/** Development-only tools. Loaded lazily and excluded from production builds. */
export default function DevTools() {
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' || e.repeat) return
      setMapOpen((open) => {
        if (!open) document.exitPointerLock()
        return !open
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <DevHud />
      {mapOpen && <DevMap onClose={() => setMapOpen(false)} />}
    </>
  )
}
