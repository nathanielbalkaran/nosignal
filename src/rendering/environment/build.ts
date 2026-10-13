import { ENVIRONMENT } from '../../config/environment.ts'
import type { World } from '../../world/build.ts'
import { buildFacade, type LightSpot } from '../facade/index.ts'
import { buildCables, buildLandmarkSigns, buildPlates } from '../facade/fixtures.ts'
import { buildClosures, buildDeadEnds, buildRailings, buildViaducts } from '../facade/boundary.ts'
import { buildMasses } from '../facade/mass.ts'
import { buildStation } from '../facade/station.ts'
import { windowLog } from '../facade/windowLog.ts'
import { Layers } from '../geo/layers.ts'
import { signAtlas } from '../geo/textures.ts'
import { buildProp } from '../props/index.ts'

export interface EnvironmentBuild {
  layers: Layers
  lights: LightSpot[]
  stats: { facades: number; props: number }
}

/** Bakes every building, prop, sign and cable into chunked geometry layers. */
export function buildEnvironment(world: World): EnvironmentBuild {
  const layers = new Layers(ENVIRONMENT.render.chunkSize, { detail: ENVIRONMENT.render.detailChunk, props: ENVIRONMENT.render.propChunk })
  const atlas = signAtlas()
  const lights: LightSpot[] = []
  windowLog.length = 0
  buildMasses(layers, world, world.facades)
  for (const spec of world.facades) buildFacade(layers, atlas, spec, lights)
  for (const p of world.props) buildProp(layers, p)
  buildStation(layers, atlas, world)
  buildRailings(layers, world)
  buildDeadEnds(layers, atlas, world)
  buildClosures(layers, atlas, world)
  buildViaducts(layers, world)
  buildPlates(layers, atlas, world)
  buildLandmarkSigns(layers, atlas, world)
  buildCables(layers, world)
  return { layers, lights, stats: { facades: world.facades.length, props: world.props.length } }
}
