import { stepType } from './steps.js'
import { MISSIONS } from './list.js'

// The mission engine. It knows nothing about planes, roads or islands: a mission is a list of
// steps (steps.js), the engine runs them one after another with the clock, the vehicle rule and
// the pay, and tells the game what happens through onEvent. Add a mission in list.js, a kind of
// objective with registerStep (steps.js), a course with registerRoute (routes.js).
//
// Events: { type: 'start' | 'progress' | 'step' | 'complete' | 'fail' | 'cancel', mission, ... }
//
// update() is given `rider`, what the player is riding now: { kind, x, z, alt, v, onGround } (kind
// 'walk' on foot), or null while swimming or in a scene. The clock only starts once the rider is in a vehicle the mission allows.

export { MISSIONS }

// `walk` is on foot: a mission that allows it is done without a vehicle
const VEHICLE_NAMES = { walk: 'on foot', plane: 'plane', heli: 'helicopter', car: 'car', scooter: 'scooter', boat: 'boat' }

export const vehicleNames = (kinds) => kinds.map((k) => VEHICLE_NAMES[k] || k).join(' or ')

// what to do before the clock and the objective count
const needText = (kinds) => (kinds.every((k) => k === 'walk') ? 'Get out and on your feet' : `Get in a ${vehicleNames(kinds.filter((k) => k !== 'walk'))}`)

// the runtime steps of a mission: each step's definition with its own state
export function buildSteps(def)
{
    return def.steps.map((step) => ({ impl: stepType(step.type), state: stepType(step.type).create(step) }))
}

export class Missions
{
    constructor(onEvent = () => {}, defs = MISSIONS)
    {
        this.onEvent = onEvent
        this.defs = defs
        this.cash = 0
        this.done = new Set()
        this.active = null // { def, steps, step, elapsed, started, riding }
    }

    // a mission added while the game runs
    add(def)
    {
        this.defs.push(def)
    }

    // what the phone lists: each mission with its state
    list()
    {
        return this.defs.map((m) => ({
            id: m.id,
            title: m.title,
            brief: m.brief,
            pay: m.pay,
            time: m.time,
            by: vehicleNames(m.vehicles),
            status: this.done.has(m.id) ? 'done' : this.active && this.active.def.id === m.id ? 'active' : 'open'
        }))
    }

    start(id)
    {
        const def = this.defs.find((m) => m.id === id)
        if(!def) return false
        this.active = { def, steps: buildSteps(def), step: 0, elapsed: 0, started: false, riding: false }
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

    get current()
    {
        const a = this.active
        return a ? a.steps[a.step] : null
    }

    get title()
    {
        return this.active ? this.active.def.title : ''
    }

    // the point the map, the minimap and the world point at, or null when no mission is on.
    // direct: it may lie across the sea, so the minimap draws a straight line to it
    get target()
    {
        const s = this.current
        const t = s ? s.impl.target(s.state) : null
        return t ? { ...t, direct: true } : null
    }

    // the short objective line for the HUD; until you are in a vehicle that counts it says which
    get objective()
    {
        const a = this.active
        if(!a) return ''
        const step = a.steps[a.step]
        const legs = a.steps.length > 1 ? `Step ${a.step + 1} of ${a.steps.length}: ` : ''
        const text = `${legs}${step.impl.objective(step.state)}`
        return a.riding ? text : `${needText(a.def.vehicles)}: ${text}`
    }

    // seconds left, or null when the mission has no limit
    get timeLeft()
    {
        const a = this.active
        if(!a || !a.def.time) return null
        return Math.max(0, a.def.time - a.elapsed)
    }

    // what to draw in the world for the current step: a list of marks (see missionView.js)
    get marks()
    {
        const s = this.current
        return s ? s.impl.marks(s.state) : []
    }

    // world: what the steps may look at besides the rider, e.g. { traffic: [ { x, z } ] }
    update(dt, rider, world = {})
    {
        const a = this.active
        if(!a) return
        a.riding = !!rider && a.def.vehicles.includes(rider.kind)
        if(a.riding) a.started = true
        if(a.started) a.elapsed += dt
        if(a.def.time && a.elapsed >= a.def.time)
        {
            this.active = null
            this.onEvent({ type: 'fail', mission: a.def, reason: 'Out of time' })
            return
        }
        if(!a.riding) return
        const step = a.steps[a.step]
        const result = step.impl.update(step.state, rider, world, dt)
        if(!result) return
        if(result.progress) this.onEvent({ type: 'progress', mission: a.def, label: step.state.def.label ?? 'Gate', ...result.progress })
        if(result.done) this.nextStep(a)
    }

    nextStep(a)
    {
        a.step++
        if(a.step >= a.steps.length)
        {
            this.active = null
            this.cash += a.def.pay
            this.done.add(a.def.id)
            this.onEvent({ type: 'complete', mission: a.def, pay: a.def.pay, cash: this.cash })
            return
        }
        this.onEvent({ type: 'step', mission: a.def, step: a.step, total: a.steps.length })
    }
}
