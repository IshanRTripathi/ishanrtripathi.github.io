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

- `src/interior/rooms.js`: the rooms. Each one returns its scene pieces, its lights, its walls and furniture as colliders, the spawn point, the exit, and its **points** (things to use: a screen that opens a card, a counter that shows a line, a seat to sit on). A room can also give an `animate(time)` hook for its own movement, such as the lounge's pulsing tiles and mirror ball.
- `src/interior/interior.js`: the controller. Entering and leaving (with a short fade), walking with the same camera-relative controls and collisions as outside, sitting and standing up, the room camera, and the prompts.
- `src/world/layout.js`: which sites are enterable (`interior: 'cinema' | 'hospital' | 'cafe' | 'arcade' | 'studio' | 'lounge'`) and where each front door is (`entrance`).
- `src/world/buildings.js`: the outside of each enterable building (the cinema already had one; the hospital and the lounge are new).
- `scripts/check-world.mjs`: each door must open onto a road within 2.6 m, be on land, and have a room.

Rooms built so far:

- **The movie hall** (the career cinema): a pulsing screen that opens the career card, rows of seats to sit on, a ticket counter and a popcorn stand. Two people sit in the rows.
- **The hospital** (a new building): reception, waiting benches, beds and a vending machine. A notice board opens the contact card. Someone waits at reception.
- **The café** (the chai shack): a counter with tea urns, stools, tables by a window to the sea. "Order a chai" opens the contact card. Two people sit at a table.
- **The Game Arcade**: three game cabinets, one per game, each opens the arcade hall. Benches to watch from. Someone plays nearby.
- **Ishan's studio** (the start of the game): a sofa, a desk whose monitor opens the career card, a pin board that opens the contact card, a bookshelf and a window to the sea.
- **The Velvet Lounge** (the night club, new, on the main street): a dance floor of tiles that pulse in turn, a DJ booth with two speakers and a script sign, a mirror ball, a bar with three stools and a bartender, and two booths. "Book the DJ" opens the contact card. Four people are in the room: a bartender, two dancers and a bouncer by the door.

## Assets

Each room is built from code today, so no files are needed. The parts a room uses:

- **Shell**: floor, walls, a door opening, optional lintel. Clay material, the same as the city.
- **Furniture**: seats (cinema rows), counters (ticket, popcorn, reception desk), benches, beds with curtain, vending machine, notice board.
- **Light**: a hemisphere light and one to three point lights per room. Warm-dark for the cinema, bright white for the hospital, pink, cyan and purple for the lounge (its purple light sweeps over the dance floor).
- **Signs**: `neonSign` (already used on the streets), a red cross made of two glowing bars, a glowing screen.
- **Characters**: Ishan (the existing model). The people on the road (`npc-female`, `npc-male`) can later sit in a room too; the model and its clips already exist.
- **Sound**: generated in code (`src/core/audio.js`). Each room has a quiet bed on its own output (a hush, a hum with a monitor beep, a café murmur with cups, arcade bleeps, room tone, and the lounge's bass with a kick drum on every beat). The city's sounds drop while you're inside, and a short door thud plays on entry and exit.
- **People**: copies of the same rigged figures as the people on the road, seated or standing where the room says.

For the next rooms, the candidates are a café (the chai shack needs a different front, because its stool is in front of it), the arcade (the cabinets and the existing game overlay), Ishan's studio (a living room), and a bank, a shop or a library. Any new third-party models must be CC0 or similar, with the credit added to `public/models/CREDITS.md`, and each pack's licence checked first (Kenney's packs are CC0, for example).

## Load and draw cost (measured)

- City, in the same view: **237 draw calls, 396,097 triangles** per frame.
- Movie hall: **6 draw calls, 1,154 triangles**. Built once in about 15 ms.
- Hospital: **5 draw calls, 314 triangles**. Built once in about 2 ms.
- Velvet Lounge: **16 draw calls, 7,788 triangles** for the room, and **28 calls, 20,894 triangles** with its four people. The dance-floor tiles pulse with their own materials, so each is its own draw call, and the ball is a sphere with 320 triangles.
- While inside, the city, traffic, birds, weather and planet are not updated or drawn.
- Rooms are cached once built, so going in again is instant.

## Not built

- **A strip club.** A portfolio site should not have one, so it is left out. The Velvet Lounge is the night venue instead: the neon, the music, the bar and the crowd, with no stage or adult-venue staging.
