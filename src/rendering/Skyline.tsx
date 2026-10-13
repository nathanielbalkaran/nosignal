import { useEffect, useMemo } from 'react'
import { DoubleSide, Mesh, MeshBasicMaterial } from 'three'
import { SCENE } from '../config/scene.ts'
import { Rng } from '../world/rng.ts'
import { Geo, mix, rgb, shade } from './geo/Geo.ts'

/**
 * A ring of dark, distant towers that closes the horizon. It is a single
 * unlit, fog-free mesh, so the haze cannot hide it, and a narrow gap is left to the
 * north (the harbour side), where the water is.
 */
const SKYLINE_HAZE = 0.55

export function Skyline() {
  const mesh = useMemo(() => {
    const g = new Geo()
    const rng = new Rng('no-signal/skyline')
    // Towers are unlit and fog-free (they sit beyond the fog), so the haze is baked in: pale, low-contrast silhouettes.
    const top = mix(rgb('#222a36'), rgb(SCENE.fog.color), SKYLINE_HAZE)
    const foot = rgb(SCENE.skyDome.horizon)
    const count = 70
    for (let i = 0; i < count; i++) {
      // Bearing 0 is north (-z). Leave a 40 degree gap there.
      const bearing = ((i + rng.range(0, 0.8)) / count) * Math.PI * 2
      const fromNorth = Math.min(bearing, Math.PI * 2 - bearing)
      if (fromNorth < Math.PI / 9) continue
      const r = rng.range(285, 335)
      const x = Math.sin(bearing) * r
      const z = -30 - Math.cos(bearing) * r
      const w = rng.range(22, 48)
      const d = rng.range(22, 40)
      const h = rng.range(55, 150)
      const yaw = -bearing
      const body = shade(top, rng.range(0.85, 1.35))
      g.at(x, 0, z, yaw, () => {
        // Darker at the top, fading towards the horizon colour at the base.
        const lo = mix(body, foot, 0.9)
        const quads: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
        quads.forEach(([sx, sz], k) => {
          const [nx, nz] = quads[(k + 1) % 4]
          g.quad([sx * w / 2, 0, sz * d / 2], [nx * w / 2, 0, nz * d / 2], [nx * w / 2, h, nz * d / 2], [sx * w / 2, h, sz * d / 2], body, [lo, lo, body, body])
        })
        g.quad([-w / 2, h, d / 2], [w / 2, h, d / 2], [w / 2, h, -d / 2], [-w / 2, h, -d / 2], body)
      })
    }
    const m = new Mesh(g.build(), new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide }))
    m.frustumCulled = false
    return m
  }, [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      ;(mesh.material as MeshBasicMaterial).dispose()
    },
    [mesh],
  )
  return <primitive object={mesh} />
}
