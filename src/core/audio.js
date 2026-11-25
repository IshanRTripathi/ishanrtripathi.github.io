import { Music } from './music.js'

// Ambient sound made on the fly: the sea (filtered noise that swells like
// waves, louder near the shore), rain, wind, thunder, birdsong in the morning
// and crickets at night. The music and the short sounds are CC0 files from
// public/audio (see public/audio/CREDITS.md); the plane's drone is made here.

// the short sounds, by file, and how loud each one plays
const CLIPS = {
    'sfx/ui-click.mp3': 0.8,
    'sfx/ui-switch.mp3': 0.8,
    'sfx/ui-open.mp3': 0.7,
    'sfx/ui-confirm.mp3': 0.8,
    'sfx/ui-close.mp3': 0.7,
    'sfx/ui-drop.mp3': 0.7,
    'sfx/car-engine.wav': 0.2
}

// the button sounds, by name
const UI = {
    click: 'sfx/ui-click.mp3',
    switch: 'sfx/ui-switch.mp3',
    open: 'sfx/ui-open.mp3',
    confirm: 'sfx/ui-confirm.mp3',
    close: 'sfx/ui-close.mp3',
    drop: 'sfx/ui-drop.mp3'
}

export class Ambience
{
    constructor()
    {
        this.context = null
        this.enabled = false
        this.shore = 0
        this.buffers = {}
        this.noises = {}
        this.room = null // the building you are in, if any
        this.roomOut = null
        this.beds = {}
    }

    start()
    {
        if(this.context) return
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if(!AudioContext) return
        const ctx = this.context = new AudioContext()

        // brown noise
        const length = ctx.sampleRate * 4
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        let last = 0
        for(let i = 0; i < length; i++)
        {
            const white = Math.random() * 2 - 1
            last = (last + 0.02 * white) / 1.02
            data[i] = last * 3.2
        }
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true

        this.filter = ctx.createBiquadFilter()
        this.filter.type = 'lowpass'
        this.filter.frequency.value = 600
        this.swell = ctx.createGain()
        this.swell.gain.value = 0.4
        this.master = ctx.createGain()
        this.master.gain.value = 0
        source.connect(this.filter).connect(this.swell).connect(this.master).connect(ctx.destination)
        source.start()

        // the short sounds load in the background; the music streams
        for(const file of Object.keys(CLIPS)) this.fetchClip(file)
        this.music = new Music(ctx, this.master)
        this.drone = this.makeDrone()
    }

    async fetchClip(file)
    {
        try
        {
            const response = await fetch(`./audio/${file}`)
            this.buffers[file] = await this.context.decodeAudioData(await response.arrayBuffer())
        }
        catch(err)
        {
            // a sound that will not load stays silent; everything else still plays
            console.warn('sound not loaded', file, err)
        }
    }

    setEnabled(on)
    {
        this.enabled = on
        if(on) this.start()
        if(!this.context) return
        if(on && this.context.state === 'suspended') this.context.resume()
        this.setLevels()
        this.music?.setOn(on)
    }

    // the city's sounds are quieter indoors; a room's own sounds are on a separate output
    setLevels()
    {
        if(!this.context) return
        const t = this.context.currentTime
        this.master.gain.cancelScheduledValues(t)
        this.master.gain.setTargetAtTime(this.enabled ? (this.room ? 0.12 : 0.55) : 0, t, 0.4)
        if(this.roomOut) this.roomOut.gain.setTargetAtTime(this.enabled && this.room ? 1 : 0, t, 0.3)
    }

    // inside a building (kind) or back outside (null): the room's bed fades in, the others out
    setRoom(kind)
    {
        this.room = kind || null
        if(!this.context) return
        const ctx = this.context
        const t = ctx.currentTime
        if(!this.roomOut)
        {
            this.roomOut = ctx.createGain()
            this.roomOut.gain.value = 0
            this.roomOut.connect(ctx.destination)
        }
        if(kind && !this.beds[kind]) this.beds[kind] = this.roomBed(kind)
        for(const name of Object.keys(this.beds)) this.beds[name].out.gain.setTargetAtTime(name === kind ? this.beds[name].level : 0, t, 0.35)
        this.setLevels()
    }

    // one room's own sounds, made the first time you go in: a looping bed, and small sounds now and then
    // that only play while you are in that room
    roomBed(kind)
    {
        const ctx = this.context
        const out = ctx.createGain()
        out.gain.value = 0
        out.connect(this.roomOut)
        const bed = { out, level: 1, timers: [] }
        this.brown = this.brown || this.noiseBuffer(4, true)
        const noise = (type, freq, q, gain) =>
        {
            const src = ctx.createBufferSource()
            src.buffer = this.brown
            src.loop = true
            const f = ctx.createBiquadFilter()
            f.type = type
            f.frequency.value = freq
            f.Q.value = q
            const g = ctx.createGain()
            g.gain.value = gain
            src.connect(f).connect(g).connect(out)
            src.start()
        }
        const tone = (freq, gain) =>
        {
            const o = ctx.createOscillator()
            o.frequency.value = freq
            const g = ctx.createGain()
            g.gain.value = gain
            o.connect(g).connect(out)
            o.start()
        }
        const beep = (freq, dur, type, level) =>
        {
            const t = ctx.currentTime
            const o = ctx.createOscillator()
            o.type = type
            o.frequency.value = freq
            const g = ctx.createGain()
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(level, t + 0.01)
            g.gain.exponentialRampToValueAtTime(0.001, t + dur)
            o.connect(g).connect(out)
            o.start(t)
            o.stop(t + dur + 0.05)
        }
        // a small sound every few seconds, only while this room is the one you are in
        const blip = (every, play) =>
        {
            const tick = () =>
            {
                if(this.room === kind) play()
                bed.timers.push(setTimeout(tick, every() * 1000))
            }
            bed.timers.push(setTimeout(tick, every() * 1000))
        }
        const wait = (a, b) => () => a + Math.random() * (b - a)
        if(kind === 'cinema')
        {
            // a hush: the film is about to start
            noise('lowpass', 240, 0.7, 0.5)
        }
        else if(kind === 'hospital')
        {
            // the lights hum, and a monitor beeps now and then
            tone(120, 0.02)
            tone(240, 0.007)
            noise('lowpass', 500, 0.5, 0.12)
            blip(wait(4, 8), () => beep(1046, 0.09, 'sine', 0.05))
        }
        else if(kind === 'cafe')
        {
            // the murmur of people, and a cup set down now and then
            noise('bandpass', 800, 0.6, 0.35)
            blip(wait(3, 7), () => beep(2600, 0.2, 'sine', 0.035))
        }
        else if(kind === 'arcade')
        {
            // the cabinets hum, and bleeps as the games are played
            tone(55, 0.02)
            const notes = [ 523, 659, 784, 880, 1046 ]
            blip(wait(0.6, 1.6), () => beep(notes[Math.floor(Math.random() * notes.length)], 0.12, 'square', 0.02))
        }
        else if(kind === 'studio')
        {
            // quiet room tone
            noise('lowpass', 160, 0.7, 0.3)
        }
        else if(kind === 'lounge')
        {
            // the bass under the room, the murmur of the crowd, and a kick drum on every beat
            tone(55, 0.025)
            noise('lowpass', 380, 0.6, 0.2)
            const kick = () =>
            {
                const t = ctx.currentTime
                const o = ctx.createOscillator()
                o.frequency.setValueAtTime(110, t)
                o.frequency.exponentialRampToValueAtTime(42, t + 0.16)
                const g = ctx.createGain()
                g.gain.setValueAtTime(0.09, t)
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
                o.connect(g).connect(out)
                o.start(t)
                o.stop(t + 0.25)
            }
            blip(() => 0.5, kick)
        }
        bed.level = 1
        return bed
    }

    // a door shutting: a short thud of muffled noise
    door()
    {
        if(!this.context || !this.enabled) return
        const ctx = this.context
        const t = ctx.currentTime
        const src = ctx.createBufferSource()
        src.buffer = this.cachedNoise('door', 0.4)
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 700
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.5, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
        src.connect(f).connect(g).connect(this.master)
        src.start(t)
        src.stop(t + 0.3)
    }

    // shore: 0 (inland) .. 1 (on the beach)
    update(time, shore)
    {
        if(!this.context || !this.enabled) return
        const t = this.context.currentTime
        const wave = 0.5 + 0.5 * Math.sin(time * 0.55) * Math.sin(time * 0.23 + 1)
        this.swell.gain.setTargetAtTime(0.12 + shore * (0.35 + wave * 0.5), t, 0.3)
        this.filter.frequency.setTargetAtTime(380 + shore * 500 + wave * 500 * shore, t, 0.3)
        this.updateNature(t)
    }

    // night: 0 (day) .. 1 (night); the music cross-fades to the night theme
    setNight(night)
    {
        this.music?.setNight(night)
    }

    noiseBuffer(seconds, brown = false)
    {
        const ctx = this.context
        const length = Math.floor(ctx.sampleRate * seconds)
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        let last = 0
        for(let i = 0; i < length; i++)
        {
            const white = Math.random() * 2 - 1
            if(brown)
            {
                last = (last + 0.02 * white) / 1.02
                data[i] = last * 3.2
            }
            else data[i] = white
        }
        return buffer
    }

    // a noise buffer made once and kept, for the effects that reuse it
    cachedNoise(key, seconds)
    {
        return this.noises[key] || (this.noises[key] = this.noiseBuffer(seconds))
    }

    // rain hiss and a low wind, both looping, faded in and out
    weatherBed()
    {
        if(this.rainGain || !this.context) return
        const ctx = this.context
        const rain = ctx.createBufferSource()
        rain.buffer = this.noiseBuffer(3)
        rain.loop = true
        const high = ctx.createBiquadFilter()
        high.type = 'highpass'
        high.frequency.value = 900
        const low = ctx.createBiquadFilter()
        low.type = 'lowpass'
        low.frequency.value = 7000
        this.rainGain = ctx.createGain()
        this.rainGain.gain.value = 0
        rain.connect(high).connect(low).connect(this.rainGain).connect(this.master)
        rain.start()

        const wind = ctx.createBufferSource()
        wind.buffer = this.noiseBuffer(4, true)
        wind.loop = true
        this.windFilter = ctx.createBiquadFilter()
        this.windFilter.type = 'bandpass'
        this.windFilter.frequency.value = 400
        this.windFilter.Q.value = 0.6
        this.windGain = ctx.createGain()
        this.windGain.gain.value = 0
        wind.connect(this.windFilter).connect(this.windGain).connect(this.master)
        wind.start()
    }

    // rain, wind: 0..1
    setWeather({ rain = 0, wind = 0 })
    {
        if(!this.context || !this.enabled) return
        this.weatherBed()
        const t = this.context.currentTime
        this.rainGain.gain.setTargetAtTime(rain * 0.12, t, 0.8)
        this.windGain.gain.setTargetAtTime(wind * 0.35, t, 1.2)
        this.windFilter.frequency.setTargetAtTime(300 + 250 * Math.sin(t * 0.3), t, 1)
    }

    // a crack and a long rolling rumble
    thunder(power = 1)
    {
        if(!this.context || !this.enabled) return
        const ctx = this.context
        const t = ctx.currentTime
        const rumble = ctx.createBufferSource()
        rumble.buffer = this.thunderBuffer || (this.thunderBuffer = this.noiseBuffer(4, true))
        const low = ctx.createBiquadFilter()
        low.type = 'lowpass'
        low.frequency.setValueAtTime(420, t)
        low.frequency.exponentialRampToValueAtTime(90, t + 2.5)
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(1.3 * power, t + 0.08)
        gain.gain.exponentialRampToValueAtTime(0.5 * power, t + 0.6)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
        rumble.connect(low).connect(gain).connect(this.master)
        rumble.start(t, Math.random() * 0.5)
        rumble.stop(t + 3.8)
    }

    // birds: 0..1 how lively the morning is; crickets: 0..1 at night
    setNature({ birds = 0, crickets = 0 })
    {
        this.birds = birds
        this.crickets = crickets
    }

    updateNature(t)
    {
        if(!this.birds && !this.crickets) return
        this.nextBird = this.nextBird ?? t + 2
        this.nextCricket = this.nextCricket ?? t + 1
        if(this.birds > 0.05 && t > this.nextBird)
        {
            this.chirp(t)
            this.nextBird = t + 1.5 + Math.random() * 5 / this.birds
        }
        if(this.crickets > 0.05 && t > this.nextCricket)
        {
            this.cricket(t)
            this.nextCricket = t + 0.5 + Math.random() * 1.6 / this.crickets
        }
    }

    // a little bird: two to four quick rising whistles
    chirp(t)
    {
        const ctx = this.context
        const base = 2400 + Math.random() * 1800
        const notes = 2 + Math.floor(Math.random() * 3)
        for(let i = 0; i < notes; i++)
        {
            const start = t + i * (0.09 + Math.random() * 0.05)
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(base, start)
            osc.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), start + 0.06)
            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.0001, start)
            gain.gain.exponentialRampToValueAtTime(0.045 * this.birds, start + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08)
            osc.connect(gain).connect(this.master)
            osc.start(start)
            osc.stop(start + 0.1)
        }
    }

    // a cricket: a few fast high pulses
    cricket(t)
    {
        const ctx = this.context
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = 4300 + Math.random() * 600
        const gain = ctx.createGain()
        gain.gain.value = 0
        for(let i = 0; i < 4; i++)
        {
            const start = t + i * 0.055
            gain.gain.setValueAtTime(0.0001, start)
            gain.gain.exponentialRampToValueAtTime(0.018 * this.crickets, start + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.035)
        }
        osc.connect(gain).connect(this.master)
        osc.start(t)
        osc.stop(t + 0.26)
    }

    // a plane's drone: two detuned saw waves through a low filter, pitched up by the throttle
    makeDrone()
    {
        const ctx = this.context
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 260
        filter.Q.value = 2
        const gain = ctx.createGain()
        gain.gain.value = 0
        const oscs = [ 0, 9 ].map((detune) =>
        {
            const osc = ctx.createOscillator()
            osc.type = 'sawtooth'
            osc.frequency.value = 58
            osc.detune.value = detune
            osc.connect(filter)
            osc.start()
            return osc
        })
        filter.connect(gain).connect(this.master)
        return { oscs, filter, gain }
    }

    // the engines. car: 0..1 how fast the car you drive is going, null when you are not in one.
    // plane: 0..1 the throttle of the plane you fly, null when it is not in the air.
    setVehicle({ car = null, plane = null } = {})
    {
        if(!this.context || !this.enabled) return
        const t = this.context.currentTime
        this.ensureCarEngine()
        if(this.carGain)
        {
            const speed = car ?? 0
            this.carGain.gain.setTargetAtTime(car === null ? 0 : CLIPS['sfx/car-engine.wav'] * (0.4 + 0.6 * speed), t, 0.15)
            this.carSource.playbackRate.setTargetAtTime(0.7 + 0.9 * speed, t, 0.2)
        }
        const throttle = plane ?? 0
        const drone = this.drone
        drone.gain.gain.setTargetAtTime(plane === null ? 0 : 0.03 + 0.1 * throttle, t, 0.3)
        for(const osc of drone.oscs) osc.frequency.setTargetAtTime(58 + 110 * throttle, t, 0.3)
        drone.filter.frequency.setTargetAtTime(260 + 900 * throttle, t, 0.3)
    }

    // the car's engine: the race-engine loop, looping for as long as the page is open
    ensureCarEngine()
    {
        const buffer = this.buffers['sfx/car-engine.wav']
        if(this.carGain || !buffer) return
        const ctx = this.context
        this.carSource = ctx.createBufferSource()
        this.carSource.buffer = buffer
        this.carSource.loop = true
        this.carGain = ctx.createGain()
        this.carGain.gain.value = 0
        this.carSource.connect(this.carGain).connect(this.master)
        this.carSource.start()
    }

    // a short sound, played once, through the same master as everything else
    play(file, rate = 1)
    {
        const buffer = this.buffers[file]
        if(!buffer || !this.enabled) return
        const ctx = this.context
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.playbackRate.value = rate
        const gain = ctx.createGain()
        gain.gain.value = CLIPS[file]
        source.connect(gain).connect(this.master)
        source.start()
    }

    // a button press, a menu opening, a close: kind is a key of UI
    ui(kind)
    {
        if(UI[kind]) this.play(UI[kind])
    }

    // a rush of air as you bail out of the plane or the car
    whoosh()
    {
        if(!this.context || !this.enabled) return
        const ctx = this.context
        const t = ctx.currentTime
        const source = ctx.createBufferSource()
        source.buffer = this.cachedNoise('whoosh', 1.5)
        const band = ctx.createBiquadFilter()
        band.type = 'bandpass'
        band.Q.value = 1.2
        band.frequency.setValueAtTime(400, t)
        band.frequency.exponentialRampToValueAtTime(2200, t + 1.1)
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.5, t + 0.25)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.3)
        source.connect(band).connect(gain).connect(this.master)
        source.start(t)
        source.stop(t + 1.4)
    }

    // the sea closing over you: a burst of noise that falls away
    splash()
    {
        if(!this.context || !this.enabled) return
        const ctx = this.context
        const t = ctx.currentTime
        const source = ctx.createBufferSource()
        source.buffer = this.cachedNoise('splash', 2)
        const low = ctx.createBiquadFilter()
        low.type = 'lowpass'
        low.frequency.setValueAtTime(3000, t)
        low.frequency.exponentialRampToValueAtTime(350, t + 1.4)
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.7, t + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
        source.connect(low).connect(gain).connect(this.master)
        source.start(t)
        source.stop(t + 1.7)
    }
}
