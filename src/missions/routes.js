import { ISLANDS } from '../world/islands.js'
import { layout } from '../world/layout.js'
import { scatter } from '../world/scatter.js'

// Routes: named ways of laying out the gates of a race or a ring run. A route takes the step's
// definition and gives back its gates, each { x, z, yaw }, in the order they are driven or flown.
// Adding a route is one registerRoute call, and any mission can then use it by name:
//
//   registerRoute('harbour', (def) => [ { x: 10, z: 20, yaw: 0 }, ... ])
//   // ... and in the mission list:  { type: 'gates', route: 'harbour', ... }

const routes = {}

export function registerRoute(name, make)
{
    routes[name] = make
}

export function routeGates(def)
{
    const make = routes[def.route]
    if(!make) throw new Error(`mission step uses a route that does not exist: ${def.route}`)
    return make(def)
}

const island = (id) =>
{
    const found = ISLANDS.find((i) => i.id === id)
    if(!found) throw new Error(`mission step names an island that does not exist: ${id}`)
    return found
}

// `count` even stops along a polyline. A closed one ends back where it began; an open one runs
// from its first point to its last.
function along(points, count, closed)
{
    const lengths = [ 0 ]
    const loop = closed ? [ ...points, points[0] ] : points
    for(let i = 1; i < loop.length; i++) lengths.push(lengths[i - 1] + Math.hypot(loop[i].x - loop[i - 1].x, loop[i].z - loop[i - 1].z))
    const total = lengths[lengths.length - 1]
    const out = []
    for(let k = 0; k < count; k++)
    {
        const s = (closed ? (k + 1) / count : k / Math.max(1, count - 1)) * total
        let j = 0
        while(j < lengths.length - 2 && lengths[j + 1] < s) j++
        const a = loop[j]
        const b = loop[j + 1]
        const t = (s - lengths[j]) / ((lengths[j + 1] - lengths[j]) || 1)
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) })
    }
    return out
}

// a circle round an island, `offset` metres off its coast, each gate facing the way round
registerRoute('around', (def) =>
{
    const isl = island(def.island)
    const r = isl.radius + (def.offset ?? 18)
    const out = []
    for(let k = 0; k < def.count; k++)
    {
        const a = (k / def.count) * Math.PI * 2 + 0.4
        out.push({ x: isl.at.x + Math.cos(a) * r, z: isl.at.z + Math.sin(a) * r, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) })
    }
    return out
})

// the city's loop road, `count` gates to a lap and `laps` laps (the traffic runs on it)
registerRoute('loop', (def) =>
{
    const lap = along(scatter.loop, def.count, true)
    return Array.from({ length: def.laps ?? 1 }, () => lap).flat()
})

// the main road from the studio to the beach, between two fractions of its length
registerRoute('main', (def) =>
{
    const from = def.from ?? 0.03
    const to = def.to ?? 1
    const out = []
    for(let k = 0; k < def.count; k++)
    {
        const f = from + (to - from) * (k / Math.max(1, def.count - 1))
        const p = layout.main.at(Math.min(1, f))
        out.push({ x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) })
    }
    return out
})

// the front doors of buildings you can walk into, by site id, in the order given
registerRoute('sites', (def) => def.ids.map((id) =>
{
    const site = layout.sites.find((s) => s.id === id)
    if(!site || !site.entrance) throw new Error(`mission route names a building with no door: ${id}`)
    return { x: site.entrance.x, z: site.entrance.z, yaw: 0 }
}))

// gates given outright in the mission, for a one-off course
registerRoute('points', (def) => def.points.map((p) => ({ yaw: 0, ...p })))
