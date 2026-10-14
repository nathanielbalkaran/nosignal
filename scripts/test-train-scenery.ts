import { createTrainScenery } from '../src/rendering/train/trainScenery.ts'

let failures = 0
function test(name: string, ok: boolean, detail: string) {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`)
}

console.log('Testing Train Scenery & Window Visuals...')

// 1. Rig initialization and child groups
{
  const scenery = createTrainScenery()
  const children = scenery.group.children
  test(
    'Scenery generates all required parallax meshes and sky dome',
    children.length >= 6,
    `children: ${children.length} meshes/groups in scenery root`
  )
  scenery.dispose()
}

// 2. Parallax speeds and layer progression
{
  const scenery = createTrainScenery()

  // Track positions
  // children: [0]=sky, [1]=bgMeshA, [2]=bgMeshB, [3]=midMesh, [4]=landmarkGroup, [5]=fgMeshA, [6]=fgMeshB
  const bgMeshA = scenery.group.children[1]
  const midMesh = scenery.group.children[3]
  const fgMeshA = scenery.group.children[5]

  const initialFgz = fgMeshA.position.z
  const initialBgz = bgMeshA.position.z
  const initialMidz = midMesh.position.z

  // Advance by 1 second at full cruise speed (speed = 1.0)
  scenery.update(10.0, 1.0, 1.0)

  const deltaFg = fgMeshA.position.z - initialFgz
  const deltaMid = midMesh.position.z - initialMidz
  const deltaBg = bgMeshA.position.z - initialBgz

  test(
    'Parallax layers maintain correct relative speeds (Foreground > Midground > Background)',
    deltaFg > deltaMid && deltaMid > deltaBg && deltaBg > 0,
    `deltaFg: ${deltaFg.toFixed(1)}m/s, deltaMid: ${deltaMid.toFixed(1)}m/s, deltaBg: ${deltaBg.toFixed(1)}m/s`
  )

  scenery.dispose()
}

// 3. Narrative progression through all 4 cinematic phases
{
  const scenery = createTrainScenery()
  const midMesh = scenery.group.children[3]
  const landmarkGroup = scenery.group.children[4]

  // Phase 1 (t = 4.0s): Departure in dense claustrophobic alley
  scenery.update(4.0, 4.0, 0.5)
  const posPhase1 = midMesh.position.z

  // Phase 2 (t = 16.0s): Widening avenue and elevated skywalks
  scenery.update(16.0, 12.0, 1.0)
  const posPhase2 = midMesh.position.z

  // Phase 3 (t = 28.0s): THE REVEAL - Open elevated viaduct panoramic view
  scenery.update(28.0, 12.0, 1.0)
  const posPhase3 = midMesh.position.z

  // Phase 4 (t = 41.0s): Re-entry into dense neighborhood with footbridge landmark
  scenery.update(41.0, 13.0, 1.0)
  const posPhase4 = midMesh.position.z
  const landmarkPos = landmarkGroup.position.z

  test(
    'Midground continuously advances through all zones without repeating',
    posPhase4 > posPhase3 && posPhase3 > posPhase2 && posPhase2 > posPhase1,
    `Phase 1: ${posPhase1.toFixed(1)}, Phase 2: ${posPhase2.toFixed(1)}, Phase 3: ${posPhase3.toFixed(1)}, Phase 4: ${posPhase4.toFixed(1)}`
  )

  test(
    'Hoi Pong Road footbridge & landmark correctly align with window during Shot 4 monologue',
    landmarkPos >= -30 && landmarkPos <= 40,
    `landmark position during Shot 4 (t = 41s): z = ${landmarkPos.toFixed(1)}m`
  )

  scenery.dispose()
}

// 4. Memory cleanup on dispose
{
  const scenery = createTrainScenery()
  scenery.dispose()
  test(
    'Disposing scenery cleanly clears all Three.js objects from the scene group',
    scenery.group.children.length === 0,
    `group children after dispose: ${scenery.group.children.length}`
  )
}

if (failures > 0) {
  console.error(`\n${failures} tests failed!`)
  process.exit(1)
} else {
  console.log('\nAll train scenery tests passed!')
}
