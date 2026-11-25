# Going inside buildings

The character can walk up to a building's front door, press **E** (or the prompt button), go inside, walk and sit around, and come back out at the same door.

## The options we weighed

| Approach | What it costs in the browser | Verdict |
| --- | --- | --- |
| **A. A separate room scene, built from code (in use)** | One small scene per building type, built the first time anyone goes in: a few merged clay meshes, a few lights. About 300 to 1,200 triangles and 5 to 6 draw calls per room, against about 396,000 triangles and 237 calls for the city. | **Chosen.** Nothing to download; the city is not drawn while you are inside. |
| B. Interiors in the same world, city hidden | Keeps the whole city in memory and in the render list. Collisions with the city's colliders and the planet's ground get in the way. | Rejected. |
| C. Interior models as GLB files, one per building, loaded on entry | Each room is a download (typically 100 KB to 1 MB, compressed), plus a loader and a cache. Better detail, and easy to art-direct in Blender. | Good next step for rooms that need real detail (see below). |
| D. Full-screen pictures per room (a "cut-away") | Almost free, but nothing to walk around. | Rejected: not the GTA feel. |

The room scene is the cheapest that still lets you walk around. It also means the GLB route (C) can be added later for any single room without changing the rest.

## What is in the code

- `src/interior/rooms.js`: the rooms. Each one returns its scene pieces, its lights, its walls and furniture as colliders, the spawn point, the exit, and its **points** (things to use: a screen that opens a card, a counter that shows a line, a seat to sit on).
- `src/interior/interior.js`: the controller. Entering and leaving (with a short fade), walking with the same camera-relative controls and collisions as outside, sitting and standing up, the room camera, and the prompts.
- `src/world/layout.js`: which sites are enterable (`interior: 'cinema' | 'hospital'`) and where each front door is (`entrance`).
- `src/world/buildings.js`: the outside of each enterable building (the cinema already had one; the hospital is new).
- `scripts/check-world.mjs`: each door must open onto a road within 2.6 m, be on land, and have a room.

Rooms in this round: **the movie hall** (the career site, screen opens the career card, seats to sit on) and **the hospital** (reception, waiting benches, beds, a vending machine, and a notice board that opens the contact card).

## Assets

Each room is built from code today, so no files are needed. The parts a room uses:

- **Shell**: floor, walls, a door opening, optional lintel. Clay material, the same as the city.
- **Furniture**: seats (cinema rows), counters (ticket, popcorn, reception desk), benches, beds with curtain, vending machine, notice board.
- **Light**: a hemisphere light and one to three point lights per room. Warm-dark for the cinema, bright white for the hospital.
- **Signs**: `neonSign` (already used on the streets), a red cross made of two glowing bars, a glowing screen.
- **Characters**: Ishan (the existing model). The people on the road (`npc-female`, `npc-male`) can later sit in a room too; the model and its clips already exist.
- **Sound**: nothing new yet. The door can reuse an existing sound effect.

For the next rooms, the candidates are a café (the chai shack needs a different front, because its stool is in front of it), the arcade (the cabinets and the existing game overlay), Ishan's studio (a living room), and a bank, a shop or a library. Any new third-party models must be CC0 or similar, with the credit added to `public/models/CREDITS.md`, and each pack's licence checked first (Kenney's packs are CC0, for example).

## Load and draw cost (measured)

- City, in the same view: **237 draw calls, 396,097 triangles** per frame.
- Movie hall: **6 draw calls, 1,154 triangles**. Built once in about 15 ms.
- Hospital: **5 draw calls, 314 triangles**. Built once in about 2 ms.
- While inside, the city, traffic, birds, weather and planet are not updated or drawn.
- Rooms are cached once built, so going in again is instant.

## Not in this round

- **A strip club.** A portfolio site should not have one, so it is left out. A bar or lounge is fine if you want a night venue.
- Ishan's studio interior, the café, the arcade's interior.
- Sound inside the rooms.
- NPCs inside the rooms.
