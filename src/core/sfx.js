// Short game sounds made on the fly, so there are no files to load: footsteps, a jump and a
// landing, a car horn, and the little tunes of a mission starting, a checkpoint, a pass, a fail
// and getting paid. Each is an entry in SOUNDS: a function that is given the audio context, the
// start time and the output, and schedules some oscillators and noise. Adding one is adding an entry.
//
//   ambience.sfx('horn')            plays it
//   ambience.sfx('step', { level }) some take options

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)

// one tone: an oscillator with an envelope, optionally sliding to another pitch
function tone(ctx, out, { t, freq, to, length = 0.2, type = 'sine', gain = 0.2, attack = 0.005, cut })
{
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if(to) osc.frequency.exponentialRampToValueAtTime(to, t + length)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, t + length)
    let node = osc
    if(cut)
    {
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = cut
        node = osc.connect(filter)
    }
    node.connect(env).connect(out)
    osc.start(t)
    osc.stop(t + length + 0.05)
}

// a burst of noise through a filter
function burst(ctx, out, noise, { t, type = 'lowpass', freq = 1200, to, length = 0.1, gain = 0.2 })
{
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(freq, t)
    if(to) filter.frequency.exponentialRampToValueAtTime(to, t + length)
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + length)
    src.connect(filter).connect(env).connect(out)
    src.start(t, Math.random() * 0.4)
    src.stop(t + length + 0.02)
}

// a run of notes, one after another
function melody(ctx, out, t, notes, step, options)
{
    notes.forEach((n, i) => { if(n !== null) tone(ctx, out, { t: t + i * step, freq: midi(n), ...options }) })
}

const SOUNDS = {
    // a footstep: a soft tick, lighter at a walk and heavier at a sprint
    step({ ctx, out, noise, t }, { level = 0.5 } = {})
    {
        burst(ctx, out, noise, { t, type: 'lowpass', freq: 700 + Math.random() * 300, length: 0.07, gain: 0.05 + 0.12 * level })
    },
    jump({ ctx, out, noise, t })
    {
        tone(ctx, out, { t, freq: 220, to: 420, length: 0.14, type: 'triangle', gain: 0.09 })
        burst(ctx, out, noise, { t, type: 'bandpass', freq: 800, to: 2400, length: 0.14, gain: 0.07 })
    },
    // landing: a thump that grows with the drop
    land({ ctx, out, noise, t }, { level = 0.5 } = {})
    {
        tone(ctx, out, { t, freq: 120, to: 45, length: 0.16, gain: 0.2 + 0.25 * level })
        burst(ctx, out, noise, { t, type: 'lowpass', freq: 900, length: 0.1, gain: 0.1 + 0.15 * level })
    },
    // a car horn: two notes together, a little out of tune, like a real one
    horn({ ctx, out, t })
    {
        for(const f of [ 392, 494 ]) tone(ctx, out, { t, freq: f, length: 0.42, type: 'sawtooth', gain: 0.07, attack: 0.012, cut: 1800 })
    },
    // out of breath: a short low puff
    puff({ ctx, out, noise, t })
    {
        burst(ctx, out, noise, { t, type: 'lowpass', freq: 600, length: 0.28, gain: 0.12 })
    },
    // a mission starts: three notes going up
    missionStart({ ctx, out, t })
    {
        melody(ctx, out, t, [ 64, 69, 76 ], 0.11, { length: 0.3, type: 'triangle', gain: 0.12 })
    },
    // a checkpoint, a ring, a landing: a bright double ding
    checkpoint({ ctx, out, t })
    {
        melody(ctx, out, t, [ 84, 91 ], 0.07, { length: 0.28, type: 'sine', gain: 0.16 })
    },
    // mission passed: a short fanfare
    missionPass({ ctx, out, t })
    {
        melody(ctx, out, t, [ 67, 72, 76, 79, 84 ], 0.12, { length: 0.5, type: 'triangle', gain: 0.14 })
        melody(ctx, out, t, [ 55, null, 60, null, 64 ], 0.12, { length: 0.6, type: 'sawtooth', gain: 0.04, cut: 900 })
    },
    // mission failed: three notes going down, in the minor
    missionFail({ ctx, out, t })
    {
        melody(ctx, out, t, [ 67, 63, 58 ], 0.2, { length: 0.45, type: 'triangle', gain: 0.14 })
    },
    // paid: a pair of high coins
    cash({ ctx, out, t })
    {
        melody(ctx, out, t, [ 88, 95 ], 0.09, { length: 0.35, type: 'square', gain: 0.05, cut: 5000 })
    }
}

export class Sfx
{
    constructor(context, destination)
    {
        this.context = context
        this.out = destination
        const length = context.sampleRate
        this.noise = context.createBuffer(1, length, context.sampleRate)
        const data = this.noise.getChannelData(0)
        for(let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    }

    play(name, options)
    {
        const sound = SOUNDS[name]
        if(!sound) return
        sound({ ctx: this.context, out: this.out, noise: this.noise, t: this.context.currentTime + 0.01 }, options)
    }
}
