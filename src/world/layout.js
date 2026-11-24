// Island layout in map coordinates (metres, island centre at 0,0).
// Pure data + math: it is shared by the renderer and by scripts/check-world.mjs.

import { projects } from '../content.js'

// ------------------------------------------------------------------ coast
// The sunset bay faces this map angle. The sun sits above it, so the walk
// goes from afternoon light near the studio to sunset at the chai stall.
export const BAY_ANGLE = -0.62
export const SUN_ELEVATION = 0.74 // radians above the horizon at the island centre

export const COAST = {
    base: 47,
    // amplitude, frequency, phase
    waves: [ [ 4.2, 2, 0.6 ], [ 3.1, 3, 2.1 ], [ 1.9, 5, 4.0 ], [ 1.1, 7, 1.3 ], [ 0.6, 11, 5.2 ] ],
    // headland for the lighthouse: [angle, width, height]
    bumps: [ [ 1.95, 0.22, 6.5 ], [ -2.55, 0.3, 3.0 ] ]
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
    // pull the bay in a little so it reads as a curve
    const b = angleDelta(phi, BAY_ANGLE) / 0.45
    r -= 3.2 * Math.exp(-b * b)
    return r
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
    s += `  { float b = ${wrap(BAY_ANGLE)} / 0.45; r -= 3.2 * exp(-b * b); }\n`
    s += '  return r;\n}\n'
    return s
}

// ------------------------------------------------------------------ paths
export const PATH_HALF_WIDTH = 1.35

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
    constructor(controlPoints, halfWidth = PATH_HALF_WIDTH)
    {
        const r = resample(catmullRom(controlPoints))
        this.points = r.points
        this.length = r.length
        this.halfWidth = halfWidth
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
    // Hand-drawn loop: out of the studio, east past the square, then round the
    // island clockwise (south, west, north) and down to the sunset bay.
    // [radius, angle in degrees]; angles grow clockwise on the map.
    const deg = Math.PI / 180
    const bay = BAY_ANGLE / deg + 360
    const control = [
        [ 3.5, -70 ], [ 9, -22 ], [ 15.5, 14 ], [ 21, 44 ], [ 25.5, 76 ], [ 28.5, 108 ],
        [ 26.5, 140 ], [ 29.5, 172 ], [ 27, 204 ], [ 29, 236 ], [ 26.5, 262 ], [ 30.5, 288 ],
        [ 35.5, bay - 16 ], [ coastRadius(BAY_ANGLE) - 4.5, bay ]
    ]
    return new Path(control.map(([ r, a ]) => polar(r, a * deg)))
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

    // --- studio at the start of the path, door facing along it
    {
        const p = main.at(0)
        const back = { x: p.x - p.tx * 5.2, z: p.z - p.tz * 5.2 }
        sites.push({
            id: 'studio', kind: 'studio', x: back.x, z: back.z,
            yaw: yawTowards(back, p), w: 7, d: 6, h: 6,
            door: { x: p.x - p.tx * 1.8, z: p.z - p.tz * 1.8 }
        })
    }

    // --- scooter parked by the path, just past the studio
    {
        const p = main.at(0.03)
        const pos = offsetFrom(p, 1, PATH_HALF_WIDTH + 1.4)
        props.push({ id: 'scooter', kind: 'scooter', x: pos.x, z: pos.z, yaw: Math.atan2(p.tx, p.tz) + 0.35 })
    }

    // --- town square with the trophies
    {
        const f = 0.095
        const p = main.at(f)
        plazas.push({ x: p.x, z: p.z, r: 4.6 })
        const pos = offsetFrom(p, -1, 4.6 + 2.6)
        // the board stands at the edge of the square, beside the trophies
        const q = main.at(f + 0.028)
        const signPos = offsetFrom(q, -1, 3.2)
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
        const dist = PATH_HALF_WIDTH + 3.0 + d / 2
        const pos = offsetFrom(p, side, dist)
        const signPos = offsetFrom(p, side, PATH_HALF_WIDTH + 1.15)
        // board turned a little towards people walking up the path
        const signYaw = yawTowards(signPos, p) - side * 0.55
        sites.push({
            id: project.id, kind: project.building, contentId: project.id,
            x: pos.x, z: pos.z, yaw: yawTowards(pos, p), w, d, h: 9,
            sign: { x: signPos.x, z: signPos.z, yaw: signYaw }
        })
    })

    // --- railway station for the career timeline, parallel to the path
    {
        const f = 0.795
        const p = main.at(f)
        const side = -1
        const pos = offsetFrom(p, side, PATH_HALF_WIDTH + 1.0 + 4.6)
        const signPos = offsetFrom(main.at(f - 0.045), side, PATH_HALF_WIDTH + 1.15)
        sites.push({
            id: 'career', kind: 'station', contentId: 'career',
            // platform front faces the path
            x: pos.x, z: pos.z, yaw: yawTowards(pos, p), w: 15, d: 8.4, h: 6,
            sign: { x: signPos.x, z: signPos.z, yaw: yawTowards(signPos, main.at(f - 0.045)) + 0.5 }
        })
    }

    // --- chai stall at the end of the path, back to the sea
    {
        const p = main.at(1)
        const outward = { x: p.tx, z: p.tz }
        const pos = { x: p.x + outward.x * 3.6, z: p.z + outward.z * 3.6 }
        const yaw = Math.atan2(-outward.x, -outward.z)
        // the stool sits in front of the stall, a little to the side
        const right = { x: -outward.z, z: outward.x }
        const stool = { x: pos.x - outward.x * 2.6 + right.x * 1.6, z: pos.z - outward.z * 2.6 + right.z * 1.6 }
        sites.push({
            id: 'contact', kind: 'chai', contentId: 'contact',
            x: pos.x, z: pos.z, yaw, w: 4.6, d: 3.0, h: 4,
            stool: { ...stool, yaw },
            sign: { ...{ x: pos.x - outward.x * 2.4 - right.x * 2.2, z: pos.z - outward.z * 2.4 - right.z * 2.2 }, yaw: yaw - 0.4 }
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
        paths.push(new Path([ start, mid1, mid2, end ], 1.05))
        sites.push({ id: 'lighthouse', kind: 'lighthouse', x: tip.x, z: tip.z, yaw: yawTowards(tip, end), w: 4.2, d: 4.2, h: 14 })
    }

    // --- a short cut from the square straight north across the middle,
    // so the paths make a loop instead of one long line
    {
        const from = main.at(0.06)
        const to = main.at(0.765)
        const deg = Math.PI / 180
        paths.push(new Path([
            { x: from.x, z: from.z },
            polar(9, -40 * deg),
            polar(14, -78 * deg),
            { x: to.x, z: to.z }
        ], 1.0))
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
        studioDoor: studio.door
    }
}

export const layout = buildLayout()
