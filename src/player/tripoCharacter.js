import * as THREE from 'three'

// Drives a rigged character model (public/models/character.glb, from Tripo or
// any pack) with the same interface as the procedural Character.
// Clips are matched by name, best match first: idle, walk, run, wave, sit.
// Packs without a run clip run with a faster walk; without a wave clip the
// greeting falls back to a cheer ("Victory" and similar).
// Walk and run play at a rate matched to the actual speed so feet don't slide.

const CLIP_NAMES = {
    idle: [ 'idle' ],
    walk: [ 'walk' ],
    run: [ 'run', 'jog' ],
    wave: [ 'wave', 'greet', 'hello', 'victory', 'cheer' ],
    sit: [ 'sitdown', 'sit_down', 'sitting', 'sit' ]
}

function findClip(animations, names)
{
    const norm = (s) => s.toLowerCase().replace(/^.*\|/, '').replace(/^preset:(biped:)?/, '')
    // exact names first, then names that start with the word, then anything containing it,
    // skipping variants like Walk_Carry or Run_Gun
    for(const name of names)
    {
        const exact = animations.find((c) => norm(c.name) === name)
        if(exact) return exact
    }
    for(const name of names)
    {
        const start = animations.find((c) => norm(c.name).startsWith(name) && !/carry|gun|hold|back/.test(norm(c.name)))
        if(start) return start
    }
    for(const name of names)
    {
        const any = animations.find((c) => norm(c.name).includes(name))
        if(any) return any
    }
    return null
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
            const clip = findClip(animations, names)
            if(!clip) continue
            const action = this.mixer.clipAction(clip)
            if(key === 'sit')
            {
                // sitting down plays once and holds the seated pose
                action.setLoop(THREE.LoopOnce, 1)
                action.clampWhenFinished = true
            }
            action.play()
            action.setEffectiveWeight(key === 'idle' ? 1 : 0)
            this.actions[key] = action
        }
        // metres covered by one loop of the walk / run clips (tune in manifest.json)
        this.walkStride = entry.walkStride ?? 1.4
        this.runStride = entry.runStride ?? 2.6
        this.weights = { idle: 1, walk: 0, run: 0, wave: 0, sit: 0 }
        this.state = { speed: 0, walkSpeed: 2.7, runSpeed: 6.2, turn: 0, mode: 'idle', wave: false }
        this.lean = 0
        this.wasSitting = false
        this.wasWaving = false
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
        const sitting = s.mode === 'sit' || s.mode === 'ride'
        const waving = !!(s.wave && s.mode !== 'ride' && this.actions.wave)
        const target = {
            idle: (s.mode === 'idle' || s.mode === 'move') && !waving ? 1 - moving : 0,
            walk: moving * (1 - run),
            run: moving * run,
            wave: waving ? 1 : 0,
            sit: sitting && !waving ? 1 : 0
        }
        if(!this.actions.run) { target.walk += target.run; target.run = 0 }
        if(!this.actions.sit && target.sit) target.idle = 1
        // waving while seated: keep the seat, wave from it
        if(waving && sitting && this.actions.sit) { target.sit = 0.4; target.wave = 0.6 }

        // restart one-shot clips each time they begin
        if(sitting && !this.wasSitting && this.actions.sit) this.actions.sit.reset().play()
        if(waving && !this.wasWaving) this.actions.wave.reset().play()
        this.wasSitting = sitting
        this.wasWaving = waving

        // blend toward the target, then normalise: if the weights add up to less
        // than one, the rig's rest pose (arms out) shows through mid-blend
        const k = 1 - Math.exp(-dt * 8)
        let total = 0
        for(const key in this.weights)
        {
            this.weights[key] += (target[key] - this.weights[key]) * k
            if(this.actions[key]) total += this.weights[key]
        }
        for(const key in this.weights)
        {
            const action = this.actions[key]
            if(action) action.setEffectiveWeight(total > 0.001 ? this.weights[key] / total : key === 'idle' ? 1 : 0)
        }

        // play the cycles at the rate the body actually moves
        if(this.actions.walk)
        {
            const clip = this.actions.walk.getClip()
            const stride = this.actions.run ? this.walkStride : THREE.MathUtils.lerp(this.walkStride, this.runStride, run)
            this.actions.walk.timeScale = speed > 0.05 ? (speed / stride) * clip.duration : 1
        }
        if(this.actions.run)
        {
            const clip = this.actions.run.getClip()
            this.actions.run.timeScale = speed > 0.05 ? (speed / this.runStride) * clip.duration : 1
        }

        // lean into turns, and forward a little when running on a walk cycle
        this.lean += (THREE.MathUtils.clamp(-s.turn * speed * 0.045, -0.3, 0.3) - this.lean) * k
        this.body.rotation.z = this.lean
        this.body.rotation.x = this.actions.run ? 0 : run * 0.12 * moving
        this.mixer.update(dt)
    }
}
