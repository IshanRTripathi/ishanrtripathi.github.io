import { ISLANDS } from '../world/islands.js'
import { groundAt } from '../world/terrain.js'
import { routeGates } from './routes.js'

// Steps: the kinds of objective a mission is made of. A mission is a list of steps done one after
// another, so any mission is a data entry, and a new kind of objective is one registerStep call:
//
//   registerStep('photo', {
//       create(def) { return { def, ... } },          // the state of one step, made when the mission starts
//       update(state, rider) { ... },                 // every frame: return { progress: { count, total }, done: true } or null
//       target(state) { return { x, z, label, alt } },// where the minimap and the map point
//       objective(state) { return 'text for the HUD' },
//       marks(state) { return [ { type: 'beam', ... } ] } // what to draw in the world (see missionView.js)
//   })
//
// `rider` is what the player is riding: { kind, x, z, alt, v, onGround }, kind being 'plane',
// 'heli', 'car', 'scooter' or 'boat'. A mission lists the kinds it allows, so the engine only
// calls update() while the rider is in one of them.

const types = {}

export function registerStep(type, impl)
{
    types[type] = impl
}

export function stepType(type)
{
    const impl = types[type]
    if(!impl) throw new Error(`mission uses a step that does not exist: ${type}`)
    return impl
}

const island = (id) =>
{
    const found = ISLANDS.find((i) => i.id === id)
    if(!found) throw new Error(`mission step names an island that does not exist: ${id}`)
    return found
}

// is a point over an airstrip's tarmac? (the strip is a rectangle)
function overRunway(runway, x, z)
{
    const dx = x - runway.mid.x
    const dz = z - runway.mid.z
    const along = dx * runway.t.x + dz * runway.t.z
    const across = -dx * runway.t.z + dz * runway.t.x
    return Math.abs(along) <= runway.length / 2 + 6 && Math.abs(across) <= runway.width / 2 + 8
}

// ------------------------------------------------------------------ land
// Land at an island's airstrip and stop on it. A plane has to be on the strip and slow; a
// helicopter only has to touch down close to the middle of it.
registerStep('land', {
    create(def)
    {
        const isl = island(def.island)
        return { def, island: isl, runway: isl.runway }
    },
    update(s, rider)
    {
        if(!rider.onGround) return null
        const { mid } = s.runway
        if(rider.kind === 'heli') return rider.v < 3 && Math.hypot(rider.x - mid.x, rider.z - mid.z) < 22 ? { done: true } : null
        return rider.v < 14 && overRunway(s.runway, rider.x, rider.z) ? { done: true } : null
    },
    target(s)
    {
        const { mid } = s.runway
        return { x: mid.x, z: mid.z, label: s.island.name, alt: Math.max(0, groundAt(mid.x, mid.z)) }
    },
    objective(s)
    {
        return `land at ${s.island.name}`
    },
    marks(s)
    {
        const t = this.target(s)
        return [ { type: 'beam', x: t.x, z: t.z, alt: t.alt } ]
    }
})

// ------------------------------------------------------------------ gates
// Go through a row of gates in order: rings in the sky for a plane or a helicopter (air: true),
// or arches over the road or the water for a car, a scooter or a boat. The gates come from a
// route (routes.js). The step is done when the last gate is passed.
const GROUND_RADIUS = 5.5
const AIR_RADIUS = 9
registerStep('gates', {
    create(def)
    {
        const air = !!def.air
        const radius = def.radius ?? (air ? AIR_RADIUS : GROUND_RADIUS)
        const gates = routeGates(def).map((g) => ({
            ...g,
            // a ring in the air hangs `height` above the ground; an arch stands on it, its middle low enough that the foot of it is buried
            alt: Math.max(0, groundAt(g.x, g.z)) + (air ? def.height ?? 24 : radius * 0.45)
        }))
        return { def, air, radius, gates, index: 0 }
    },
    update(s, rider)
    {
        const g = s.gates[s.index]
        if(Math.hypot(g.x - rider.x, g.z - rider.z) >= s.radius) return null
        if(s.air && Math.abs(g.alt - rider.alt) >= s.radius + 4) return null
        s.index++
        return { progress: { count: s.index, total: s.gates.length }, done: s.index >= s.gates.length }
    },
    target(s)
    {
        const g = s.gates[Math.min(s.index, s.gates.length - 1)]
        return { x: g.x, z: g.z, label: `${s.def.label ?? 'Gate'} ${Math.min(s.index + 1, s.gates.length)} of ${s.gates.length}`, alt: g.alt }
    },
    objective(s)
    {
        const where = s.def.where ? ` ${s.def.where}` : ''
        return `${(s.def.label ?? 'gate').toLowerCase()} ${Math.min(s.index + 1, s.gates.length)} of ${s.gates.length}${where}`
    },
    marks(s)
    {
        return s.gates.map((g, i) => ({
            type: 'ring', x: g.x, z: g.z, yaw: g.yaw, alt: g.alt, radius: s.radius,
            state: i < s.index ? 'passed' : i === s.index ? 'next' : 'ahead'
        }))
    }
})
