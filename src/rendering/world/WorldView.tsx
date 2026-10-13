import { Environment } from '../environment/Environment.tsx'
import { Footbridge } from './Footbridge.tsx'
import { StreetObjects } from './StreetObjects.tsx'
import { Streets } from './Streets.tsx'

export function WorldView() {
  return (
    <group>
      <Streets />
      <Environment />
      <Footbridge />
      <StreetObjects />
    </group>
  )
}
