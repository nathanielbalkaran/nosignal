import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RepeatWrapping,
  ShaderChunk,
  type Material,
  type WebGLRenderer,
} from 'three'
import { ENVIRONMENT } from '../../config/environment.ts'
import { FOG_CULL_DISTANCE } from '../../config/scene.ts'
import { world } from '../../world/index.ts'
import type { LayerName } from '../geo/layers.ts'
import { makeGlowTexture, makeMeshTexture, signAtlas } from '../geo/textures.ts'
import { retroTexture } from '../geo/retroTextures.ts'
import { buildEnvironment } from './build.ts'

interface Chunk {
  mesh: Mesh
  layer: LayerName
  /** Bounding sphere, for dropping chunks that are wholly lost in the haze. */
  sx: number
  sy: number
  sz: number
  radius: number
}

/** Shows or hides chunks by distance: small layers close up, everything inside the haze. */
function cull(chunks: readonly Chunk[], px: number, pz: number) {
  const { detailDistance, propDistance } = ENVIRONMENT.render
  const haze = FOG_CULL_DISTANCE
  for (const c of chunks) {
    const d = Math.hypot(c.sx - px, c.sz - pz) - c.radius
    if (d > haze) c.mesh.visible = false
    else if (c.layer === 'detail') c.mesh.visible = d < detailDistance
    else if (c.layer === 'props' || c.layer === 'mesh') c.mesh.visible = d < propDistance
    else c.mesh.visible = true
  }
}

function publishStats(info: WebGLRenderer['info']) {
  const w = window as unknown as { __env?: Record<string, unknown> }
  w.__env = { ...w.__env, drawCalls: info.render.calls, frameTriangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures }
}

/**
 * All static scenery, merged into one mesh per (chunk, layer). Small detail
 * layers are switched off beyond a distance; everything else is frustum culled
 * per chunk by three.js.
 */
export function Environment() {
  const built = useMemo(() => {
    const { layers, lights, stats } = buildEnvironment(world)
    const atlas = signAtlas().finish()

    // Double-sided: any quad with the wrong winding still shows (lit correctly, since three.js flips back-face normals)
    // rather than silently vanishing. Everything here is drawn at 360p, so the extra cost is negligible.
    const standard = new MeshStandardMaterial({ vertexColors: true, map: retroTexture('plaster'), roughness: 1, metalness: 0, side: DoubleSide })
    const solid = new Set<LayerName>(['base', 'detail', 'props'])
    const materials: Record<LayerName, Material> = {
      base: standard,
      detail: standard,
      props: standard,
      emissive: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
      signs: new MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: '#6a6a6a', roughness: 0.9, metalness: 0, side: DoubleSide }),
      signsLit: new MeshBasicMaterial({ map: atlas, color: '#e8e8e8', side: DoubleSide }),
      mesh: new MeshStandardMaterial({ vertexColors: true, map: makeMeshTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.9 }),
      glow: new MeshBasicMaterial({
        vertexColors: true,
        map: makeGlowTexture(),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    }
    // Additive light decals fade out with distance instead of blending towards the fog colour (which would brighten them).
    materials.glow.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', ShaderChunk.fog_fragment.replace('fogColor', 'vec3( 0.0 )'))
    }
    materials.glow.customProgramCacheKey = () => 'glow-additive-fog'
    const mesh = materials.mesh as MeshStandardMaterial
    if (mesh.map) {
      // Nearest and unmipmapped like every other retro texture; mip-averaging thins the wire below the alpha cut-off at range.
      mesh.map.wrapS = mesh.map.wrapT = RepeatWrapping
      mesh.map.magFilter = mesh.map.minFilter = NearestFilter
      mesh.map.generateMipmaps = false
      mesh.map.needsUpdate = true
    }

    const group = new Group()
    const chunks: Chunk[] = []
    let triangles = 0
    const byLayer: Record<string, number> = {}
    for (const e of layers.entries()) {
      if (e.geo.triangleCount === 0) continue
      const geometry = e.geo.build(solid.has(e.layer) ? { tile: 4 } : undefined)
      triangles += e.geo.triangleCount
      byLayer[e.layer] = (byLayer[e.layer] ?? 0) + e.geo.triangleCount
      const m = new Mesh(geometry, materials[e.layer])
      m.matrixAutoUpdate = false
      m.frustumCulled = true
      group.add(m)
      const bs = geometry.boundingSphere
      chunks.push({
        mesh: m,
        layer: e.layer,
        sx: bs?.center.x ?? 0,
        sy: bs?.center.y ?? 0,
        sz: bs?.center.z ?? 0,
        radius: bs?.radius ?? 0,
      })
    }
    return { group, chunks, lights, materials, stats: { ...stats, triangles, byLayer, meshes: chunks.length } }
  }, [])

  useEffect(() => {
    ;(window as unknown as { __env?: unknown }).__env = built.stats
    return () => {
      for (const c of built.chunks) c.mesh.geometry.dispose()
      for (const m of new Set(Object.values(built.materials))) m.dispose()
    }
  }, [built])

  const frames = useRef(0)
  useFrame(({ camera, gl }) => {
    cull(built.chunks, camera.position.x, camera.position.z)
    if (import.meta.env.DEV && ++frames.current % 30 === 0) publishStats(gl.info)
  })

  return (
    <>
      <primitive object={built.group} />
    </>
  )
}
