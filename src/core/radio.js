// The car radio: a few FM stations made on the fly, so there are no audio files to load. Each
// station is a small tune built from a step sequencer: a key, a chord for each bar, a bass line,
// an arpeggio, some drums, a pad. Adding a station is adding an entry to STATIONS.
//
// A station has:
//   name, freq, tag     what the dial shows
//   bpm, swing          the tempo, and how late the odd sixteenths fall (0 to 0.3)
//   root, scale         the key: a MIDI note, and the scale as semitones from it
//   prog                the chord of each bar, as a scale degree (0 is the first note of the scale)
//   seventh             chords with a seventh (a softer, jazzier sound)
//   bass, arp           16 steps a bar: bass 1 plays the chord's root; arp is the chord tone to play
//                       (0 root, 1 third, 2 fifth, 3 seventh) or -1 for a rest
//   kick, snare, hat    16 steps a bar, as a string: 'x' plays, 'o' plays quietly, '.' rests
//   bassSound, arpSound, padSound   { type, gain, cut } for an oscillator through a low-pass filter
//   dust                the crackle of an old record, 0 to 1

const STATIONS = [
    {
        name: 'Neon FM', freq: '88.1', tag: 'Synthwave all night',
        bpm: 108, swing: 0, root: 57, scale: [ 0, 2, 3, 5, 7, 8, 10 ], prog: [ 0, 5, 2, 6 ], seventh: false,
        bass: [ 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0 ],
        arp: [ 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1 ],
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..o...o...o...o.',
        bassSound: { type: 'sawtooth', gain: 0.2, cut: 700 }, arpSound: { type: 'square', gain: 0.05, cut: 2600 }, padSound: { type: 'sawtooth', gain: 0.035, cut: 900 },
        dust: 0
    },
    {
        name: 'Chai Lo-fi', freq: '94.5', tag: 'Slow beats for the chai shack',
        bpm: 74, swing: 0.2, root: 50, scale: [ 0, 2, 3, 5, 7, 9, 10 ], prog: [ 1, 4, 0, 3 ], seventh: true,
        bass: [ 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0 ],
        arp: [ -1, 1, -1, -1, 3, -1, 2, -1, -1, 1, -1, -1, 3, -1, -1, 2 ],
        kick: 'x......o..x.....', snare: '....o.......o...', hat: 'o.o.o.o.o.o.o.o.',
        bassSound: { type: 'sine', gain: 0.3, cut: 500 }, arpSound: { type: 'triangle', gain: 0.09, cut: 1800 }, padSound: { type: 'sine', gain: 0.07, cut: 1200 },
        dust: 0.5
    },
    {
        name: 'Island Pop', freq: '101.3', tag: 'Sunny hits, all day',
        bpm: 118, swing: 0.05, root: 48, scale: [ 0, 2, 4, 5, 7, 9, 11 ], prog: [ 0, 4, 5, 3 ], seventh: false,
        bass: [ 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0 ],
        arp: [ -1, 0, -1, 2, -1, 1, -1, 2, -1, 0, -1, 2, -1, 1, -1, 2 ],
        kick: 'x..o..x.x..o..x.', snare: '....x.......x...', hat: 'o.x.o.x.o.x.o.x.',
        bassSound: { type: 'triangle', gain: 0.32, cut: 900 }, arpSound: { type: 'square', gain: 0.06, cut: 3600 }, padSound: { type: 'triangle', gain: 0.06, cut: 2000 },
        dust: 0
    },
    {
        name: 'Night Drive', freq: '104.9', tag: 'Slow neon, empty roads',
        bpm: 88, swing: 0.08, root: 52, scale: [ 0, 2, 3, 5, 7, 8, 10 ], prog: [ 0, 2, 5, 6 ], seventh: true,
        bass: [ 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1 ],
        arp: [ 0, -1, 2, -1, 3, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1 ],
        kick: 'x...x...x...x...', snare: '............x...', hat: 'o.o.o.o.o.o.o.o.',
        bassSound: { type: 'sawtooth', gain: 0.18, cut: 450 }, arpSound: { type: 'triangle', gain: 0.1, cut: 2200 }, padSound: { type: 'sawtooth', gain: 0.04, cut: 700 },
        dust: 0.1
    }
]

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)
const LOOKAHEAD = 0.3 // seconds scheduled ahead of the clock
const TICK = 90 // how often the scheduler runs, in milliseconds

export class Radio
{
    constructor(context, destination)
    {
        this.context = context
        this.stations = STATIONS
        this.index = -1 // -1: off
        this.active = false // in a car, with the sound on
        this.out = context.createGain()
        this.out.gain.value = 0
        this.out.connect(destination)
        // one bus for the music, so a station change can cut it off at once
        this.bus = null
        this.timer = null
        this.noise = this.noiseBuffer()
    }

    get current()
    {
        return this.index < 0 ? null : { ...this.stations[this.index], index: this.index }
    }

    noiseBuffer()
    {
        const ctx = this.context
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        return buffer
    }

    // the next station on the dial, then off, then the first again; returns what is now playing or null for off
    next()
    {
        this.setStation(this.index + 1 >= this.stations.length ? -1 : this.index + 1)
        return this.current
    }

    setStation(index)
    {
        this.index = index
        this.stop()
        if(index < 0) return
        // a burst of static between stations, then the tune
        this.static()
        this.bus = this.context.createGain()
        this.bus.gain.value = 1
        this.bus.connect(this.out)
        this.step = 0
        this.nextTime = this.context.currentTime + 0.25
        if(this.active) this.run()
    }

    // in a car with the sound on: the radio is heard, and runs; otherwise it is silent and costs nothing
    setActive(on)
    {
        if(on === this.active) return
        this.active = on
        this.out.gain.setTargetAtTime(on ? 0.8 : 0, this.context.currentTime, 0.15)
        if(on && this.index >= 0) { this.nextTime = this.context.currentTime + 0.1; this.run() }
        if(!on) clearInterval(this.timer), this.timer = null
    }

    run()
    {
        clearInterval(this.timer)
        this.timer = setInterval(() => this.tick(), TICK)
        this.tick()
    }

    stop()
    {
        clearInterval(this.timer)
        this.timer = null
        if(this.bus)
        {
            // the old tune is cut, its last notes with it
            this.bus.gain.setTargetAtTime(0, this.context.currentTime, 0.03)
            const old = this.bus
            setTimeout(() => old.disconnect(), 400)
            this.bus = null
        }
    }

    tick()
    {
        const station = this.stations[this.index]
        if(!station || !this.bus) return
        const ctx = this.context
        const sixteenth = 60 / station.bpm / 4
        while(this.nextTime < ctx.currentTime + LOOKAHEAD)
        {
            // odd sixteenths fall a little late: the swing
            const late = this.step % 2 ? sixteenth * station.swing : 0
            this.play(station, this.step, this.nextTime + late, sixteenth)
            this.nextTime += sixteenth
            this.step++
        }
    }

    // the notes of one sixteenth of the tune
    play(station, step, t, sixteenth)
    {
        const s = step % 16
        const bar = Math.floor(step / 16) % station.prog.length
        const degree = station.prog[bar]
        const note = (d) => station.root + station.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7)
        const chord = [ degree, degree + 2, degree + 4, degree + 6 ].slice(0, station.seventh ? 4 : 3)

        // the pad holds the chord for the bar
        if(s === 0) for(const d of chord) this.voice(midi(note(d) + 12), t, sixteenth * 16 * 0.98, { ...station.padSound, attack: 0.25 })
        if(station.bass[s]) this.voice(midi(note(degree) - 12), t, sixteenth * 1.7, { ...station.bassSound, attack: 0.008 })
        const a = station.arp[s]
        if(a >= 0) this.voice(midi(note(chord[a % chord.length]) + 12), t, sixteenth * 1.4, { ...station.arpSound, attack: 0.004 })

        const level = (ch) => (ch === 'x' ? 1 : ch === 'o' ? 0.4 : 0)
        const kick = level(station.kick[s])
        if(kick) this.kick(t, kick)
        const snare = level(station.snare[s])
        if(snare) this.snare(t, snare)
        const hat = level(station.hat[s])
        if(hat) this.hat(t, hat)
        if(station.dust && Math.random() < station.dust * 0.25) this.hat(t + Math.random() * sixteenth, 0.12 * station.dust, 3000)
    }

    // one note: an oscillator through a low-pass filter, with a quick attack and a release
    voice(freq, t, length, { type, gain, cut, attack = 0.01 })
    {
        const ctx = this.context
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.value = freq
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = cut
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.0001, t)
        env.gain.exponentialRampToValueAtTime(gain, t + attack)
        env.gain.setValueAtTime(gain, t + Math.max(attack, length * 0.6))
        env.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.12)
        osc.connect(filter).connect(env).connect(this.bus)
        osc.start(t)
        osc.stop(t + length + 0.15)
    }

    kick(t, level)
    {
        const ctx = this.context
        const osc = ctx.createOscillator()
        osc.frequency.setValueAtTime(150, t)
        osc.frequency.exponentialRampToValueAtTime(42, t + 0.12)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.7 * level, t)
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
        osc.connect(env).connect(this.bus)
        osc.start(t)
        osc.stop(t + 0.25)
    }

    // noise through a filter: a snare is mid and long, a hat is high and short
    burst(t, { type, freq, length, gain })
    {
        const ctx = this.context
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        const filter = ctx.createBiquadFilter()
        filter.type = type
        filter.frequency.value = freq
        const env = ctx.createGain()
        env.gain.setValueAtTime(gain, t)
        env.gain.exponentialRampToValueAtTime(0.0001, t + length)
        src.connect(filter).connect(env).connect(this.bus)
        src.start(t, Math.random() * 0.5)
        src.stop(t + length + 0.02)
    }

    snare(t, level) { this.burst(t, { type: 'bandpass', freq: 1900, length: 0.16, gain: 0.45 * level }) }

    hat(t, level, freq = 7500) { this.burst(t, { type: 'highpass', freq, length: 0.05, gain: 0.22 * level }) }

    // the hiss of tuning: a short burst of noise that drops away
    static()
    {
        const ctx = this.context
        const t = ctx.currentTime
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(3500, t)
        filter.frequency.exponentialRampToValueAtTime(900, t + 0.3)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.35, t)
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
        src.connect(filter).connect(env).connect(this.out)
        src.start(t)
        src.stop(t + 0.35)
    }
}
