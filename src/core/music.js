// The background music: a day theme and a night theme that loop and cross-fade
// as the sun goes down. Both stream from public/audio, and only start once the
// sound is turned on (browsers allow sound only after a click anyway).

// trim: how loud each file plays, set from its measured loudness so the two
// themes sit at about the same level
const TRACKS = [
    { file: 'music-day.mp3', night: false, trim: 2.4 },
    { file: 'music-night.mp3', night: true, trim: 0.68 }
]

export class Music
{
    constructor(context, destination)
    {
        this.context = context
        this.on = false
        this.night = 0
        this.duckLevel = 1 // the radio turns the music down while it plays
        this.out = context.createGain()
        this.out.gain.value = 0
        this.out.connect(destination)
        this.legs = TRACKS.map((track) => this.leg(track))
    }

    // one track: its own looping element, and a gain that fades it in and out
    leg(track)
    {
        const el = new Audio(`./audio/${track.file}`)
        el.loop = true
        el.preload = 'auto'
        const gain = this.context.createGain()
        gain.gain.value = 0
        this.context.createMediaElementSource(el).connect(gain).connect(this.out)
        return { el, gain, track }
    }

    // night: 0 (day) .. 1 (night); the two themes cross-fade between them
    setNight(night)
    {
        if(Math.abs(night - this.night) < 0.002) return
        this.night = night
        this.fade()
    }

    setOn(on)
    {
        this.on = on
        if(on) for(const leg of this.legs) Promise.resolve(leg.el.play()).catch(() => {})
        else setTimeout(() => { if(!this.on) for(const leg of this.legs) leg.el.pause() }, 1500)
        this.fade()
    }

    fade()
    {
        const t = this.context.currentTime
        for(const { gain, track } of this.legs)
        {
            const share = track.night ? this.night : 1 - this.night
            gain.gain.setTargetAtTime(share * track.trim, t, 1.2)
        }
        this.out.gain.setTargetAtTime(this.on ? this.duckLevel : 0, t, 0.4)
    }

    duck(on)
    {
        this.duckLevel = on ? 0.1 : 1
        this.fade()
    }
}
