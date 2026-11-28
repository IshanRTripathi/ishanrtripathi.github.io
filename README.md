# ishanr.com

An open-world island game with my portfolio built into it. The city island holds the portfolio (the projects, the career poster, the trophies, the chai shack); the islands around it, the vehicles and the missions are the game. The city is in the spirit of the neon Miami crime-game genre (original art, names and story, nothing borrowed from any one game). You walk out of my place, wave hi, and follow the GPS on the minimap past one pastel Art Deco building per project. Step into a glowing marker to open a project briefing, jump in the convertible, on the scooter or into any car in town, catch my career on the cinema poster, and end at the chai shack on the beach where I sit down and wave you over.

The city lives on its own clock. A day takes about eight minutes, with long, slow dawns and dusks: golden hour, sunset over the bay, a blue hour with the first stars, a moonlit night when the neon, windows and lanterns come into their own, and a pastel dawn. The night is quick: it lasts about a minute, a quarter of its old length. Every new day brings the next season (spring blossom, summer, autumn leaves, winter snow), and the weather changes every minute or two to suit it: clear skies, clouds, rain, thunderstorms with lightning, snowfall, morning fog.

Past the city there is an airstrip. Walk up to the little plane at the near end, press E to climb in, and fly: hold R to add throttle, F to ease off, W and S to point the nose up and down, and A and D to bank and turn. Take off down the strip, climb, and come back to land on it. Landing short or too fast bounces you back up (or, if it's bad enough, back to the runway). The Game Arcade hall is past the far end of the strip: walk in through its door and pick a game from the list. Ten original games are there: a stacking tower, a coin catcher, a bouncing paddle, a chai clicker, a lane racer, a palm-merge puzzle, island fishing, Pilot Hop (a flappy plane through the islands' gaps), Island Golf and Shell Match (a match-three of shells). Your best scores stay on this device.

Around the planet are eleven islands, each with its own shape and theme: a jungle cove with a stilt hut, palms and tall rainforest trees; a snowy peak with a log cabin and a warm window, and pines; a dune oasis with a pool, a tent and cacti; a crescent harbour round a deep cove, with a fish market and a boat shed; a volcanic geyser isle with a hot spring and a geothermal station; a four-armed cross cay with a solar farm, a wind turbine and a dive shop; a heart-shaped isle with a ferris wheel and bungalows; and a pearl atoll, a ring of white sand round a lagoon. And three more: Lantern Bay, a rocky cape with a lighthouse whose beam turns; Radio Ridge, with a radio mast whose light blinks and an observatory dome; and Mangrove Delta, a river inlet with houses on stilts. The eleven are scattered in a loose belt round the city, a little under the planet's equator, with open sea between every island and its neighbours (`npm run check` fails if any gap is under 40 metres). Each has its own coast, hills and sea, and its own airstrip, with a plane parked at its near end. Notice boards on the islands give opening times and local facts, buoys bob off the harbour and the cape, and the turbines and the ferris wheel turn. The plane can land on the sea, and a parachute that lands in it floats you back to the nearest shore. Boats are moored offshore, and flocks of birds circle over each island.

Press M (or tap the minimap) for the city map. Every airstrip is a place to fly to: tap it on the map, or use the buttons under the map, and you land beside its plane. A jump is instant and free, so you can go from the city to any island in a moment, and the camera turns to face the strip as you arrive.

The phone (P) has my contacts, career, trophies, a Sky app to pick the time of day, season or weather by hand, and an Errands app: twelve side missions (land on three islands, find four landmarks, sail 300 metres, drive 400 metres, go into three buildings, play four arcade games, score 50 in any game, read four notice boards, land on every island, visit two lighthouses, sit on the chai stool, play every game). The HUD under the minimap shows the one you are on. The Missions app is the jobs from the control tower, like the jobs in an open-world game: fourteen of them, by plane or helicopter (a milk run, a sandstorm drop, ring races round three islands, hops across the islands), by helicopter (a skyline tour, a heli hop), by car or scooter (a three-lap sprint round the loop road and a beach run, through checkpoints, and Close Shave: pass the traffic close, at speed, six times), on foot (City Courier: run from door to door, sprinting and jumping, against the clock) and by boat (a regatta round Pearl Atoll, and the Wavebreaker Run, with ramps to jump the waves and a Shift boost). Start one and a green beam, a row of glowing rings or checkpoint arches shows in the world, the minimap and the city map point straight at it, a card shows the objective and the time left, and a finished job pays out in cash that shows in the HUD. Some are on the clock, and a missed time fails the mission (start it again from the phone). "Page view" shows everything as a plain page, for anyone who'd rather read than drive (and for browsers without WebGL).

![The city](public/social/share.png)

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # checks the island, then builds to dist/
```

Pushing to `master` deploys to GitHub Pages at ishanr.com (`.github/workflows/pages.yml`).

Controls: WASD or arrow keys to walk (or drive), Shift to run, M (or a tap on the minimap) for the city map (north up, with the route to the next stop, and every airstrip to fly to), E to get in or out of a car, the scooter or the plane (in the air, E bails out under a parachute that you steer with A and D), Enter to open a project, P for the phone, drag to look around. Any car can be driven: the parked ones, and the traffic too (stand in a car's way, it stops, then press E). In the plane: W and S for the nose, A and D to bank, R and F for throttle. A helicopter is parked beside every airstrip and is much easier to fly: R climbs, F descends, W and S fly forward and back, A and D turn, and with nothing held it hovers. On foot, Shift (or a full push on the stick) sprints while the stamina bar lasts, and Space (a Jump button on a phone) jumps. In a car, T tunes the radio (four generated stations: Neon FM, Chai Lo-fi, Island Pop and Night Drive; the sound has to be on) and H sounds the horn. Near the ground the plane levels its wings and lifts a sinking nose into a flare by itself, so a landing is forgiving. On a phone, the left thumb steers the plane, a + and a − throttle column sits at the right edge, and the minimap and tips stay out of the way so the view is clear. In the arcade: arrows or A and D, Space to drop or launch, Escape to go back, or tap and drag on a phone.

Sound is off until you press the Sound button in the HUD. Then you hear the sea, the weather, the birds and crickets, the car engine and the plane's drone, plus two music tracks: a day theme that cross-fades into a night theme as the sun goes down. The music and short sounds are free (CC0) files, credited in [`public/audio/CREDITS.md`](public/audio/CREDITS.md).

To see a particular sky, add it to the address: `?time=dawn` (or `day`, `dusk`, `night`, or a fraction of the day like `0.8`), `?season=winter`, `?weather=storm` (`clear`, `cloudy`, `rain`, `storm`, `snow`, `fog`).

On phones it plays best sideways: the left thumb anywhere on the left half is a joystick (push all the way to run, or to drive), the right thumb drags to look, and a big button bottom right does whatever is nearby (get in the car, open a project, stand up). Tapping Explore goes fullscreen and locks to landscape where the browser allows it (Android Chrome; iPhone Safari has no fullscreen for pages, so it just plays in the browser). Held upright, a hint suggests turning the phone, and can be dismissed. Phones also get a lower resolution cap and a smaller shadow map.

## Change the content

Everything people read is in [`src/content.js`](src/content.js): intro, projects, career stops, achievements and links. Add a project there and it gets a building, a sign, a marker and a spot on the GPS. The giant object on its roof comes from its `building` field (`tiffin`, `calculator`, `clock`, `phone`, `arcade`).

If you move things around in [`src/world/layout.js`](src/world/layout.js), run `npm run check`. It fails if a building, tree, street light, lantern, fence or city block ends up on a road or in the sea, or if traffic would leave the asphalt. It also fails if anything stands in front of an airstrip, or if an airstrip is not flat or runs into the sea. It runs before every build.

## Models

The character, cars, palm trees and the cruise ship are free CC0 models from [Quaternius](https://quaternius.com) and [Kenney](https://kenney.nl), restyled to match the city: each static model is baked into one flat-coloured mesh, some cars are repainted in the city's pastels, and the character is recoloured and merged into a single skinned mesh. Everything in `public/models` is about 570 KB. Credits are in [`public/models/CREDITS.md`](public/models/CREDITS.md) and on the page view.

To rebuild them, or swap a model or a colour, edit the recipe in [`tools/asset-baker/bake.mjs`](tools/asset-baker/bake.mjs) and run:

```bash
npm install --no-save playwright && npx playwright install chromium
node tools/asset-baker/bake.mjs
```

If a model is missing, the world falls back to the procedural stand-in, so the site always works.

## Make your own 3D models with Tripo

The buildings are built in code. The Tripo pipeline swaps any of them, or the character and car, for generated models, including a rigged and animated character made from your photos.

1. Get an API key at [developers.tripo3d.ai](https://developers.tripo3d.ai/) and put it in `.env.local` (git ignores it):
   ```
   TRIPO_API_KEY=tsk_...
   ```
2. Fill in the `[brackets]` in [`tripo/jobs.mjs`](tripo/jobs.mjs) (how you look, what you wear) and add two photos: `tripo/photos/headshot.jpg` and `tripo/photos/fullbody.jpg` (also ignored by git).
3. Look at the dry run. It shows every step and what it costs, and spends nothing:
   ```bash
   npm run tripo
   ```
4. Make the images, then look at them in `tripo/out/<job>/`:
   ```bash
   npm run tripo -- run tiffin --yes
   ```
   A bad image means a bad model, so the pipeline stops after each image. If it is good, approve it and run again to make the 3D model. If not, ask for a new one:
   ```bash
   npm run tripo -- approve tiffin
   npm run tripo -- run tiffin --yes
   npm run tripo -- redo tiffin image
   ```
5. Shrink the results for the web (simplified mesh, WebP textures, meshopt). The model tools are optional dependencies, so `npm install` already added them locally:
   ```bash
   npm run models:optimize
   ```

Finished models land in `public/models/` and are listed in `public/models/manifest.json`; the world loads them in place of the stand-ins. If one comes in facing the wrong way, set its `yaw` there (in radians, `3.1416` turns it around). Task ids are kept in `tripo/state.json`, so finished steps are never paid for twice.

Notes:
- Everything uses one style line (`STYLE` in `tripo/jobs.mjs`) so the models look like one world.
- The character uses Tripo's v1.0 rig because it is the one with wave and sit animations. The newer v3.0 rig (`MODELS.rig`) is better for humanoids but only has idle, walk and run.
- Walk and run clips play at a rate matched to the walking speed. If feet slide, tune `walkStride` and `runStride` on the character in the manifest.

## How it's built

Three.js and Vite, no framework.

- `src/core/geo.js`: the island is laid out on a flat map and wrapped onto a small planet. Everything is placed with map coordinates.
- `src/world/`: terrain, roads, sea, sky, Art Deco buildings and city blocks, neon, palms (instanced, swaying in the wind), traffic, markers, boats, birds, the car and scooter.
- `src/world/environment.js`: the clock, the seasons and the weather. It moves the sun (placed over wherever you are, so dawn and dusk happen at the same moment all over the tiny planet), blends the sky, light, fog and glow between night, blue hour, dawn, day and dusk, and greys it all over in bad weather. `seasonal.js` patches the materials so snow settles on whatever faces the sky, leaves turn and blossom comes out; `weather.js` has the rain, snow and lightning; `src/core/audio.js` makes the rain, wind, thunder, birds, crickets and the plane's drone, and plays the engine and button sounds; `src/core/music.js` cross-fades the day and night themes.
- `src/world/details.js`: the evening. Lanterns with pools of light along the boardwalk, the beach road and round the chai shack, fences, stepping stones, flower beds along the sidewalks, grass and fireflies. `duskAt()` in `layout.js` says how far into the evening each spot is, so windows light up and street lights get warmer the closer you get to the sunset beach.
- `src/player/`: the character, walking and driving, the follow camera, and `flight.js`, the plane's arcade flight model (speed sets the lift, the nose sets the climb, the bank sets the turn).
- `src/world/plane.js` and `airstrip.js`: the plane and the runway, built from the same clay parts as the city. The runway is a straight strip on a ring round the island, flattened into the ground by the terrain pads.
- `src/world/runways.js` and `src/world/airstrip.js`: every runway, the city's and the islands': the strip, its clear airspace (which nothing may grow or stand in), the runway lights that run in a chase (brighter at night), and the windsock that turns with the wind.
- `src/world/islands.js`: the eight islands. Each coast is built from waves, headlands (`bumps`), coves and, for the atoll, a lagoon (`hole`); each has its boats (`moor`), buoys (`buoys`), landmarks (`structures`), notice boards (`signs`) and airstrip (the strip is found by a search when the game loads). `scripts/check-world.mjs` checks that every landmark and board is on land, every boat is at sea, and no two islands run into each other. `terrain.js`, `terrainMesh.js`, `water.js`, `scatter.js` and `islandBuildings.js` build them all from that one description.
- `src/arcade/games.js` and `src/ui/arcade.js`: the arcade's games and the game-select hall.
- `src/errands.js`: the side missions (Errands) and what they measure. Progress is kept in this browser.
- `src/ui/`: title, HUD, minimap with GPS, briefing cards, phone, page view, touch controls.

To keep it at 60 fps, repeated things are instanced, terrain is cut into tiles, and the foliage and city blocks into cells of about 48 m, so only the cells in view are drawn. The sea is split into eight pieces. Buildings behind the planet's curve are not drawn, and if the frame rate drops the resolution goes down first and the neon glow switches off last.

## Add a mission

Missions are data, in [`src/missions/list.js`](src/missions/list.js): an entry is a title, a brief, the pay, a time limit, the vehicles that count and a list of steps. Three kinds of step exist: `land` (touch down at an island's airstrip), `gates` (go through a row of rings in the air, arches on the road or the sea, or, with `marker: 'beam'`, stops on foot; `ramps: true` adds ramps for a boat) and `weave` (near misses with the traffic). The gates come from a route: `around` an island, the city `loop` (with `laps`), the `main` road, the front doors of `sites`, or `points` given outright. The vehicle kinds are `walk`, `plane`, `heli`, `car`, `scooter` and `boat`. A new kind of step is one `registerStep` call in [`src/missions/steps.js`](src/missions/steps.js) and a new route one `registerRoute` call in [`src/missions/routes.js`](src/missions/routes.js). `npm run check` builds every mission, and fails if an island is missing, a road race has a checkpoint off the road, a boat race has a gate on land, or a car race asks for more than a car can do in the time.
