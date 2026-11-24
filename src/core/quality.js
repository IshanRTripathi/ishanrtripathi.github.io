// Keeps the frame rate up: lowers the resolution when frames get slow, then
// switches off the glow if that is not enough, and raises the resolution
// again when there is room.

export class Quality
{
    constructor(renderer, { onRatio, onLowest } = {})
    {
        this.renderer = renderer
        this.onRatio = onRatio
        this.onLowest = onLowest
        this.max = Math.min(window.devicePixelRatio || 1, 2)
        this.min = Math.min(0.6, this.max)
        this.ratio = this.max
        this.frames = 0
        this.elapsed = 0
        this.good = 0
        this.slowAtLowest = 0
        this.fps = 60
        renderer.setPixelRatio(this.ratio)
    }

    update(dt)
    {
        this.frames++
        this.elapsed += dt
        if(this.elapsed < 1) return
        this.fps = this.frames / this.elapsed
        this.frames = 0
        this.elapsed = 0
        if(document.hidden) return
        if(this.fps < 50 && this.ratio > this.min)
        {
            this.set(Math.max(this.min, this.ratio - 0.25))
            this.good = 0
        }
        else if(this.fps < 45 && this.ratio <= this.min)
        {
            this.slowAtLowest++
            if(this.slowAtLowest === 3) this.onLowest?.()
        }
        else if(this.fps > 58)
        {
            this.good++
            if(this.good >= 4 && this.ratio < this.max)
            {
                this.set(Math.min(this.max, this.ratio + 0.25))
                this.good = 0
            }
        }
        else this.good = 0
    }

    set(ratio)
    {
        this.ratio = ratio
        this.renderer.setPixelRatio(ratio)
        this.renderer.setSize(window.innerWidth, window.innerHeight, false)
        this.onRatio?.(ratio)
    }
}
