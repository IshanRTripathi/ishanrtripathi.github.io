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
// `rider` is what the player is riding: { kind, x, z, alt, v, onGround }, kind being 'walk',
// 'plane', 'heli', 'car', 'scooter' or 'boat'. A mission lists the kinds it allows, so the engine
// only calls update() while the rider is in one of them. update() also gets `world`, what else it
// may look at ({ traffic: the traffic cars }), and `dt`, the seconds since the last frame.

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
            ground: Math.max(0, groundAt(g.x, g.z)),
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
        // a stop on foot is a beam on the next one only; a race is a row of rings or arches
        if(s.def.marker === 'beam')
        {
            const g = s.gates[Math.min(s.index, s.gates.length - 1)]
            return [ { type: 'beam', x: g.x, z: g.z, alt: g.ground, radius: s.radius } ]
        }
        const marks = s.gates.map((g, i) => ({
            type: 'ring', x: g.x, z: g.z, yaw: g.yaw, alt: g.alt, radius: s.radius,
            state: i < s.index ? 'passed' : i === s.index ? 'next' : 'ahead'
        }))
        // ramps (for a boat to jump) halfway between one gate and the next
        if(s.def.ramps)
            for(let i = 0; i + 1 < s.gates.length; i++)
            {
                const a = s.gates[i]
                const b = s.gates[i + 1]
                marks.push({ type: 'ramp', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, yaw: Math.atan2(b.x - a.x, b.z - a.z), alt: 0 })
            }
        return marks
    }
})

// ------------------------------------------------------------------ weave
// Drive close past the traffic without hitting it, at speed: each near miss counts. The same car
// does not count twice in a row. Done after `goal` near misses.
registerStep('weave', {
    create(def)
    {
        return { def, count: 0, clock: 0, last: new Map() }
    },
    update(s, rider, world, dt)
    {
        s.clock += dt
        // a near miss: close enough to be scary (the cars are 1.9 m wide, so under 1.6 m apart is a hit), at speed
        const near = s.def.near ?? 4.2
        const fastEnough = s.def.speed ?? 7
        let progress = null
        ;(world.traffic || []).forEach((car, i) =>
        {
            const d = Math.hypot(car.x - rider.x, car.z - rider.z)
            if(d > near || d < 1.6 || rider.v < fastEnough) return
            if(s.clock - (s.last.get(i) ?? -99) < 2.5) return
            s.last.set(i, s.clock)
            s.count++
            progress = { count: Math.min(s.count, s.def.goal), total: s.def.goal }
        })
        if(!progress) return null
        return { progress, done: s.count >= s.def.goal }
    },
    // there is nowhere to point to: the traffic moves
    target() { return null },
    objective(s)
    {
        return `${(s.def.label ?? 'near miss').toLowerCase()} ${Math.min(s.count + 1, s.def.goal)} of ${s.def.goal}: pass the traffic close, at speed`
    },
    marks() { return [] }
})
