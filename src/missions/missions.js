import { ISLANDS } from '../world/islands.js'
import { groundAt } from '../world/terrain.js'

// Missions: jobs you take from the phone and fly to finish, like the missions in an
// open-world game. Pure logic and data: the scene draws them (missionView.js), the
// phone and the HUD show them, and main.js feeds in the plane every frame.
//
// Kinds:
//   land  - fly to an island and land on its airstrip, slowly enough to stop on it
//   rings - fly through every ring round an island, in order, before the time runs out
//   hop   - land on several islands one after another (each leg is a land leg)

const island = (id) => ISLANDS.find((i) => i.id === id)

// the rings for a ring race: a circle round the island, just off its coast, each one
// facing the way round the circle so the plane flies through it on the way
const RING_HEIGHT = 24
const RING_RADIUS = 9
export function ringsAround(isl, count)
{
    const out = []
    const r = isl.radius + 18
    for(let k = 0; k < count; k++)
    {
        const a = (k / count) * Math.PI * 2 + 0.4
        const x = isl.at.x + Math.cos(a) * r
        const z = isl.at.z + Math.sin(a) * r
        out.push({ x, z, yaw: Math.atan2(-Math.sin(a), Math.cos(a)), alt: Math.max(0, groundAt(x, z)) + RING_HEIGHT })
    }
    return out
}

// the missions on offer. pay is what the job pays on the day; time is the limit in seconds (0: none)
export const MISSIONS = [
    { id: 'milk-run', title: 'Milk Run', kind: 'land', legs: [ 'jungle' ], time: 0, pay: 400,
        brief: 'Fly the cargo to Jungle Cove and land on its airstrip.' },
    { id: 'ice-rings', title: 'Ice Ring Race', kind: 'rings', legs: [ 'frost' ], rings: 5, time: 150, pay: 900,
        brief: 'Fly through all five rings round Frost Peak, in order, within 150 seconds.' },
    { id: 'sandstorm', title: 'Sandstorm Drop', kind: 'land', legs: [ 'dunes' ], time: 150, pay: 600,
        brief: 'Get the supplies down at Dune Oasis before the sandstorm closes in.' },
    { id: 'geyser-rings', title: 'Geyser Ring Run', kind: 'rings', legs: [ 'geyser' ], rings: 6, time: 110, pay: 1200,
        brief: 'Thread the six rings round Geyser Isle, within 110 seconds.' },
    { id: 'pearl-rings', title: 'Pearl Ring Race', kind: 'rings', legs: [ 'atoll' ], rings: 4, time: 100, pay: 800,
        brief: 'Fly through the four rings round Pearl Atoll, within 100 seconds.' },
    { id: 'rim-hop', title: 'Rim Hop', kind: 'hop', legs: [ 'lantern', 'ridge', 'mangrove' ], time: 0, pay: 1500,
        brief: 'Land on Lantern Bay, then Radio Ridge, then Mangrove Delta.' }
]

// is a point over an airstrip's tarmac, and low enough to be on it? (the strip is a rectangle)
function overRunway(runway, x, z)
{
    const dx = x - runway.mid.x
    const dz = z - runway.mid.z
    const along = dx * runway.t.x + dz * runway.t.z
    const across = -dx * runway.t.z + dz * runway.t.x
    return Math.abs(along) <= runway.length / 2 + 6 && Math.abs(across) <= runway.width / 2 + 8
}

export class Missions
{
    // onEvent({ type, mission, ... }) is called as things happen: start, ring, leg, complete, fail, cancel
    constructor(onEvent = () => {})
    {
        this.onEvent = onEvent
        this.cash = 0
        this.done = new Set()
        this.active = null // { def, leg, ring, elapsed, rings, legs }
    }

    // what the phone lists: each mission with its state
    list()
    {
        return MISSIONS.map((m) => ({
            id: m.id,
            title: m.title,
            brief: m.brief,
            pay: m.pay,
            time: m.time,
            where: m.legs.map((id) => island(id).name).join(', then '),
            status: this.done.has(m.id) ? 'done' : this.active && this.active.def.id === m.id ? 'active' : 'open'
        }))
    }

    start(id)
    {
        const def = MISSIONS.find((m) => m.id === id)
        if(!def) return false
        const legs = def.legs.map((legId) => this.legFor(def, island(legId)))
        this.active = { def, legs, leg: 0, ring: 0, elapsed: 0 }
        this.onEvent({ type: 'start', mission: def })
        return true
    }

    cancel()
    {
        if(!this.active) return
        const def = this.active.def
        this.active = null
        this.onEvent({ type: 'cancel', mission: def })
    }

    // one leg of a mission: a landing on an island, or a ring race round it
    legFor(def, isl)
    {
        if(def.kind === 'rings') return { kind: 'rings', island: isl, rings: ringsAround(isl, def.rings) }
        return { kind: 'land', island: isl, runway: isl.runway }
    }

    // the point the map, the minimap and the world point at, or null when no mission is on.
    // direct: it lies across the sea, so the minimap draws a straight line to it
    get target()
    {
        const a = this.active
        if(!a) return null
        const leg = a.legs[a.leg]
        if(leg.kind === 'rings')
        {
            const ring = leg.rings[a.ring]
            return { x: ring.x, z: ring.z, label: `Ring ${a.ring + 1} of ${leg.rings.length}`, alt: ring.alt, direct: true }
        }
        return { x: leg.runway.mid.x, z: leg.runway.mid.z, label: leg.island.name, alt: groundAt(leg.runway.mid.x, leg.runway.mid.z), direct: true }
    }

    get title()
    {
        return this.active ? this.active.def.title : ''
    }

    // the short objective line for the HUD
    get objective()
    {
        const a = this.active
        if(!a) return ''
        const leg = a.legs[a.leg]
        const steps = a.legs.length > 1 ? `Leg ${a.leg + 1} of ${a.legs.length}: ` : ''
        if(leg.kind === 'rings') return `${steps}ring ${a.ring + 1} of ${leg.rings.length} round ${leg.island.name}`
        return `${steps}land at ${leg.island.name}`
    }

    // seconds left, or null when the mission has no limit
    get timeLeft()
    {
        const a = this.active
        if(!a || !a.def.time) return null
        return Math.max(0, a.def.time - a.elapsed)
    }

    // plane: { x, z, alt, v, onGround, rider } for the plane you are flying, or null when you are not in one
    update(dt, plane)
    {
        const a = this.active
        if(!a) return
        a.elapsed += dt
        if(a.def.time && a.elapsed >= a.def.time)
        {
            this.active = null
            this.onEvent({ type: 'fail', mission: a.def, reason: 'Out of time' })
            return
        }
        if(!plane) return
        const leg = a.legs[a.leg]
        if(leg.kind === 'rings')
        {
            const ring = leg.rings[a.ring]
            const near = Math.hypot(ring.x - plane.x, ring.z - plane.z) < RING_RADIUS
            if(near && Math.abs(ring.alt - plane.alt) < RING_RADIUS + 4)
            {
                a.ring++
                this.onEvent({ type: 'ring', mission: a.def, count: a.ring, total: leg.rings.length })
                if(a.ring >= leg.rings.length) this.nextLeg(a)
            }
        }
        else if(plane.onGround && plane.v < 14 && overRunway(leg.runway, plane.x, plane.z))
        {
            this.nextLeg(a)
        }
    }

    nextLeg(a)
    {
        a.leg++
        a.ring = 0
        if(a.leg >= a.legs.length)
        {
            this.active = null
            this.cash += a.def.pay
            this.done.add(a.def.id)
            this.onEvent({ type: 'complete', mission: a.def, pay: a.def.pay, cash: this.cash })
            return
        }
        this.onEvent({ type: 'leg', mission: a.def, leg: a.leg, total: a.legs.length })
    }

    // the rings still to fly, for drawing: the list of the active ring leg, or []
    get rings()
    {
        const a = this.active
        if(!a) return []
        const leg = a.legs[a.leg]
        return leg.kind === 'rings' ? leg.rings.map((r, i) => ({ ...r, state: i < a.ring ? 'passed' : i === a.ring ? 'next' : 'ahead' })) : []
    }

    // the landing spot of the active land leg, for drawing, or null
    get landing()
    {
        const a = this.active
        if(!a) return null
        const leg = a.legs[a.leg]
        if(leg.kind !== 'land') return null
        return { x: leg.runway.mid.x, z: leg.runway.mid.z, alt: Math.max(0, groundAt(leg.runway.mid.x, leg.runway.mid.z)), runway: leg.runway }
    }
}
