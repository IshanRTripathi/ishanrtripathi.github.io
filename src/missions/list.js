// The missions on offer. Each is plain data, so adding one is adding an entry here:
//
//   id, title, brief   what the phone shows
//   pay                what it pays when finished
//   time               the limit in seconds, counted from the first moment you are in an allowed
//                      vehicle (0: no limit)
//   vehicles           the kinds of vehicle that count: 'plane', 'heli', 'car', 'scooter', 'boat'
//   steps              what to do, in order (see steps.js for the kinds, routes.js for the routes)

const AIR = [ 'plane', 'heli' ]
const ROAD = [ 'car', 'scooter' ]
const FOOT = [ 'walk' ]

export const MISSIONS = [
    { id: 'milk-run', title: 'Milk Run', pay: 400, time: 0, vehicles: AIR,
        brief: 'Fly the cargo to Jungle Cove and land on its airstrip.',
        steps: [ { type: 'land', island: 'jungle' } ] },

    { id: 'sandstorm', title: 'Sandstorm Drop', pay: 600, time: 150, vehicles: AIR,
        brief: 'Get the supplies down at Dune Oasis before the sandstorm closes in.',
        steps: [ { type: 'land', island: 'dunes' } ] },

    { id: 'ice-rings', title: 'Ice Ring Race', pay: 900, time: 150, vehicles: AIR,
        brief: 'Fly through all five rings round Frost Peak, in order.',
        steps: [ { type: 'gates', route: 'around', island: 'frost', count: 5, air: true, label: 'Ring', where: 'round Frost Peak' } ] },

    { id: 'geyser-rings', title: 'Geyser Ring Run', pay: 1200, time: 110, vehicles: AIR,
        brief: 'Thread the six rings round Geyser Isle.',
        steps: [ { type: 'gates', route: 'around', island: 'geyser', count: 6, air: true, label: 'Ring', where: 'round Geyser Isle' } ] },

    { id: 'pearl-rings', title: 'Pearl Ring Race', pay: 800, time: 100, vehicles: AIR,
        brief: 'Fly through the four rings round Pearl Atoll.',
        steps: [ { type: 'gates', route: 'around', island: 'atoll', count: 4, air: true, label: 'Ring', where: 'round Pearl Atoll' } ] },

    { id: 'rim-hop', title: 'Rim Hop', pay: 1500, time: 0, vehicles: AIR,
        brief: 'Land on Lantern Bay, then Radio Ridge, then Mangrove Delta.',
        steps: [ { type: 'land', island: 'lantern' }, { type: 'land', island: 'ridge' }, { type: 'land', island: 'mangrove' } ] },

    { id: 'skyline-tour', title: 'Skyline Tour', pay: 1000, time: 100, vehicles: [ 'heli' ],
        brief: 'Take a helicopter twice round the city, through every ring over the loop road.',
        steps: [ { type: 'gates', route: 'loop', count: 8, laps: 2, air: true, height: 34, label: 'Ring', where: 'over the city' } ] },

    { id: 'heli-hop', title: 'Heli Hop', pay: 1100, time: 0, vehicles: [ 'heli' ],
        brief: 'Hop by helicopter to Heart Isle, Cross Cay and Crescent Harbour, and touch down on each.',
        steps: [ { type: 'land', island: 'heart' }, { type: 'land', island: 'cay' }, { type: 'land', island: 'harbour' } ] },

    { id: 'neon-sprint', title: 'Neon Loop Sprint', pay: 700, time: 70, vehicles: ROAD,
        brief: 'Race three laps of the loop road through the checkpoints, in a car or on the scooter.',
        steps: [ { type: 'gates', route: 'loop', count: 8, laps: 3, label: 'Checkpoint', where: 'on the loop road' } ] },

    { id: 'beach-run', title: 'Beach Run', pay: 600, time: 30, vehicles: ROAD,
        brief: 'Drive from the studio to the chai shack through the checkpoints.',
        steps: [ { type: 'gates', route: 'main', from: 0.03, to: 0.98, count: 14, label: 'Checkpoint', where: 'on the main road' } ] },

    { id: 'regatta', title: 'Pearl Regatta', pay: 900, time: 120, vehicles: [ 'boat' ],
        brief: 'Sail a boat round Pearl Atoll through six gates over the water.',
        steps: [ { type: 'gates', route: 'around', island: 'atoll', count: 6, offset: 12, label: 'Buoy gate', where: 'round Pearl Atoll' } ] },

    // from the reel's ideas: a boat race with ramps and a boost, a courier run on foot, a traffic weave
    { id: 'wavebreaker', title: 'Wavebreaker Run', pay: 1300, time: 70, vehicles: [ 'boat' ],
        brief: 'Race a boat round Pearl Atoll through eight gates. Hit the ramps at speed to jump the waves, and hold Shift to boost.',
        steps: [ { type: 'gates', route: 'around', island: 'atoll', count: 8, offset: 16, ramps: true, label: 'Buoy gate', where: 'round Pearl Atoll' } ] },

    { id: 'city-courier', title: 'City Courier', pay: 800, time: 55, vehicles: FOOT,
        brief: 'Run a package round the city on foot, from door to door. Hold Shift to sprint (it tires you out) and press Space to jump.',
        steps: [ { type: 'gates', route: 'sites', ids: [ 'studio', 'career', 'hospital', 'arcade', 'club', 'contact' ], marker: 'beam', radius: 3.5, label: 'Stop', where: 'on foot' } ] },

    { id: 'close-shave', title: 'Close Shave', pay: 900, time: 75, vehicles: ROAD,
        brief: 'Drive the loop road and pass the traffic close, at speed, without hitting it. Six near misses.',
        steps: [ { type: 'weave', goal: 6, label: 'Near miss' } ] }
]
