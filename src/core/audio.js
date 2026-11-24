// Ambient sea sound made on the fly: filtered noise that swells like waves,
// louder near the shore. No audio files to download.

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
    }
}
