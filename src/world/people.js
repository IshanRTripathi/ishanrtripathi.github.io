import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { layout } from './layout.js'
import { groundAt } from './terrain.js'
import { surfacePoint, frameQuaternion } from '../core/geo.js'
import { mulberry32 } from '../core/noise.js'
import { WALK_OFFSET, BENCH } from './seats.js'

// A few people on the road: two women and two men. They walk the sidewalk, back and forth, and
// now and then turn off to sit on a bench or on the beach. What they wear depends on the season.

const SKIN = '#B07B56'
const SHOES = '#3A2F2A'
const WOOD = '#A87448'
const WOOD_DARK = '#7A4F2C'

// the outfit of each season (spring, summer, autumn, winter): women (f) and men (m)
const OUTFITS = [
    {
        f: { top: '#F4B6C2', bottom: '#F3E6C9', skirt: true, hair: '#3B2A22', scarf: null, coat: false, hat: null },
        m: { top: '#9ED5A6', bottom: '#B69D74', skirt: false, hair: '#231A17', scarf: null, coat: false, hat: null }
    },
    {
        f: { top: '#FFD166', bottom: '#FF8C69', skirt: true, hair: '#7A4A2A', scarf: null, coat: false, hat: null },
        m: { top: '#FFFFFF', bottom: '#3E7CB1', skirt: false, hair: '#231A17', scarf: null, coat: false, hat: null }
    },
    {
        f: { top: '#C8643B', bottom: '#6B4A2F', skirt: true, hair: '#3B2A22', scarf: '#E0A030', coat: false, hat: null },
        m: { top: '#D9A531', bottom: '#3C3A44', skirt: false, hair: '#231A17', scarf: '#8C3B2E', coat: false, hat: null }
    },
    {
        f: { top: '#6B2D5C', bottom: '#2F2F3A', skirt: false, hair: '#3B2A22', scarf: '#B8C4D6', coat: true, hat: '#5C4A9E' },
        m: { top: '#1F3A5F', bottom: '#3C3C44', skirt: false, hair: '#231A17', scarf: '#B8C4D6', coat: true, hat: '#C0392B' }
    }
]

const CAST = [
    { gender: 'f', f: 0.22, dir: 1, speed: 1.2 },
    { gender: 'm', f: 0.5, dir: -1, speed: 1.35 },
    { gender: 'f', f: 0.74, dir: -1, speed: 1.15 },
    { gender: 'm', f: 0.12, dir: 1, speed: 1.4 }
]

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const smooth = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c) }

function angleLerp(a, b, t)
{
    let d = b - a
    while(d > Math.PI) d -= Math.PI * 2
    while(d < -Math.PI) d += Math.PI * 2
    return a + d * t
}

function part(build)
{
    const kit = new Kit()
    build(kit)
    const mesh = new THREE.Mesh(kit.geometry(), clayMaterial)
    mesh.castShadow = true
    return mesh
}

function joint(parent, x, y, z, mesh)
{
    const g = new THREE.Group()
    g.position.set(x, y, z)
    if(mesh) g.add(mesh)
    parent.add(g)
    return g
}

// one figure, on the same bone layout as the main character, in this season's clothes
function buildFigure(gender, outfit)
{
    const c = outfit[gender]
    const root = new THREE.Group()
    const hips = joint(root, 0, 0.94, 0, part((k) =>
    {
        k.box(0.34, 0.2, 0.2, c.bottom, { y: -0.08 })
        if(c.skirt) k.cyl(0.19, 0.27, 0.36, 8, c.bottom, { y: -0.2 })
    }))

    const legs = [ -1, 1 ].map((side) =>
    {
        const thigh = joint(hips, side * 0.09, -0.02, 0, part((k) => k.box(0.17, 0.44, 0.18, c.bottom, { y: -0.22 })))
        const shin = joint(thigh, 0, -0.44, 0, part((k) =>
        {
            k.box(0.15, 0.42, 0.16, c.bottom, { y: -0.21 })
            k.box(0.17, 0.09, 0.26, SHOES, { y: -0.44, z: 0.04 })
        }))
        return { thigh, shin }
    })

    const spine = joint(hips, 0, 0.06, 0, part((k) =>
    {
        k.box(c.coat ? 0.42 : 0.36, c.coat ? 0.56 : 0.5, c.coat ? 0.26 : 0.21, c.top, { y: 0 })
        if(c.scarf) k.box(0.3, 0.07, 0.25, c.scarf, { y: 0.27 })
    }))

    const arms = [ -1, 1 ].map((side) => joint(spine, side * 0.24, 0.42, 0, part((k) =>
    {
        k.box(c.coat ? 0.14 : 0.12, 0.46, 0.13, c.top, { y: -0.23 })
        k.sphere(0.06, SKIN, { y: -0.5 }, 1)
    })))

    const neck = joint(spine, 0, 0.5, 0, part((k) => k.cyl(0.055, 0.065, 0.1, 6, SKIN, {})))
    const head = joint(neck, 0, 0.09, 0, part((k) =>
    {
        k.sphere(0.13, SKIN, { y: 0.12, sy: 1.12, sz: 1.0 }, 1)
        // hair: a short cap for the men, longer at the back for the women
        k.sphere(0.145, c.hair, { y: 0.16, sy: 0.7 }, 1)
        if(gender === 'f') k.box(0.28, 0.3, 0.1, c.hair, { y: 0.02, z: -0.1 })
        if(c.hat) k.box(0.29, 0.12, 0.29, c.hat, { y: 0.27 })
    }))

    return { root, hips, spine, head, legs, arms }
}

// the walking cycle, or the seated pose, blended by `sit` (0 standing, 1 seated)
function pose(fig, move, phase, sit)
{
    fig.hips.position.y = THREE.MathUtils.lerp(0.94, 0.5, sit)
    fig.legs.forEach((leg, i) =>
    {
        const s = i === 0 ? Math.sin(phase) : -Math.sin(phase)
        leg.thigh.rotation.x = THREE.MathUtils.lerp(s * 0.5 * move, -Math.PI / 2, sit)
        leg.shin.rotation.x = THREE.MathUtils.lerp(Math.max(0, -s) * 0.45 * move, Math.PI / 2, sit)
    })
    fig.arms.forEach((arm, i) =>
    {
        const s = i === 0 ? -Math.sin(phase) : Math.sin(phase)
        arm.rotation.x = THREE.MathUtils.lerp(s * 0.4 * move, -0.7, sit)
    })
}

function disposeTree(obj)
{
    obj.traverse((o) => { if(o.geometry) o.geometry.dispose() })
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
        this.season = -1

        for(const seat of seats)
        {
            const bench = buildBench()
            bench.position.copy(surfacePoint(seat.x, seat.z, groundAt(seat.x, seat.z)))
            bench.quaternion.copy(frameQuaternion(seat.x, seat.z, seat.yaw))
            this.group.add(bench)
        }

        this.people = CAST.map((spec, i) =>
        {
            const group = new THREE.Group()
            this.group.add(group)
            return {
                gender: spec.gender, group, fig: null, state: 'walk', seat: null,
                f: spec.f, dir: spec.dir, speed: spec.speed, side: 1,
                x: 0, z: 0, yaw: 0, phase: i * 1.7, move: 0, sit: 0, speedNow: 0,
                t: 0, dur: 0, sitFor: 0, from: null, to: null
            }
        })
    }

    dress(p, season)
    {
        if(p.fig)
        {
            p.group.remove(p.fig.root)
            disposeTree(p.fig.root)
        }
        p.fig = buildFigure(p.gender, OUTFITS[season])
        p.group.add(p.fig.root)
    }

    // the spot on the sidewalk at a fraction of the main road, and the way the road runs there
    walkSpot(p, f)
    {
        const q = this.main.at(f)
        return { x: q.x - q.tz * WALK_OFFSET * p.side, z: q.z + q.tx * WALK_OFFSET * p.side, tx: q.tx, tz: q.tz }
    }

    update(dt, season)
    {
        if(season !== this.season)
        {
            this.season = season
            for(const p of this.people) this.dress(p, season)
        }
        for(const p of this.people)
        {
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
        p.dur = 1.2
        p.t = 0
        p.state = 'rise'
    }

    place(p, dt)
    {
        // where the person is, and which way they face, for each state
        let move = 0
        let sit = 0
        if(p.state === 'walk')
        {
            const s = this.walkSpot(p, p.f)
            p.x = s.x
            p.z = s.z
            p.yaw = Math.atan2(s.tx * p.dir, s.tz * p.dir)
            move = 1
        }
        else if(p.state === 'toSeat')
        {
            const k = smooth(p.t / p.dur)
            p.x = p.from.x + (p.to.x - p.from.x) * k
            p.z = p.from.z + (p.to.z - p.from.z) * k
            p.yaw = angleLerp(p.from.yaw, p.to.yaw, k)
            move = 1
        }
        else if(p.state === 'sit')
        {
            p.x = p.seat.x
            p.z = p.seat.z
            p.yaw = p.seat.yaw
            sit = 1
        }
        else if(p.state === 'rise')
        {
            const k = smooth(p.t / p.dur)
            p.x = p.from.x + (p.to.x - p.from.x) * k
            p.z = p.from.z + (p.to.z - p.from.z) * k
            p.yaw = angleLerp(p.from.yaw, p.to.yaw, k)
            sit = 1 - k
        }

        // the walking cycle carries on from its own phase, so the legs don't snap when a pose changes
        const ease = 1 - Math.exp(-dt * 8)
        p.move += (move - p.move) * ease
        p.sit += (sit - p.sit) * (1 - Math.exp(-dt * 6))
        p.phase += p.speedNow * dt * 4.2

        if(p.fig) pose(p.fig, p.move, p.phase, p.sit)
        p.group.position.copy(surfacePoint(p.x, p.z, groundAt(p.x, p.z) + 0.03))
        p.group.quaternion.copy(frameQuaternion(p.x, p.z, p.yaw))
    }
}
