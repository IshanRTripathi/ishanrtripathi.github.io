// Ambient sound made on the fly: the sea (filtered noise that swells like
// waves, louder near the shore), rain, wind, thunder, birdsong in the morning
// and crickets at night. No audio files to download.

export class Ambience
{
    constructor()
    {
        this.context = null
        this.enabled = false
        this.shore = 0
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
    }

    setEnabled(on)
    {
        this.enabled = on
        if(on) this.start()
        if(!this.context) return
        if(on && this.context.state === 'suspended') this.context.resume()
        const t = this.context.currentTime
        this.master.gain.cancelScheduledValues(t)
        this.master.gain.setTargetAtTime(on ? 0.55 : 0, t, 0.4)
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
        this.rainGain.gain.setTargetAtTime(rain * 0.32, t, 0.8)
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
}
