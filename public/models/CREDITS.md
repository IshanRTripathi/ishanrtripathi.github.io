# Model credits

All of these are released under CC0 1.0 (public domain). Credit is not required, but they deserve it.

| Models | From | By | Source |
| --- | --- | --- | --- |
| `character.glb` (Casual_Male, recoloured) | Ultimate Animated Character Pack | Quaternius | https://opengameart.org/content/animated-characters-pack |
| `npc-female.glb`, `npc-male.glb` (Casual_Female, Casual_Male; clothes recoloured by season in the game) | Ultimate Animated Character Pack | Quaternius | https://opengameart.org/content/animated-characters-pack |
| `palm-curved.glb`, `palm-straight.glb` (PalmTree_1, PalmTree_3) | Ultimate Nature Pack | Quaternius | https://opengameart.org/content/low-poly-nature-pack-1 |
| `cruise.glb` (CruiseShip) | Ships | Quaternius | https://opengameart.org/content/lowpoly-ship-pack |
| `car-player.glb`, `traffic-*.glb`, `parked-*.glb` (sedan-sports, hatchback-sports, taxi, police, van, suv, sedan, suv-luxury; some repainted) | Car Kit 3.1 | Kenney | https://opengameart.org/content/car-kit |

How they were made: `tools/asset-baker/bake.mjs` downloads the packs, bakes each static model into one vertex-coloured mesh in the world's flat clay style, repaints some cars in the city's pastels, recolours the character and merges it into a single skinned mesh, then compresses everything with meshopt.
