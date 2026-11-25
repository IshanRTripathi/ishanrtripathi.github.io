// Three small original games for the arcade hall. Each one is a plain object
// with reset(), update(dt), draw(ctx, W, H) and optional key/pointer handlers.
// They all play on a 480 x 300 board and keep a best score in localStorage.

export const BOARD = { W: 480, H: 300 }

const palette = {
    night: '#1B1530',
    pink: '#FF3EA5',
    cyan: '#2DE2E6',
    yellow: '#FFE45E',
    cream: '#FFF6EC',
    purple: '#A855F7',
    orange: '#FF8C42',
    mint: '#6CFF8E'
}

function loadBest(id)
{
    try { return Number(localStorage.getItem(`arcade-best-${id}`)) || 0 } catch { return 0 }
}

function saveBest(id, score)
{
    try { localStorage.setItem(`arcade-best-${id}`, String(score)) } catch {}
}

function neonText(ctx, text, x, y, color, size = 16, align = 'left')
{
    ctx.font = `700 ${size}px "Barlow Semi Condensed", system-ui, sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
    ctx.shadowBlur = 0
}

function background(ctx, W, H)
{
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#2A1B4A')
    g.addColorStop(0.6, '#4A2A5E')
    g.addColorStop(1, '#8A3C5E')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // a sun low on the horizon
    ctx.fillStyle = 'rgba(255, 196, 135, 0.22)'
    ctx.beginPath()
    ctx.arc(W / 2, H * 0.92, H * 0.42, 0, Math.PI * 2)
    ctx.fill()
}

// ------------------------------------------------------------------ 1. Stack Tower
// Drop blocks onto the tower. Each one must land on the one below, and the
// part that hangs over falls off. Miss completely and the tower is done.
export const stackTower = {
    id: 'stack',
    title: 'Stack Tower',
    blurb: 'Tap or press Space to drop each block. Line them up, and the overhang gets trimmed.',
    controls: 'Tap, click or Space',
    reset()
    {
        this.blocks = [ { x: 140, w: 200, y: 0 } ]
        this.moving = { x: 0, w: 200, dir: 1, speed: 120, y: 1 }
        this.score = 0
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.scroll = 0
        this.flash = 0
        this.particles = []
    },
    drop()
    {
        if(this.status !== 'playing') return
        const top = this.blocks[this.blocks.length - 1]
        const m = this.moving
        const left = Math.max(m.x, top.x)
        const right = Math.min(m.x + m.w, top.x + top.w)
        const overlap = right - left
        if(overlap < 6)
        {
            this.status = 'over'
            this.finish()
            return
        }
        // the part that hangs over falls away
        if(m.x < top.x) this.particles.push({ x: m.x, w: top.x - m.x, y: m.y, vy: 0 })
        if(m.x + m.w > top.x + top.w) this.particles.push({ x: top.x + top.w, w: m.x + m.w - (top.x + top.w), y: m.y, vy: 0 })
        const placed = { x: left, w: overlap, y: m.y }
        this.blocks.push(placed)
        this.score++
        this.flash = 0.25
        this.moving = { x: 0, w: overlap, dir: m.dir * -1, speed: 120 + this.score * 9, y: placed.y + 1 }
        this.moving.x = m.dir > 0 ? 40 : 300
    },
    finish()
    {
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    onPointer(x, y, type) { if(type === 'down') this.drop() },
    onKey(code, down) { if(down && (code === 'Space' || code === 'ArrowDown')) this.drop(); if(down && code === 'Enter') this.reset() },
    update(dt)
    {
        this.flash = Math.max(0, this.flash - dt)
        if(this.status !== 'playing') return
        const m = this.moving
        m.x += m.dir * m.speed * dt
        if(m.x < 0) { m.x = 0; m.dir = 1 }
        if(m.x + m.w > BOARD.W) { m.x = BOARD.W - m.w; m.dir = -1 }
        // scroll the tower down once it climbs high
        const want = Math.max(0, this.blocks.length - 7) * 18
        this.scroll += (want - this.scroll) * Math.min(1, dt * 4)
        for(const p of this.particles) { p.vy += 900 * dt; p.y -= p.vy * dt }
        this.particles = this.particles.filter((p) => p.y - this.scroll < BOARD.H + 40)
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        const base = H - 30 + this.scroll
        const block = (b, color) =>
        {
            const y = base - b.y * 18 - 18
            ctx.fillStyle = color
            ctx.fillRect(b.x, y, b.w, 18)
            ctx.fillStyle = 'rgba(255,255,255,0.35)'
            ctx.fillRect(b.x, y, b.w, 3)
        }
        this.blocks.forEach((b, i) => block(b, i === 0 ? palette.purple : i % 2 ? palette.pink : palette.cyan))
        for(const p of this.particles) { ctx.fillStyle = palette.pink; ctx.globalAlpha = 0.7; ctx.fillRect(p.x, base - p.y * 18 - 18 - p.vy * 0.0, p.w, 18); ctx.globalAlpha = 1 }
        if(this.status === 'playing')
        {
            ctx.fillStyle = palette.yellow
            const m = this.moving
            ctx.fillRect(m.x, 26 - 0 + 0, m.w, 18)
            ctx.shadowColor = palette.yellow
            ctx.shadowBlur = 12
            ctx.fillRect(m.x, 26, m.w, 4)
            ctx.shadowBlur = 0
        }
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
        if(this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.4})`; ctx.fillRect(0, 0, W, H) }
    },
    gameOver: 'Tower fell over'
}

// ------------------------------------------------------------------ 2. Coin Catch
// Coins drift down. Slide under them to catch, and let three go by and it's over.
export const coinCatch = {
    id: 'coins',
    title: 'Coin Catch',
    blurb: 'Coins fall from the sky. Slide your basket under them. Miss three and the night is over.',
    controls: 'Left and right arrows, A and D, or drag',
    reset()
    {
        this.basket = BOARD.W / 2
        this.target = this.basket
        this.coins = []
        this.score = 0
        this.lives = 3
        this.spawn = 0
        this.elapsed = 0
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.keys = { left: false, right: false }
        this.popups = []
    },
    onPointer(x, y, type) { if(type === 'down' || type === 'move') this.target = Math.max(28, Math.min(BOARD.W - 28, x)) },
    onKey(code, down)
    {
        if(code === 'ArrowLeft' || code === 'KeyA') this.keys.left = down
        if(code === 'ArrowRight' || code === 'KeyD') this.keys.right = down
        if(down && code === 'Enter' && this.status !== 'playing') this.reset()
    },
    finish()
    {
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    update(dt)
    {
        if(this.status !== 'playing') return
        this.elapsed += dt
        const speed = 260
        if(this.keys.left) this.target -= speed * dt
        if(this.keys.right) this.target += speed * dt
        this.target = Math.max(28, Math.min(BOARD.W - 28, this.target))
        this.basket += (this.target - this.basket) * Math.min(1, dt * 12)
        this.spawn -= dt
        if(this.spawn <= 0)
        {
            this.coins.push({ x: 24 + Math.random() * (BOARD.W - 48), y: -12, v: 80 + this.elapsed * 4 + Math.random() * 40, big: Math.random() < 0.2 })
            this.spawn = Math.max(0.28, 0.9 - this.elapsed * 0.02) * (0.7 + Math.random() * 0.6)
        }
        for(const c of this.coins)
        {
            c.y += c.v * dt
            if(c.y > BOARD.H - 36 && Math.abs(c.x - this.basket) < 30)
            {
                c.dead = true
                this.score += c.big ? 3 : 1
                this.popups.push({ x: c.x, y: BOARD.H - 50, t: 0.6, text: c.big ? '+3' : '+1' })
            }
            else if(c.y > BOARD.H + 12 && !c.dead)
            {
                c.dead = true
                this.lives--
                if(this.lives <= 0) { this.status = 'over'; this.finish() }
            }
        }
        this.coins = this.coins.filter((c) => !c.dead)
        for(const p of this.popups) { p.t -= dt; p.y -= 40 * dt }
        this.popups = this.popups.filter((p) => p.t > 0)
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        for(const c of this.coins)
        {
            ctx.beginPath()
            ctx.arc(c.x, c.y, c.big ? 11 : 8, 0, Math.PI * 2)
            ctx.fillStyle = c.big ? palette.orange : palette.yellow
            ctx.shadowColor = c.big ? palette.orange : palette.yellow
            ctx.shadowBlur = 12
            ctx.fill()
            ctx.shadowBlur = 0
        }
        // basket
        ctx.fillStyle = palette.cyan
        ctx.shadowColor = palette.cyan
        ctx.shadowBlur = 14
        ctx.beginPath()
        ctx.moveTo(this.basket - 30, H - 26)
        ctx.lineTo(this.basket + 30, H - 26)
        ctx.lineTo(this.basket + 22, H - 12)
        ctx.lineTo(this.basket - 22, H - 12)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        for(const p of this.popups) neonText(ctx, p.text, p.x, p.y, palette.yellow, 15, 'center')
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
        neonText(ctx, '♥'.repeat(Math.max(0, this.lives)), 18, 40, palette.pink, 16)
    },
    gameOver: 'The basket is empty'
}

// ------------------------------------------------------------------ 3. Neon Bounce
// Keep the ball in play with your paddle and clear the neon bricks. Each board is
// faster than the last.
export const neonBounce = {
    id: 'bounce',
    title: 'Neon Bounce',
    blurb: 'Bounce the ball off your paddle and into the bricks. Clear them all for a faster board.',
    controls: 'Left and right arrows, A and D, or drag',
    reset()
    {
        this.level = 1
        this.score = 0
        this.lives = 3
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.keys = { left: false, right: false }
        this.newBoard()
    },
    newBoard()
    {
        this.paddle = BOARD.W / 2
        this.target = this.paddle
        this.paddleW = 74
        this.ball = { x: BOARD.W / 2, y: BOARD.H - 60, vx: 0, vy: 0, stuck: true }
        this.bricks = []
        const rows = 4 + Math.min(2, this.level - 1)
        const cols = 9
        const colors = [ palette.pink, palette.orange, palette.yellow, palette.cyan, palette.purple, palette.mint ]
        for(let r = 0; r < rows; r++)
            for(let c = 0; c < cols; c++)
                this.bricks.push({ x: 18 + c * 50, y: 46 + r * 20, w: 44, h: 14, color: colors[r % colors.length], alive: true })
    },
    launch()
    {
        if(!this.ball.stuck) return
        const a = (Math.random() * 0.6 - 0.3) - Math.PI / 2
        const s = 215 + this.level * 18
        this.ball.vx = Math.cos(a) * s
        this.ball.vy = Math.sin(a) * s
        this.ball.stuck = false
    },
    onPointer(x, y, type)
    {
        if(type === 'down') this.launch()
        if(type === 'down' || type === 'move') this.target = Math.max(this.paddleW / 2, Math.min(BOARD.W - this.paddleW / 2, x))
    },
    onKey(code, down)
    {
        if(code === 'ArrowLeft' || code === 'KeyA') this.keys.left = down
        if(code === 'ArrowRight' || code === 'KeyD') this.keys.right = down
        if(down && (code === 'Space' || code === 'ArrowUp')) this.launch()
        if(down && code === 'Enter' && this.status !== 'playing') this.reset()
    },
    finish()
    {
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    update(dt)
    {
        if(this.status !== 'playing') return
        const speed = 300
        if(this.keys.left) this.target -= speed * dt
        if(this.keys.right) this.target += speed * dt
        this.target = Math.max(this.paddleW / 2, Math.min(BOARD.W - this.paddleW / 2, this.target))
        this.paddle += (this.target - this.paddle) * Math.min(1, dt * 14)
        const b = this.ball
        if(b.stuck)
        {
            b.x = this.paddle
            b.y = BOARD.H - 60
            return
        }
        // move in small steps so the ball never skips past a brick
        const steps = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / 3) || 1
        for(let i = 0; i < steps; i++)
        {
            b.x += b.vx * dt / steps
            b.y += b.vy * dt / steps
            if(b.x < 8) { b.x = 8; b.vx = Math.abs(b.vx) }
            if(b.x > BOARD.W - 8) { b.x = BOARD.W - 8; b.vx = -Math.abs(b.vx) }
            if(b.y < 8) { b.y = 8; b.vy = Math.abs(b.vy) }
            // paddle
            const py = BOARD.H - 30
            if(b.vy > 0 && b.y + 6 >= py && b.y - 6 <= py + 8 && Math.abs(b.x - this.paddle) < this.paddleW / 2 + 6)
            {
                const hit = (b.x - this.paddle) / (this.paddleW / 2)
                const s = Math.hypot(b.vx, b.vy)
                const a = -Math.PI / 2 + hit * 0.9
                b.vx = Math.cos(a) * s
                b.vy = Math.sin(a) * s
                b.y = py - 7
            }
            // bricks
            for(const k of this.bricks)
            {
                if(!k.alive) continue
                if(b.x > k.x - 6 && b.x < k.x + k.w + 6 && b.y > k.y - 6 && b.y < k.y + k.h + 6)
                {
                    k.alive = false
                    this.score += 10 * this.level
                    const fromSide = Math.min(Math.abs(b.x - k.x), Math.abs(b.x - (k.x + k.w)))
                    const fromTopBottom = Math.min(Math.abs(b.y - k.y), Math.abs(b.y - (k.y + k.h)))
                    if(fromSide < fromTopBottom) b.vx = -b.vx
                    else b.vy = -b.vy
                    break
                }
            }
        }
        if(b.y > BOARD.H + 10)
        {
            this.lives--
            if(this.lives <= 0) { this.status = 'over'; this.finish(); return }
            b.stuck = true
            return
        }
        if(this.bricks.every((k) => !k.alive))
        {
            this.level++
            this.newBoard()
        }
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        for(const k of this.bricks)
        {
            if(!k.alive) continue
            ctx.fillStyle = k.color
            ctx.shadowColor = k.color
            ctx.shadowBlur = 8
            ctx.fillRect(k.x, k.y, k.w, k.h)
        }
        ctx.shadowBlur = 0
        ctx.fillStyle = palette.cyan
        ctx.shadowColor = palette.cyan
        ctx.shadowBlur = 14
        ctx.fillRect(this.paddle - this.paddleW / 2, BOARD.H - 30, this.paddleW, 8)
        ctx.beginPath()
        ctx.arc(this.ball.x, this.ball.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = palette.cream
        ctx.shadowColor = palette.cream
        ctx.fill()
        ctx.shadowBlur = 0
        if(this.ball.stuck) neonText(ctx, 'tap to launch', W / 2, H - 56, palette.cream, 14, 'center')
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `board ${this.level}  ·  best ${this.best}`, 18, 20, palette.cream, 14)
        neonText(ctx, '♥'.repeat(Math.max(0, this.lives)), 18, 40, palette.pink, 16)
    },
    gameOver: 'The ball got past you'
}

export const GAMES = [ stackTower, coinCatch, neonBounce ]
