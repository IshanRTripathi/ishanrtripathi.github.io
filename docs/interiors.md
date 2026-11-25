# Going inside buildings

The character can walk up to a building's front door, press **E** (or the prompt button), go inside, walk and sit around, and come back out. Every room has an **exit door** in its front wall, with a lit green **EXIT** sign above it. Walk up to the door and press **E** to leave through it.

## The options we weighed

| Approach | What it costs in the browser | Verdict |
| --- | --- | --- |
| **A. A separate room scene, built from code (in use)** | One small scene per building type, built the first time anyone goes in: a few merged clay meshes, a few lights. About 300 to 1,200 triangles and 5 to 6 draw calls per room, against about 396,000 triangles and 237 calls for the city. | **Chosen.** Nothing to download; the city is not drawn while you are inside. |
| B. Interiors in the same world, city hidden | Keeps the whole city in memory and in the render list. Collisions with the city's colliders and the planet's ground get in the way. | Rejected. |
| C. Interior models as GLB files, one per building, loaded on entry | Each room is a download (typically 100 KB to 1 MB, compressed), plus a loader and a cache. Better detail, and easy to art-direct in Blender. | Good next step for rooms that need real detail (see below). |
| D. Full-screen pictures per room (a "cut-away") | Almost free, but nothing to walk around. | Rejected: not the GTA feel. |

The room scene is the cheapest that still lets you walk around. It also means the GLB route (C) can be added later for any single room without changing the rest.

## What is in the code

- `src/interior/rooms.js`: the rooms. Each one returns its scene pieces, its lights, its walls and furniture as colliders, the spawn point, the exit, its **points** (things to use), and its **people**. Its pieces are placed by their centre (`RoomKit`), so a wall of height 5 at `y: 2.5` stands on the floor. A room can also give an `animate(time, people)` hook for its own movement, such as the club's tiles, mirror ball and disco spots.
- `src/interior/motion.js`: how the people move. Figures have Idle, Walk, SitDown and StandUp clips, so dancing and fidgeting are done here, bone by bone (hips, torso, head and arms), in the figure's own frame. Walkers follow a route.
- `src/interior/interior.js`: the controller. Entering and leaving (with a short fade), walking with the same camera-relative controls and collisions as outside, sitting and standing up, the room camera, the prompts, and the people and lights of the room each frame.
- `src/world/layout.js`: which sites are enterable (`interior: 'cinema' | 'hospital' | 'cafe' | 'arcade' | 'studio' | 'club'`) and where each front door is (`entrance`).
- `src/world/buildings.js`: the outside of each enterable building.
- `src/core/audio.js`: each room's sound bed, which plays only while you are in that room.
- `scripts/check-world.mjs`: each door must open onto a road within 2.6 m, be on land, and have a room.

## The people

A room lists its people in `npcs`. Each one is a copy of the figure used on the road, and can be:

- **sitting** (`pose: 'sit'`) in a seat the room names;
- **dancing** (`dance: true`, with `energy` from 0 to 1): the arms swing out and forward, the hips roll, the torso turns, and the body bounces twice a swing, in time with the club's beat;
- **fidgeting** (`fidget: true`): standing, with a sway and a look around;
- **walking** (`walk: [{x, z}, ...]`): back and forth along a route, with a short pause at each end;
- or just **standing** (`pose: 'idle'`), with `y` for a raised floor such as the club's stage.

## Rooms built so far

- **The movie hall** (the career cinema): a pulsing screen that opens the career card, rows of seats to sit on, a ticket counter and a popcorn stand. Two people sit in the rows, and an usher walks up and down the aisle.
- **The hospital** (a new building): reception, waiting benches, beds and a vending machine. A notice board opens the contact card. Two people stand and fidget, and the red cross pulses.
- **The café** (the chai shack): a counter with tea urns and stools, tables by a window to the sea. "Order a chai" opens the contact card. Two people sit at a table, and the barista works behind the counter.
- **The Game Arcade**: three game cabinets, one per game, each opens the arcade hall. Benches to watch from. Two people stand and watch the games.
- **Ishan's studio** (the start of the game): a sofa, a desk whose monitor opens the career card, a pin board that opens the contact card, a bookshelf and a window to the sea.
- **The Gilded Lily** (new, the club on the main street): a strip club in the GTA nightspot style, kept non-explicit. A stage across the back with two dancers and a chrome pole at each front corner, and a neon name over it. A dance floor of tiles that pulse to the beat, a mirror ball, and disco spots that drift round the floor and change colour. A bar along the left wall with a bartender who walks behind it, and three stools. Two VIP booths along the right wall, with velvet curtains and a VIP sign. A crowd dances on the floor, two people are sat in the booths, and a bouncer stands by the door. "Book the VIP room" opens the contact card. The people are clothed, and there is no nudity or sexual content in the room; the staging is lights, neon, music and a bouncer.

## Sound

Generated in code (`src/core/audio.js`). Each room has a quiet bed on its own output, which fades in when you go in and out when you leave. The city's sounds drop while you're inside, and a short door thud plays on entry and exit.

- The movie hall: a hush. The hospital: a hum with a monitor beep. The café: a murmur with cups. The arcade: bleeps. The studio: room tone.
- **The Gilded Lily: a beat at 120 beats a minute**, scheduled on the audio clock: a bass tone, a crowd murmur, a kick on every beat, a snare on the backbeat and a hi-hat on each off-beat. It is silent outside the room.

## Assets

Each room is built from code today, so no files are needed. The parts a room uses:

- **Shell**: floor, walls, a door opening, optional lintel. Clay material, the same as the city.
- **Exit door**: a door leaf in the opening, a frame, a push bar, and an EXIT sign (a neon panel, green).
- **Furniture**: seats (cinema rows), counters (ticket, popcorn, reception desk, bar, café counter), benches, beds with curtain, vending machine, notice board, booths with velvet curtains, a stage and chrome poles, a mirror ball.
- **Light**: a hemisphere light and one to four point lights per room, which breathe a little. Warm-dark for the cinema, bright white for the hospital, pink, gold, cyan and violet for the club. The club's spinning spot and its disco spots move.
- **Signs**: `neonSign` (already used on the streets), a red cross made of two glowing bars, a glowing screen.
- **Characters**: Ishan (the existing model). The people are copies of the figures on the road (`npc-female`, `npc-male`), with their own dancing and walking (see above).

For the next rooms, the candidates are a bank, a shop or a library. Any new third-party models must be CC0 or similar, with the credit added to `public/models/CREDITS.md`, and each pack's licence checked first (Kenney's packs are CC0, for example).

## Load and draw cost (measured)

Measured with the whole room in view (no culling), one frame, on the same renderer settings as the city figures:

- City, in the same view: **237 draw calls, 396,097 triangles** per frame.
- Movie hall: **9 draw calls, 1,218 triangles** for the room, and **27 calls, 20,938 triangles** with its three people.
- Hospital: **7 calls, 376 triangles** for the room, and **19 calls, 13,482 triangles** with its two people.
- Café: **6 calls, 888 triangles** for the room, and **24 calls, 20,608 triangles** with its three people.
- Arcade: **10 calls, 292 triangles** for the room, and **22 calls, 13,398 triangles** with its two people.
- Studio: **7 calls, 518 triangles**, no people.
- The Gilded Lily: **23 calls, 1,716 triangles** for the room, and **83 calls, 67,368 triangles** with its ten people. The people are most of the cost: each figure is about 5,000 to 6,000 triangles, so the crowd is the first thing to trim if it ever needs to be lighter.
- While inside, the city, traffic, birds, weather and planet are not updated or drawn.
- Rooms are cached once built, so going in again is instant.

## Not built

- **Anything explicit.** The Gilded Lily is a strip club in the GTA nightspot style, and it stays non-explicit: the people are clothed, there is no nudity or sexual content, and there are no private-dance areas. A new room that goes further than that is not built.
