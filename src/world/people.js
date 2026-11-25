import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { layout } from './layout.js'
import { groundAt } from './terrain.js'
import { surfacePoint, frameQuaternion } from '../core/geo.js'
import { mulberry32 } from '../core/noise.js'
import { WALK_OFFSET, BENCH } from './seats.js'
import { Kit, clayMaterial } from '../models/kit.js'

// A few people on the road: two women and two men, on the same rigged figures as the character
// (Quaternius, CC0). They walk the sidewalk back and forth, and now and then turn off to sit on a
// bench or on the beach. Each one's clothes (the Shirt and Pants materials) change with the season.

const WOOD = '#A87448'
const WOOD_DARK = '#7A4F2C'

// the clothes of each season (spring, summer, autumn, winter): [shirt, trousers] for women and men
const OUTFITS = [
    { f: [ '#F4B6C2', '#F3E6C9' ], m: [ '#9ED5A6', '#B69D74' ] },
    { f: [ '#FFD166', '#FF8C69' ], m: [ '#FFFFFF', '#3E7CB1' ] },
    { f: [ '#C8643B', '#6B4A2F' ], m: [ '#D9A531', '#3C3A44' ] },
    { f: [ '#6B2D5C', '#2F2F3A' ], m: [ '#1F3A5F', '#3C3C44' ] }
]

const CAST = [
    { gender: 'f', f: 0.22, dir: 1, speed: 1.2 },
    { gender: 'm', f: 0.5, dir: -1, speed: 1.35 },
    { gender: 'f', f: 0.74, dir: -1, speed: 1.15 },
    { gender: 'm', f: 0.12, dir: 1, speed: 1.4 }
]

// each person's own skin and hair, and a little difference in height, so they are not all alike
const SKINS = [ '#B07B56', '#8D5A3B', '#E0B08C', '#C68A62', '#5C3A26', '#F1C9A5' ]
const HAIRS = {
    f: [ '#3B2A22', '#1C1410', '#7A4A2A', '#C9A36B', '#8A3B22' ],
    m: [ '#231A17', '#3B2A22', '#5A3A22', '#9A6A3A', '#1C1410' ]
}

const CLIPS = [ 'Idle', 'Walk', 'SitDown', 'StandUp' ]
const FADE = 0.25

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const smooth = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c) }

function angleLerp(a, b, t)
{
    let d = b - a
    while(d > Math.PI) d -= Math.PI * 2
    while(d < -Math.PI) d += Math.PI * 2
    return a + d * t
}

function disposeTree(obj)
{
    obj.traverse((o) => { if(o.geometry) o.geometry.dispose() })
}

// A copy of a rigged figure, with its own materials (so its skin, hair and clothes can differ) and its
// own clips. Shared by the people on the road and the people inside the rooms.
export function cloneFigure(figure, gender, rng)
{
    const model = clone(figure.object)
    model.traverse((o) =>
    {
        if(!o.isMesh) return
        o.castShadow = true
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone()
    })
    const pick = (list) => list[Math.floor(rng() * list.length)]
    model.scale.setScalar(0.94 + rng() * 0.12)
    let shirt = null
    let pants = null
    model.traverse((o) =>
    {
        if(!o.isMesh) return
        for(const m of [].concat(o.material))
        {
            if(m.name === 'Shirt') shirt = m
            if(m.name === 'Pants') pants = m
            if(m.name === 'Skin') m.color.set(pick(SKINS))
            if(m.name === 'Hair') m.color.set(pick(HAIRS[gender]))
        }
    })
    const mixer = new THREE.AnimationMixer(model)
    const actions = {}
    for(const name of CLIPS)
    {
        const clip = figure.animations.find((a) => a.name === name)
        if(!clip) continue
        const action = mixer.clipAction(clip)
        if(name === 'SitDown' || name === 'StandUp')
        {
            action.setLoop(THREE.LoopOnce, 1)
            action.clampWhenFinished = true
        }
        actions[name] = action
    }
    return { model, mixer, actions, shirt, pants, stride: figure.entry.walkStride || 1.9 }
}

function buildBench()
{
    const k = new Kit()
    k.box(BENCH.length, 0.08, BENCH.depth, WOOD, { y: BENCH.seat })
    k.box(BENCH.length, 0.46, 0.06, WOOD, { y: BENCH.seat + 0.22, z: -BENCH.depth / 2 + 0.03 })
    for(const x of [ -0.7, 0.7 ]) for(const z of [ -0.18, 0.18 ]) k.box(0.08, BENCH.seat, 0.08, WOOD_DARK, { x, y: BENCH.seat / 2, z })
    const mesh = new THREE.Mesh(k.geometry(), clayMaterial)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}

export class People
{
    constructor(seats)
    {
        this.group = new THREE.Group()
        this.seats = seats
        this.main = layout.paths[0]
        this.rng = mulberry32(77)
        this.people = []

        for(const seat of seats)
        {
            const bench = buildBench()
            bench.position.copy(surfacePoint(seat.x, seat.z, groundAt(seat.x, seat.z)))
            bench.quaternion.copy(frameQuaternion(seat.x, seat.z, seat.yaw))
            this.group.add(bench)
        }
    }

    // the people, once the figures have loaded: { female, male }, each from the registry, or null
    populate(figures)
    {
        this.people = CAST.map((spec, i) =>
        {
            const figure = figures[spec.gender === 'f' ? 'female' : 'male']
            const group = new THREE.Group()
            this.group.add(group)
            const person = {
                gender: spec.gender, group, model: null, mixer: null, actions: {}, anim: null, season: -1,
                state: 'walk', seat: null,
                f: spec.f, dir: spec.dir, speed: spec.speed, side: 1,
                x: 0, z: 0, yaw: 0, speedNow: 0,
                t: 0, dur: 0, sitFor: 0, from: null, to: null
            }
            if(figure) this.attachFigure(person, figure)
            return person
        })
    }

    // a copy of the figure for one person: its own materials, its own colours and its own clips
    attachFigure(person, figure)
    {
        const f = cloneFigure(figure, person.gender, this.rng)
        person.model = f.model
        person.group.add(f.model)
        person.shirt = f.shirt
        person.pants = f.pants
        person.mixer = f.mixer
        person.actions = f.actions
        person.stride = f.stride
    }

    // the clothes for a season: the shirt and the trousers take that season's colours
    dress(p, season)
    {
        if(!p.shirt || !p.pants) return
        const [ shirt, pants ] = OUTFITS[season][p.gender]
        p.shirt.color.set(shirt)
        p.pants.color.set(pants)
        p.season = season
    }

    // the spot on the sidewalk at a fraction of the main road, and the way the road runs there
    walkSpot(p, f)
    {
        const q = this.main.at(f)
        return { x: q.x - q.tz * WALK_OFFSET * p.side, z: q.z + q.tx * WALK_OFFSET * p.side, tx: q.tx, tz: q.tz }
    }

    update(dt, season)
    {
        for(const p of this.people)
        {
            if(p.season !== season) this.dress(p, season)
            this.step(p, dt)
            this.place(p, dt)
        }
    }

    step(p, dt)
    {
        const len = this.main.length
        if(p.state === 'walk')
        {
            p.f += p.dir * p.speed * dt / len
            p.speedNow = p.speed
            if(p.f >= 1 || p.f <= 0)
            {
                p.f = clamp01(p.f)
                const beach = this.seats.find((s) => s.kind === 'beach' && !s.busy)
                // at the end of the road, sit on the beach if a seat is free; otherwise turn round
                if(p.f >= 1 && beach && this.rng() < 0.7) this.startSeat(p, beach)
                else p.dir = -p.dir
                return
            }
            // a free bench on the way: decided once per pass, so most people walk on past it
            const bench = this.seats.find((s) => s.kind === 'bench' && !s.busy && Math.abs(s.f - p.f) * len < 0.8)
            if(!bench) p.declined = null
            else if(bench !== p.declined)
            {
                if(this.rng() < 0.35) this.startSeat(p, bench)
                else p.declined = bench
            }
        }
        else if(p.state === 'toSeat')
        {
            p.t += dt
            p.speedNow = p.dur > 0 ? Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z) / p.dur : 0
            if(p.t >= p.dur)
            {
                p.state = 'sit'
                p.t = 0
                p.sitFor = 7 + this.rng() * 8
                p.speedNow = 0
            }
        }
        else if(p.state === 'sit')
        {
            p.t += dt
            if(p.t >= p.sitFor) this.startRise(p)
        }
        else if(p.state === 'rise')
        {
            p.t += dt
            p.speedNow = 0
            if(p.t >= p.dur)
            {
                const seat = p.seat
                p.state = 'walk'
                p.f = seat.kind === 'beach' ? 1 : seat.f
                p.dir = seat.kind === 'beach' ? -1 : (this.rng() < 0.5 ? -1 : 1)
                seat.busy = false
                p.seat = null
            }
        }
    }

    startSeat(p, seat)
    {
        seat.busy = true
        p.seat = seat
        p.from = { x: p.x, z: p.z, yaw: p.yaw }
        p.to = { x: seat.x, z: seat.z, yaw: seat.yaw }
        p.dur = Math.max(1, Math.hypot(seat.x - p.x, seat.z - p.z) / 1.2)
        p.t = 0
        p.state = 'toSeat'
    }

    startRise(p)
    {
        const seat = p.seat
        const spot = this.walkSpot(p, seat.kind === 'beach' ? 1 : seat.f)
        p.from = { x: p.x, z: p.z, yaw: p.yaw }
        p.to = { x: spot.x, z: spot.z, yaw: Math.atan2(spot.tx, spot.tz) }
        p.dur = p.actions.StandUp ? p.actions.StandUp.getClip().duration : 1.2
        p.t = 0
        p.state = 'rise'
    }

    place(p, dt)
    {
        // where the person is, and which way they face, for each state
        if(p.state === 'walk')
        {
            const s = this.walkSpot(p, p.f)
            p.x = s.x
            p.z = s.z
            p.yaw = Math.atan2(s.tx * p.dir, s.tz * p.dir)
        }
        else if(p.state === 'toSeat')
        {
            const k = smooth(p.t / p.dur)
            p.x = p.from.x + (p.to.x - p.from.x) * k
            p.z = p.from.z + (p.to.z - p.from.z) * k
            p.yaw = angleLerp(p.from.yaw, p.to.yaw, k)
        }
        else if(p.state === 'sit')
        {
            p.x = p.seat.x
            p.z = p.seat.z
            p.yaw = p.seat.yaw
        }
        else if(p.state === 'rise')
        {
            const k = smooth(p.t / p.dur)
            p.x = p.from.x + (p.to.x - p.from.x) * k
            p.z = p.from.z + (p.to.z - p.from.z) * k
            p.yaw = angleLerp(p.from.yaw, p.to.yaw, k)
        }

        if(p.mixer) this.animate(p, dt)
        p.group.position.copy(surfacePoint(p.x, p.z, groundAt(p.x, p.z) + 0.03))
        p.group.quaternion.copy(frameQuaternion(p.x, p.z, p.yaw))
    }

    // the clip for the state: walking, idle, sitting down (and holding), or getting up
    animate(p, dt)
    {
        const want = p.state === 'walk' || p.state === 'toSeat' ? 'Walk'
            : p.state === 'sit' ? 'SitDown'
            : p.state === 'rise' ? 'StandUp'
            : 'Idle'
        if(want !== p.anim)
        {
            const prev = p.actions[p.anim]
            const next = p.actions[want]
            if(prev) prev.fadeOut(FADE)
            if(next)
            {
                next.reset()
                next.fadeIn(FADE)
                next.play()
            }
            p.anim = want
        }
        // the walk plays at the speed the person actually moves, so the feet keep up with the road
        const walk = p.actions.Walk
        if(walk && p.speedNow > 0.05) walk.timeScale = (p.speedNow / p.stride) * walk.getClip().duration
        p.mixer.update(dt)
    }

    dispose()
    {
        for(const p of this.people) if(p.model) disposeTree(p.model)
    }
}
