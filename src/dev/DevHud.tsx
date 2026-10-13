import { useEffect, useRef, type CSSProperties } from 'react'
import { playerState } from '../player/playerState.ts'

const style: CSSProperties = {
  position: 'fixed',
  top: 10,
  left: 10,
  padding: '5px 9px',
  font: '11px/1.4 ui-monospace, Menlo, monospace',
  background: 'rgba(0, 0, 0, 0.5)',
  borderRadius: 4,
  pointerEvents: 'none',
  zIndex: 20,
  whiteSpace: 'pre',
}

export function DevHud() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const p = playerState
      const heading = Math.round(((((-p.yaw * 180) / Math.PI) % 360) + 360) % 360)
      if (ref.current) {
        ref.current.textContent = `DEV  M: map\nx ${p.x.toFixed(1)}  z ${p.z.toFixed(1)}  y ${p.y.toFixed(2)}  heading ${heading}°`
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [])

  return <div ref={ref} style={style} data-dev-hud />
}
