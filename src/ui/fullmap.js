import { drawCity } from './minimap.js'

// The full city map: north-up, the whole island and the airstrip, with the
// stops, the Game Arcade, the plane, and the route to the next stop. Opens with
// M (or the Map button), and closes with M, Escape or the close button. While it
// is open the city is paused, like the phone and the cards.

const EXTENT = 136 // metres from the middle of the island to the edge of the map
const SIZE = 720 // canvas pixels

export class FullMap
{
    constructor({ canOpen, onOpen, onClose } = {})
    {
        this.canOpen = canOpen || (() => true)
        this.onOpen = onOpen
        this.onClose = onClose
        this.open_ = false
        this.city = null
        this.root = document.querySelector('.fullmap')
        this.canvas = this.root.querySelector('.fullmap-canvas')
        this.ctx = this.canvas.getContext('2d')
        this.root.querySelector('[data-fullmap="close"]').addEventListener('click', () => this.close())
        this.root.querySelector('.fullmap-backdrop').addEventListener('click', () => this.close())
        window.addEventListener('keydown', (e) => this.onKey(e))
    }

    get isOpen() { return this.open_ }

    toggle()
    {
        if(this.open_) this.close()
        else this.open()
    }

    open()
    {
        if(this.open_ || !this.canOpen()) return
        this.open_ = true
        this.root.hidden = false
        // the city image is drawn the first time the map is opened, then kept
        if(!this.city) this.city = drawCity(EXTENT, SIZE)
        this.root.querySelector('.fullmap-panel').focus({ preventScroll: true })
        this.onOpen?.()
    }

    close()
    {
        if(!this.open_) return
        this.open_ = false
        this.root.hidden = true
        this.onClose?.()
    }

    onKey(e)
    {
        if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if(e.code === 'KeyM' && !e.repeat)
        {
            e.preventDefault()
            this.toggle()
        }
        else if(e.code === 'Escape' && this.open_)
        {
            e.preventDefault()
            this.close()
        }
    }

    // scene: { player, stops, vehicles, runway, route, visited }
    draw(scene)
    {
        if(!this.open_ || !this.city) return
        const ctx = this.ctx
        const px = SIZE / (EXTENT * 2)
        const sx = (x) => SIZE / 2 + x * px
        const sz = (z) => SIZE / 2 + z * px
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, SIZE, SIZE)
        ctx.drawImage(this.city, 0, 0, SIZE, SIZE)

        // the airstrip, with a label
        const rw = scene.runway
        if(rw && rw.length)
        {
            ctx.beginPath()
            rw.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sz(p.z)) : ctx.moveTo(sx(p.x), sz(p.z))))
            ctx.strokeStyle = 'rgba(255, 246, 236, 0.85)'
            ctx.lineWidth = 2
            ctx.setLineDash([ 6, 5 ])
            ctx.stroke()
            ctx.setLineDash([])
            const mid = rw[Math.floor(rw.length / 2)]
            this.label('Airstrip', sx(mid.x), sz(mid.z) - 12, '#FFF6EC')
        }

        // the route to the next stop
        if(scene.route && scene.route.length > 1)
        {
            ctx.beginPath()
            scene.route.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sz(p.z)) : ctx.moveTo(sx(p.x), sz(p.z))))
            ctx.strokeStyle = '#FF3EA5'
            ctx.lineWidth = 4
            ctx.lineJoin = 'round'
            ctx.setLineDash([ 10, 8 ])
            ctx.stroke()
            ctx.setLineDash([])
        }

        // stops: the projects, career, trophies, the arcade and the chai shack
        for(const s of scene.stops)
        {
            const dim = scene.visited.has(s.id)
            ctx.globalAlpha = dim ? 0.5 : 1
            ctx.beginPath()
            ctx.arc(sx(s.x), sz(s.z), s.size || 7, 0, Math.PI * 2)
            ctx.fillStyle = s.color
            ctx.fill()
            ctx.lineWidth = 2
            ctx.strokeStyle = '#1B1535'
            ctx.stroke()
            ctx.globalAlpha = 1
            this.label(s.label, sx(s.x), sz(s.z) + 17, dim ? 'rgba(255,246,236,0.6)' : '#FFF6EC')
        }

        // vehicles: the plane as a plane, the rest as dots
        for(const v of scene.vehicles)
        {
            if(v.kind === 'plane') this.planeIcon(sx(v.x), sz(v.z), v.yaw, v.label)
            else
            {
                ctx.beginPath()
                ctx.arc(sx(v.x), sz(v.z), 3.5, 0, Math.PI * 2)
                ctx.fillStyle = 'rgba(255, 246, 236, 0.85)'
                ctx.fill()
            }
        }

        // you: an arrow pointing where you face
        const p = scene.player
        ctx.save()
        ctx.translate(sx(p.x), sz(p.z))
        // the tip points up before rotating; a heading (sin yaw, cos yaw) needs a turn of pi - yaw
        ctx.rotate(Math.PI - p.yaw)
        ctx.beginPath()
        ctx.moveTo(0, -12)
        ctx.lineTo(8, 9)
        ctx.lineTo(0, 4)
        ctx.lineTo(-8, 9)
        ctx.closePath()
        ctx.fillStyle = '#FFE45E'
        ctx.fill()
        ctx.lineWidth = 2.5
        ctx.strokeStyle = '#1B1535'
        ctx.stroke()
        ctx.restore()

        // north
        this.label('N', SIZE - 18, 18, '#FFF6EC')
    }

    planeIcon(x, y, yaw, text)
    {
        const ctx = this.ctx
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.PI - yaw)
        ctx.beginPath()
        ctx.moveTo(0, -11)
        ctx.lineTo(10, 6)
        ctx.lineTo(0, 2)
        ctx.lineTo(-10, 6)
        ctx.closePath()
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#1B1535'
        ctx.stroke()
        ctx.restore()
        if(text) this.label(text, x, y + 20, '#FFF6EC')
    }

    label(text, x, y, color)
    {
        const ctx = this.ctx
        ctx.font = '700 14px "Barlow Semi Condensed", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(27, 21, 53, 0.85)'
        ctx.strokeText(text, x, y)
        ctx.fillStyle = color
        ctx.fillText(text, x, y)
    }
}
