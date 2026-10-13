import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { placePlayer, playerState } from '../player/playerState.ts'
import { isBlocked } from '../world/collision.ts'
import { rectFromSegment, type Vec2 } from '../world/geometry2d.ts'
import { world } from '../world/index.ts'
import { degree } from '../world/navigation.ts'
import type { StreetKind } from '../world/types.ts'
import { validateWorld, type ValidationReport } from '../world/validate.ts'

const ROUTE_COLORS = ['#ff6b5a', '#4fc3f7', '#ffd54f']
const STREET_FILL: Record<StreetKind, string> = {
  trunk: '#4a4a55',
  main: '#6a6458',
  street: '#5a5650',
  market: '#7a5f45',
  lane: '#4f4a45',
  alley: '#46423e',
}

const panel: CSSProperties = {
  width: 360,
  padding: 14,
  overflowY: 'auto',
  background: '#15141b',
  font: '12px/1.45 ui-monospace, Menlo, monospace',
  borderLeft: '1px solid #333',
}

const points = (poly: readonly Vec2[]) => poly.map((p) => `${p[0]},${p[1]}`).join(' ')

/** Renders the reachability grid into an image: green reachable, red free but unreachable. */
function gridImage(report: ValidationReport): string {
  const { grid } = report
  const canvas = document.createElement('canvas')
  canvas.width = grid.cols
  canvas.height = grid.rows
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(grid.cols, grid.rows)
  for (let i = 0; i < grid.state.length; i++) {
    const s = grid.state[i]
    if (s === 0) continue
    img.data[i * 4] = s === 2 ? 60 : 220
    img.data[i * 4 + 1] = s === 2 ? 200 : 60
    img.data[i * 4 + 2] = s === 2 ? 120 : 60
    img.data[i * 4 + 3] = 70
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

export function DevMap({ onClose }: { onClose: () => void }) {
  const report = useMemo(() => validateWorld(world), [])
  const reachImage = useMemo(() => gridImage(report), [report])
  const [showReach, setShowReach] = useState(false)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showProps, setShowProps] = useState(true)
  const [showCorridors, setShowCorridors] = useState(false)
  const [message, setMessage] = useState('Click the map to teleport.')
  const svgRef = useRef<SVGSVGElement>(null)
  const playerRef = useRef<SVGGElement>(null)

  const b = report.grid.bounds
  const g = world.navigation

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const deg = (-playerState.yaw * 180) / Math.PI
      playerRef.current?.setAttribute('transform', `translate(${playerState.x} ${playerState.z}) rotate(${deg})`)
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [])

  const teleport = (e: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    const p: Vec2 = [pt.x, pt.y]
    if (isBlocked(world, p, 0)) {
      setMessage(`(${p[0].toFixed(1)}, ${p[1].toFixed(1)}) is inside something.`)
      return
    }
    placePlayer(p[0], p[1], 0)
    setMessage(`Teleported to (${p[0].toFixed(1)}, ${p[1].toFixed(1)}).`)
  }

  const nodeAt = (id: string) => g.nodes.get(id)?.at as Vec2

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', background: 'rgba(10, 10, 14, 0.94)', zIndex: 30 }}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        ref={svgRef}
        viewBox={`${b.minX} ${b.minZ} ${b.maxX - b.minX} ${b.maxZ - b.minZ}`}
        style={{ flex: 1, cursor: 'crosshair' }}
        onClick={teleport}
      >
        {world.segments.map((s, i) => (
          <polygon key={`s${i}`} points={points(rectFromSegment(s.a, s.b, s.street.width, s.street.width / 2))} fill={STREET_FILL[s.street.kind]} />
        ))}
        {world.blocks.map((blk) => (
          <polygon
            key={blk.layout.id}
            points={points(blk.footprint)}
            fill={blk.layout.role === 'station' ? '#5c5138' : '#26252c'}
            stroke="#77736b"
            strokeWidth={0.3}
          />
        ))}
        <polygon points={points(world.cornerBuilding.footprint)} fill="#4f8a80" />
        <polygon points={points(world.restaurant.footprint)} fill="#a8473b" />
        {showReach && <image href={reachImage} x={b.minX} y={b.minZ} width={report.grid.cols * report.grid.cell} height={report.grid.rows * report.grid.cell} style={{ imageRendering: 'pixelated' }} />}
        {world.crossings.map((c, i) => (
          <polygon key={`c${i}`} points={points(c.rect.poly)} fill="#ddd" opacity={0.6} />
        ))}
        {world.railings.map((r, i) => (
          <line key={`r${i}`} x1={r.a[0]} y1={r.a[1]} x2={r.b[0]} y2={r.b[1]} stroke="#e05050" strokeWidth={0.4} />
        ))}
        {world.gates.map((g, i) => (
          <polygon key={`g${i}`} points={points(g.rect.poly)} fill="#ff9d3c" stroke="#ff9d3c" strokeWidth={0.6} />
        ))}
        {world.layout.barriers.map(([a, c], i) => (
          <line key={`w${i}`} x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke="#e05050" strokeWidth={0.8} strokeDasharray="1 1" />
        ))}
        {showCorridors && world.corridors.map((c, i) => <polygon key={`co${i}`} points={points(c.poly)} fill="#3fa" opacity={0.18} />)}
        {showCorridors && world.keepouts.map((k, i) => <polygon key={`ko${i}`} points={points(k)} fill="none" stroke="#f6c" strokeWidth={0.3} strokeDasharray="1 0.6" />)}
        {showProps &&
          world.props.flatMap((p) =>
            p.colliders.length > 0
              ? p.colliders.map((c, k) => <polygon key={`p${p.id}.${k}`} points={points(c.poly)} fill={c.top > 2.2 ? '#ff5a5a' : '#ffb347'} opacity={0.85} />)
              : [<circle key={`p${p.id}`} cx={p.at[0]} cy={p.at[1]} r={0.25} fill="#8cf" opacity={0.6} />],
          )}
        {world.stalls.map((s, i) => (
          <polygon key={`m${i}`} points={points(s.rect.poly)} fill={s.color} />
        ))}
        {world.ramps.map((r, i) => (
          <polygon key={`st${i}`} points={points(r.poly)} fill="#c98a3a" />
        ))}
        {world.decks.map((d, i) => (
          <polygon key={`d${i}`} points={points(d.poly)} fill="#f0a848" />
        ))}

        {g.edges.map((e, i) => {
          const a = nodeAt(e.a)
          const c = nodeAt(e.b)
          return (
            <line
              key={`e${i}`}
              x1={a[0]}
              y1={a[1]}
              x2={c[0]}
              y2={c[1]}
              stroke={e.kind === 'footbridge' ? '#f0a848' : '#9fd'}
              strokeWidth={0.5}
              strokeDasharray={e.kind === 'street' ? undefined : '1.5 1'}
              opacity={0.7}
            />
          )
        })}
        {showRoutes &&
          report.routes.map((r, ri) => (
            <polyline
              key={`route${ri}`}
              points={points(r.nodes.map((id) => nodeAt(id)).map((p) => [p[0] + (ri - 1) * 1.2, p[1] + (ri - 1) * 1.2] as Vec2))}
              fill="none"
              stroke={ROUTE_COLORS[ri]}
              strokeWidth={1.2}
              strokeLinejoin="round"
              opacity={0.85}
            />
          ))}
        {[...g.nodes.values()].map((n) => {
          const isJunction = degree(g, n.id) >= 3
          return (
            <g key={n.id}>
              <circle cx={n.at[0]} cy={n.at[1]} r={isJunction ? 1.6 : 1} fill={isJunction ? '#fff' : '#9fd'} />
              <text x={n.at[0] + 2} y={n.at[1] - 2} fontSize={3} fill="#cfe">
                {n.id}
              </text>
            </g>
          )
        })}
        {world.landmarks.map((l) => (
          <text key={l.id} x={l.at[0]} y={l.at[1]} fontSize={3.4} fill="#ffcf80" textAnchor="middle" fontWeight={700}>
            {l.label}
          </text>
        ))}
        {world.layout.streets.map((s) => {
          const mid = Math.floor((s.nodes.length - 1) / 2)
          const a = world.nodes.get(s.nodes[mid])?.at as Vec2
          const c = world.nodes.get(s.nodes[mid + 1])?.at as Vec2
          const angle = (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI
          const upright = angle > 90 || angle < -90 ? angle + 180 : angle
          return (
            <text
              key={s.id}
              transform={`translate(${(a[0] + c[0]) / 2} ${(a[1] + c[1]) / 2}) rotate(${upright})`}
              fontSize={2.6}
              fill="#bbb"
              textAnchor="middle"
              dy={-2.5}
            >
              {s.name.en} {s.name.zh}
            </text>
          )
        })}

        <circle cx={world.spawn.at[0]} cy={world.spawn.at[1]} r={2.2} fill="none" stroke="#6f6" strokeWidth={0.6} />
        {world.goal.entrances.map((e) => (
          <circle key={e.node} cx={e.at[0]} cy={e.at[1]} r={world.goal.radius} fill="none" stroke="#f55" strokeWidth={0.6} />
        ))}
        <g ref={playerRef}>
          <polygon points="0,-3 2,2 0,1 -2,2" fill="#fff" stroke="#000" strokeWidth={0.3} />
        </g>
      </svg>

      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <strong>World layout · dev</strong>
          <button onClick={onClose}>Close (M)</button>
        </div>
        <div style={{ marginBottom: 10, opacity: 0.8 }}>{message}</div>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} /> Routes to station
        </label>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <input type="checkbox" checked={showReach} onChange={(e) => setShowReach(e.target.checked)} /> Walkable area (green reachable, red cut off)
        </label>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={showProps} onChange={(e) => setShowProps(e.target.checked)} /> Props (red tall solids, orange low solids, blue passable)
        </label>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <input type="checkbox" checked={showCorridors} onChange={(e) => setShowCorridors(e.target.checked)} /> Kept-clear corridors (green) and keep-outs (pink)
        </label>
        {report.routes.map((r, i) => (
          <div key={i} style={{ color: ROUTE_COLORS[i], marginBottom: 4 }}>
            {world.layout.routes[i]?.name}: {Math.round(r.length)} m
            <div style={{ opacity: 0.7 }}>{r.nodes.join(' → ')}</div>
          </div>
        ))}
        <hr style={{ borderColor: '#333' }} />
        {report.checks.map((c) => (
          <div key={c.label} style={{ marginBottom: 6 }}>
            <span style={{ color: c.ok ? '#7d7' : '#f66' }}>{c.ok ? 'PASS' : 'FAIL'}</span> {c.label}
            <div style={{ opacity: 0.6, paddingLeft: 38 }}>{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
