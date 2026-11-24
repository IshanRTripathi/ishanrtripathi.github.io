import * as THREE from 'three'

// Drives a rigged Tripo character (public/models/character.glb) with the same
// interface as the procedural Character. Clips are matched by name: idle, walk,
// run, wave, sit (Tripo preset names such as "preset:walk" match too).
// Walk and run play at a rate matched to the actual speed so feet don't slide.

const CLIP_NAMES = {
    idle: [ 'idle' ],
    walk: [ 'walk' ],
    run: [ 'run' ],
    wave: [ 'wave', 'greet', 'hello' ],
    sit: [ 'sit' ]
}

export class TripoCharacter
{
    constructor({ object, animations, entry })
    {
        this.root = new THREE.Group()
        this.body = new THREE.Group()
        this.root.add(this.body)
        this.body.add(object)
        this.mixer = new THREE.AnimationMixer(object)
        this.actions = {}
        for(const [ key, names ] of Object.entries(CLIP_NAMES))
        {
            const clip = animations.find((c) => names.some((n) => c.name.toLowerCase().includes(n)))
            if(clip)
            {
                const action = this.mixer.clipAction(clip)
                action.play()
                action.setEffectiveWeight(key === 'idle' ? 1 : 0)
                this.actions[key] = action
            }
        }
        // metres covered by one loop of the walk / run clips (tune in manifest.json)
        this.walkStride = entry.walkStride ?? 1.4
        this.runStride = entry.runStride ?? 2.6
        this.weights = { idle: 1, walk: 0, run: 0, wave: 0, sit: 0 }
        this.state = { speed: 0, walkSpeed: 2.7, runSpeed: 6.2, turn: 0, mode: 'idle', wave: false }
        this.lean = 0
    }

    setState(state)
    {
        Object.assign(this.state, state)
    }

    update(dt)
    {
        const s = this.state
        const speed = Math.abs(s.speed)
        const run = THREE.MathUtils.clamp((speed - s.walkSpeed) / (s.runSpeed - s.walkSpeed), 0, 1)
        const moving = s.mode === 'move' ? THREE.MathUtils.clamp(speed / 0.6, 0, 1) : 0
        const target = {
            idle: s.mode === 'idle' || s.mode === 'move' ? (1 - moving) * (s.wave && this.actions.wave ? 0 : 1) : 0,
            walk: moving * (1 - run),
            run: moving * run,
            wave: s.wave && s.mode !== 'ride' ? 1 : 0,
            sit: s.mode === 'sit' || s.mode === 'ride' ? 1 : 0
        }
        if(!this.actions.run) { target.walk += target.run; target.run = 0 }
        if(!this.actions.sit && target.sit) target.idle = 1

        const k = 1 - Math.exp(-dt * 8)
        for(const key in this.weights)
        {
            this.weights[key] += (target[key] - this.weights[key]) * k
            const action = this.actions[key]
            if(action) action.setEffectiveWeight(this.weights[key])
        }

        // play the cycles at the rate the body actually moves
        if(this.actions.walk)
        {
            const clip = this.actions.walk.getClip()
            this.actions.walk.timeScale = speed > 0.05 ? (speed / this.walkStride) * clip.duration : 1
        }
        if(this.actions.run)
        {
            const clip = this.actions.run.getClip()
            this.actions.run.timeScale = speed > 0.05 ? (speed / this.runStride) * clip.duration : 1
        }

        this.lean += (THREE.MathUtils.clamp(-s.turn * speed * 0.045, -0.3, 0.3) - this.lean) * k
        this.body.rotation.z = this.lean
        this.mixer.update(dt)
    }
}
