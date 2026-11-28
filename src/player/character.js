import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'

// Stand-in character until the Tripo model is generated: a low-poly figure on
// a simple bone hierarchy, animated procedurally. The leg cycle is driven by
// distance travelled, so feet don't slide at any speed.

const COLORS = {
    skin: '#B07B56',
    hair: '#231A17',
    shirt: '#FFFFFF',
    shirtShade: '#EDEAE4',
    overshirt: '#5EC4B6',
    trousers: '#D8C6A5',
    shoes: '#F6F3EC',
    sole: '#FF4FA3',
    shades: '#1B1A22',
    eye: '#1E1A18'
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

export class Character
{
    constructor()
    {
        this.root = new THREE.Group()
        this.root.name = 'character'
        this.body = joint(this.root, 0, 0, 0)

        const hips = this.hips = joint(this.body, 0, 0.94, 0, part((k) =>
        {
            k.box(0.34, 0.2, 0.2, COLORS.trousers, { y: -0.08 })
        }))

        const spine = this.spine = joint(hips, 0, 0.06, 0, part((k) =>
        {
            // white tee under an open short-sleeved shirt
            k.box(0.36, 0.5, 0.21, COLORS.shirt, { y: 0 })
            k.box(0.38, 0.5, 0.2, COLORS.overshirt, { y: 0, z: -0.012 })
            k.box(0.12, 0.48, 0.02, COLORS.overshirt, { x: -0.13, y: 0.01, z: 0.1 })
            k.box(0.12, 0.48, 0.02, COLORS.overshirt, { x: 0.13, y: 0.01, z: 0.1 })
            k.box(0.16, 0.05, 0.05, COLORS.shirtShade, { y: 0.5, z: 0.09 })
        }))

        const neck = this.neck = joint(spine, 0, 0.5, 0, part((k) =>
        {
            k.cyl(0.055, 0.065, 0.1, 6, COLORS.skin, {})
        }))

        this.head = joint(neck, 0, 0.09, 0, part((k) =>
        {
            k.sphere(0.13, COLORS.skin, { y: 0.12, sy: 1.12, sz: 1.0 }, 1)
            // hair: a cap pushed back with a little volume on top
            k.sphere(0.14, COLORS.hair, { y: 0.19, z: -0.02, sy: 0.82, sx: 1.04 }, 1)
            k.box(0.2, 0.06, 0.1, COLORS.hair, { y: 0.24, z: 0.06, rx: -0.3 })
            // ears, eyes, nose
            k.sphere(0.03, COLORS.skin, { x: -0.13, y: 0.12 })
            k.sphere(0.03, COLORS.skin, { x: 0.13, y: 0.12 })
            // sunglasses
            k.box(0.075, 0.045, 0.02, COLORS.shades, { x: -0.048, y: 0.13, z: 0.12 })
            k.box(0.075, 0.045, 0.02, COLORS.shades, { x: 0.048, y: 0.13, z: 0.12 })
            k.box(0.24, 0.014, 0.014, COLORS.shades, { y: 0.15, z: 0.12 })
            k.box(0.06, 0.015, 0.02, COLORS.hair, { x: -0.048, y: 0.172, z: 0.112 })
            k.box(0.06, 0.015, 0.02, COLORS.hair, { x: 0.048, y: 0.172, z: 0.112 })
            k.box(0.03, 0.05, 0.04, COLORS.skin, { y: 0.09, z: 0.125 })
        }))

        const leg = (side) =>
        {
            const thigh = joint(hips, side * 0.1, -0.08, 0, part((k) =>
            {
                k.box(0.14, 0.44, 0.15, COLORS.trousers, { y: -0.44 })
            }))
            const shin = joint(thigh, 0, -0.44, 0, part((k) =>
            {
                k.box(0.12, 0.4, 0.13, COLORS.trousers, { y: -0.4 })
            }))
            const foot = joint(shin, 0, -0.41, 0, part((k) =>
            {
                k.box(0.13, 0.08, 0.26, COLORS.shoes, { y: -0.06, z: 0.05 })
                k.box(0.14, 0.03, 0.27, COLORS.sole, { y: -0.07, z: 0.05 })
            }))
            return { thigh, shin, foot }
        }
        this.legL = leg(1)
        this.legR = leg(-1)

        const arm = (side) =>
        {
            const upper = joint(spine, side * 0.22, 0.44, 0, part((k) =>
            {
                k.box(0.12, 0.16, 0.13, COLORS.overshirt, { y: -0.16 })
                k.box(0.1, 0.16, 0.11, COLORS.skin, { y: -0.31 })
            }))
            const fore = joint(upper, 0, -0.3, 0, part((k) =>
            {
                k.box(0.09, 0.26, 0.1, COLORS.skin, { y: -0.26 })
                k.box(0.1, 0.1, 0.06, COLORS.skin, { y: -0.36, z: 0.01 })
                if(side < 0) k.box(0.1, 0.05, 0.11, '#C8CDD2', { y: -0.2 }) // watch
            }))
            return { upper, fore }
        }
        this.armL = arm(1)
        this.armR = arm(-1)

        this.phase = 0
        this.time = 0
        this.weights = { idle: 1, move: 0, wave: 0, sit: 0, ride: 0 }
        this.state = { speed: 0, walkSpeed: 2.7, runSpeed: 6.2, turn: 0, mode: 'idle', wave: false }
        this.lean = 0
        this.airW = 0 // how much of the pose is a jump
        this.waveTime = 0
    }

    // mode: 'idle' | 'move' | 'sit' | 'ride'; wave can layer on idle or sit
    setState(state)
    {
        Object.assign(this.state, state)
    }

    update(dt)
    {
        const s = this.state
        this.time += dt
        const speed = Math.abs(s.speed)
        const run = THREE.MathUtils.clamp((speed - s.walkSpeed) / (s.runSpeed - s.walkSpeed), 0, 1)
        const cycle = THREE.MathUtils.lerp(1.45, 2.5, run) // metres per full stride
        if(s.mode === 'move') this.phase += (s.speed * dt / cycle) * Math.PI * 2

        // blend weights toward the current mode
        const target = { idle: 0, move: 0, wave: 0, sit: 0, ride: 0 }
        if(s.mode === 'move') target.move = THREE.MathUtils.clamp(speed / 0.6, 0, 1)
        if(s.mode === 'move' || s.mode === 'idle') target.idle = 1 - target.move
        if(s.mode === 'sit') target.sit = 1
        if(s.mode === 'ride') target.ride = 1
        if(s.wave && s.mode !== 'ride' && s.mode !== 'move') target.wave = 1
        const k = 1 - Math.exp(-dt * 9)
        for(const key in this.weights) this.weights[key] += (target[key] - this.weights[key]) * k

        this.waveTime = s.wave ? this.waveTime + dt : 0
        this.lean += (THREE.MathUtils.clamp(-s.turn * speed * 0.045, -0.3, 0.3) - this.lean) * k

        this.airW += ((s.air ? 1 : 0) - this.airW) * k
        this.pose(run)
        this.applyAir()
    }

    // in the air the knees are tucked and the arms thrown up, laid over whatever the legs were doing
    applyAir()
    {
        const a = this.airW
        if(a < 0.01) return
        const to = (joint, value) => { joint.rotation.x += (value - joint.rotation.x) * a }
        to(this.legL.thigh, -0.9)
        to(this.legR.thigh, -0.3)
        to(this.legL.shin, 1.1)
        to(this.legR.shin, 0.5)
        to(this.armL.upper, -1.3)
        to(this.armR.upper, -1.1)
    }

    pose(run)
    {
        const w = this.weights
        const t = this.time
        const p = this.phase
        const amp = THREE.MathUtils.lerp(0.5, 0.85, run)
        const swingL = Math.sin(p) * amp
        const swingR = Math.sin(p + Math.PI) * amp
        const kneeL = Math.max(0, Math.cos(p)) * THREE.MathUtils.lerp(0.7, 1.5, run) + 0.08
        const kneeR = Math.max(0, Math.cos(p + Math.PI)) * THREE.MathUtils.lerp(0.7, 1.5, run) + 0.08
        const breath = Math.sin(t * 1.8) * 0.02

        // joint values: [idle, move, sit, ride]
        const blend = (idle, move, sit, ride) => idle * w.idle + move * w.move + sit * w.sit + ride * w.ride
        const total = w.idle + w.move + w.sit + w.ride || 1
        const B = (idle, move, sit, ride) => blend(idle, move, sit, ride) / total

        this.hips.position.y = B(0.94, 0.94 - Math.abs(Math.cos(p)) * 0.045 - run * 0.04, 0.6, 0.66)
        this.hips.position.z = B(0, 0, -0.12, -0.08)
        this.hips.rotation.y = B(0, Math.sin(p) * 0.12, 0, 0)
        this.spine.rotation.x = B(breath, 0.06 + run * 0.18, 0.06, 0.32)
        this.spine.rotation.y = B(0, -Math.sin(p) * 0.16, 0, 0)
        this.neck.rotation.x = B(-breath, -0.04 - run * 0.12, 0.05, -0.2)
        this.head.rotation.y = B(Math.sin(t * 0.4) * 0.15, 0, 0, 0)

        this.legL.thigh.rotation.x = B(0, -swingL, -1.55, -1.35)
        this.legR.thigh.rotation.x = B(0, -swingR, -1.55, -1.35)
        this.legL.thigh.rotation.z = B(0.03, 0, 0.12, 0.22)
        this.legR.thigh.rotation.z = B(-0.03, 0, -0.12, -0.22)
        this.legL.shin.rotation.x = B(0.02, kneeL, 1.5, 1.1)
        this.legR.shin.rotation.x = B(0.02, kneeR, 1.5, 1.1)
        this.legL.foot.rotation.x = B(0, -kneeL * 0.3 + swingL * 0.2, 0.05, 0.25)
        this.legR.foot.rotation.x = B(0, -kneeR * 0.3 + swingR * 0.2, 0.05, 0.25)

        this.armL.upper.rotation.x = B(0.05, -swingR * 0.9, -0.55, -1.15)
        this.armR.upper.rotation.x = B(0.05, -swingL * 0.9, -0.55, -1.15)
        this.armL.upper.rotation.z = B(0.1, 0.08, 0.12, 0.28)
        this.armR.upper.rotation.z = B(-0.1, -0.08, -0.12, -0.28)
        this.armL.fore.rotation.x = B(-0.1, -0.25 - run * 1.1, -0.65, -0.35)
        this.armR.fore.rotation.x = B(-0.1, -0.25 - run * 1.1, -0.65, -0.35)
        this.armR.fore.rotation.z = 0

        // wave: right arm up, forearm swinging. Layered over whatever else.
        if(w.wave > 0.001)
        {
            const ww = w.wave
            const wave = Math.sin(this.waveTime * 9) * 0.45
            this.armR.upper.rotation.x = THREE.MathUtils.lerp(this.armR.upper.rotation.x, -0.25, ww)
            this.armR.upper.rotation.z = THREE.MathUtils.lerp(this.armR.upper.rotation.z, -2.55, ww)
            this.armR.fore.rotation.x = THREE.MathUtils.lerp(this.armR.fore.rotation.x, 0, ww)
            this.armR.fore.rotation.z = THREE.MathUtils.lerp(0, -0.35 + wave, ww)
            this.head.rotation.z = 0.08 * ww
        }
        else this.head.rotation.z = 0

        this.body.rotation.z = this.lean
    }
}
