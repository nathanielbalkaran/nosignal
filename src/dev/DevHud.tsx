import { useEffect, useRef, type CSSProperties } from 'react'
import { clock, formatClock } from '../game/clock.ts'
import { session } from '../game/session.ts'
import { playerState } from '../player/playerState.ts'
import { world } from '../world/index.ts'

/** Nearest station entrance, for judging how far the player is from the goal (straight line only). */
function toStation(x: number, z: number) {
  let best = { d: Infinity, node: '' }
  for (const e of world.goal.entrances) {
    const d = Math.hypot(e.at[0] - x, e.at[1] - z)
    if (d < best.d) best = { d, node: e.node }
  }
  return `${best.node} ${best.d.toFixed(0)} m`
}

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
        const g = session.getSnapshot()
        const game = `${g.mode} ${g.state}  ${formatClock(clock.elapsedMs())}${session.isFrozen() ? ' FROZEN' : ''}${clock.running ? '' : ' (stopped)'}`
        ref.current.textContent = `DEV  M: map  F6 start  F7 clock  F8 freeze  F9 30s\n${game}\nx ${p.x.toFixed(1)}  z ${p.z.toFixed(1)}  y ${p.y.toFixed(2)}  heading ${heading}°\nstart ${world.spawn.at.map((v) => v.toFixed(0)).join(',')}  station ${world.goal.entrances.map((e) => `${e.node} ${e.at.map((v) => v.toFixed(0)).join(',')}`).join('  ')}\nstraight line to station ${toStation(p.x, p.z)}`
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [])

  return <div ref={ref} style={style} data-dev-hud />
}
