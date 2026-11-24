// Keyboard, pointer and touch input, reduced to a few intents.

export class Input
{
    constructor(element)
    {
        this.element = element
        this.keys = new Set()
        this.pressed = new Set() // keys pressed since last frame
        this.move = { x: 0, y: 0 } // x: right, y: forward
        this.run = false
        this.enabled = false
        this.drag = { dx: 0, dy: 0, active: false, lastTime: -Infinity }
        this.zoom = 0
        this.stick = { x: 0, y: 0, active: false }
        this.lastActivity = 0

        window.addEventListener('keydown', (e) =>
        {
            if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
            const code = e.code
            if(!this.keys.has(code)) this.pressed.add(code)
            this.keys.add(code)
            if(this.enabled && [ 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space' ].includes(code) && document.activeElement === document.body) e.preventDefault()
        })
        window.addEventListener('keyup', (e) => this.keys.delete(e.code))
        window.addEventListener('blur', () => this.keys.clear())

        // camera drag with mouse or a finger outside the joystick
        let pointerId = null
        let last = null
        element.addEventListener('pointerdown', (e) =>
        {
            if(pointerId !== null) return
            if(e.pointerType === 'touch' && this.stick.active && e.pointerId === this.stick.pointerId) return
            pointerId = e.pointerId
            last = { x: e.clientX, y: e.clientY, t: performance.now(), sx: e.clientX, sy: e.clientY }
            this.drag.active = true
            this.drag.moved = 0
        })
        window.addEventListener('pointermove', (e) =>
        {
            if(e.pointerId !== pointerId || !last) return
            this.drag.dx += e.clientX - last.x
            this.drag.dy += e.clientY - last.y
            this.drag.moved += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y)
            last.x = e.clientX
            last.y = e.clientY
            this.drag.lastTime = performance.now()
        })
        const end = (e) =>
        {
            if(e.pointerId !== pointerId) return
            pointerId = null
            this.drag.active = false
            last = null
        }
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
        element.addEventListener('wheel', (e) =>
        {
            this.zoom += Math.sign(e.deltaY)
            e.preventDefault()
        }, { passive: false })
    }

    down(...codes)
    {
        return codes.some((c) => this.keys.has(c))
    }

    consume(...codes)
    {
        for(const c of codes)
            if(this.pressed.has(c)) { this.pressed.delete(c); return true }
        return false
    }

    update(time)
    {
        let x = 0
        let y = 0
        if(this.down('KeyW', 'ArrowUp', 'KeyZ')) y += 1
        if(this.down('KeyS', 'ArrowDown')) y -= 1
        if(this.down('KeyA', 'ArrowLeft', 'KeyQ')) x -= 1
        if(this.down('KeyD', 'ArrowRight')) x += 1
        if(this.stick.active)
        {
            x = this.stick.x
            y = this.stick.y
        }
        const len = Math.hypot(x, y)
        if(len > 1) { x /= len; y /= len }
        this.move.x = x
        this.move.y = y
        this.run = this.down('ShiftLeft', 'ShiftRight') || (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.92)
        if(len > 0.05) this.lastActivity = time
    }

    endFrame()
    {
        this.pressed.clear()
        this.drag.dx = 0
        this.drag.dy = 0
        this.zoom = 0
    }

    get moving()
    {
        return Math.hypot(this.move.x, this.move.y) > 0.05
    }
}
