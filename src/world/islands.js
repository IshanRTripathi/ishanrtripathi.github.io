import { createNoise2D, fbm, smoothstep } from '../core/noise.js'
import { makeRunway, clearZone, distanceToSegment, CLEAR } from './runways.js'

// The islands around the planet. Each one has its own shape, theme, coast, hills,
// boats, landmarks, signs and airstrip. This file has no other dependencies (apart
// from the runway helpers), so the terrain, the water shader, the scatter, the
// structures, the map and the check script can all read it.
//
// A shape is built from polar terms, measured from the island's middle, so every
// island keeps one closed coast:
//   radius   the base distance to the coast
//   waves    [amplitude, whole-number frequency, phase]: long, rolling lumps
//   bumps    [angle, width, height]: headlands and lobes (a heart's two lobes, a cross's arms)
//   coves    [angle, width, depth]: bays and harbours cut into the coast
//   hole     (optional) the radius of a lagoon of sea in the middle: an atoll is land around a lagoon
// The water shader gets the same shape as GLSL (islandsGLSL), so the foam matches the land.

const polar = (r, a) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r })
// the same, as an offset from an island's middle, for its landmarks and signs
const rel = (r, a) => ({ dx: Math.cos(a) * r, dz: Math.sin(a) * r })
// the yaw that turns a structure's front towards the angle a
const faceAngle = (a) => Math.PI / 2 - a
const PI = Math.PI

// every island's airstrip: a straight runway across the island
export const AIRSTRIP = { length: 70, width: 12 }

// how far from the middle of the city the full map reaches: far enough for the islands on their ring
export const MAP_EXTENT = 340

// The islands sit on one even ring round the city, 262 metres out, a little under the planet's
// equator, so they read as a belt round the globe. Each one has its own angle on the ring. The
// spacing is kept by scripts/check-world.mjs: at least 40 metres of sea to the city and between
// neighbours. Every island's features are placed from its own middle, so moving an island moves
// the whole of it.
const RING = 262
const HARBOUR_AT = 0.771
// the harbour's cove faces the city, the geyser's bay faces the sea to the south
const HARBOUR_FACE = 1 + PI
const GEYSER_BAY = PI / 2

export const ISLANDS = [
    {
        id: 'jungle', name: 'Jungle Cove', theme: 'jungle', seed: 11,
        blurb: 'Palms, rainforest and a stilt hut on the beach',
        at: polar(RING, 3.056), radius: 46,
        waves: [ [ 2.2, 3, 0.4 ], [ 1.2, 6, 1.9 ] ],
        hills: 2.6, peak: 0,
        // a stilt hut on the beach side, and palms, ferns and tall rainforest trees
        structures: [ { kind: 'hut', dx: -6, dz: 5 } ],
        life: { trees: [ 'rain', 'palm', 'rain', 'royal', 'palm', 'rain' ], tree: 0.16, bush: 0.2, flower: 0.12, rock: 0.02 },
        moor: [ { phi: 0.4, kind: 'yacht' }, { phi: 0.4 + PI, kind: 'speedboat' } ]
    },
    {
        id: 'frost', name: 'Frost Peak', theme: 'frost', seed: 23,
        blurb: 'Snowy pines, a log cabin and a warm window',
        at: polar(RING, 2.485), radius: 48,
        waves: [ [ 1.8, 2, 2.6 ], [ 1.0, 5, 0.9 ] ],
        hills: 2.2, peak: 9,
        // a log cabin with a warm window, and snowy pines
        structures: [ { kind: 'cabin', dx: 6, dz: -14 } ],
        life: { trees: [ 'slender', 'slender', 'rain' ], tree: 0.1, bush: 0.06, flower: 0, rock: 0.08 },
        moor: [ { phi: 0.4, kind: 'yacht' }, { phi: 0.4 + PI, kind: 'speedboat' } ]
    },
    {
        id: 'dunes', name: 'Dune Oasis', theme: 'desert', seed: 37,
        blurb: 'Sand dunes, cacti and an oasis with a tent',
        at: polar(RING, 1.914), radius: 46,
        waves: [ [ 1.6, 4, 1.2 ], [ 0.9, 7, 0.3 ] ],
        hills: 1.4, peak: 0,
        // an oasis pool with a tent beside it, and a few cacti and palms in the dunes
        structures: [ { kind: 'oasis', dx: 0, dz: 0 }, { kind: 'tent', dx: 8, dz: 3 } ],
        life: { trees: [ 'cactus', 'cactus', 'cactus', 'palm' ], tree: 0.07, bush: 0.05, flower: 0.02, rock: 0.1 },
        moor: [ { phi: 0.4, kind: 'yacht' }, { phi: 0.4 + PI, kind: 'speedboat' } ]
    },
    {
        // a crescent of land round a deep, sheltered cove that faces the city
        id: 'harbour', name: 'Crescent Harbour', theme: 'harbour', seed: 61,
        blurb: 'A fishing village round a sheltered cove: fish market, boat shed, 212 people',
        at: polar(RING, HARBOUR_AT), radius: 44,
        waves: [ [ 1.6, 3, 0.7 ], [ 0.9, 7, 2.2 ] ],
        coves: [ [ HARBOUR_FACE, 1.0, 24 ] ],
        hills: 1.4, peak: 0,
        structures: [
            { kind: 'fishmarket', ...rel(17, HARBOUR_FACE + 0.65), yaw: faceAngle(HARBOUR_FACE) },
            { kind: 'boathouse', ...rel(16, HARBOUR_FACE - 0.75), yaw: faceAngle(HARBOUR_FACE) }
        ],
        signs: [ { ...rel(9, HARBOUR_FACE + 1.1), title: 'Crescent Harbour', line: 'Fish market opens at 5 am' } ],
        life: { trees: [ 'palm', 'palm', 'royal', 'rain' ], tree: 0.12, bush: 0.16, flower: 0.08, rock: 0.03 },
        moor: [ { phi: HARBOUR_FACE - 0.25, kind: 'yacht' }, { phi: HARBOUR_FACE + 0.3, kind: 'speedboat' } ],
        buoys: [ { phi: HARBOUR_FACE - 1.0, off: 10 }, { phi: HARBOUR_FACE + 1.0, off: 10 } ]
    },
    {
        // a volcanic island with a hot spring at the foot of its peak, a geothermal station on the
        // flat, and a bay bitten out of the south
        id: 'geyser', name: 'Geyser Isle', theme: 'geyser', seed: 67,
        blurb: 'Volcanic rock, a hot spring and a geothermal station humming on the flat',
        at: polar(RING, 5.912), radius: 45,
        waves: [ [ 2.0, 2, 0.9 ], [ 1.2, 5, 2.2 ] ],
        bumps: [ [ -0.9, 0.6, 5 ] ],
        coves: [ [ GEYSER_BAY, 0.7, 8 ] ],
        hills: 1.5, peak: 0,
        // both stand on one side, so the runway can run across the other
        structures: [
            { kind: 'hotspring', ...rel(20, 1.0) },
            { kind: 'geothermal', ...rel(27, 1.4), yaw: faceAngle(1.4) }
        ],
        signs: [ { dx: -22.6, dz: -8, title: 'Geyser Isle', line: 'Hot spring open 7 to 9 pm, mind the steam' } ],
        life: { trees: [ 'rain', 'slender' ], tree: 0.05, bush: 0.08, flower: 0, rock: 0.2 },
        moor: [ { phi: -1.3, kind: 'speedboat' }, { phi: 2.0, kind: 'yacht' } ]
    },
    {
        // a four-armed cay: the arms reach out to the sea, with a solar farm, a wind turbine and a dive shop
        id: 'cay', name: 'Cross Cay', theme: 'cay', seed: 73,
        blurb: 'Four sandy arms: a solar farm, a wind turbine and dive trips at 9 am',
        at: polar(RING, 3.627), radius: 34,
        waves: [ [ 12, 4, 0.5 ], [ 2.0, 9, 1.3 ] ],
        hills: 1.2, peak: 0,
        // the runway runs along the arms at 0.27 and 3.41 radians, so the buildings sit on the other two arms
        structures: [
            { kind: 'solar', ...rel(22, 4.98) },
            { kind: 'turbine', ...rel(24, 1.84), yaw: faceAngle(0) },
            { kind: 'diveshop', ...rel(14, 1.05), yaw: faceAngle(1.05) }
        ],
        signs: [ { dx: -6.5, dz: -20, title: 'Cross Cay', line: 'Dive trips at 9 am. Sunscreen is for sale' } ],
        life: { trees: [ 'cactus', 'palm', 'cactus' ], tree: 0.05, bush: 0.04, flower: 0.03, rock: 0.08 },
        moor: [ { phi: 1.05, kind: 'speedboat' }, { phi: 4.2, kind: 'yacht' } ]
    },
    {
        // a heart: two lobes at the top with a cleft between them, and the point at the bottom
        id: 'heart', name: 'Heart Isle', theme: 'meadow', seed: 79,
        blurb: 'Honeymoon bungalows, a beach bar and a ferris wheel that does the full loop',
        at: polar(RING, 4.77), radius: 42,
        waves: [ [ 1.2, 3, 0.5 ] ],
        bumps: [ [ -PI / 2 - 0.8, 0.5, 13 ], [ -PI / 2 + 0.8, 0.5, 13 ], [ PI / 2, 0.26, 17 ] ],
        coves: [ [ -PI / 2, 0.3, 8 ] ],
        hills: 1.8, peak: 0,
        // the buildings keep to the rim, so the runway can cross the heart from lobe to lobe
        structures: [
            { kind: 'ferris', ...rel(30, -2.35), yaw: faceAngle(-2.35) },
            { kind: 'beachbar', ...rel(28, 2.2), yaw: faceAngle(2.2) },
            { kind: 'bungalow', ...rel(31, -0.6), yaw: faceAngle(-0.6) },
            { kind: 'bungalow', ...rel(34, -0.1), yaw: faceAngle(-0.1) }
        ],
        signs: [ { dx: 26.3, dz: 24.5, title: 'Heart Isle', line: 'Sunsets at six. Bungalows still free' } ],
        life: { trees: [ 'royal', 'palm', 'royal' ], tree: 0.13, bush: 0.2, flower: 0.22, rock: 0.02 },
        moor: [ { phi: -0.2, kind: 'yacht' }, { phi: 2.8, kind: 'speedboat' } ]
    },
    {
        // an atoll: a ring of sand round a lagoon, with bungalows, a beach bar and a turbine on the ring
        id: 'atoll', name: 'Pearl Atoll', theme: 'atoll', seed: 89,
        blurb: 'A ring of white sand round a lagoon, with boats to hire and a turbine on the rim',
        at: polar(RING, 0.2), radius: 64, hole: 22,
        waves: [ [ 1.6, 3, 0.3 ], [ 0.8, 5, 1.1 ] ],
        hills: 0.5, peak: 0,
        structures: [
            { kind: 'bungalow', ...rel(45, 2.2), yaw: faceAngle(2.2) },
            { kind: 'bungalow', ...rel(45, 2.8), yaw: faceAngle(2.8) },
            { kind: 'beachbar', ...rel(44, 4.2), yaw: faceAngle(4.2) },
            { kind: 'turbine', ...rel(46, -1.4), yaw: faceAngle(-1.4) }
        ],
        signs: [ { dx: -27.4, dz: -40, title: 'Pearl Atoll', line: 'Lagoon boats for hire. Ask at the bar' } ],
        life: { trees: [ 'palm', 'palm', 'palm' ], tree: 0.1, bush: 0.05, flower: 0.03, rock: 0 },
        // the lagoon is sea, so the boats float in its middle
        moor: [ { phi: 0.9, r: 9, kind: 'yacht' }, { phi: 3.6, r: 12, kind: 'speedboat' } ]
    },
    {
        // a rocky cape out on the rim of the map: a lighthouse on its tip, and a keeper's cottage behind
        id: 'lantern', name: 'Lantern Bay', theme: 'meadow', seed: 97,
        blurb: 'A rocky cape with a working lighthouse and a keeper\'s cottage. The light comes on at dusk',
        at: polar(RING, 1.342), radius: 42,
        waves: [ [ 2.0, 3, 0.2 ], [ 1.0, 6, 1.4 ] ],
        bumps: [ [ -0.4, 0.32, 14 ] ],
        hills: 1.6, peak: 0,
        structures: [
            { kind: 'lighthouse', ...rel(50, -0.4) },
            { kind: 'cabin', ...rel(22, 1.6), yaw: faceAngle(1.6) }
        ],
        signs: [ { ...rel(30, 0.9), title: 'Lantern Bay', line: 'Lighthouse tours at dusk. Mind the rocks' } ],
        life: { trees: [ 'palm', 'royal', 'rain' ], tree: 0.08, bush: 0.12, flower: 0.04, rock: 0.1 },
        moor: [ { phi: 2.6, kind: 'yacht' }, { phi: -2.2, kind: 'speedboat' } ],
        buoys: [ { phi: 0.66 + 0.9, off: 12 }, { phi: 0.66 - 0.9, off: 12 } ]
    },
    {
        // a windy ridge with a radio mast on the crest and an observatory dome
        id: 'ridge', name: 'Radio Ridge', theme: 'ridge', seed: 101,
        blurb: 'A windy ridge with a radio mast, and an observatory that opens on Fridays',
        at: polar(RING, 4.198), radius: 44,
        waves: [ [ 1.4, 2, 0.8 ], [ 0.8, 5, 2.0 ] ],
        hills: 2.4, peak: 0,
        structures: [
            { kind: 'radiomast', ...rel(18, 2.4) },
            { kind: 'observatory', ...rel(-14, 0.5) }
        ],
        signs: [ { dx: 20, dz: 34.1, title: 'Radio Ridge', line: 'Mast is lit all night. Observatory opens Fridays' } ],
        life: { trees: [ 'slender', 'slender', 'rain' ], tree: 0.09, bush: 0.07, flower: 0, rock: 0.14 },
        moor: [ { phi: 1.4, kind: 'speedboat' }, { phi: 4.8, kind: 'yacht' } ]
    },
    {
        // a river delta: a narrow inlet cut in from the sea, mangroves, and houses on stilts
        id: 'mangrove', name: 'Mangrove Delta', theme: 'mangrove', seed: 103,
        blurb: 'A river delta with houses on stilts, crab traps and a boat shed among the mangroves',
        at: polar(RING, 5.341), radius: 47,
        waves: [ [ 1.8, 2, 2.0 ], [ 1.0, 5, 0.6 ] ],
        coves: [ [ 6.1, 0.22, 22 ] ],
        hills: 0.9, peak: 0,
        structures: [
            { kind: 'bungalow', ...rel(20, 4.0), yaw: faceAngle(4.0) },
            { kind: 'bungalow', ...rel(16, 4.5), yaw: faceAngle(4.5) },
            { kind: 'boathouse', ...rel(14, 0.8), yaw: faceAngle(0.8) }
        ],
        signs: [ { dx: -38.6, dz: 10.3, title: 'Mangrove Delta', line: 'Crabs sold by the bag. Stilt houses to let' } ],
        life: { trees: [ 'rain', 'palm' ], tree: 0.14, bush: 0.3, flower: 0.02, rock: 0.02 },
        moor: [ { phi: 6.1, kind: 'speedboat' }, { phi: 0.9, kind: 'yacht' } ]
    }
]

// the distance from the middle of an island to its coast, at a given angle
const gauss = (d) => Math.exp(-d * d)
function angleDelta(a, b)
{
    let d = a - b
    while(d > PI) d -= PI * 2
    while(d < -PI) d += PI * 2
    return d
}

export function islandCoastRadius(island, phi)
{
    let r = island.radius
    for(const [ a, f, p ] of island.waves) r += a * Math.sin(f * phi + p)
    for(const [ c, w, h ] of island.bumps || []) r += h * gauss(angleDelta(phi, c) / w)
    for(const [ c, w, d ] of island.coves || []) r -= d * gauss(angleDelta(phi, c) / w)
    return r
}

// how far out from the middle the island reaches at its widest, so the terrain and the scatter can cover it
for(const island of ISLANDS)
{
    let widest = 0
    for(let i = 0; i < 720; i++) widest = Math.max(widest, islandCoastRadius(island, (i / 720) * PI * 2))
    island.extent = widest
}

const noises = ISLANDS.map((i) => createNoise2D(i.seed))

// signed distance from the coast of one island: positive on land, negative at sea (a lagoon is sea)
export function islandSigned(island, x, z)
{
    const dx = x - island.at.x
    const dz = z - island.at.z
    const dist = Math.hypot(dx, dz)
    let s = islandCoastRadius(island, Math.atan2(dz, dx)) - dist
    if(island.hole) s = Math.min(s, dist - island.hole)
    return s
}

// the largest signed distance over all islands, and which island it is
export function nearestIsland(x, z)
{
    let best = { s: -Infinity, island: null, index: -1 }
    ISLANDS.forEach((island, index) =>
    {
        const s = islandSigned(island, x, z)
        if(s > best.s) best = { s, island, index }
    })
    return best
}

// the height of an island's ground above sea level (sea level is the planet's radius)
export function islandHeight(index, x, z, s)
{
    const island = ISLANDS[index]
    if(s < 0) return Math.max(-6.5, s * 0.75 + 0.12)
    const beach = Math.min(0.6, 0.12 + s * 0.07)
    const inland = smoothstep(1, 5, s)
    const n = noises[index]
    // the hills are measured from the island's own middle, so an island looks the same wherever it sits
    const lx = x - island.at.x
    const lz = z - island.at.z
    let hills
    if(island.theme === 'desert')
    {
        // long dunes, rolling along one direction
        hills = island.hills * (0.5 + 0.5 * Math.sin(0.19 * lx + 0.12 * lz + 2.2 * fbm(n, lx * 0.04, lz * 0.04, 2)))
        // level sand around the oasis
        hills *= smoothstep(4, 11, Math.hypot(lx, lz))
    }
    else hills = island.hills * smoothstep(-0.2, 0.7, fbm(n, lx * 0.07 + 3, lz * 0.07 - 1, 3))
    let peak = 0
    if(island.peak)
    {
        const d = Math.hypot(x - island.at.x, z - island.at.z)
        peak = island.peak * Math.exp(-(d / 13) * (d / 13))
    }
    // the middle of an island rises into a dome, and ridges run across it, so it is a landscape and not a flat plate
    const dome = (1.4 + island.hills * 0.8) * smoothstep(5, 26, s)
    const ridge = Math.pow(1 - Math.abs(fbm(n, lx * 0.05 - 8, lz * 0.05 + 5, 3)), 2) * island.hills * 1.2 * smoothstep(8, 24, s)
    // the extra relief fades out near the airstrip (found once, on the flat ground this relief is added to), so the strip and its surroundings stay level
    const away = island.clearSeg ? smoothstep(CLEAR.half + 2, CLEAR.half + 26, distanceToSegment(island.clearSeg, x, z)) : 0
    return beach + inland * (0.4 + hills + peak) + (dome + ridge) * away
}

// the kind of ground at a point on an island: the terrain colours depend on it
export function islandSurface(island, s)
{
    if(s < 0.9) return 'wet'
    if(s < 3) return 'sand'
    return island.theme
}

// where an island's landmarks stand, in map space
export function structureSpots(island)
{
    return (island.structures || []).map((st) => ({ ...st, x: island.at.x + st.dx, z: island.at.z + st.dz }))
}

// where an island's notice boards stand, in map space; a board with no facing turns to face the middle
export function signSpots(island)
{
    return (island.signs || []).map((sg) => ({ ...sg, x: island.at.x + sg.dx, z: island.at.z + sg.dz, yaw: sg.yaw ?? Math.atan2(-sg.dx, -sg.dz) }))
}

// The boats moored offshore of an island. A spot is either at an angle from the middle, out
// to the sea 6.5 m from the shore (a cove's sea counts too), or at a given radius (a boat
// inside an atoll's lagoon). Each returns { kind, x, z, yaw } in map space.
export function mooringSpots(island)
{
    return (island.moor || []).map(({ phi, r, kind }) =>
    {
        const c = Math.cos(phi)
        const s = Math.sin(phi)
        let dist = r
        if(dist === undefined)
        {
            dist = 0
            while(dist < island.extent + 40 && islandSigned(island, island.at.x + c * dist, island.at.z + s * dist) > -6.5) dist += 0.25
        }
        return { kind, x: island.at.x + c * dist, z: island.at.z + s * dist, yaw: phi + PI / 2 }
    })
}

// Buoys: a light out on the water a few metres off the shore, at an angle from the middle, to mark
// a harbour mouth or a reef. Each returns { x, z } in map space.
export function buoySpots(island)
{
    return (island.buoys || []).map(({ phi, off }) =>
    {
        const c = Math.cos(phi)
        const s = Math.sin(phi)
        let dist = 0
        while(dist < island.extent + 40 && islandSigned(island, island.at.x + c * dist, island.at.z + s * dist) > -off) dist += 0.25
        return { x: island.at.x + c * dist, z: island.at.z + s * dist }
    })
}

// the coast of every island as GLSL, for the water shader
export function islandsGLSL()
{
    const f = (v) => v.toFixed(4)
    // the angle from a headland or cove, wrapped to (-pi, pi]
    const wrap = (c) => `(mod(ph - (${f(c)}) + 3.14159265, 6.2831853) - 3.14159265)`
    let s = 'float islandSigned(vec2 m) {\n  float best = -1000.0;\n'
    for(const island of ISLANDS)
    {
        s += `  {\n    vec2 d = m - vec2(${f(island.at.x)}, ${f(island.at.z)});\n    float ph = atan(d.y, d.x);\n    float r = ${f(island.radius)}`
        for(const [ a, fr, p ] of island.waves) s += ` + ${f(a)} * sin(${f(fr)} * ph + ${f(p)})`
        s += ';\n'
        for(const [ c, w, h ] of island.bumps || []) s += `    { float g = ${wrap(c)} / ${f(w)}; r += ${f(h)} * exp(-g * g); }\n`
        for(const [ c, w, depth ] of island.coves || []) s += `    { float g = ${wrap(c)} / ${f(w)}; r -= ${f(depth)} * exp(-g * g); }\n`
        s += '    float land = r - length(d);\n'
        if(island.hole) s += `    land = min(land, length(d) - ${f(island.hole)});\n`
        s += '    best = max(best, land);\n  }\n'
    }
    return s + '  return best;\n}\n'
}

// Find where an island's airstrip goes: a straight line across the island, on the
// flattest ground it can find, with the sea and the island's buildings kept well
// away. It is found once, when this module loads, and kept as island.runway. The
// numbers it was chosen by are kept as island.airstrip, for the check script.
function findAirstrip(index)
{
    const island = ISLANDS[index]
    const half = AIRSTRIP.length / 2
    const spots = structureSpots(island)
    let best = null
    let fallback = null
    // how far off the middle the strip may run: most of the way to the coast, so a ring of land
    // (an atoll) can carry a strip along its rim
    const reach = Math.max(22, island.extent - 14)
    for(let deg = 0; deg < 180; deg += 3)
    {
        const a = (deg * PI) / 180
        const t = { x: Math.cos(a), z: Math.sin(a) }
        const n = { x: -t.z, z: t.x }
        for(let off = -reach; off <= reach; off += 1)
        {
            const mid = { x: island.at.x + n.x * off, z: island.at.z + n.z * off }
            let lo = Infinity
            let hi = -Infinity
            let coast = Infinity
            for(let s = -half - 3; s <= half + 3; s += 1)
            {
                const x = mid.x + t.x * s
                const z = mid.z + t.z * s
                const sg = islandSigned(island, x, z)
                coast = Math.min(coast, sg)
                if(Math.abs(s) <= half)
                {
                    const h = islandHeight(index, x, z, sg)
                    lo = Math.min(lo, h)
                    hi = Math.max(hi, h)
                }
            }
            const runway = makeRunway(mid, t, AIRSTRIP.length, AIRSTRIP.width)
            const zone = clearZone(runway)
            let near = Infinity
            for(const spot of spots) near = Math.min(near, distanceToSegment(zone, spot.x, spot.z))
            const range = hi - lo
            const candidate = { runway, range, coast, near }
            const fits = coast >= 5 && range <= 3 && near >= CLEAR.half + 3
            const cost = range + 0.05 * Math.abs(off)
            if(fits && (!best || cost < best.cost)) best = { ...candidate, cost }
            if(coast >= 3 && (!fallback || range < fallback.range)) fallback = candidate
        }
    }
    const pick = best || fallback
    island.runway = pick.runway
    island.clearSeg = clearZone(pick.runway)
    island.airstrip = { range: pick.range, coast: pick.coast, near: pick.near, fits: !!best }
}

ISLANDS.forEach((_, index) => findAirstrip(index))
