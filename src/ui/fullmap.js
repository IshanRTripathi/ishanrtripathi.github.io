import { drawCityBands } from './minimap.js'
import { MAP_EXTENT } from '../world/islands.js'

// The full city map: north-up, the whole island and the islands, with the airstrips,
// the stops, the Game Arcade, the planes, and the route to the next stop. Opens with
// M, the Map button or a tap on the minimap, and closes with M, Escape or the close
// button. Drag to pan, wheel or pinch to zoom, and drop your own markers (right-click,
// long-press, or Add marker then a tap); a marker is kept between visits and can be
// made the minimap's target. Every airstrip is a place to fly to: tap it on the map, or use the buttons
// under the map. While it is open the city is paused, like the phone and the cards.

const EXTENT = MAP_EXTENT // metres from the middle of the main island to the edge of the map, far enough for the islands
const SIZE = 720 // logical canvas units; the canvas itself is sharper on dense screens
const IMAGE = 1536 // the terrain image: about 0.44 m a pixel, so zooming in stays smooth
const TAP = 30 // how close, in canvas units, a tap has to be to a destination
const MAX_ZOOM = 10
const MAX_MARKERS = 12
const KEY = 'ishanr.markers'

function load()
{
    try { const m = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(m) ? m.filter((k) => Number.isFinite(k.x) && Number.isFinite(k.z) && k.id).slice(-MAX_MARKERS) : [] }
    catch { return [] }
}

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
        this.hits = [] // where each destination is drawn, in canvas units, for taps
        this.view = { x: 0, z: 0, zoom: 1 }
        this.markers = load() // { id, x, z }
        this.active = null // id of the marker the minimap points at
        this.placing = false
        this.pointers = new Map()
        this.pinch = 0
        this.root = document.querySelector('.fullmap')
        this.canvas = this.root.querySelector('.fullmap-canvas')
        this.ctx = this.canvas.getContext('2d')
        this.jumps = this.root.querySelector('[data-jumps]')
        this.chips = this.root.querySelector('[data-markers]')
        this.addButton = this.root.querySelector('[data-fullmap="marker"]')
        this.root.querySelector('[data-fullmap="close"]').addEventListener('click', () => this.close())
        this.root.querySelector('.fullmap-backdrop').addEventListener('click', () => this.close())
        window.addEventListener('keydown', (e) => this.onKey(e))
        this.root.querySelector('[data-fullmap="in"]').addEventListener('click', () => this.zoomBy(1.6))
        this.root.querySelector('[data-fullmap="out"]').addEventListener('click', () => this.zoomBy(1 / 1.6))
        this.root.querySelector('[data-fullmap="fit"]').addEventListener('click', () => { this.view = { x: 0, z: 0, zoom: 1 } })
        this.root.querySelector('[data-fullmap="me"]').addEventListener('click', () => { this.view.zoom = Math.max(this.view.zoom, 4); this.view.x = this.me.x; this.view.z = this.me.z; this.clamp() })
        this.addButton.addEventListener('click', () => this.setPlacing(!this.placing))
        this.root.querySelector('[data-fullmap="clear"]').addEventListener('click', () => { this.markers = []; this.active = null; this.changed() })
        this.me = { x: 0, z: 0 }
        const c = this.canvas
        c.style.touchAction = 'none'
        c.addEventListener('pointerdown', (e) => this.onDown(e))
        c.addEventListener('pointermove', (e) => this.onMove(e))
        c.addEventListener('pointerup', (e) => this.onUp(e))
        c.addEventListener('pointercancel', (e) => { this.pointers.delete(e.pointerId); clearTimeout(this.hold) })
        c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(this.logical(e), Math.exp(-e.deltaY * 0.0015)) }, { passive: false })
        c.addEventListener('contextmenu', (e) => { e.preventDefault(); this.addMarkerAt(this.logical(e)) })
        this.renderChips()
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
        this.prepare()
        this.view = { x: 0, z: 0, zoom: 1 }
        this.setPlacing(false)
        this.root.querySelector('.fullmap-panel').focus({ preventScroll: true })
        this.onOpen?.()
    }

    // the terrain image is drawn in bands over a few frames, the first time, then kept
    prepare()
    {
        if(this.city) return
        this.city = drawCityBands(EXTENT, IMAGE)
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

    // view <-> canvas units <-> metres
    get scale() { return (SIZE / (EXTENT * 2)) * this.view.zoom }
    toMap(p) { return { x: this.view.x + (p.x - SIZE / 2) / this.scale, z: this.view.z + (p.y - SIZE / 2) / this.scale } }

    logical(e)
    {
        const rect = this.canvas.getBoundingClientRect()
        return { x: (e.clientX - rect.left) * (SIZE / rect.width), y: (e.clientY - rect.top) * (SIZE / rect.height) }
    }

    clamp()
    {
        const v = this.view
        v.zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom))
        const lim = EXTENT * (1 - 1 / v.zoom) // keeps the map filling the frame
        v.x = Math.min(lim, Math.max(-lim, v.x))
        v.z = Math.min(lim, Math.max(-lim, v.z))
    }

    // zoom keeping the metre under point p where it is
    zoomAt(p, factor)
    {
        const before = this.toMap(p)
        this.view.zoom *= factor
        this.clamp()
        this.view.x += before.x - this.toMap(p).x
        this.view.z += before.z - this.toMap(p).z
        this.clamp()
    }

    zoomBy(factor) { this.zoomAt({ x: SIZE / 2, y: SIZE / 2 }, factor) }

    onDown(e)
    {
        this.canvas.setPointerCapture?.(e.pointerId)
        const p = this.logical(e)
        this.pointers.set(e.pointerId, { ...p, x0: p.x, y0: p.y, moved: false })
        this.pinch = 0
        clearTimeout(this.hold)
        // a long press on the map drops a marker
        if(this.pointers.size === 1) this.hold = setTimeout(() => { const q = this.pointers.get(e.pointerId); if(q && !q.moved) { q.moved = true; this.addMarkerAt(q) } }, 550)
    }

    onMove(e)
    {
        const q = this.pointers.get(e.pointerId)
        if(!q)
        {
            this.canvas.style.cursor = this.destinationAt(this.logical(e)) || this.markerAt(this.logical(e)) ? 'pointer' : this.placing ? 'crosshair' : 'grab'
            return
        }
        const p = this.logical(e)
        const dx = p.x - q.x
        const dy = p.y - q.y
        if(Math.hypot(p.x - q.x0, p.y - q.y0) > 6) { q.moved = true; clearTimeout(this.hold) }
        q.x = p.x
        q.y = p.y
        if(this.pointers.size === 2)
        {
            const [ a, b ] = [ ...this.pointers.values() ]
            const d = Math.hypot(a.x - b.x, a.y - b.y)
            if(this.pinch) this.zoomAt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d / this.pinch)
            this.pinch = d
        }
        else if(q.moved)
        {
            this.view.x -= dx / this.scale
            this.view.z -= dy / this.scale
            this.clamp()
        }
    }

    onUp(e)
    {
        const q = this.pointers.get(e.pointerId)
        this.pointers.delete(e.pointerId)
        clearTimeout(this.hold)
        this.pinch = 0
        if(!q || q.moved) return
        const p = this.logical(e)
        if(this.placing) { this.addMarkerAt(p); this.setPlacing(false); return }
        const marker = this.markerAt(p)
        if(marker) { this.active = this.active === marker.id ? null : marker.id; this.changed(); return }
        const dest = this.destinationAt(p)
        if(dest) this.onJump?.(dest)
    }

    setPlacing(on)
    {
        this.placing = on
        this.addButton.setAttribute('aria-pressed', String(on))
        this.addButton.textContent = on ? 'Tap the map…' : 'Add marker'
        this.canvas.style.cursor = on ? 'crosshair' : 'grab'
    }

    addMarkerAt(p)
    {
        if(this.markers.length >= MAX_MARKERS) this.markers.shift()
        const m = this.toMap(p)
        const id = (this.markers.at(-1)?.id || 0) + 1
        this.markers.push({ id, x: Math.round(m.x), z: Math.round(m.z) })
        this.active = id // the newest marker is the one the minimap points at
        this.changed()
    }

    changed()
    {
        try { localStorage.setItem(KEY, JSON.stringify(this.markers)) } catch {}
        this.renderChips()
        this.onMarkers?.()
    }

    // the marker the minimap points at, or null
    get target()
    {
        const m = this.markers.find((k) => k.id === this.active)
        return m ? { x: m.x, z: m.z, label: `Marker ${m.id}`, direct: true } : null
    }

    clearActive() { if(this.active !== null) { this.active = null; this.renderChips() } }

    renderChips()
    {
        this.chips.replaceChildren(...this.markers.map((m) =>
        {
            const b = document.createElement('button')
            b.type = 'button'
            b.className = 'fullmap-jump fullmap-chip'
            b.setAttribute('aria-pressed', String(m.id === this.active))
            b.textContent = `Marker ${m.id}${m.id === this.active ? ' (GPS)' : ''} ✕`
            b.title = 'Click to remove'
            b.addEventListener('click', () => { this.markers = this.markers.filter((k) => k !== m); if(this.active === m.id) this.active = null; this.changed() })
            return b
        }))
        this.root.querySelector('[data-fullmap="clear"]').hidden = this.markers.length < 2
    }

    markerAt(p)
    {
        let best = null
        let bestD = TAP * 0.7
        for(const m of this.markers)
        {
            const d = Math.hypot(p.x - this.sx(m.x), p.y - (this.sz(m.z) - 12))
            if(d < bestD) { best = m; bestD = d }
        }
        return best
    }

    sx(x) { return SIZE / 2 + (x - this.view.x) * this.scale }
    sz(z) { return SIZE / 2 + (z - this.view.z) * this.scale }

    // the destination under a point, if any
    destinationAt(p)
    {
        let best = null
        let bestD = TAP
        for(const h of this.hits)
        {
            const d = Math.hypot(p.x - h.x, p.y - h.y)
            if(d < bestD) { best = h.dest; bestD = d }
        }
        return best
    }

    // scene: { player, stops, vehicles, runways, route, visited }
    draw(scene)
    {
        if(!this.open_ || !this.city) return
        const ctx = this.ctx
        // a sharper canvas on dense screens, drawn in the same 720 units
        const k = Math.min(2, Math.max(1, Math.round((this.canvas.clientWidth || SIZE) * (window.devicePixelRatio || 1)) / SIZE))
        if(this.canvas.width !== Math.round(SIZE * k)) { this.canvas.width = this.canvas.height = Math.round(SIZE * k) }
        ctx.setTransform(k, 0, 0, k, 0, 0)
        ctx.clearRect(0, 0, SIZE, SIZE)
        ctx.fillStyle = '#1C6E93'
        ctx.fillRect(0, 0, SIZE, SIZE)
        this.me = scene.player
        const zoom = this.view.zoom
        const sx = (x) => this.sx(x)
        const sz = (z) => this.sz(z)
        ctx.imageSmoothingQuality = 'high'
        const span = EXTENT * 2 * this.scale
        ctx.drawImage(this.city, sx(-EXTENT), sz(-EXTENT), span, span)

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
            if(zoom >= 2.4) this.label(s.label, sx(s.x), sz(s.z) + 17, dim ? 'rgba(255,246,236,0.6)' : '#FFF6EC')
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

        // your markers: pins, the one the minimap points at ringed
        for(const m of this.markers)
        {
            const x = sx(m.x)
            const y = sz(m.z)
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.bezierCurveTo(x - 14, y - 14, x - 10, y - 30, x, y - 30)
            ctx.bezierCurveTo(x + 10, y - 30, x + 14, y - 14, x, y)
            ctx.fillStyle = '#2DE2E6'
            ctx.fill()
            ctx.lineWidth = m.id === this.active ? 3.5 : 2
            ctx.strokeStyle = m.id === this.active ? '#FFE45E' : '#1B1535'
            ctx.stroke()
            ctx.fillStyle = '#1B1535'
            ctx.font = '800 12px "Barlow Semi Condensed", system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(m.id), x, y - 19)
        }

        // north, and a scale bar that follows the zoom
        this.label('N', SIZE - 18, 18, '#FFF6EC')
        const metres = [ 10, 20, 50, 100, 200 ].find((n) => n * this.scale >= 60) || 200
        const bar = metres * this.scale
        ctx.fillStyle = '#FFF6EC'
        ctx.strokeStyle = '#1B1535'
        ctx.lineWidth = 3
        ctx.strokeRect(14, SIZE - 22, bar, 0)
        ctx.fillRect(14, SIZE - 24, bar, 4)
        this.label(`${metres} m`, 14 + bar / 2, SIZE - 34, '#FFF6EC')
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
