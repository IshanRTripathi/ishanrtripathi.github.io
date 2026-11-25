import { createNoise2D, fbm, smoothstep } from '../core/noise.js'
import { makeRunway, clearZone, distanceToSegment, CLEAR } from './runways.js'

// The islands around the planet. Each one has its own theme, its own coast, its own
// hills and its own airstrip. This file has no other dependencies (apart from the
// runway helpers), so the terrain, the water shader, the scatter, the structures,
// the map and the check script can all read it.

const polar = (r, a) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r })

// every island's airstrip: a straight runway across the island
export const AIRSTRIP = { length: 70, width: 12 }

export const ISLANDS = [
    {
        id: 'jungle', name: 'Jungle Cove', theme: 'jungle', seed: 11,
        blurb: 'Palms, rainforest and a stilt hut on the beach',
        at: polar(176, 0.3), radius: 46,
        // coast waves: [amplitude, whole-number frequency, phase]
        waves: [ [ 2.2, 3, 0.4 ], [ 1.2, 6, 1.9 ] ],
        hills: 2.6, peak: 0,
        // a stilt hut on the beach side, and palms, ferns and tall rainforest trees
        structures: [ { kind: 'hut', dx: -6, dz: 5 } ],
        life: { trees: [ 'rain', 'palm', 'rain', 'royal', 'palm', 'rain' ], tree: 0.16, bush: 0.2, flower: 0.12, rock: 0.02 }
    },
    {
        id: 'frost', name: 'Frost Peak', theme: 'frost', seed: 23,
        blurb: 'Snowy pines, a log cabin and a warm window',
        at: polar(178, 2.4), radius: 48,
        waves: [ [ 1.8, 2, 2.6 ], [ 1.0, 5, 0.9 ] ],
        hills: 2.2, peak: 9,
        // a log cabin with a warm window, and snowy pines
        structures: [ { kind: 'cabin', dx: 6, dz: -14 } ],
        life: { trees: [ 'slender', 'slender', 'rain' ], tree: 0.1, bush: 0.06, flower: 0, rock: 0.08 }
    },
    {
        id: 'dunes', name: 'Dune Oasis', theme: 'desert', seed: 37,
        blurb: 'Sand dunes, cacti and an oasis with a tent',
        at: polar(174, 4.6), radius: 46,
        waves: [ [ 1.6, 4, 1.2 ], [ 0.9, 7, 0.3 ] ],
        hills: 1.4, peak: 0,
        // an oasis pool with a tent beside it, and a few cacti and palms in the dunes
        structures: [ { kind: 'oasis', dx: 0, dz: 0 }, { kind: 'tent', dx: 8, dz: 3 } ],
        life: { trees: [ 'cactus', 'cactus', 'cactus', 'palm' ], tree: 0.07, bush: 0.05, flower: 0.02, rock: 0.1 }
    }
]

const noises = ISLANDS.map((i) => createNoise2D(i.seed))

// how far the coast of an island is from its middle, at a given angle
export function islandCoastRadius(island, phi)
{
    let r = island.radius
    for(const [ a, f, p ] of island.waves) r += a * Math.sin(f * phi + p)
    return r
}

// signed distance from the coast of one island: positive on land, negative at sea
export function islandSigned(island, x, z)
{
    const dx = x - island.at.x
    const dz = z - island.at.z
    return islandCoastRadius(island, Math.atan2(dz, dx)) - Math.hypot(dx, dz)
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
    let hills
    if(island.theme === 'desert')
    {
        // long dunes, rolling along one direction
        hills = island.hills * (0.5 + 0.5 * Math.sin(0.19 * x + 0.12 * z + 2.2 * fbm(n, x * 0.04, z * 0.04, 2)))
        // level sand around the oasis
        hills *= smoothstep(4, 11, Math.hypot(x - island.at.x, z - island.at.z))
    }
    else hills = island.hills * smoothstep(-0.2, 0.7, fbm(n, x * 0.07 + 3, z * 0.07 - 1, 3))
    let peak = 0
    if(island.peak)
    {
        const d = Math.hypot(x - island.at.x, z - island.at.z)
        peak = island.peak * Math.exp(-(d / 13) * (d / 13))
    }
    return beach + inland * (0.4 + hills + peak)
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

// the coast of every island as GLSL, for the water shader
export function islandsGLSL()
{
    const f = (v) => v.toFixed(4)
    let s = 'float islandSigned(vec2 m) {\n  float best = -1000.0;\n'
    for(const island of ISLANDS)
    {
        s += `  {\n    vec2 d = m - vec2(${f(island.at.x)}, ${f(island.at.z)});\n    float ph = atan(d.y, d.x);\n    float r = ${f(island.radius)}`
        for(const [ a, fr, p ] of island.waves) s += ` + ${f(a)} * sin(${f(fr)} * ph + ${f(p)})`
        s += `;\n    best = max(best, r - length(d));\n  }\n`
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
    for(let deg = 0; deg < 180; deg += 3)
    {
        const a = (deg * Math.PI) / 180
        const t = { x: Math.cos(a), z: Math.sin(a) }
        const n = { x: -t.z, z: t.x }
        for(let off = -22; off <= 22; off += 1)
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
    island.airstrip = { range: pick.range, coast: pick.coast, near: pick.near, fits: !!best }
}

ISLANDS.forEach((_, index) => findAirstrip(index))
