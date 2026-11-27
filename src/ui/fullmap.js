import { drawCity } from './minimap.js'
import { MAP_EXTENT } from '../world/islands.js'

// The full city map: north-up, the whole island and the islands, with the airstrips,
// the stops, the Game Arcade, the planes, and the route to the next stop. Opens with
// M, the Map button or a tap on the minimap, and closes with M, Escape or the close
// button. Every airstrip is a place to fly to: tap it on the map, or use the buttons
// under the map. While it is open the city is paused, like the phone and the cards.

const EXTENT = MAP_EXTENT // metres from the middle of the main island to the edge of the map, far enough for the islands
const SIZE = 720 // canvas pixels
const TAP = 30 // how close, in canvas pixels, a tap has to be to a destination

export class FullMap
{
    constructor({ canOpen, onOpen, onClose, onJump } = {})
    {
        this.canOpen = canOpen || (() => true)
        this.onOpen = onOpen
        this.onClose = onClose
        this.onJump = onJump
        this.open_ = false
        this.city = null
        this.destinations = [] // { id, label, x, z, spot }: where you can jump to
        this.hits = [] // where each destination is drawn, in canvas pixels, for taps
        this.root = document.querySelector('.fullmap')
        this.canvas = this.root.querySelector('.fullmap-canvas')
        this.ctx = this.canvas.getContext('2d')
        this.jumps = this.root.querySelector('[data-jumps]')
        this.root.querySelector('[data-fullmap="close"]').addEventListener('click', () => this.close())
        this.root.querySelector('.fullmap-backdrop').addEventListener('click', () => this.close())
        window.addEventListener('keydown', (e) => this.onKey(e))
        this.canvas.addEventListener('click', (e) => { const dest = this.destinationAt(e); if(dest) this.onJump?.(dest) })
        this.canvas.addEventListener('pointermove', (e) => { this.canvas.style.cursor = this.destinationAt(e) ? 'pointer' : 'default' })
    }

    get isOpen() { return this.open_ }

    // the places to fly to, and the buttons under the map that jump to them
    setDestinations(list)
    {
        this.destinations = list
        this.jumps.replaceChildren(...list.map((d) =>
        {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'fullmap-jump'
            button.textContent = d.label
            button.addEventListener('click', () => this.onJump?.(d))
            return button
        }))
    }

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

    // the destination under a pointer, if any
    destinationAt(e)
    {
        const rect = this.canvas.getBoundingClientRect()
        const x = (e.clientX - rect.left) * (SIZE / rect.width)
        const y = (e.clientY - rect.top) * (SIZE / rect.height)
        let best = null
        let bestD = TAP
        for(const h of this.hits)
        {
            const d = Math.hypot(x - h.x, y - h.y)
            if(d < bestD) { best = h.dest; bestD = d }
        }
        return best
    }

    // scene: { player, stops, vehicles, runways, route, visited }
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

        // every airstrip: a dark line under a dashed cream one, so it reads on sand, grass and snow alike
        const trace = (points) =>
        {
            ctx.beginPath()
            points.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sz(p.z)) : ctx.moveTo(sx(p.x), sz(p.z))))
        }
        for(const points of scene.runways || [])
        {
            trace(points)
            ctx.strokeStyle = 'rgba(27, 21, 53, 0.7)'
            ctx.lineWidth = 5
            ctx.setLineDash([])
            ctx.stroke()
            trace(points)
            ctx.strokeStyle = '#FFF6EC'
            ctx.lineWidth = 2.5
            ctx.setLineDash([ 6, 5 ])
            ctx.stroke()
            ctx.setLineDash([])
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

        // the places to jump to: a marker and a name at each airstrip
        this.hits = []
        for(const d of this.destinations)
        {
            const x = sx(d.x)
            const y = sz(d.z)
            ctx.beginPath()
            ctx.moveTo(x, y - 9)
            ctx.lineTo(x + 9, y)
            ctx.lineTo(x, y + 9)
            ctx.lineTo(x - 9, y)
            ctx.closePath()
            ctx.fillStyle = '#FFF6EC'
            ctx.fill()
            ctx.lineWidth = 2
            ctx.strokeStyle = '#1B1535'
            ctx.stroke()
            this.label(d.label, x, y - 20, '#FFF6EC')
            this.hits.push({ x, y, dest: d })
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

        // vehicles: the planes as planes, the rest as dots
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
