import { Matrix4 } from 'three'
import type { FacadeSpec } from '../../world/facades.ts'
import type { Layers } from '../geo/layers.ts'
import type { SignAtlas } from '../geo/textures.ts'
import { makeContext, type LightSpot } from './context.ts'
import { drawGround } from './ground.ts'
import { drawRoof } from './roof.ts'
import { drawServices, drawWalls, drawWindows } from './upper.ts'

export type { LightSpot } from './context.ts'

/** Draws one building front into the shared layers. */
export function buildFacade(layers: Layers, atlas: SignAtlas, spec: FacadeSpec, lights: LightSpot[]) {
  const { ctx, frame } = makeContext(layers, atlas, spec, lights)
  const m: Matrix4 = frame
  ctx.s.with(m, () => {
    drawWalls(ctx)
    drawWindows(ctx)
    drawServices(ctx)
    drawGround(ctx)
    drawRoof(ctx)
  })
}
