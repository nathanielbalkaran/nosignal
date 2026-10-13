# NO SIGNAL — Development Log

## Commands

| Command                 | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `npm install`           | Install dependencies                                           |
| `npm run dev`           | Start the dev server (http://localhost:5173)                   |
| `npm run build`         | Typecheck, then production build to `dist/`                    |
| `npm run typecheck`     | Typecheck only                                                 |
| `npm run lint`          | ESLint                                                         |
| `npm run check:world`   | Validate the district layout (routes, reachability, sightline) |
| `npm run test:movement` | Headless controller and collision tests                        |
| `npm run validate`      | All of the above: build, lint, world checks, movement tests    |
| `npm run preview`       | Serve the production build                                     |

Every phase must finish with `npm run validate` passing.

The scripts in `scripts/` run directly on Node 24 (native TypeScript type
stripping), so they import with `.ts` extensions and use only erasable syntax.

## Project Structure

```
src/
  main.tsx              Entry point
  App.tsx               Top-level composition: canvas, overlay, dev tools (dev only)
  config/               Tunable constants
    scene.ts            Sky, fog, lighting, camera
    player.ts           Movement speed, acceleration, eye height, mouse look
  world/                Pure data and logic, no Three.js
    layout.ts           The district: nodes, streets, blocks, landmarks, routes
    types.ts            Layout and built-world types
    build.ts            Layout -> world (footprints, lots, obstacles, nav graph)
    geometry2d.ts       2D vector/polygon helpers, seeded PRNG
    collision.ts        Player-vs-world collision and movement
    navigation.ts       Street-graph analysis (routes, loops, disjoint paths)
    reachability.ts     Walkable grid flood fill and A* using the real collision
    faces.ts            Street graph -> city blocks (planar face traversal)
    analysis.ts         Sightlines, station visibility, lost-walker simulation
    validate.ts         Layout checks shared by the script and the dev map
    goal.ts             Arrival test: within reach of any station entrance
  game/session.ts       Session status (ready / playing / paused)
  player/               Player state, keyboard, first-person controller
    movement.ts         Pure movement step shared by the controller and the tests
  rendering/            R3F scene: canvas, lighting, ground
    world/              Greybox renderers built from the world data
  ui/                   DOM overlays (start / pause screen)
  dev/                  Dev-only tools, lazy-loaded and excluded from production
scripts/
  check-world.ts        CLI for the layout checks
  test-movement.ts      Headless movement and collision tests
```

Coordinates: metres, +Y up, ground at y = 0. North is −Z, east is +X. 2D
layout points are `[x, z]`.

## Dev Tools (development builds only)

- **M** opens an overhead map: streets, blocks, landmarks, navigation graph,
  the three designed routes, all layout checks, and the live player position.
  Click to teleport. A toggle overlays the walkable area.
- A small HUD shows position and heading.
- URL options for screenshots: `?view=x,z,heading,pitch[,deck]` places the
  camera; `&clean` hides the overlays.

`App.tsx` imports the dev tools behind `import.meta.env.DEV`, so Vite drops
them from production builds. Verified by searching `dist/` for dev-only
strings.

## Dependencies

| Package            | Version | Why                         |
| ------------------ | ------- | --------------------------- |
| react, react-dom   | 19.3    | UI framework                |
| three              | 0.186   | 3D rendering                |
| @react-three/fiber | 9.8     | React renderer for Three.js |

Dev: vite 8, typescript 6, eslint 10 with typescript-eslint and React hooks
rules, @types/node (for the scripts).

Drei was removed in Phase 1. Its only use was the Phase 0 orbit camera.

## Third-Party Assets

None. Phase 2 is entirely procedural (Three.js geometry and canvas textures). Every asset added later must be listed here with source and licence.

## Phases

### Phase 0 — Foundation ✅ (2026-10-12)

Implemented:

- Vite + React + TypeScript project with strict TS settings and ESLint
- React Three Fiber canvas with ACES filmic tone mapping, sRGB output, PCF shadows
- Early-evening lighting: cool hemisphere fill plus a low, warm directional sun
- Sky colour and distance fog
- Scene constants centralised in `src/config/scene.ts`
- Temporary orbit camera, scale references and dev overlay (all removed in Phase 1)

### Phase 1 — World Layout ✅ (2026-10-12)

Implemented:

- The complete greybox district, defined as data in `src/world/layout.ts`:
  10 intersections, 8 independent loops, varied street widths and angles, no
  dead ends. See GAME_DESIGN.md for the layout.
- Generated building lots along every street frontage (seeded, deterministic),
  plus landmark masses: the corner building, the restaurant and the station.
- Elevated footbridge over the trunk road with walkable stairs and deck.
- Market stalls along Kam Fung Street.
- Fenced trunk road with kerb railings, two zebra crossings, and invisible end
  barriers that close the district.
- First-person controller: WASD, pointer-lock mouse look, Esc to pause,
  3 m/s walking speed, 1.62 m eye height, smoothed acceleration, no jump or sprint.
- Custom collision: circle-vs-polygon push-out, axis sliding, 0.45 m step
  height, stairs, deck surfaces with clearance underneath, deck edges as railings.
- Dev overhead map and HUD (development builds only).
- Automated validation: 17 layout checks and 11 movement tests, including bots
  walking all three designed routes and a 200,000-step random-walk fuzz test.
- Sun shadows follow the player, snapped to shadow texels.

Verification:

- `npm run validate` passes: build, lint, 17/17 layout checks, 11/11 movement tests.
- In the browser, keyboard movement was checked through the real controller:
  walking speed, wall stop and sliding, and no movement while paused.
- Mouse look could not be tested automatically, because the automation browser
  refuses pointer lock. It needs a manual check.

Known limitations:

- Everything is greybox: untextured masses with no windows, signage or detail.
- The district's ends on the trunk road are closed by invisible barriers.
- The player can step onto the trunk carriageway at the zebra crossings and
  walk along it between the kerb railings.
- The station is visible from the trunk road itself (by design it is hidden
  from the start and from most of the interior).
- At the Phase 1 speed of 3 m/s, the shortest walk to the station took about 100 s.
  Phase 1.5 retuned this.
- The production bundle is about 1.16 MB (320 KB gzipped), almost all of it
  Three.js.
- React Three Fiber 9.8 still uses `THREE.Clock`, which triggers one harmless
  deprecation warning from Three r186.

### Phase 1.5 — Movement and Pacing ✅ (2026-10-12, awaiting review)

Implemented:

- All movement tuning lives in `src/config/player.ts`. `PLAYER.speed` is the
  single traversal-pace dial.
- Speed raised from 3 to 5.5 m/s (1.83×). The average link between
  intersections now takes about 10 s instead of 18 s.
- Snappier response. The player reaches 90% speed in about 0.12 s and stops in
  about 0.23 s, gliding 0.15 m. Smoothing is now frame-rate independent.
- Diagonal input is normalised, so all directions move at the same speed.
- Pausing freezes the player at once instead of letting them glide.
- Collision is sub-stepped (`MAX_COLLISION_STEP`, 0.12 m). No single step can
  carry the player through a railing or off a deck edge, whatever the speed or
  frame time.
- The camera tracks stair slopes exactly and eases only over small ledges, so
  eye height stays consistent.
- The movement step is a pure function in `src/player/movement.ts`. The game
  and the headless tests run the same code.
- `check:world` prints a pacing report: time per link and per designed route at
  the configured speed, with links over 12 s flagged.

- Approved layout change: the station now has a second, west entrance facing
  the footbridge.
  - The station block extends west to x = −10.
  - Its west end sits on the promenade building line, so the entrance canopy
    and sign are in view from the footbridge stairs.
  - East of Po Sin Street (T3) it steps back to the original forecourt.
  - Reaching either entrance counts as arriving.
  - The footbridge-to-station leg dropped from 117 m (21 s) to 36 m (7 s).
- Southern Ching Wan Road (76 m, 14 s) was kept as is, by decision: the
  backstreet route can feel longer.

Verification:

- `npm run validate` passes: 17/17 layout checks and 16/16 movement tests.
- New tests cover:
  - Speed in every direction, start/stop response, and camera height.
  - Tunnelling at 4× speed and 20 fps. This test fails when sub-stepping is
    disabled.
  - Two random walks with variable frame times. One roams the district; one
    starts on the footbridge so the stairs and deck are always covered.
- In the browser, the real controller measured about 5.5 m/s forward and
  diagonally. It glides 0.14 m after release and stays still when paused.

Pacing at 5.5 m/s (see `npm run check:world`):

- Designed routes take 57 s (Shun Hing Street), 41 s (market and footbridge)
  and 67 s (backstreet) for someone who knows the way. The footbridge route is
  now the quickest, which rewards using the landmark.
- The average link between intersections is 51 m, about 9 s.
- Walking every link in the district once takes about 4 minutes.

### Phase 1.75 — Labyrinthine World Redesign ✅ (2026-10-12, awaiting review)

Goal: make navigation the challenge. No speed change, no new mechanics, no
bigger map, greybox only.

Implemented:

- New street network in `layout.ts`: 20 junctions, 15 loops, narrow winding
  backstreets, offset junctions, short links (average 31 m) and 3-4 m alleys.
  The long straights (Shun Hing Street, the southern lane, Ching Wan Road) now
  zig-zag. The playable area is the same as before.
- City blocks are derived from the street graph (`faces.ts`, 17 blocks), so
  buildings follow every bend. Blocks can still be placed by hand (the outer
  ring, the station and the north side).
- Alleys (`alley` street kind) and three gated dead ends (`blocked: { at }`).
  A gate is a solid 2.8 m obstacle; the nav graph treats the street as closed.
- Station has two entrances (`ST`, `STW`) merged for topology checks.
- Landmarks redistributed: footbridge and market in the west, corner building
  in the east, restaurant in the centre, station hidden to the north.
- `analysis.ts` and `validate.ts` add checks for sightlines, station
  visibility, dead ends, loops, route overlap and decisions per route.
- `test-movement.ts` now picks its test locations from the layout instead of
  hard-coded coordinates.

Verification: `npm run validate` passes (build, lint, 22/22 layout checks,
16/16 movement tests). Checks include:

- 20 junctions, 3 dead ends, 15 loops, 3 street-disjoint routes.
- Every nav node and both entrances reachable on foot; the player cannot walk
  out of the district; a random-walk fuzz never gets trapped.
- Station not visible from the start, and visible from under 10% of positions.
- Typical longest view 41 m; 90th percentile under 70 m; under 2% above 80 m.
- Each route passes 4-5 junctions.

Pacing at 5.5 m/s (`npm run check:world`):

- Known-route times: 59 s main street, 42 s market, 41 s backstreet.
- Lost-walker simulation (not a playtest): median 2.1 min, 90th percentile
  5.7 min with no sense of direction; median 1.2 min if heading north.

Known limitations:

- The requested 2-3 minute pace for an experienced player is not reached.
  At 5.5 m/s and with the map not enlarged, a 230 m route takes about 40 s.
  Reaching 2-3 min would need a slower speed or a bigger map, both ruled out.
  The wanderer figures suggest first-time players land nearer 2-6 minutes
  than 5-8. These need real playtesting.
- The 70 m sightline limit was loosened from 60 m after the zig-zags were in.
- The trunk road has no sidewalk; buildings stand against its railings.
- The far side of Tai Ping Alley (beyond its gate) cannot be reached. This is
  by design.
- Not verified in a browser this phase (the dev server was not reachable from
  the browser tool), so the overhead map and first-person views have not been
  eyeballed. Mouse look is untested.

### Phase 2 — World Atmosphere and Environmental Density ✅ (2026-10-12, awaiting review)

The greybox is now a dense, muted, pre-dawn low-poly neighbourhood. The street
network, the 5.5 m/s speed and the maze layout are unchanged. No third-party
assets, no new dependencies, no `Math.random`.

Structure (rendering is in `src/rendering`, world data stays pure TS):

- `rendering/facade/` builds every facade from a spec: walls, windows, balconies,
  AC units, pipes, grilles, shutters, awnings, shops and restaurant fronts, roof
  features (`upper.ts`, `ground.ts`, `roof.ts`), plus side and back walls
  (`mass.ts`) and street plates, cables and landmark boards (`fixtures.ts`).
- `rendering/props/` has the reusable prop builders (vehicles, street furniture,
  vegetation, construction, clutter).
- `rendering/environment/` merges everything into chunked layers
  (`base`, `detail`, `props`, `emissive`, `signs`, `signsLit`, `mesh`, `glow`) and
  culls chunks by distance. Detail and props switch off at 30 m and 85 m.
- `world/facades.ts` makes facade specs per street character, fills uncovered
  wall stretches with low-rise infill, and picks a few lit shops. `world/props.ts`
  does seeded, zone-aware placement with clusters and gaps.
- Lighting: cool hemisphere light, one dim shadowless directional light, up to 8
  static point lights from lit shops, fog, a gradient sky dome and a skyline ring.
  No shadows or post-processing.
- Signs use a curated Traditional Chinese and English label set on a procedural
  canvas atlas (it throws if full).

Tuning: `src/config/environment.ts`. `density` (clutter, vehicles, vegetation,
construction, signage, litWindows, occlusion), `clearance.margin`, `seed` and
`render` distances. Same seed and densities always give the same district.

Dev tools: the overhead map (`dev/DevMap.tsx`) can show props (red tall solid,
orange low solid, blue passable) and corridors and keep-outs. In dev builds
`window.__env` reports facades, props, triangles and draw calls.

Verification:

- `npm run validate`: build, lint, 32 world checks and all movement tests pass.
  World checks now include fat-clearance reachability (+0.25 m), no pinched
  links, routes open, no solid prop inside a building, keep-outs clear, nothing
  solid within 6 m of a station entrance, the construction area still passable,
  curated labels only, and a determinism fingerprint (built twice).
- The free-movement tests (speed, sliding) now run on the district with props
  removed, because the clutter left no clean 30 m stretch. Props are still
  covered by the three bot routes and the random walks.
- Inspected first-person in the embedded browser: Shun Hing Street, a lit
  convenience store, the construction area, the cha chaan teng, the market and
  footbridge stairs, the station entrance, the spawn alley and Hoi Pong Road.
  The footbridge deck interior was only seen before its roof was changed.

Performance (about 777k triangles in total, about 290k in view, about 81 draw
calls): measured only in the embedded browser at roughly 24 to 32 fps, which
is probably software rendering and so not reliable. The detail layer is the
biggest share. Not measured on real hardware.

Known limitations:

- Detail triangle count is high. Lower `detailDistance` or merge more if needed.
- No covered walkway. Only about 23 vehicles.
- Sightline openness before and after was not measured.
- Mouse look and pointer lock were not tested.
- Phase 1 stalls and railings are still recoloured boxes.

### Phase 2 fix — Station ✅ (2026-10-12, awaiting review)

Diagnosis (by reading the code and viewing it first person):

- The station was still Phase 1 placeholder geometry. Its walls were an
  untextured `#6d706e` extrusion, 16 m high and about 90 m wide along the front,
  with three greybox boxes on each entrance (a slab, a dark door box and a sign
  band). Positions and orientations were correct, nothing was clipped or
  occluded, and no materials were missing.
- Separate bug in Phase 2's `infillLots`: lots lying on the same line as a block
  edge (but past its ends) were counted as covering it, which opened "gaps"
  beyond the edge. That produced 117 phantom facade pieces, including a row of
  shopfronts standing in front of the west entrance. Now clamped to the edge
  (424 to 307 infill pieces, 709 facades in total).

Changes:

- New `rendering/facade/station.ts`. It draws the frontage of the station
  footprint: pilaster bays with roller shutters, lit display cases and vents, a
  dark fascia band, two rows of mostly dark windows (a few lit), cornice and
  parapet. `mass.ts` skips those edges. `stationFronts()` is the single place
  that decides which edges they are.
- Each entrance has a surround, a recessed stairwell with a landing, steps and
  handrails going down into a dark void, a ceiling-lit "往月台 TO PLATFORMS"
  board, a cantilevered canopy with a dim lit underside, the lit 海旁站 / HOI PONG
  STATION board, and a cool light pool on the pavement. The main entrance also
  has a 鐵路 RAIL plate.
- Removed `Station.tsx` and the station boards from `fixtures.ts`.
- Collision and positions are unchanged. The stairwell is visual only: the
  footprint is still solid, so the player cannot enter. The win trigger still
  fires at the entrance node in front of each doorway.

Verified: `npm run validate` passes (32 checks and all movement tests). Checked
that the doorway interior is solid, the forecourt in front of it is open and
within the goal radius, and the station is not visible from the spawn. Viewed
first person in the embedded browser: the main entrance from the forecourt, the
frontage at an angle, and the west entrance from the crossing.

Limits: the stairs are an illusion (the ground plane cannot be cut, so the
steps are drawn flat and darken as they drop away). The long side and rear
walls of the station are still plain; they are party walls and not on a route.
The forecourt paving is untouched. The embedded browser viewport is narrow, so
wide shots of the whole frontage were not possible.

## Phase 2.5A — retro visual & performance pass

- **Low-res rendering**: `RETRO_RENDER_HEIGHT` (360) in `src/config/scene.ts`. `GameCanvas` sets the renderer pixel ratio from the viewport height (`retroDpr`), so the WebGL drawing buffer really is ~360 px tall (width follows aspect); CSS `image-rendering: pixelated` upscales it. MSAA is off. HTML UI stays native resolution. No post-processing.
- **Textures**: `src/rendering/geo/retroTextures.ts` — cached 64/128 px procedural concrete/plaster/asphalt/pavement, nearest filtered, multiplied with vertex colours. Plaster is shared by all building/prop layers via world-space UVs (`Geo.build({ tile })`, 4 m per tile); asphalt on roads; pavement on the ground plane.
- **Lighting**: slightly stronger cool hemisphere to offset the textures; the 8 arbitrary (non-nearest) point lights were removed in favour of the existing emissive and glow layers. Nothing casts shadows.
- **Fog**: unchanged blue-grey fog (14–120 m) already suited the brief.
- Not done: dedicated shutter texture (shutters are not a separate material/layer — needs Phase 2.5B geometry tagging).

## Phase 2.5B — environmental refinement & station approach (awaiting review)

**Rendering fixes.** Solid, sign and emissive materials are now `DoubleSide` (wrong-winding quads no longer vanish); the mesh-net texture uses nearest filtering without mipmaps; road/paving/zebra layers are separated by 1 cm steps to stop z-fighting. Kerb railings are real posts and rails (`facade/boundary.ts`), no longer flat panels.

**Props.** `world/props.ts` has per-kind `LIMITS`, per-street `characterOf()` multipliers (`world/zones.ts`) and authored clusters (bicycle groups, scooter rows, delivery areas). Props dropped from ~676 to ~211; `check:world` caps repetitive kinds. Facade AC units are per-building (half have none).

**Street identity.** `characterOf` drives clutter, vehicles, AC, signage and shuttering per street. The restaurant's neighbours are shuttered, unsigned and darker so the lit cha chaan teng stands out; alleys are dark with grilles, pipes and service doors.

**Dead ends.** `blocked` alleys carry `ends: [DeadEnd, DeadEnd]` (`service`, `gate`, `construction`, `retaining`), built as solid building ends in `facade/boundary.ts`. Trunk ends are closed by roadworks (barriers, mesh, lamps) with a viaduct and skyline behind. Gate collision is 4.6 m thick so dressing is never walkable.

**Station.** The plaza is gone. Two 11 m pockets (`STATION`, `STATION-W`) are cut into the north frontage block (`NORTH-STATION`) and are only visible from the trunk once you are near the mouth. Entrance, canopy, sign, stairwell and light are in `facade/station.ts`; a transit plate marks each pocket. Nodes ST/STW and the win trigger sit at the entrances.

**Checks.** `npm run validate` passes (33 world checks, movement tests). Triangles ~766k, 27 draw calls at a typical view.

**Needs manual inspection.** Market awnings and the restaurant street at night; the Yi Wo service face; the east pocket from the trunk; the viaduct silhouette from the east end; overall fog/skyline at the north edge; gameplay feel of the narrower station approach.

## Phase 2.6 — A city waking up (awaiting review)

Environmental atmosphere only. No new dependencies, no audio files, no `Math.random`, no changes to the street network, collision, controls or renderer.

**Audio** (`src/audio/`). Everything is generated at start-up into 18 small mono buffers (16 kHz, about 4 MB of samples): `synth.ts` makes them, `zones.ts` says where each lives, `ambient.ts` plays them. Beds loop and fade by distance: traffic (louder near the trunk road), low hum, ventilation (louder in backstreets), restaurant fan, railway, plus a van engine for the event. A bed's source only runs while it is audible. One-shots (birds, distant household sounds, dishes, shutters, delivery thumps, construction clanks, a train pass, a muffled announcement) are scheduled with seeded timing, only when the player is in the zone, with at most three overlapping. The `AudioContext` is created on the first click, suspends on pause, blur or a hidden tab, and does nothing if Web Audio is missing. Optional real recordings are not wired in; to add one, decode a file in `ambient.ts` and use it in place of the buffer of the same `SoundName`. List its source and licence under Third-Party Assets.

**Ambient life** (`src/rendering/ambient/`, one `useFrame` in `AmbientLife.tsx`; time only advances while playing, so pausing freezes it all):
- `motion.ts`: 10 wall fans (one instanced mesh), 8 swinging shop signs, and a stuttering tube in two convenience shops. Only things within 70 m update.
- `windows.ts`: 96 dark windows, spread out on a grid, are covered by one instanced quad each (`facade/windowLog.ts` records the real window rects while facades are built). 20 start lit, about a fifth of them blue like a television. One window changes every 22 to 48 s, within 14 to 85 m of the player.
- `restaurant.ts`: on the cha chaan teng, a ceiling fan, a tube that stutters now and then, a flat silhouetted cook who occasionally stirs, and five steam sprites from a kitchen vent on the alley side. The entrance and interior are untouched.
- `pedestrians.ts`: three scripted figures (Kam Fung St / Fuk Wing Lane junction, a commuter going into a doorway on Shun Hing St, Fuk Tai Alley across to Lung Hing Alley). Each is triggered by proximity, waits until its start is out of sight, walks 13 to 30 m once and vanishes. They have no collision.
- `events.ts`: A) the shutter of shop `F2.6` on Shun Hing Street rises in 3.5 s with a rattle and shows a dim shop. B) A delivery van comes down Ching Wan Road, turns onto Hoi Pong Road and into Chung Wo Street (about 25 s). It brakes if the player is within 9 m. Both run once.

**Dev.** `?live` (dev builds only) keeps the ambient layer running while the pointer is unlocked, for screenshots.

**Cost.** About 9 draw calls for fans, windows, signs and tubes, 5 steam sprites and up to about 30 small meshes while a figure, the van or the shutter is active. No lights, shadows or post-processing. Not measured on real hardware.

**Verified.** `npm run validate` passes (33 world checks, all movement tests, build, lint). Pedestrian and van paths were checked against building footprints in Node. The embedded browser could not reach the dev server, so nothing here has been seen or heard.

**Needs manual testing.** Loudness balance and whether the beds feel too busy; the audio gesture on a first click in Safari; the van's apparent size and the shutter slats' colour against the static shutter; whether steam sprites read at 360p; whether covered windows match their neighbours; frame rate with the van and a figure on screen; pedestrian triggers feel natural on the three designed routes.

## NPC visual overhaul (awaiting review)

Pedestrians are now built by `rendering/ambient/figures.ts`: tapered torso, neck, rounded head with hair and two dark eyes, shoulders, two-part arms and legs, hands and shoes. Parts are merged per joint into vertex-coloured geometry (nine meshes per figure, one shared flat-shaded material, about 800 triangles each). Three archetypes with different silhouettes and gaits: an elderly resident in a long coat (stooped, short stride, 1.15 m/s) on the Kam Fung junction route, a commuter in a jacket with a shoulder bag (1.55 m/s) on the doorway route, and a courier in work clothes with a cap, pack and reflective band (1.7 m/s) on the alley route.

Walk cycle is procedural: hip swing, knee flex on the forward swing, opposing arms with elbow bend, pelvis drop, shoulder counter-twist and lean. Stride length follows walking speed. Measured in Node over a gait cycle: feet stay within about 1 cm of ground level.

Routes and triggers are unchanged. New: corners are rounded and figures turn at a limited rate, and at the end of a route a figure keeps walking straight until it is out of sight (up to 30 m) instead of vanishing in view; the doorway commuter goes in.

Not seen in a browser (the embedded one cannot reach the dev server). Needs a look at close, medium and long range.

## Phase 2.8: market street and footbridge redesign (awaiting review)

**Market.** `world.stalls` is now a hand-composed run per side of Kam Fung Street (`rows` in `world/build.ts`) instead of two mirrored rows: six kinds (`produce`, `tarp`, `open`, `storage`, `kiosk`, `shutter`) with varied length, depth, counter height, awning height/projection, folded awnings and gaps (doorway breaks, a quiet section, a cluster of equipment). Two stalls have a warm unlit lamp. Each stall's collision is its footprint only (inner edge never closer than ~2.65 m to the centre line, so the aisle and the stair foot stay clear). `StreetObjects.tsx` builds every stall from instanced boxes (new optional `pitch` on `BoxSpec`, `slab()` helper, `unlit` flag on `InstancedBoxes` for lamps). Aisle props in `props.ts` now follow the stall that owns them. Damp patches and a gutter are flat boxes on the market floor.

**Footbridge.** Visual only (`Footbridge.tsx`); `layout.footbridge`, decks, ramps, columns and obstacles are unchanged, so traversal is untouched. Thin deck slab with girders, cross beams and a conduit; open steel stairs (treads at the walkable height, risers, stringers, soffit, legs, nosing); railings with a lower panel, mid and top rails and posts, joined at stair heads; slim piers with plinth and crosshead; roof with trim, posts and lamps. `npm run test:movement` and `check:world` pass.

**Needs manual testing.** A full walk up, across and down both stairs (only the existing scripted movement tests were run); the market at game resolution; the north stair head against the neighbouring wall.

## Phase 2.8B: material pass (awaiting review)

`retroTexture` gained two recipes (`metal`, `fabric`), same generator, size and nearest filtering. `BoxSpec.surface` selects one; `InstancedBoxes` now draws one mesh per surface using a shared cached material whose vertex shader maps each face by its real size (`TILE`), so long decks and awnings don't stretch. Stalls use metal frames, concrete counters, fabric awnings/tarps and plaster crates; the bridge uses concrete for deck, treads and piers and metal for rails, roof and steel. Lamps stay unlit and untextured. Trucks and vans (geometry unchanged) have duller palettes and stronger grime. Geometry, collision and placement are untouched.

### Phase 2.6 — Pre-dawn lighting & fog

- Fog was attached and enabled, but linear `Fog` at 14–120 m left buildings at 40 m only ~25% fogged and most of the district under 60% fogged. The ring skyline is unlit and fog-free, so it stayed crisp and dark. The weak settings were the cause, not a rendering bypass.
- Now native `FogExp2` (`FOG_DENSITY` in `src/config/scene.ts`), colour shared by the background, sky-dome horizon and skyline base (`FOG_COLOR`). Chunk culling distance is derived from the density (`FOG_CULL_DISTANCE`).
- Ambient: `AMBIENT_INTENSITY` scales the hemisphere and fill lights (hemisphere 6.4 to 5.3, fill 1.5 to 1.2, darker ground bounce).
- Additive light decals (streetlight and shop pools) now fade with distance instead of ignoring fog; skyline towers have the haze baked in (`SKYLINE_HAZE`); streetlight pool strength is `LAMP_POOL_STRENGTH`.
- Fog does not make rendering cheaper; no performance change is claimed.

## Phase 3B — Navigation design (awaiting review)

No new streets, geometry, collision, timer or speed changes. `npm run nav:audit` (`scripts/nav-audit.ts`) prints start and entrance coordinates, route lengths and times at 5.5 m/s, and station visibility from the spawn and the footbridge.

**Audit (measured).** Start (-96, 52); entrances ST (80, -109) and STW (2, -104.5), 239 m and 185 m in a straight line. Street-graph lengths: shortest 218 m (40 s); market and footbridge 234 m (42 s); backstreets 235 m (43 s); Shun Hing Street 319 m (58 s); the market route with two deliberate wrong turns 483 m (88 s). Ground-only A* with real collision (stairs solid, so no bridge): 233 m to STW, 283 m to ST. Real walking adds a few percent. The lost-walker simulation (not a playtest) gives a 90th percentile of 5.7 min. A player who knows the way has about 8 of 9 minutes spare, so the challenge comes from finding the way, not the clock; the timer was not touched. All three routes were already distinct and overlap little; nothing was changed.

**Clues.** Five directional plates (`WAYFINDING` in `world/signage.ts`, placed in `props.ts`, drawn by `facade/fixtures.ts`): 往海旁站 / TO HOI PONG STATION with an arrow along the street, in the existing blue transit plate palette. They are on Kam Fung Street south of the market, the market's north end, Wing On Lane, Chung Wo Street and Ching Wan Road. Left or right is worked out from the wall the plate is on. None are near the start, and the backstreet and main routes get only one each. The station name is the existing 海旁站 HOI PONG STATION; the entrance board, the existing 鐵路 plates by the trunk road and the pocket plates are unchanged. Check `Every directional station sign found a wall` in `check:world`.

**Audio.** New wide, faint `railFar` zone (120 m around the entrances): the rail bed gets a floor of 0.035 and a muffled, quiet distant train now and then. Both go through the Ambience bus, so the slider and mute apply, and the music level is untouched. Nothing is directional.

**Bridge.** Unchanged. Measured: the station sign band is visible from 1 of 32 sample points on the deck and stairs (the south stair head, 60 m away, deep in fog), so the bridge does not reveal the entrance.

**Landmarks.** The corner tower (teal, ribbon windows, 40 m), the lit red restaurant, the market and the green footbridge sign were left as they are; no new landmark objects.

**Dev.** The dev HUD now shows start and entrance coordinates and the straight-line distance to the nearest entrance. The dev map already draws the three routes; F6 resets to the start.

**Needs manual playtesting.** Whether the plates are readable at 360p (they are 1.9 m wide and sit at 2.9 m; check the arrow glyph in the CJK font used), their arrow direction on each street, whether they sit clear of awnings in the market, how loud the far train is, bridge views at dawn light, and whether the clues make the route too easy. The embedded browser cannot reach the dev server, so none of this has been seen.
