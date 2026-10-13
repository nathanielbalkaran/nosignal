import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { retroTexture, type RetroSurface } from '../geo/retroTextures.ts'
import type { BoxSpec } from './boxes.ts'

interface Props {
  boxes: readonly BoxSpec[]
  castShadow?: boolean
  receiveShadow?: boolean
  roughness?: number
  /** Self-lit (no shading): lamps and lit signs. */
  unlit?: boolean
}

/** World-space texel density: one texture tile per 1/TILE metres. */
const TILE = 0.6

/**
 * One shared material per surface. Box UVs are 0..1 per face, which would stretch a tile over a
 * long deck, so the vertex shader maps each face by its real size (instance scale) instead.
 */
const materials = new Map<RetroSurface | 'plain', MeshStandardMaterial>()
function materialFor(surface: RetroSurface | undefined, roughness: number): MeshStandardMaterial {
  const key = surface ?? 'plain'
  const hit = materials.get(key)
  if (hit) return hit
  const m = new MeshStandardMaterial({ roughness, metalness: 0, map: surface ? retroTexture(surface) : null })
  if (surface) {
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#ifdef USE_MAP
  vec3 bsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec3 bp = position * bsc;
  vec3 an = abs(normal);
  vMapUv = (an.x > 0.5 ? bp.zy : (an.y > 0.5 ? bp.xz : bp.xy)) * ${TILE.toFixed(2)};
#endif`,
      )
    }
    m.customProgramCacheKey = () => 'instanced-box-world-uv'
  }
  materials.set(key, m)
  return m
}

function Part({ boxes, castShadow, receiveShadow, roughness, unlit, surface }: Props & { surface?: RetroSurface }) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const p = new Vector3()
    const s = new Vector3()
    const c = new Color()
    boxes.forEach((b, i) => {
      e.set(0, Math.atan2(-b.axis[1], b.axis[0]), b.pitch ?? 0, 'YZX')
      q.setFromEuler(e)
      p.set(b.at[0], b.y + b.height / 2, b.at[1])
      s.set(b.length, b.height, b.width)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.set(b.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [boxes])

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, boxes.length]}
      castShadow={castShadow && !unlit}
      receiveShadow={receiveShadow}
      material={unlit ? undefined : materialFor(surface, roughness ?? 0.85)}
    >
      <boxGeometry />
      {unlit ? <meshBasicMaterial /> : null}
    </instancedMesh>
  )
}

/** Instanced boxes, one draw call per surface type. */
export function InstancedBoxes({ boxes, castShadow = true, receiveShadow = true, roughness = 0.85, unlit = false }: Props) {
  const groups = useMemo(() => {
    const by = new Map<RetroSurface | undefined, BoxSpec[]>()
    for (const b of boxes) {
      const k = unlit ? undefined : b.surface
      by.set(k, [...(by.get(k) ?? []), b])
    }
    return [...by.entries()]
  }, [boxes, unlit])
  return (
    <>
      {groups.map(([surface, list]) => (
        <Part key={surface ?? 'plain'} boxes={list} surface={surface} castShadow={castShadow} receiveShadow={receiveShadow} roughness={roughness} unlit={unlit} />
      ))}
    </>
  )
}
