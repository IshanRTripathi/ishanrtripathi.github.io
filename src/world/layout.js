// Island layout in map coordinates (metres, island centre at 0,0).
// Pure data + math: it is shared by the renderer and by scripts/check-world.mjs.

import { projects } from '../content.js'
import { makeRunway } from './runways.js'

// ------------------------------------------------------------------ coast
// The sunset bay faces this map angle. The sun sits above it, so the walk
// goes from afternoon light near the studio to sunset at the chai stall.
export const BAY_ANGLE = -0.62
export const SUN_ELEVATION = 0.74 // radians above the horizon at the island centre

export const COAST = {
    base: 108,
    // amplitude, frequency, phase
    waves: [ [ 5.2, 2, 0.6 ], [ 3.9, 3, 2.1 ], [ 2.4, 5, 4.0 ], [ 1.4, 7, 1.3 ], [ 0.7, 11, 5.2 ] ],
    // headland for the lighthouse: [angle, width, height]
    bumps: [ [ 1.95, 0.22, 8 ], [ -2.55, 0.3, 3.8 ] ],
    // a cove cut in beside the lighthouse, so the boardwalk to it stays short: [angle, width, depth]
    // (the bay gets its own cove, so the road to the chai shack and the beach are exactly where they were)
    coves: [ [ 1.95, 0.5, 48 ], [ BAY_ANGLE, 0.45, 48 ] ]
}

function angleDelta(a, b)
{
    let d = a - b
    while(d > Math.PI) d -= Math.PI * 2
    while(d < -Math.PI) d += Math.PI * 2
    return d
}

export function coastRadius(phi)
{
    let r = COAST.base
    for(const [ a, f, p ] of COAST.waves) r += a * Math.sin(f * phi + p)
    for(const [ c, w, h ] of COAST.bumps)
    {
        const d = angleDelta(phi, c) / w
        r += h * Math.exp(-d * d)
    }
    for(const [ c, w, depth ] of COAST.coves)
    {
        const d = angleDelta(phi, c) / w
        r -= depth * Math.exp(-d * d)
    }
    // pull the bay in a little so it reads as a curve
    const b = angleDelta(phi, BAY_ANGLE) / 0.45
    r -= 3.2 * Math.exp(-b * b)
    return r
}

// How far into the evening a spot is: 0 on the afternoon side of the island,
// 1 at the sunset beach. Lit windows, street lights, lanterns and fireflies
// all get warmer and brighter with it.
const DUSK_CENTRE = { x: Math.cos(BAY_ANGLE) * 50, z: Math.sin(BAY_ANGLE) * 50 }
export function duskAt(x, z)
{
    const d = Math.hypot(x - DUSK_CENTRE.x, z - DUSK_CENTRE.z)
    const t = Math.min(1, Math.max(0, (d - 10) / 40))
    return 1 - t * t * (3 - 2 * t)
}

export function beachWidth(phi)
{
    const c = Math.max(0, Math.cos(angleDelta(phi, BAY_ANGLE)))
    return 2.6 + 7.5 * Math.pow(c, 3)
}

// GLSL version of coastRadius for the water shader
export function coastGLSL()
{
    const f = (v) => v.toFixed(4)
    let s = `float coastRadius(float phi) {\n  float r = ${f(COAST.base)};\n`
    for(const [ a, fr, p ] of COAST.waves) s += `  r += ${f(a)} * sin(${f(fr)} * phi + ${f(p)});\n`
    const wrap = (c) => `(mod(phi - (${f(c)}) + 3.14159265, 6.2831853) - 3.14159265)`
    for(const [ c, w, h ] of COAST.bumps) s += `  { float d = ${wrap(c)} / ${f(w)}; r += ${f(h)} * exp(-d * d); }\n`
    for(const [ c, w, depth ] of COAST.coves) s += `  { float d = ${wrap(c)} / ${f(w)}; r -= ${f(depth)} * exp(-d * d); }\n`
    s += `  { float b = ${wrap(BAY_ANGLE)} / 0.45; r -= 3.2 * exp(-b * b); }\n`
    s += '  return r;\n}\n'
    return s
}

// ------------------------------------------------------------------ paths
// Roads: two lanes of asphalt with a sidewalk on each side.
export const ROAD_HALF = 2.4
export const SIDEWALK = 1.2
export const PATH_HALF_WIDTH = ROAD_HALF

function catmullRom(points, samplesPerSegment = 24)
{
    const out = []
    const n = points.length
    for(let i = 0; i < n - 1; i++)
    {
        const p0 = points[Math.max(0, i - 1)]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[Math.min(n - 1, i + 2)]
        for(let k = 0; k < samplesPerSegment; k++)
        {
            const t = k / samplesPerSegment
            const t2 = t * t
            const t3 = t2 * t
            const c = (a0, a1, a2, a3) => 0.5 * ((2 * a1) + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3)
            out.push({ x: c(p0.x, p1.x, p2.x, p3.x), z: c(p0.z, p1.z, p2.z, p3.z) })
        }
    }
    out.push({ ...points[n - 1] })
    return out
}

// Resample a polyline at an even spacing and keep cumulative lengths
function resample(points, step = 0.5)
{
    const lengths = [ 0 ]
    for(let i = 1; i < points.length; i++)
        lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z))
    const total = lengths[lengths.length - 1]
    const count = Math.max(2, Math.ceil(total / step))
    const out = []
    let j = 0
    for(let i = 0; i <= count; i++)
    {
        const target = total * i / count
        while(j < lengths.length - 2 && lengths[j + 1] < target) j++
        const seg = lengths[j + 1] - lengths[j] || 1
        const t = (target - lengths[j]) / seg
        out.push({
            x: points[j].x + (points[j + 1].x - points[j].x) * t,
            z: points[j].z + (points[j + 1].z - points[j].z) * t
        })
    }
    return { points: out, length: total }
}

class Path
{
    // kind: 'road' (asphalt + sidewalks) or 'boardwalk' (wooden footpath)
    constructor(controlPoints, halfWidth = PATH_HALF_WIDTH, kind = 'road')
    {
        const r = resample(catmullRom(controlPoints))
        this.points = r.points
        this.length = r.length
        this.halfWidth = halfWidth
        this.kind = kind
        // clearance from the centre line to the outer edge of the sidewalk
        this.edge = kind === 'road' ? halfWidth + SIDEWALK : halfWidth
    }

    // position + unit tangent at a fraction (0..1) of the length
    at(f)
    {
        const n = this.points.length - 1
        const i = Math.min(n - 1, Math.max(0, Math.floor(f * n)))
        const a = this.points[i]
        const b = this.points[i + 1]
        const t = f * n - i
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
        return {
            x: a.x + (b.x - a.x) * t,
            z: a.z + (b.z - a.z) * t,
            tx: (b.x - a.x) / len,
            tz: (b.z - a.z) / len
        }
    }

    nearest(x, z)
    {
        let best = Infinity
        let bestI = 0
        for(let i = 0; i < this.points.length; i++)
        {
            const p = this.points[i]
            const d = (p.x - x) ** 2 + (p.z - z) ** 2
            if(d < best) { best = d; bestI = i }
        }
        return { index: bestI, fraction: bestI / (this.points.length - 1), distance: Math.sqrt(best) }
    }
}

// ------------------------------------------------------------------ build
function polar(r, a) { return { x: Math.cos(a) * r, z: Math.sin(a) * r } }

function buildMainPath()
{
    // Hand-drawn loop: out of Ishan's place, east past the plaza, then round the
    // island clockwise (south, west, north) and down to the sunset beach.
    // [radius, angle in degrees]; angles grow clockwise on the map.
    const deg = Math.PI / 180
    const bay = BAY_ANGLE / deg + 360
    const control = [
        [ 4.5, -70 ], [ 11.5, -22 ], [ 20, 14 ], [ 27, 44 ], [ 32.5, 76 ], [ 36.5, 108 ],
        [ 34, 140 ], [ 37.5, 172 ], [ 34.5, 204 ], [ 37, 236 ], [ 34, 262 ], [ 39, 288 ],
        [ 45, bay - 16 ], [ coastRadius(BAY_ANGLE) - 9, bay ]
    ]
    return new Path(control.map(([ r, a ]) => polar(r, a * deg)))
}

// The airstrip: a straight runway on the far side of the island, past the city.
// Its middle sits on a ring at this distance from the middle of the island, and
// it runs along the ring's tangent, so a plane flying straight stays on it.
export const RUNWAY = { angle: 4.2, radius: 56, length: 80, width: 12 }

function buildRunway()
{
    const mid = polar(RUNWAY.radius, RUNWAY.angle)
    // the tangent to the ring: the way round the island
    const t = { x: -Math.sin(RUNWAY.angle), z: Math.cos(RUNWAY.angle) }
    return makeRunway(mid, t, RUNWAY.length, RUNWAY.width)
}

function offsetFrom(p, side, distance)
{
    // left normal of the tangent (tx, tz) is (-tz, tx)
    return { x: p.x - p.tz * side * distance, z: p.z + p.tx * side * distance }
}

function yawTowards(from, to)
{
    return Math.atan2(to.x - from.x, to.z - from.z)
}

export function buildLayout()
{
    const main = buildMainPath()
    const paths = [ main ]
    const plazas = []
    const sites = []
    const props = []

    // --- Ishan's place at the start of the road, door facing along it
    {
        const p = main.at(0)
        const back = { x: p.x - p.tx * 8.0, z: p.z - p.tz * 8.0 }
        sites.push({
            id: 'studio', kind: 'studio', x: back.x, z: back.z,
            yaw: yawTowards(back, p), w: 7, d: 6, h: 7,
            // just outside the front door, and just inside it
            door: { x: p.x - p.tx * 4.5, z: p.z - p.tz * 4.5 },
            inside: { x: p.x - p.tx * 5.4, z: p.z - p.tz * 5.4 }
        })
    }

    // --- the convertible parked at the kerb, the scooter on the sidewalk
    {
        const p = main.at(0.034)
        const car = offsetFrom(p, 1, ROAD_HALF - 1.05)
        props.push({ id: 'car', kind: 'car', x: car.x, z: car.z, yaw: Math.atan2(p.tx, p.tz) })
        const q = main.at(0.022)
        const scooter = offsetFrom(q, -1, ROAD_HALF + SIDEWALK * 0.55)
        props.push({ id: 'scooter', kind: 'scooter', x: scooter.x, z: scooter.z, yaw: Math.atan2(q.tx, q.tz) + 0.5 })
    }

    // --- plaza with the trophies
    {
        const f = 0.1
        const p = main.at(f)
        plazas.push({ x: p.x, z: p.z, r: 6.2 })
        const pos = offsetFrom(p, -1, 6.2 + 3.4)
        // the board stands at the edge of the plaza, beside the trophies
        const q = main.at(f + 0.03)
        const signPos = offsetFrom(q, -1, 5.0)
        sites.push({
            id: 'achievements', kind: 'trophies', contentId: 'achievements',
            x: pos.x, z: pos.z, yaw: yawTowards(pos, p), w: 4.4, d: 3.2, h: 5,
            sign: { ...signPos, yaw: yawTowards(signPos, p) }
        })
    }

    // --- one building per project
    const fractions = [ 0.19, 0.305, 0.42, 0.535, 0.645, 0.73 ]
    projects.forEach((project, i) =>
    {
        const f = fractions[i] ?? (0.19 + i * 0.1)
        const side = i % 2 === 0 ? 1 : -1
        const p = main.at(f)
        const w = 8
        const d = 6.4
        const dist = ROAD_HALF + SIDEWALK + 2.4 + d / 2
        const pos = offsetFrom(p, side, dist)
        const signPos = offsetFrom(p, side, ROAD_HALF + SIDEWALK + 0.6)
        // board turned a little towards people walking up the path
        const signYaw = yawTowards(signPos, p) - side * 0.55
        sites.push({
            id: project.id, kind: project.building, contentId: project.id,
            x: pos.x, z: pos.z, yaw: yawTowards(pos, p), w, d, h: 9,
            sign: { x: signPos.x, z: signPos.z, yaw: signYaw }
        })
    })

    // --- the cinema whose marquee lists the career, facing the road
    {
        const f = 0.795
        const p = main.at(f)
        const side = -1
        const pos = offsetFrom(p, side, ROAD_HALF + SIDEWALK + 1.6 + 3.6)
        const q = main.at(f - 0.04)
        const signPos = offsetFrom(q, side, ROAD_HALF + SIDEWALK + 0.6)
        sites.push({
            id: 'career', kind: 'cinema', contentId: 'career',
            x: pos.x, z: pos.z, yaw: yawTowards(pos, p), w: 11, d: 7.2, h: 12,
            sign: { x: signPos.x, z: signPos.z, yaw: yawTowards(signPos, q) + 0.5 }
        })
    }

    // --- chai stall at the end of the path, back to the sea
    {
        const p = main.at(1)
        const outward = { x: p.tx, z: p.tz }
        const pos = { x: p.x + outward.x * 5.6, z: p.z + outward.z * 5.6 }
        const yaw = Math.atan2(-outward.x, -outward.z)
        // the stool sits in front of the stall, a little to the side
        const right = { x: -outward.z, z: outward.x }
        const stool = { x: pos.x - outward.x * 2.6 + right.x * 1.6, z: pos.z - outward.z * 2.6 + right.z * 1.6 }
        sites.push({
            id: 'contact', kind: 'chai', contentId: 'contact',
            x: pos.x, z: pos.z, yaw, w: 4.6, d: 3.0, h: 4,
            stool: { ...stool, yaw },
            sign: { ...{ x: pos.x - outward.x * 2.2 - right.x * 2.8, z: pos.z - outward.z * 2.2 - right.z * 2.8 }, yaw: yaw - 0.4 }
        })
    }

    // --- branch to the lighthouse on the headland
    {
        const a = COAST.bumps[0][0]
        const tip = polar(coastRadius(a) - 4.2, a)
        const from = main.nearest(tip.x, tip.z)
        const start = main.points[from.index]
        const mid1 = { x: start.x + (tip.x - start.x) * 0.35 + 2.5, z: start.z + (tip.z - start.z) * 0.35 - 1.5 }
        const mid2 = { x: start.x + (tip.x - start.x) * 0.7 - 1.5, z: start.z + (tip.z - start.z) * 0.7 + 2.0 }
        const end = polar(coastRadius(a) - 9.5, a)
        paths.push(new Path([ start, mid1, mid2, end ], 1.1, 'boardwalk'))
        sites.push({ id: 'lighthouse', kind: 'lighthouse', x: tip.x, z: tip.z, yaw: yawTowards(tip, end), w: 4.2, d: 4.2, h: 14 })
    }

    // --- the Game Arcade: a hall beside the far end of the runway, with a boardwalk
    // from the road loop to its door
    const runway = buildRunway()
    const arcade = (() =>
    {
        // out past the city on the sea side of the island, clear of the houses, the road and the runway
        const pos = polar(62, 2.55)
        const near = main.nearest(pos.x, pos.z)
        const road = main.points[near.index]
        const yaw = yawTowards(pos, road)
        const fx = Math.sin(yaw)
        const fz = Math.cos(yaw)
        const door = { x: pos.x + fx * 6.6, z: pos.z + fz * 6.6 }
        const from = road
        const mid = { x: (from.x + door.x) / 2 + 2.5, z: (from.z + door.z) / 2 - 1.5 }
        paths.push(new Path([ from, mid, door ], 1.6, 'boardwalk'))
        const site = { id: 'arcade', kind: 'arcade', contentId: 'arcade', x: pos.x, z: pos.z, yaw, w: 10, d: 8, h: 10, door }
        sites.push(site)
        return site
    })()

    // --- a short cut from the square straight north across the middle,
    // so the paths make a loop instead of one long line
    {
        const from = main.at(0.06)
        const to = main.at(0.765)
        const deg = Math.PI / 180
        const cut = new Path([
            { x: from.x, z: from.z },
            polar(11.5, -40 * deg),
            polar(18, -78 * deg),
            { x: to.x, z: to.z }
        ], ROAD_HALF)
        // marked by name, not by its position in the list, since the other paths may change
        cut.cut = true
        paths.push(cut)
    }

    // spawn: just outside the studio door
    const studio = sites[0]
    const start = main.at(0.0)

    return {
        paths,
        plazas,
        sites,
        props,
        main,
        spawn: { x: start.x, z: start.z, yaw: Math.atan2(start.tx, start.tz) },
        studioDoor: studio.door,
        studioInside: studio.inside,
        runway,
        arcade: sites.find((s) => s.id === 'arcade')
    }
}

export const layout = buildLayout()
