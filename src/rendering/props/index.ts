import type { PropInstance, PropType } from '../../world/props.ts'
import { Sink, type Layers } from '../geo/layers.ts'
import type { PropBuilder } from './common.ts'
import { boxes, cart, crates, display, foldedStall } from './commercial.ts'
import { bambooScaffold, coveredWalkway, hoarding, materials, metalScaffold, pipesStack, tempFence } from './construction.ts'
import { barrier, bench, bin, bollard, cabinet, cone, diningSet, planter, pottedPlant, shrub, stool, streetlight, trafficSign, tree } from './furniture.ts'
import { bicycle, car, motorcycle, scooter, truck, van } from './vehicles.ts'

/** One geometry builder per prop type. Each draws in the prop's local frame: +x along its length, +z towards its front. */
export const PROP_BUILDERS: Readonly<Record<PropType, PropBuilder>> = {
  car,
  van,
  truck,
  scooter,
  motorcycle,
  bicycle,
  bench,
  stool,
  streetlight,
  bollard,
  trafficSign,
  cabinet,
  bin,
  barrier,
  tree,
  pottedPlant,
  shrub,
  planter,
  bambooScaffold,
  metalScaffold,
  hoarding,
  coveredWalkway,
  materials,
  pipesStack,
  tempFence,
  cone,
  crates,
  foldedStall,
  boxes,
  diningSet,
  display,
  cart,
}

export function buildProp(layers: Layers, p: PropInstance) {
  const sink = new Sink(layers, 'props', p.at[0], p.at[1])
  sink.at(p.at[0], 0, p.at[1], p.yaw, () => PROP_BUILDERS[p.type](sink, p))
}
