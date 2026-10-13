# NO SIGNAL — Game Design

This document records the creative and technical decisions for NO SIGNAL.
It is the reference for every phase. Changes require creative-director approval.

## Premise

A short first-person exploration game set in a fictional, Hong Kong-inspired
city district.

The player's phone is dead. Their train leaves in **nine minutes**. They must
find the railway station before it departs.

- Target playtime for a new player: **5–10 minutes**.
- Core mechanic: navigating an unfamiliar place using architectural landmarks,
  street signs, visual clues, and limited human interaction.

## Design Philosophy

1. Minimalism in systems, richness in atmosphere.
2. Every feature must serve navigation, immersion, orientation, or urgency.
3. No unnecessary mechanics or repetitive interactions.
4. The entire game takes place in one small district.
5. The environment must feel intentional, not randomly generated.
6. Players should be able to navigate intuitively, even without a minimap.
7. No runtime AI, multiplayer, accounts, databases, external APIs, or
   complicated progression systems.
8. The game must be enjoyable on its first playthrough.
9. Prioritize environmental storytelling over exposition.
10. Prefer a complete, polished small experience over an unfinished large one.

## World

A fictional contemporary city inspired by older, densely developed Hong Kong
neighbourhoods. Stylized but believable.

Visual characteristics:

- Narrow streets
- Mixed commercial and residential buildings
- Dense shopfronts
- Traditional Chinese and English signage
- Balconies, shutters, AC units, awnings
- Pedestrian bridges
- Urban clutter and environmental details
- Atmospheric early-evening lighting

Avoid: generic American city architecture, exaggerated cyberpunk aesthetics.

## Scope

| Element                    | Amount                         |
| -------------------------- | ------------------------------ |
| Neighbourhood              | One, compact                   |
| Meaningful intersections   | About 8–10                     |
| Railway station            | One (the goal)                 |
| Accessible restaurant      | One                            |
| Recognizable landmarks     | Several                        |

Explicitly out of scope:

- Free-roaming NPC systems
- Traffic simulation
- Unnecessary interiors
- New mechanics not approved by the creative director

## Content Rules

- All world construction is done in code or with automatically integrated,
  properly licensed third-party assets. No hand-modelled or hand-placed assets.
- No unlicensed assets. Every third-party asset is recorded with its source and
  licence.
- No AI-generated dialogue at runtime. All text is authored and shipped with
  the game.
- No placeholder features presented as finished work.

## District Layout

Approved in Phase 1 (greybox). Source of truth: `src/world/layout.ts`.

The district sits south of **Hoi Pong Road (海旁道)**, a wide, fenced trunk
road. The station is on the far (north) side. Pedestrians cross the trunk road
only at the footbridge or at the two zebra crossings, so the trunk road works as
the final threshold rather than as another street.

The station has two entrances, and reaching either one counts as arriving:

- The **main entrance** faces a deep forecourt opposite the two crossings.
- The **west entrance** sits on the promenade and is in view from the
  footbridge stairs.

**Phase 1.75 redesign (labyrinthine).** The district is now a tangle of
backstreets rather than a grid. Source of truth: `src/world/layout.ts`.

- 20 junctions, 15 loops, no long straight lines of sight. Shun Hing Street, the
  southern lane and Ching Wan Road zig-zag so each bend hides the next
  junction.
- Streets range from the 12 m Shun Hing Street, through 8-10 m commercial
  streets and the pedestrian market, down to 3-4 m alleys. Blocks are derived
  from the street network, so the buildings follow every bend.
- Three plausible dead ends are alleys closed by a gate (Tai Ping Alley, Yi Wo
  Lane, Sheung Tai Alley).
- The station is hidden from the start and from nearly all of the district;
  it appears only on approach.

Landmarks, spread out so they can be recognised from new directions:

- **Elevated footbridge** over Hoi Pong Road at the end of the market (west).
- **Kam Fung Street market**: two rows of stalls between Kam Fung Street and
  Hoi Pong Road.
- **Corner building**: a 40 m tower with a rounded corner and a crown at Shun
  Hing / San Tai Street (east), visible over the rooftops.
- **Restaurant**: a low red-fronted building in the centre at Po Sin Lane. It
  is on one route but visiting it is optional.
- **Station**: north of the trunk road, with a west and a main entrance.

Start: the small square at the south-west corner, facing into the district.

Three designed routes (about 230-330 m each), overlapping and reconnecting:

1. **Main street**: Tak On Street, Shun Hing Street past the corner building,
   then Chung Wo Street to the crossing (about 327 m, obvious but indirect).
2. **Market**: Lok Wo Lane, Kam Fung Street through the market, then over the
   footbridge to the west entrance (about 232 m).
3. **Backstreets**: Fuk Wing Lane, Po Sin Street and Lane, Cheung Fat Lane and
   Wing On Lane to the west crossing (about 228 m, the shortest, hard to find).

Wrong turns are recoverable: loops join all three routes.

## Player

- First person: WASD to walk, mouse to look (pointer lock), Esc to pause.
- Brisk game pace rather than realistic walking: 5.5 m/s, with near-instant
  start and stop. Eye height 1.62 m. No jump, no sprint, no stamina.
- Tuning lives in `src/config/player.ts`.

## Technology

- Vite, React, TypeScript
- Three.js via React Three Fiber
- Target: modern desktop browsers
- Simple custom collision detection; no physics engine unless absolutely
  necessary

## Architecture Principles

- **Deterministic world layout stored in configuration.** The district is
  described as data (streets, blocks, buildings, landmarks, signs), and the
  renderer builds the world from that data. The same config always produces the
  same district.
- **Reusable generated components.** Buildings and storefronts are parametric
  components driven by config, not one-off models.
- **Separation of concerns.** Rendering, player controls, game state, and
  interactions live in separate modules.
- **Minimal dependencies.** Add a package only when it clearly earns its place.
- **Performance.** Reuse geometries and materials; use instancing for repeated
  elements (windows, AC units, signs, clutter).

## Conventions

- World units are **metres**. +Y is up. Ground is at y = 0.
- Scene-wide constants (lighting, fog, camera) live in `src/config/`.

## Workflow

The game is built in distinct phases. At the end of each phase:

1. Run the build and validation commands.
2. Fix any errors introduced.
3. Explain what was implemented.
4. Identify known limitations.
5. Stop and wait for creative-director approval.
