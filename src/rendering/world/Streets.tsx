import { useEffect, useMemo } from 'react'
import { Color } from 'three'
import { add, perp, rectFromSegment, scale, type Vec2 } from '../../world/geometry2d.ts'
import { world } from '../../world/index.ts'
import type { StreetKind } from '../../world/types.ts'
import { retroTexture } from '../geo/retroTextures.ts'
import { MeshAccumulator } from './meshBuilders.ts'

/** Paving colour for streets without a carriageway. */
const PEDESTRIAN_PAVING: Partial<Record<StreetKind, string>> = {
  market: '#6b5d50',
  lane: '#5f5a54',
  alley: '#57524c',
}
const ASPHALT = '#3d3f45'
const ZEBRA = '#d9d6cc'

function disc(centre: Vec2, radius: number, segments = 16): Vec2[] {
  return Array.from({ length: segments }, (_, i) => {
    const t = (i / segments) * Math.PI * 2
    return [centre[0] + Math.cos(t) * radius, centre[1] + Math.sin(t) * radius] as Vec2
  })
}

/**
 * Road surfaces drawn just above the ground plane (which reads as sidewalk).
 * Layers are separated by small heights plus polygon offset to avoid z-fighting.
 */
export function Streets() {
  const geometry = useMemo(() => {
    const acc = new MeshAccumulator()
    const color = new Color()

    // Pedestrian paving first, carriageways over it, crossings on top.
    for (const s of world.segments) {
      const paving = PEDESTRIAN_PAVING[s.street.kind]
      if (paving) acc.polygon(rectFromSegment(s.a, s.b, s.street.width, s.street.width / 2), 0.012, color.set(paving))
    }

    const asphalt = color.set(ASPHALT).clone()
    const jointRadius = new Map<string, number>()
    for (const street of world.layout.streets) {
      if (street.carriageway <= 0) continue
      for (const id of street.nodes) jointRadius.set(id, Math.max(jointRadius.get(id) ?? 0, street.carriageway / 2))
      for (let i = 0; i < street.nodes.length - 1; i++) {
        const a = world.nodes.get(street.nodes[i])?.at as Vec2
        const b = world.nodes.get(street.nodes[i + 1])?.at as Vec2
        acc.polygon(rectFromSegment(a, b, street.carriageway), 0.024, asphalt)
      }
    }
    for (const [id, r] of jointRadius) {
      acc.polygon(disc(world.nodes.get(id)?.at as Vec2, r), 0.024, asphalt)
    }

    const zebra = color.set(ZEBRA).clone()
    for (const { rect } of world.crossings) {
      const stripes = Math.floor((rect.halfLength * 2) / 1.0)
      const across = perp(rect.axis)
      for (let i = 0; i < stripes; i++) {
        const t = -rect.halfLength + 0.5 + i * 1.0
        const c = add(rect.center, scale(rect.axis, t))
        acc.polygon(rectFromSegment(add(c, scale(across, -rect.halfWidth)), add(c, scale(across, rect.halfWidth)), 0.5), 0.036, zebra)
      }
    }
    return acc.build()
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors map={retroTexture('asphalt')} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-4} />
    </mesh>
  )
}
