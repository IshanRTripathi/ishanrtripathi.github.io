// Small original games for the arcade hall. Each one is a plain object with
// reset(), update(dt), draw(ctx, W, H) and optional key/pointer handlers.
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

// ------------------------------------------------------------------ shared helpers
// A rounded rectangle path, built with arcTo so it works on every canvas.
function roundRect(ctx, x, y, w, h, r)
{
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

function clamp(v, lo, hi)
{
    return Math.max(lo, Math.min(hi, v))
}

// Turns key events into 'down' and 'up' transitions. Auto-repeat keydowns are
// ignored, so holding a key counts as one press.
function edge(held, code, down)
{
    if(!!held[code] === down) return null
    held[code] = down
    return down ? 'down' : 'up'
}

// ------------------------------------------------------------------ 4. Chai Clicker
// A 60 second tap rush. Every tap pours chai for coins, and quick taps build a
// combo multiplier. Now and then a golden cup appears, worth ten if you catch it.
function drawChaiCup(ctx, cx, cy, body, glow, t)
{
    ctx.fillStyle = palette.cream
    ctx.beginPath()
    ctx.ellipse(cx, cy + 46, 74, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    // the handle is drawn first, so the body covers its inner edge
    ctx.strokeStyle = body
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.arc(cx + 52, cy - 4, 14, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 52, cy - 40)
    ctx.lineTo(cx + 52, cy - 40)
    ctx.lineTo(cx + 38, cy + 40)
    ctx.lineTo(cx - 38, cy + 40)
    ctx.closePath()
    ctx.fillStyle = body
    ctx.shadowColor = glow
    ctx.shadowBlur = 18
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#7A3E1D'
    ctx.beginPath()
    ctx.ellipse(cx, cy - 40, 52, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 246, 236, 0.55)'
    ctx.lineWidth = 2
    for(let i = -1; i <= 1; i++)
    {
        const x = cx + i * 18
        const wob = Math.sin(t * 3 + i * 1.7) * 7
        ctx.beginPath()
        ctx.moveTo(x, cy - 56)
        ctx.bezierCurveTo(x + wob, cy - 66, x - wob, cy - 76, x, cy - 88)
        ctx.stroke()
    }
}

export const chaiClicker = {
    id: 'chai-clicker',
    title: 'Chai Clicker',
    blurb: 'Tap to pour chai for coins. Quick taps build a combo, and a golden cup pays ten if you catch it.',
    controls: 'Tap, click, Space or Enter',
    reset()
    {
        this.score = 0
        this.timeLeft = 60
        this.heat = 0
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.squash = 0
        this.clock = 0
        this.popups = []
        this.golden = null
        this.goldenIn = 2.5
        this.held = {}
    },
    multiplier() { return 1 + Math.floor(this.heat * 4) },
    tap(x, y)
    {
        if(this.status !== 'playing') return
        this.heat = Math.min(1, this.heat + 0.12)
        this.squash = 1
        const g = this.golden
        // a tap near the golden cup, or any key while it is up, catches it
        if(g && (x === undefined || Math.hypot(x - g.x, y - g.y) < 34))
        {
            this.golden = null
            this.score += 10
            this.popups.push({ x: g.x, y: g.y - 22, t: 0.9, text: '+10', color: palette.yellow })
            return
        }
        const coins = this.multiplier()
        this.score += coins
        this.popups.push({ x: 240 + (Math.random() * 2 - 1) * 46, y: 96, t: 0.7, text: `+${coins}`, color: palette.cream })
    },
    onPointer(x, y, type) { if(type === 'down') this.tap(x, y) },
    onKey(code, down)
    {
        if(code !== 'Space' && code !== 'Enter') return
        if(edge(this.held, code, down) !== 'down') return
        if(this.status === 'playing') this.tap()
        else if(code === 'Enter') this.reset()
    },
    finish()
    {
        this.status = 'over'
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    update(dt)
    {
        this.clock += dt
        this.squash = Math.max(0, this.squash - dt * 7)
        for(const p of this.popups) { p.t -= dt; p.y -= 34 * dt }
        this.popups = this.popups.filter((p) => p.t > 0)
        if(this.status !== 'playing') return
        this.timeLeft = Math.max(0, this.timeLeft - dt)
        this.heat = Math.max(0, this.heat - dt * 0.4)
        if(this.golden)
        {
            this.golden.t -= dt
            if(this.golden.t <= 0) this.golden = null
        }
        this.goldenIn -= dt
        if(this.goldenIn <= 0)
        {
            // find a spot around the cup rather than on top of it
            let x = 0
            let y = 0
            for(let i = 0; i < 20; i++)
            {
                x = 36 + Math.random() * (BOARD.W - 72)
                y = 66 + Math.random() * 176
                if(Math.abs(x - 240) > 72 || Math.abs(y - 150) > 72) break
            }
            this.golden = { x, y, t: 2, life: 2 }
            this.goldenIn = 3.5 + Math.random() * 2.5
        }
        if(this.timeLeft <= 0) this.finish()
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        // the cup squashes a little on every tap
        const s = 1 + this.squash * 0.07
        ctx.save()
        ctx.translate(240, 150)
        ctx.scale(s, 2 - s)
        drawChaiCup(ctx, 0, 0, palette.orange, palette.orange, this.clock)
        ctx.restore()
        const g = this.golden
        if(g)
        {
            const fade = Math.min(1, g.t / 0.4)
            ctx.globalAlpha = fade
            ctx.save()
            ctx.translate(g.x, g.y)
            ctx.scale(0.42, 0.42)
            drawChaiCup(ctx, 0, 0, palette.yellow, palette.yellow, this.clock)
            ctx.restore()
            // a ring that closes in over the two seconds
            ctx.strokeStyle = palette.yellow
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(g.x, g.y, 22 + 12 * (g.t / g.life), 0, Math.PI * 2)
            ctx.stroke()
            ctx.globalAlpha = 1
        }
        // the timer bar empties over the round
        const bar = this.timeLeft < 10 ? palette.pink : palette.yellow
        ctx.fillStyle = 'rgba(255, 246, 236, 0.12)'
        ctx.fillRect(18, H - 16, W - 36, 6)
        ctx.fillStyle = bar
        ctx.shadowColor = bar
        ctx.shadowBlur = 10
        ctx.fillRect(18, H - 16, (W - 36) * (this.timeLeft / 60), 6)
        ctx.shadowBlur = 0
        for(const p of this.popups)
        {
            ctx.globalAlpha = Math.min(1, p.t * 2)
            neonText(ctx, p.text, p.x, p.y, p.color, 18, 'center')
        }
        ctx.globalAlpha = 1
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
        neonText(ctx, `${Math.ceil(this.timeLeft)}s`, W / 2, 20, palette.cream, 16, 'center')
        neonText(ctx, `combo x${this.multiplier()}`, 18, 40, palette.pink, 14)
    },
    gameOver: 'Time is up. The chai is cold'
}

// ------------------------------------------------------------------ 5. Lane Racer
// A convertible on a night road with three lanes of traffic. Dodge left and right.
// The road gets faster and busier, and the distance you cover is the score.
const LANE_X = [ 140, 240, 340 ]
const ROAD = { left: 90, right: 390 }
const CAR = { w: 44, h: 66 }
const PLAYER_Y = 236

function nearestLane(x)
{
    let best = 0
    for(let i = 1; i < LANE_X.length; i++) if(Math.abs(LANE_X[i] - x) < Math.abs(LANE_X[best] - x)) best = i
    return best
}

function drawCar(ctx, x, y, color, facingDown)
{
    const { w, h } = CAR
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 9)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    ctx.fill()
    ctx.shadowBlur = 0
    // windscreen, toward the front of the car
    ctx.fillStyle = 'rgba(27, 21, 48, 0.75)'
    roundRect(ctx, x - w / 2 + 8, facingDown ? y + h / 2 - 24 : y - h / 2 + 12, w - 16, 12, 4)
    ctx.fill()
    // headlights
    const ly = facingDown ? y + h / 2 - 5 : y - h / 2 + 5
    ctx.fillStyle = palette.cream
    ctx.shadowColor = palette.yellow
    ctx.shadowBlur = 8
    for(const lx of [ x - w / 2 + 8, x + w / 2 - 8 ])
    {
        ctx.beginPath()
        ctx.arc(lx, ly, 3, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.shadowBlur = 0
}

export const laneRacer = {
    id: 'lane-racer',
    title: 'Lane Racer',
    blurb: 'Three lanes of night traffic. Weave between the cars and see how far the convertible can go.',
    controls: 'Left and right arrows, A and D, or drag',
    reset()
    {
        this.score = 0
        this.dist = 0
        this.elapsed = 0
        this.speed = 200
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.lane = 1
        this.x = LANE_X[1]
        this.targetX = LANE_X[1]
        this.cars = []
        this.spawn = 1
        this.roll = 0
        this.shake = 0
        this.sparks = []
        this.held = {}
    },
    onPointer(x, y, type)
    {
        if(type !== 'down' && type !== 'move') return
        this.targetX = clamp(x, ROAD.left + 28, ROAD.right - 28)
        this.lane = nearestLane(this.targetX)
    },
    onKey(code, down)
    {
        const left = code === 'ArrowLeft' || code === 'KeyA'
        const right = code === 'ArrowRight' || code === 'KeyD'
        if(!left && !right && code !== 'Enter') return
        if(edge(this.held, code, down) !== 'down') return
        if(this.status !== 'playing')
        {
            if(code === 'Enter') this.reset()
            return
        }
        if(left) this.lane = Math.max(0, this.lane - 1)
        if(right) this.lane = Math.min(LANE_X.length - 1, this.lane + 1)
        this.targetX = LANE_X[this.lane]
    },
    finish()
    {
        this.status = 'over'
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    crash(x, y)
    {
        this.finish()
        this.shake = 0.35
        const colors = [ palette.yellow, palette.orange, palette.pink ]
        for(let i = 0; i < 28; i++)
        {
            const a = Math.random() * Math.PI * 2
            const s = 60 + Math.random() * 240
            this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.45 + Math.random() * 0.4, color: colors[i % 3] })
        }
    },
    spawnCar()
    {
        // never start a car in a lane that still has one near the top
        const free = [ 0, 1, 2 ].filter((i) => !this.cars.some((c) => c.lane === i && c.y < 120))
        if(!free.length) return
        const lane = free[Math.floor(Math.random() * free.length)]
        const colors = [ palette.pink, palette.orange, palette.purple, palette.mint ]
        this.cars.push({
            lane,
            x: LANE_X[lane],
            y: -CAR.h / 2,
            v: this.speed * (0.3 + Math.random() * 0.45),
            color: colors[Math.floor(Math.random() * colors.length)]
        })
    },
    update(dt)
    {
        this.shake = Math.max(0, this.shake - dt)
        for(const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.t -= dt }
        this.sparks = this.sparks.filter((s) => s.t > 0 && s.x > 0 && s.x < BOARD.W && s.y > 0 && s.y < BOARD.H)
        if(this.status !== 'playing') return
        this.elapsed += dt
        this.speed = Math.min(430, 200 + this.elapsed * 4.5)
        this.roll = (this.roll + this.speed * dt) % 42
        this.dist += this.speed * dt / 10
        this.score = Math.floor(this.dist)
        this.x += (this.targetX - this.x) * Math.min(1, dt * 12)
        this.spawn -= dt
        if(this.spawn <= 0)
        {
            this.spawnCar()
            this.spawn = Math.max(0.42, 1.1 - this.elapsed * 0.012) * (0.6 + Math.random() * 0.8)
        }
        for(const c of this.cars) c.y += c.v * dt
        this.cars = this.cars.filter((c) => c.y < BOARD.H + CAR.h)
        for(const c of this.cars)
        {
            if(Math.abs(c.x - this.x) < CAR.w - 6 && Math.abs(c.y - PLAYER_Y) < CAR.h - 8)
            {
                this.crash((this.x + c.x) / 2, (PLAYER_Y + c.y) / 2)
                return
            }
        }
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        ctx.fillStyle = 'rgba(20, 12, 36, 0.8)'
        ctx.fillRect(ROAD.left, 0, ROAD.right - ROAD.left, H)
        ctx.save()
        if(this.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)
        // the road edges
        ctx.shadowColor = palette.pink
        ctx.shadowBlur = 12
        ctx.strokeStyle = palette.pink
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(ROAD.left, 0)
        ctx.lineTo(ROAD.left, H)
        ctx.moveTo(ROAD.right, 0)
        ctx.lineTo(ROAD.right, H)
        ctx.stroke()
        ctx.shadowBlur = 0
        // dashed lane lines that scroll with the speed
        ctx.strokeStyle = 'rgba(255, 246, 236, 0.6)'
        ctx.lineWidth = 2
        ctx.setLineDash([ 22, 20 ])
        ctx.lineDashOffset = -this.roll
        ctx.beginPath()
        for(const x of [ 190, 290 ])
        {
            ctx.moveTo(x, 0)
            ctx.lineTo(x, H)
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
        for(const c of this.cars) if(c.y + CAR.h / 2 > 0) drawCar(ctx, c.x, c.y, c.color, true)
        drawCar(ctx, this.x, PLAYER_Y, palette.cyan, false)
        // sparks from a crash
        for(const s of this.sparks)
        {
            ctx.globalAlpha = Math.min(1, s.t * 3)
            ctx.fillStyle = s.color
            ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3)
        }
        ctx.globalAlpha = 1
        ctx.restore()
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
        neonText(ctx, `${Math.round(this.speed * 0.3)} km/h`, W / 2, 20, palette.cream, 14, 'center')
    },
    gameOver: 'You crashed the convertible'
}

// ------------------------------------------------------------------ 6. Palm Merge
// 2048 on an island. Two of the same stage merge into the next one, from a seed up
// to a whole island. Tiles glide to their cells, so the board always feels responsive.
const PALM_STAGES = [ '', 'Seed', 'Sprout', 'Bud', 'Flower', 'Palm', 'Coconut Palm', 'Grove', 'Island' ]
const PALM_COLORS = [ '', '#4A3D7A', '#1F7A8C', '#2FB37A', '#FF6FA8', '#FF8C42', '#FFB347', '#FFE45E', '#FFF6EC' ]
const PALM_MAX = 8
const PALM_KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }
const PALM = { x: 113, y: 38, size: 254, pad: 6, cell: 56, gap: 6 }

function palmCell(r, c)
{
    return { x: PALM.x + PALM.pad + c * (PALM.cell + PALM.gap), y: PALM.y + PALM.pad + r * (PALM.cell + PALM.gap) }
}

// Slides one line of four levels towards index 0. Equal neighbours merge once per
// move, starting from the front of the line. Stage 8 is the top and never merges.
function slideLine(line)
{
    const out = [ 0, 0, 0, 0 ]
    const moves = []
    let gained = 0
    let w = 0
    for(let i = 0; i < 4; i++)
    {
        const v = line[i]
        if(!v) continue
        let j = i + 1
        while(j < 4 && !line[j]) j++
        if(j < 4 && line[j] === v && v < PALM_MAX)
        {
            out[w] = v + 1
            gained += 2 ** (v + 1)
            moves.push({ from: i, to: w, grows: true })
            moves.push({ from: j, to: w, consumed: true })
            i = j
        }
        else
        {
            out[w] = v
            moves.push({ from: i, to: w })
        }
        w++
    }
    return { line: out, moves, gained }
}

// Slides the whole 4 x 4 grid of levels (0 is empty). Returns the new grid, the tile
// moves for the animation and the points gained. moved is false if nothing changes.
export function slidePalmGrid(grid, dir)
{
    const next = grid.map((row) => row.map(() => 0))
    const moves = []
    let gained = 0
    const horizontal = dir === 'left' || dir === 'right'
    const reversed = dir === 'right' || dir === 'down'
    for(let k = 0; k < 4; k++)
    {
        // i is the position along the line, counted from the edge the tiles slide to
        const at = (i) =>
        {
            const p = reversed ? 3 - i : i
            return horizontal ? [ k, p ] : [ p, k ]
        }
        const line = [ 0, 1, 2, 3 ].map((i) =>
        {
            const [ r, c ] = at(i)
            return grid[r][c]
        })
        const res = slideLine(line)
        gained += res.gained
        res.line.forEach((v, w) =>
        {
            const [ r, c ] = at(w)
            next[r][c] = v
        })
        for(const m of res.moves)
        {
            const [ fr, fc ] = at(m.from)
            const [ tr, tc ] = at(m.to)
            moves.push({ fromR: fr, fromC: fc, toR: tr, toC: tc, grows: !!m.grows, consumed: !!m.consumed })
        }
    }
    const moved = next.some((row, r) => row.some((v, c) => v !== grid[r][c]))
    if(!moved) return { grid: next, moves: [], gained: 0, moved: false }
    return { grid: next, moves, gained, moved: true }
}

// Puts a level 1 tile (a level 2 one one time in ten) on a random empty cell.
export function spawnPalmTile(grid)
{
    const empty = []
    grid.forEach((row, r) => row.forEach((v, c) => { if(!v) empty.push([ r, c ]) }))
    if(!empty.length) return null
    const [ r, c ] = empty[Math.floor(Math.random() * empty.length)]
    const level = Math.random() < 0.9 ? 1 : 2
    grid[r][c] = level
    return { r, c, level }
}

// True while some slide would still change the board: a free cell, or two equal neighbours.
export function palmHasMoves(grid)
{
    for(let r = 0; r < 4; r++)
        for(let c = 0; c < 4; c++)
        {
            const v = grid[r][c]
            if(!v) return true
            if(v < PALM_MAX && ((c < 3 && grid[r][c + 1] === v) || (r < 3 && grid[r + 1][c] === v))) return true
        }
    return false
}

// A palm tree: a curved trunk from the base (x, y) up to the crown, with fronds fanning out.
function palmTree(ctx, x, y, s)
{
    const tx = x + 2 * s
    const ty = y - 13 * s
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 3 * s, y - 6 * s, tx, ty)
    ctx.stroke()
    ctx.lineWidth = 1.8
    for(const a of [ -2.9, -2.2, -1.57, -0.95, -0.25 ])
    {
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.quadraticCurveTo(tx + Math.cos(a) * 7 * s, ty + Math.sin(a) * 7 * s - 2 * s, tx + Math.cos(a) * 12 * s, ty + Math.sin(a) * 12 * s + 3 * s)
        ctx.stroke()
    }
    return { x: tx, y: ty }
}

// The stage icon for a tile (seed, sprout, bud, flower, palm, ...), drawn around (cx, cy).
function palmGlyph(ctx, level, cx, cy)
{
    ctx.lineCap = 'round'
    ctx.lineWidth = 2
    const dot = (x, y, rx, ry, rot = 0) =>
    {
        ctx.beginPath()
        ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
        ctx.fill()
    }
    const stem = () =>
    {
        ctx.beginPath()
        ctx.moveTo(cx, cy + 8)
        ctx.lineTo(cx, cy - 2)
        ctx.stroke()
    }
    if(level === 1) dot(cx, cy, 4.5, 6.5, -0.5)
    else if(level === 2)
    {
        stem()
        dot(cx - 6, cy - 4, 6, 3, -0.5)
        dot(cx + 6, cy - 6, 6, 3, 0.5)
    }
    else if(level === 3)
    {
        stem()
        ctx.beginPath()
        ctx.arc(cx, cy - 5, 5.5, 0, Math.PI * 2)
        ctx.fill()
    }
    else if(level === 4)
    {
        for(let i = 0; i < 5; i++)
        {
            const a = -Math.PI / 2 + i * Math.PI * 2 / 5
            dot(cx + Math.cos(a) * 6, cy - 3 + Math.sin(a) * 6, 3.6, 3.6)
        }
        ctx.fillStyle = palette.yellow
        dot(cx, cy - 3, 2.6, 2.6)
    }
    else if(level === 5) palmTree(ctx, cx, cy + 9, 1)
    else if(level === 6)
    {
        const top = palmTree(ctx, cx, cy + 9, 1)
        dot(top.x - 2, top.y + 3, 2.2, 2.2)
        dot(top.x + 1, top.y + 4, 2.2, 2.2)
    }
    else if(level === 7)
    {
        palmTree(ctx, cx - 8, cy + 9, 0.7)
        palmTree(ctx, cx + 7, cy + 9, 0.7)
        palmTree(ctx, cx, cy + 10, 0.9)
    }
    else
    {
        ctx.fillStyle = palette.orange
        dot(cx, cy + 10, 15, 4.5)
        ctx.fillStyle = palette.night
        ctx.strokeStyle = palette.night
        palmTree(ctx, cx, cy + 9, 0.8)
    }
}

function palmTile(ctx, x, y, size, level, scale)
{
    const cx = x + size / 2
    const cy = y + size / 2
    const ink = level >= 3 ? palette.night : palette.cream
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    roundRect(ctx, x, y, size, size, 9)
    ctx.fillStyle = PALM_COLORS[level]
    ctx.shadowColor = PALM_COLORS[level]
    ctx.shadowBlur = 12
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = ink
    ctx.strokeStyle = ink
    palmGlyph(ctx, level, cx, y + 21)
    ctx.font = '700 10px "Barlow Semi Condensed", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ink
    const words = PALM_STAGES[level].split(' ')
    const top = words.length > 1 ? 39 : 43
    words.forEach((word, i) => ctx.fillText(word, cx, y + top + i * 10))
    ctx.restore()
}

export const palmMerge = {
    id: 'palm-merge',
    title: 'Palm Merge',
    blurb: 'Slide seeds across the island. Match two of the same stage and they grow into the next one.',
    controls: 'Arrow keys, WASD, or swipe',
    reset()
    {
        this.grid = [ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ]
        this.score = 0
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.held = {}
        this.drag = null
        this.tiles = []
        this.addTile(spawnPalmTile(this.grid))
        this.addTile(spawnPalmTile(this.grid))
    },
    // a visual tile follows a board cell; tiles ease towards their cell each frame
    addTile(info)
    {
        if(!info) return
        const p = palmCell(info.r, info.c)
        this.tiles.push({ r: info.r, c: info.c, level: info.level, x: p.x, y: p.y, pop: 0.2, dead: false, deadT: 0 })
    },
    applyMoves(moves)
    {
        // snapshot the live tiles by their old cell, so no move chases a tile that already moved
        const at = this.grid.map((row) => row.map(() => null))
        for(const t of this.tiles) if(!t.dead) at[t.r][t.c] = t
        for(const m of moves)
        {
            const t = at[m.fromR][m.fromC]
            if(!t) continue
            t.r = m.toR
            t.c = m.toC
            if(m.consumed) { t.dead = true; t.deadT = 0.16 }
            else if(m.grows)
            {
                t.level = this.grid[m.toR][m.toC]
                t.pop = 0.2
            }
        }
    },
    slide(dir)
    {
        if(this.status !== 'playing') return
        const res = slidePalmGrid(this.grid, dir)
        if(!res.moved) return
        this.grid = res.grid
        this.score += res.gained
        this.applyMoves(res.moves)
        this.addTile(spawnPalmTile(this.grid))
        if(!palmHasMoves(this.grid)) this.finish()
    },
    onPointer(x, y, type)
    {
        if(type === 'down') this.drag = { x, y }
        else if(type === 'up' && this.drag)
        {
            const dx = x - this.drag.x
            const dy = y - this.drag.y
            this.drag = null
            if(Math.hypot(dx, dy) <= 20) return
            if(Math.abs(dx) > Math.abs(dy)) this.slide(dx > 0 ? 'right' : 'left')
            else this.slide(dy > 0 ? 'down' : 'up')
        }
    },
    onKey(code, down)
    {
        const dir = PALM_KEYS[code]
        if(dir)
        {
            if(edge(this.held, code, down) === 'down') this.slide(dir)
            return
        }
        if(down && code === 'Enter' && this.status !== 'playing') this.reset()
    },
    finish()
    {
        this.status = 'over'
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    update(dt)
    {
        for(const t of this.tiles)
        {
            const p = palmCell(t.r, t.c)
            const k = Math.min(1, dt * 18)
            t.x += (p.x - t.x) * k
            t.y += (p.y - t.y) * k
            t.pop = Math.max(0, t.pop - dt)
            if(t.dead) t.deadT -= dt
        }
        this.tiles = this.tiles.filter((t) => !t.dead || t.deadT > 0)
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        roundRect(ctx, PALM.x, PALM.y, PALM.size, PALM.size, 12)
        ctx.fillStyle = 'rgba(27, 21, 48, 0.6)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(45, 226, 230, 0.35)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = 'rgba(255, 246, 236, 0.07)'
        for(let r = 0; r < 4; r++)
            for(let c = 0; c < 4; c++)
            {
                const p = palmCell(r, c)
                roundRect(ctx, p.x, p.y, PALM.cell, PALM.cell, 9)
                ctx.fill()
            }
        for(const t of this.tiles)
        {
            const scale = 1 + 0.14 * Math.sin((t.pop / 0.2) * Math.PI)
            palmTile(ctx, t.x, t.y, PALM.cell, t.level, scale)
        }
        // the stage guide, with the stages reached so far lit up
        const top = Math.max(...this.grid.flat())
        for(let lvl = 1; lvl <= PALM_MAX; lvl++)
        {
            const left = lvl <= 4
            const y = 72 + ((lvl - 1) % 4) * 24
            const color = lvl <= top ? palette.cream : 'rgba(255, 246, 236, 0.3)'
            neonText(ctx, `${lvl} ${PALM_STAGES[lvl]}`, left ? 18 : W - 18, y, color, 14, left ? 'left' : 'right')
        }
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
    },
    gameOver: 'No more moves on the island'
}

// ------------------------------------------------------------------ 7. Island Fishing
// A casual 60 second trip. Hold to sink the hook, let go to set the depth, then hook
// a fish as it swims past. Big fish are slower and worth more.
const FISH_KINDS = {
    small: { w: 22, h: 11, pts: 1, speed: [ 92, 128 ], color: palette.mint },
    medium: { w: 34, h: 15, pts: 3, speed: [ 62, 90 ], color: palette.orange },
    big: { w: 54, h: 22, pts: 5, speed: [ 34, 52 ], color: palette.pink }
}
const FISH_LANES = [ 80, 106, 132 ]
const FISH_COUNT = 7
const SURFACE = 56
const WATER_BOTTOM = 150
const HOOK_MAX = 146

// A fish either starts anywhere on the water, or waits just off one edge.
function makeFish(anywhere)
{
    const roll = Math.random()
    const kind = roll < 0.5 ? 'small' : roll < 0.85 ? 'medium' : 'big'
    const k = FISH_KINDS[kind]
    const side = Math.random() < 0.5 ? -1 : 1
    const dir = anywhere ? (Math.random() < 0.5 ? -1 : 1) : -side
    const x = anywhere ? k.w / 2 + Math.random() * (BOARD.W - k.w) : side < 0 ? -k.w / 2 - 4 : BOARD.W + k.w / 2 + 4
    return {
        kind,
        w: k.w,
        h: k.h,
        pts: k.pts,
        color: k.color,
        dir,
        x,
        y: FISH_LANES[Math.floor(Math.random() * FISH_LANES.length)],
        speed: k.speed[0] + Math.random() * (k.speed[1] - k.speed[0]),
        hooked: false
    }
}

function drawFish(ctx, f)
{
    const s = f.dir
    const tailX = f.x - s * (f.w / 2 - 3)
    ctx.fillStyle = f.color
    ctx.shadowColor = f.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.ellipse(f.x, f.y, f.w / 2, f.h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(tailX, f.y)
    ctx.lineTo(tailX - s * f.h * 0.7, f.y - f.h / 2)
    ctx.lineTo(tailX - s * f.h * 0.7, f.y + f.h / 2)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = palette.night
    ctx.beginPath()
    ctx.arc(f.x + s * f.w * 0.22, f.y - f.h * 0.12, Math.max(1.3, f.h * 0.09), 0, Math.PI * 2)
    ctx.fill()
}

export const islandFishing = {
    id: 'island-fishing',
    title: 'Island Fishing',
    blurb: 'Sink your line to the right depth and hook the fish swimming past. The big ones are worth the wait.',
    controls: 'Hold Space, click or ArrowDown to sink, let go to set. Left and right steer',
    reset()
    {
        this.score = 0
        this.timeLeft = 60
        this.status = 'playing'
        this.best = loadBest(this.id)
        // idle, sinking (button held), hanging (set at a depth), retract, or hooked (reeling up)
        this.state = 'idle'
        this.hookX = BOARD.W / 2
        this.hookY = -10
        this.pressing = false
        this.keys = { left: false, right: false }
        this.held = {}
        this.clock = 0
        this.caught = null
        this.popups = []
        this.fish = []
        for(let i = 0; i < FISH_COUNT; i++) this.fish.push(makeFish(true))
    },
    press(x)
    {
        if(this.status !== 'playing' || this.pressing) return
        this.pressing = true
        if(this.state === 'idle')
        {
            this.state = 'sinking'
            this.hookY = SURFACE
            if(x !== undefined) this.hookX = clamp(x, 14, BOARD.W - 14)
        }
        else if(this.state === 'hanging') this.state = 'retract'
    },
    release()
    {
        this.pressing = false
        if(this.state === 'sinking') this.state = 'hanging'
    },
    steer(x)
    {
        if(this.state === 'sinking' || this.state === 'hanging') this.hookX = clamp(x, 14, BOARD.W - 14)
    },
    onPointer(x, y, type)
    {
        if(type === 'down') this.press(x)
        else if(type === 'up') this.release()
        else if(type === 'move' && this.pressing) this.steer(x)
    },
    onKey(code, down)
    {
        if(code === 'ArrowLeft' || code === 'KeyA') this.keys.left = down
        if(code === 'ArrowRight' || code === 'KeyD') this.keys.right = down
        if(code === 'Space' || code === 'ArrowDown')
        {
            const e = edge(this.held, code, down)
            if(e === 'down') this.press()
            else if(e === 'up') this.release()
        }
        if(down && code === 'Enter' && this.status !== 'playing') this.reset()
    },
    finish()
    {
        this.status = 'over'
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    update(dt)
    {
        this.clock += dt
        for(const p of this.popups) { p.t -= dt; p.y -= 26 * dt }
        this.popups = this.popups.filter((p) => p.t > 0)
        if(this.status !== 'playing') return
        this.timeLeft = Math.max(0, this.timeLeft - dt)
        if(this.timeLeft <= 0)
        {
            this.finish()
            return
        }
        // the fish swim across, and new ones come in from the edges
        for(const f of this.fish) if(!f.hooked) f.x += f.dir * f.speed * dt
        this.fish = this.fish.filter((f) => f.hooked || (f.x > -f.w - 12 && f.x < BOARD.W + f.w + 12))
        while(this.fish.filter((f) => !f.hooked).length < FISH_COUNT) this.fish.push(makeFish(false))
        const steer = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0)
        if(steer) this.steer(this.hookX + steer * 190 * dt)
        if(this.state === 'sinking')
        {
            if(this.pressing) this.hookY = Math.min(HOOK_MAX, this.hookY + 62 * dt)
            else this.state = 'hanging'
        }
        if(this.state === 'sinking' || this.state === 'hanging')
        {
            const hit = this.fish.find((f) => !f.hooked && Math.abs(f.x - this.hookX) < f.w / 2 + 3 && Math.abs(f.y - this.hookY) < f.h / 2 + 3)
            if(hit)
            {
                hit.hooked = true
                this.caught = hit
                this.state = 'hooked'
            }
        }
        if(this.state === 'hooked')
        {
            // a caught fish reels up at a fixed speed, whatever its size
            this.hookY -= 58 * dt
            const f = this.caught
            f.x = this.hookX
            f.y = this.hookY + 8
            if(this.hookY <= SURFACE)
            {
                this.score += f.pts
                this.popups.push({ x: this.hookX, y: SURFACE + 16, t: 1, text: `+${f.pts}`, color: f.color })
                this.fish = this.fish.filter((o) => o !== f)
                this.caught = null
                this.state = 'idle'
                this.hookY = -10
            }
        }
        if(this.state === 'retract')
        {
            this.hookY -= 220 * dt
            if(this.hookY <= 0)
            {
                this.state = 'idle'
                this.hookY = -10
            }
        }
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        // the water sits in the top half, with a wavy surface
        const wg = ctx.createLinearGradient(0, SURFACE, 0, WATER_BOTTOM)
        wg.addColorStop(0, '#1E6E9C')
        wg.addColorStop(1, '#0E2F57')
        ctx.fillStyle = wg
        ctx.fillRect(0, SURFACE, W, WATER_BOTTOM - SURFACE)
        ctx.beginPath()
        for(let x = 0; x <= W; x += 6)
        {
            const y = SURFACE + Math.sin(x * 0.06 + this.clock * 2.2) * 1.8
            if(x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = palette.cyan
        ctx.lineWidth = 2
        ctx.shadowColor = palette.cyan
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.shadowBlur = 0
        // a dusky beach on the bottom half
        const sg = ctx.createLinearGradient(0, WATER_BOTTOM, 0, H)
        sg.addColorStop(0, '#B5654F')
        sg.addColorStop(1, '#6E3A4E')
        ctx.fillStyle = sg
        ctx.fillRect(0, WATER_BOTTOM, W, H - WATER_BOTTOM)
        ctx.fillStyle = palette.night
        ctx.strokeStyle = palette.night
        palmTree(ctx, 34, WATER_BOTTOM + 8, 1.6)
        palmTree(ctx, 452, WATER_BOTTOM + 8, 1.4)
        for(const f of this.fish) drawFish(ctx, f)
        if(this.state !== 'idle')
        {
            ctx.strokeStyle = palette.cream
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(this.hookX, 0)
            ctx.lineTo(this.hookX, this.hookY)
            ctx.stroke()
            ctx.strokeStyle = palette.yellow
            ctx.lineWidth = 2
            ctx.shadowColor = palette.yellow
            ctx.shadowBlur = 8
            ctx.beginPath()
            ctx.arc(this.hookX, this.hookY + 2, 4, 0, Math.PI * 1.5)
            ctx.stroke()
            ctx.shadowBlur = 0
        }
        if(this.state === 'idle' && this.status === 'playing')
            neonText(ctx, 'hold to sink the hook, let go to set the depth', W / 2, 200, palette.cream, 14, 'center')
        for(const p of this.popups)
        {
            ctx.globalAlpha = Math.min(1, p.t * 2)
            neonText(ctx, p.text, p.x, p.y, p.color, 16, 'center')
        }
        ctx.globalAlpha = 1
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
        neonText(ctx, `${Math.ceil(this.timeLeft)}s`, W / 2, 20, palette.cream, 16, 'center')
    },
    gameOver: 'The tide is in. Time to go home'
}

// ------------------------------------------------------------------ 8. Pilot Hop
// A flappy flight over the islands. Hold to climb and let go to drop. Each pillar gap
// you pass is a point, and a ring in the gap pays three if you fly through its centre.
const HOP_PLANE = { x: 116, hit: 9, gravity: 760, lift: 1350, maxUp: 300, maxDown: 320 }
const HOP_PILLAR = { w: 46, spacing: 200, ground: 268 }
const HOP_RING = { r: 13, hit: 7 }

// A circle against a box. Close enough for a small plane.
function hitsBox(cx, cy, r, x, y, w, h)
{
    const nx = clamp(cx, x, x + w)
    const ny = clamp(cy, y, y + h)
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

// One pillar. The top one hangs from the ceiling and the bottom one stands on the ground.
// The side that faces the gap is a jagged rock stack or a glowing island tower.
function drawHopPillar(ctx, p, fromTop)
{
    const { w, ground } = HOP_PILLAR
    const lip = fromTop ? p.gapY - p.gapH / 2 : p.gapY + p.gapH / 2
    const far = fromTop ? 0 : ground
    const sign = fromTop ? -1 : 1
    if(p.kind === 'rock')
    {
        ctx.beginPath()
        ctx.moveTo(p.x, far)
        ctx.lineTo(p.x + w, far)
        for(let i = 0; i <= 6; i++)
        {
            // the tips reach the gap and the valleys sit back into the rock
            const depth = 10 * (0.5 + 0.5 * Math.sin(p.seed + i * 2.1))
            ctx.lineTo(p.x + w - (w * i) / 6, lip + sign * depth)
        }
        ctx.closePath()
        ctx.fillStyle = '#3A2A5E'
        ctx.fill()
        ctx.strokeStyle = palette.pink
        ctx.lineWidth = 1.5
        ctx.shadowColor = palette.pink
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.shadowBlur = 0
        return
    }
    // an island tower: a column with a glowing cap on the gap side
    const top = fromTop ? far - 12 : lip
    const bottom = fromTop ? lip : far + 12
    roundRect(ctx, p.x + 6, top, w - 12, bottom - top, 6)
    ctx.fillStyle = '#2B2350'
    ctx.fill()
    ctx.strokeStyle = 'rgba(45, 226, 230, 0.35)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    roundRect(ctx, p.x - 2, fromTop ? lip - 10 : lip, w + 4, 10, 4)
    ctx.fillStyle = palette.cyan
    ctx.shadowColor = palette.cyan
    ctx.shadowBlur = 12
    ctx.fill()
    ctx.shadowBlur = 0
}

// The glowing ring in a gap. It turns mint when it scores and goes grey when missed.
function drawHopRing(ctx, x, y, state)
{
    const color = state === 'hit' ? palette.mint : state === 'missed' ? 'rgba(255, 246, 236, 0.3)' : palette.yellow
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.shadowColor = color
    ctx.shadowBlur = state === 'live' ? 14 : 0
    ctx.beginPath()
    ctx.arc(x, y, HOP_RING.r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    if(state === 'live')
    {
        // a dot marks the centre, which is what the ring pays for
        ctx.fillStyle = palette.yellow
        ctx.beginPath()
        ctx.arc(x, y, 1.6, 0, Math.PI * 2)
        ctx.fill()
    }
}

// The plane faces right and tilts with its climb or dive. The propeller spins.
function drawHopPlane(ctx, x, y, vy, t)
{
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(clamp(vy / 520, -0.45, 0.55))
    ctx.shadowColor = palette.cyan
    ctx.shadowBlur = 10
    // swept wings, one above and one below the fuselage
    ctx.fillStyle = palette.pink
    for(const s of [ -1, 1 ])
    {
        ctx.beginPath()
        ctx.moveTo(3, 0)
        ctx.lineTo(-4, 9 * s)
        ctx.lineTo(-9, 9 * s)
        ctx.lineTo(-6, 0)
        ctx.closePath()
        ctx.fill()
    }
    ctx.fillStyle = palette.cyan
    roundRect(ctx, -12, -4, 25, 8, 4)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-9, -3)
    ctx.lineTo(-15, -10)
    ctx.lineTo(-12, -10)
    ctx.lineTo(-5, -3)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = palette.cream
    ctx.beginPath()
    ctx.ellipse(4, -1, 3.2, 2.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 246, 236, 0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(13.5, 0, 1.2, 7 * Math.abs(Math.cos(t * 40)) + 1, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
}

export const pilotHop = {
    id: 'pilot-hop',
    title: 'Pilot Hop',
    blurb: 'Hold to climb, let go to drop. Thread the island towers and rock stacks, and fly through the rings.',
    controls: 'Hold Space, ArrowUp, the mouse or touch to climb',
    reset()
    {
        this.score = 0
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.y = BOARD.H / 2
        this.vy = 0
        this.speed = 140
        this.clock = 0
        this.lastGap = BOARD.H / 2
        this.spawnIn = 80
        this.pairs = []
        this.trail = []
        this.burst = []
        this.popups = []
        this.held = {}
    },
    spawnPair()
    {
        const gapH = Math.max(94, 124 - this.score * 1.2)
        const lo = gapH / 2 + 18
        const hi = HOP_PILLAR.ground - gapH / 2 - 14
        const gapY = clamp(this.lastGap + (Math.random() * 2 - 1) * 84, lo, hi)
        this.lastGap = gapY
        this.pairs.push({ x: BOARD.W + 10, gapY, gapH, kind: Math.random() < 0.5 ? 'tower' : 'rock', seed: Math.random() * 6, passed: false, ring: 'live' })
    },
    crash()
    {
        this.finish()
        const colors = [ palette.pink, palette.orange, palette.yellow ]
        for(let i = 0; i < 22; i++)
        {
            const a = Math.random() * Math.PI * 2
            const s = 60 + Math.random() * 180
            this.burst.push({ x: HOP_PLANE.x, y: this.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.5 + Math.random() * 0.4, color: colors[i % 3] })
        }
    },
    finish()
    {
        this.status = 'over'
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },
    onPointer(x, y, type)
    {
        if(type === 'down') this.held.pointer = true
        else if(type === 'up') this.held.pointer = false
    },
    onKey(code, down)
    {
        if(code === 'Space' || code === 'ArrowUp') this.held[code] = down
        if(down && code === 'Enter' && this.status !== 'playing') this.reset()
    },
    update(dt)
    {
        this.clock += dt
        for(const b of this.burst) { b.t -= dt; b.vy += 500 * dt; b.x += b.vx * dt; b.y += b.vy * dt }
        this.burst = this.burst.filter((b) => b.t > 0)
        for(const t of this.trail) { t.life -= dt; t.x += t.vx * dt; t.y += t.vy * dt }
        this.trail = this.trail.filter((t) => t.life > 0)
        for(const p of this.popups) { p.t -= dt; p.y -= 30 * dt }
        this.popups = this.popups.filter((p) => p.t > 0)
        if(this.status !== 'playing') return
        this.speed = Math.min(260, 140 + this.score * 2.2)
        // a gentle lift while held, then gravity pulls the plane down
        const lifting = this.held.pointer || this.held.Space || this.held.ArrowUp
        this.vy = clamp(this.vy + (HOP_PLANE.gravity - (lifting ? HOP_PLANE.lift : 0)) * dt, -HOP_PLANE.maxUp, HOP_PLANE.maxDown)
        this.y += this.vy * dt
        if(Math.random() < 0.9)
            this.trail.push({ x: HOP_PLANE.x - 14, y: this.y + Math.random() * 4 - 2, vx: -this.speed * 0.5, vy: Math.random() * 20 - 10, life: 0.45, color: Math.random() < 0.5 ? palette.pink : palette.orange })
        this.spawnIn -= this.speed * dt
        if(this.spawnIn <= 0) { this.spawnPair(); this.spawnIn += HOP_PILLAR.spacing }
        for(const p of this.pairs) p.x -= this.speed * dt
        for(const p of this.pairs)
        {
            if(!p.passed && p.x + HOP_PILLAR.w < HOP_PLANE.x)
            {
                p.passed = true
                this.score++
                this.popups.push({ x: HOP_PLANE.x + 30, y: p.gapY, text: '+1', color: palette.cream, t: 0.7 })
            }
            if(p.ring === 'live' && p.x + HOP_PILLAR.w / 2 < HOP_PLANE.x)
            {
                if(Math.abs(this.y - p.gapY) <= HOP_RING.hit)
                {
                    p.ring = 'hit'
                    this.score += 3
                    this.popups.push({ x: HOP_PLANE.x + 30, y: p.gapY - 18, text: '+3 ring', color: palette.yellow, t: 0.9 })
                }
                else p.ring = 'missed'
            }
        }
        this.pairs = this.pairs.filter((p) => p.x + HOP_PILLAR.w > -4)
        for(const p of this.pairs)
        {
            const top = p.gapY - p.gapH / 2
            const bottom = p.gapY + p.gapH / 2
            if(hitsBox(HOP_PLANE.x, this.y, HOP_PLANE.hit, p.x, 0, HOP_PILLAR.w, top) || hitsBox(HOP_PLANE.x, this.y, HOP_PLANE.hit, p.x, bottom, HOP_PILLAR.w, HOP_PILLAR.ground - bottom))
            {
                this.crash()
                return
            }
        }
        // the ceiling and the ground end the flight too
        if(this.y - HOP_PLANE.hit < 0 || this.y + HOP_PLANE.hit > HOP_PILLAR.ground) this.crash()
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, W, H)
        ctx.clip()
        // the sea and sand under the towers
        ctx.fillStyle = 'rgba(27, 21, 48, 0.7)'
        ctx.fillRect(0, HOP_PILLAR.ground, W, H - HOP_PILLAR.ground)
        ctx.strokeStyle = palette.cyan
        ctx.lineWidth = 2
        ctx.shadowColor = palette.cyan
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(0, HOP_PILLAR.ground)
        ctx.lineTo(W, HOP_PILLAR.ground)
        ctx.stroke()
        ctx.shadowBlur = 0
        for(const p of this.pairs)
        {
            drawHopPillar(ctx, p, true)
            drawHopPillar(ctx, p, false)
        }
        for(const p of this.pairs) drawHopRing(ctx, p.x + HOP_PILLAR.w / 2, p.gapY, p.ring)
        for(const t of this.trail)
        {
            ctx.globalAlpha = Math.max(0, t.life / 0.45) * 0.7
            ctx.fillStyle = t.color
            ctx.beginPath()
            ctx.arc(t.x, t.y, 1 + 2 * (t.life / 0.45), 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.globalAlpha = 1
        drawHopPlane(ctx, HOP_PLANE.x, this.y, this.vy, this.clock)
        for(const b of this.burst)
        {
            ctx.globalAlpha = Math.max(0, Math.min(1, b.t * 2))
            ctx.fillStyle = b.color
            ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3)
        }
        ctx.globalAlpha = 1
        ctx.restore()
        for(const p of this.popups)
        {
            ctx.globalAlpha = Math.min(1, p.t * 2)
            neonText(ctx, p.text, p.x, p.y, p.color, 16, 'center')
        }
        ctx.globalAlpha = 1
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
        if(this.status === 'playing' && this.clock < 3) neonText(ctx, 'hold to climb, let go to drop', W / 2, 20, palette.cream, 13, 'center')
    },
    gameOver: 'You clipped the island'
}

// ------------------------------------------------------------------ 9. Island Golf
// Three holes on neon greens. Press the ball and drag back to aim and set the power,
// or turn with the arrows and charge with Space. Sand stops the ball hard, and the water
// sends it back to where it was hit from.
const GOLF = { par: 2, shot: 460, green: 300, sand: 1400, ball: 5, cup: 8, sink: 140, grab: 40, pull: 110 }
const GOLF_HOLES = [
    {
        bounds: { x: 34, y: 64, w: 412, h: 200, r: 30 },
        tee: { x: 96, y: 214 },
        cup: { x: 352, y: 110 },
        water: [ { x: 222, y: 176, r: 26 } ],
        sand: [ { kind: 'circle', x: 300, y: 146, r: 20 }, { kind: 'rect', x: 268, y: 214, w: 62, h: 30 } ]
    },
    {
        bounds: { x: 56, y: 58, w: 368, h: 222, r: 44 },
        tee: { x: 104, y: 228 },
        cup: { x: 316, y: 110 },
        water: [ { x: 200, y: 170, r: 30 }, { x: 150, y: 110, r: 20 } ],
        sand: [ { kind: 'rect', x: 236, y: 196, w: 70, h: 26 } ]
    },
    {
        bounds: { x: 30, y: 62, w: 420, h: 206, r: 24 },
        tee: { x: 74, y: 160 },
        cup: { x: 336, y: 160 },
        water: [ { x: 200, y: 96, r: 30 }, { x: 200, y: 224, r: 30 } ],
        sand: [ { kind: 'rect', x: 276, y: 142, w: 38, h: 36 } ]
    }
]

// Keeps the ball on a rounded green. A wall gives back 60% of the speed that hits it.
function golfWalls(b, g)
{
    const r = g.r
    const cx = clamp(b.x, g.x + r, g.x + g.w - r)
    const cy = clamp(b.y, g.y + r, g.y + g.h - r)
    const dx = b.x - cx
    const dy = b.y - cy
    const dist = Math.hypot(dx, dy)
    const limit = r - GOLF.ball
    if(dist <= limit) return
    const nx = dx / dist
    const ny = dy / dist
    b.x = cx + nx * limit
    b.y = cy + ny * limit
    const vn = b.vx * nx + b.vy * ny
    if(vn > 0)
    {
        b.vx -= 1.6 * vn * nx
        b.vy -= 1.6 * vn * ny
    }
}

// Is the point inside a sand trap? Traps are rectangles or circles.
function golfInside(s, x, y)
{
    if(s.kind === 'circle') return Math.hypot(x - s.x, y - s.y) < s.r
    return x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h
}

export const islandGolf = {
    id: 'island-golf',
    title: 'Island Golf',
    blurb: 'Three holes on neon greens. Drag back from the ball to aim, and keep out of the sand and the water.',
    controls: 'Drag back from the ball, or use the arrows to aim and hold Space for power',
    reset()
    {
        this.score = 0
        this.status = 'playing'
        this.best = loadBest(this.id)
        this.hole = 0
        this.held = {}
        this.drag = null
        this.dragPower = 0
        this.clock = 0
        this.popups = []
        this.loadHole()
    },
    loadHole()
    {
        const h = GOLF_HOLES[this.hole]
        this.ball = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 }
        this.lastRest = { x: h.tee.x, y: h.tee.y }
        this.strokes = 0
        // aim: the ball can be hit. roll: it is moving. sunk: it is in the cup.
        this.phase = 'aim'
        this.sinkT = 0
        this.banner = ''
        this.lastPts = 0
        this.keyPower = 0
        this.aimAngle = Math.atan2(h.cup.y - h.tee.y, h.cup.x - h.tee.x)
    },
    shoot(angle, power)
    {
        if(this.phase !== 'aim' || this.status !== 'playing') return
        this.lastRest = { x: this.ball.x, y: this.ball.y }
        this.ball.vx = Math.cos(angle) * GOLF.shot * power
        this.ball.vy = Math.sin(angle) * GOLF.shot * power
        this.strokes++
        this.phase = 'roll'
        this.keyPower = 0
    },
    holed()
    {
        const d = this.strokes - GOLF.par
        const pts = Math.max(0, 50 - 10 * d)
        this.banner = d <= -1 ? 'Hole in one' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : 'Over par'
        this.lastPts = pts
        this.score += pts
        this.phase = 'sunk'
        this.sinkT = 0
        const cup = GOLF_HOLES[this.hole].cup
        this.ball.x = cup.x
        this.ball.y = cup.y
        this.ball.vx = 0
        this.ball.vy = 0
        // the last hole ends the round at once; the ball still sinks on screen
        if(this.hole === GOLF_HOLES.length - 1) this.finish()
    },
    splash()
    {
        this.popups.push({ x: this.ball.x, y: this.ball.y - 12, t: 1, text: 'splash, +1 stroke', color: palette.cyan })
        // the shot already counted, so the water costs one more stroke and the ball goes back
        this.strokes++
        this.ball = { x: this.lastRest.x, y: this.lastRest.y, vx: 0, vy: 0 }
        this.phase = 'aim'
    },
    roll(dt)
    {
        const hole = GOLF_HOLES[this.hole]
        const b = this.ball
        // small steps, so a fast ball cannot skip over a pond or the cup
        const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 3))
        const sub = dt / steps
        for(let i = 0; i < steps; i++)
        {
            b.x += b.vx * sub
            b.y += b.vy * sub
            golfWalls(b, hole.bounds)
            if(hole.water.some((w) => Math.hypot(b.x - w.x, b.y - w.y) < w.r))
            {
                this.splash()
                return
            }
            const inSand = hole.sand.some((s) => golfInside(s, b.x, b.y))
            const sp = Math.hypot(b.vx, b.vy)
            const next = Math.max(0, sp - (inSand ? GOLF.sand : GOLF.green) * sub)
            if(sp > 0)
            {
                b.vx *= next / sp
                b.vy *= next / sp
            }
            if(Math.hypot(b.x - hole.cup.x, b.y - hole.cup.y) < GOLF.cup && next < GOLF.sink)
            {
                this.holed()
                return
            }
            if(next < 4)
            {
                b.vx = 0
                b.vy = 0
                this.phase = 'aim'
                return
            }
        }
    },
    finish()
    {
        this.status = 'over'
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },

    onPointer(x, y, type)
    {
        if(type === 'down' && this.status === 'playing' && this.phase === 'aim' && Math.hypot(x - this.ball.x, y - this.ball.y) <= GOLF.grab)
        {
            this.drag = { x0: x, y0: y, x, y }
            this.dragPower = 0
            return
        }
        if(!this.drag || (type !== 'move' && type !== 'up')) return
        this.drag.x = x
        this.drag.y = y
        // the shot flies opposite to the pull, and the pull length sets the power
        const dx = this.drag.x0 - x
        const dy = this.drag.y0 - y
        const len = Math.hypot(dx, dy)
        if(len > 2) this.aimAngle = Math.atan2(dy, dx)
        this.dragPower = Math.min(1, len / GOLF.pull)
        if(type === 'up')
        {
            const power = this.dragPower
            this.drag = null
            this.dragPower = 0
            if(power > 0.04) this.shoot(this.aimAngle, power)
        }
    },
    onKey(code, down)
    {
        if(code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') this.held[code] = down
        if(code === 'Space')
        {
            const e = edge(this.held, code, down)
            if(e === 'down' && this.phase === 'aim') this.keyPower = 0
            // the shot goes at the power the meter reached when Space is let go
            if(e === 'up')
            {
                if(this.keyPower > 0.04) this.shoot(this.aimAngle, this.keyPower)
                this.keyPower = 0
            }
        }
        if(down && code === 'Enter' && this.status !== 'playing') this.reset()
    },
    drawAim(ctx, H)
    {
        const b = this.ball
        const power = this.drag ? this.dragPower : this.keyPower
        const dx = Math.cos(this.aimAngle)
        const dy = Math.sin(this.aimAngle)
        // a dotted line in the shot direction, longer with more power
        ctx.strokeStyle = power > 0 ? palette.yellow : 'rgba(255, 246, 236, 0.6)'
        ctx.lineWidth = 2
        ctx.setLineDash([ 3, 5 ])
        ctx.beginPath()
        ctx.moveTo(b.x + dx * 9, b.y + dy * 9)
        ctx.lineTo(b.x + dx * (16 + power * 110), b.y + dy * (16 + power * 110))
        ctx.stroke()
        ctx.setLineDash([])
        if(this.drag)
        {
            ctx.strokeStyle = 'rgba(255, 246, 236, 0.5)'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(this.drag.x0, this.drag.y0)
            ctx.lineTo(this.drag.x, this.drag.y)
            ctx.stroke()
        }
        // the power meter sits in the bottom left corner
        ctx.fillStyle = 'rgba(255, 246, 236, 0.15)'
        ctx.fillRect(18, H - 16, 120, 6)
        ctx.fillStyle = power > 0.75 ? palette.pink : palette.yellow
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 8
        ctx.fillRect(18, H - 16, 120 * power, 6)
        ctx.shadowBlur = 0
    },
    update(dt)
    {
        this.clock += dt
        for(const p of this.popups) { p.t -= dt; p.y -= 26 * dt }
        this.popups = this.popups.filter((p) => p.t > 0)
        // the ball sinks on screen even after the round is over
        if(this.phase === 'sunk')
        {
            this.sinkT += dt
            if(this.status === 'playing' && this.sinkT >= 1.6)
            {
                this.hole++
                this.loadHole()
            }
            return
        }
        if(this.status !== 'playing') return
        if(this.phase === 'aim')
        {
            const turn = (this.held.ArrowRight || this.held.KeyD ? 1 : 0) - (this.held.ArrowLeft || this.held.KeyA ? 1 : 0)
            this.aimAngle += turn * 2.4 * dt
            if(this.held.Space) this.keyPower = Math.min(1, this.keyPower + dt / 1.1)
        }
        else if(this.phase === 'roll') this.roll(dt)
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        const hole = GOLF_HOLES[this.hole]
        const g = hole.bounds
        // the green: a rounded neon shape
        roundRect(ctx, g.x, g.y, g.w, g.h, g.r)
        ctx.fillStyle = 'rgba(28, 92, 88, 0.9)'
        ctx.fill()
        ctx.strokeStyle = palette.mint
        ctx.lineWidth = 2
        ctx.shadowColor = palette.mint
        ctx.shadowBlur = 12
        ctx.stroke()
        ctx.shadowBlur = 0
        for(const s of hole.sand)
        {
            ctx.fillStyle = 'rgba(255, 196, 135, 0.6)'
            if(s.kind === 'circle')
            {
                ctx.beginPath()
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
                ctx.fill()
            }
            else
            {
                roundRect(ctx, s.x, s.y, s.w, s.h, 6)
                ctx.fill()
            }
        }
        for(const w of hole.water)
        {
            ctx.beginPath()
            ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2)
            ctx.fillStyle = '#1E6E9C'
            ctx.shadowColor = palette.cyan
            ctx.shadowBlur = 8
            ctx.fill()
            ctx.shadowBlur = 0
            // a ripple that breathes inside the pond
            ctx.strokeStyle = 'rgba(45, 226, 230, 0.5)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(w.x, w.y, w.r * (0.5 + 0.12 * Math.sin(this.clock * 2.4 + w.x)), 0, Math.PI * 2)
            ctx.stroke()
        }
        // the cup is a dark circle, with a pole and a fluttering pink flag
        const c = hole.cup
        ctx.beginPath()
        ctx.arc(c.x, c.y, GOLF.cup + 1, 0, Math.PI * 2)
        ctx.fillStyle = '#0B0817'
        ctx.fill()
        ctx.strokeStyle = palette.cream
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(c.x, c.y - 28)
        ctx.stroke()
        const wave = Math.sin(this.clock * 4) * 1.5
        ctx.beginPath()
        ctx.moveTo(c.x, c.y - 28)
        ctx.lineTo(c.x + 14, c.y - 23 + wave)
        ctx.lineTo(c.x, c.y - 18)
        ctx.closePath()
        ctx.fillStyle = palette.pink
        ctx.shadowColor = palette.pink
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
        // the ball shrinks into the cup when it sinks
        const b = this.ball
        const shrink = this.phase === 'sunk' ? clamp(1 - this.sinkT / 0.35, 0, 1) : 1
        if(shrink > 0)
        {
            ctx.beginPath()
            ctx.arc(b.x, b.y, GOLF.ball * shrink, 0, Math.PI * 2)
            ctx.fillStyle = palette.cream
            ctx.shadowColor = palette.cream
            ctx.shadowBlur = 6
            ctx.fill()
            ctx.shadowBlur = 0
        }
        if(this.phase === 'aim' && this.status === 'playing') this.drawAim(ctx, H)
        if(this.phase === 'sunk')
        {
            neonText(ctx, this.banner, W / 2, H / 2 - 6, palette.yellow, 24, 'center')
            neonText(ctx, `+${this.lastPts}`, W / 2, H / 2 + 20, palette.cream, 16, 'center')
        }
        if(this.hole === 0 && this.strokes === 0 && this.phase === 'aim' && this.status === 'playing')
            neonText(ctx, 'press the ball and drag back to shoot', W / 2, 44, palette.cream, 13, 'center')
        for(const p of this.popups)
        {
            ctx.globalAlpha = Math.min(1, p.t * 2)
            neonText(ctx, p.text, p.x, p.y, p.color, 16, 'center')
        }
        ctx.globalAlpha = 1
        neonText(ctx, `hole ${this.hole + 1} of ${GOLF_HOLES.length}  ·  par ${GOLF.par}  ·  stroke ${this.strokes}`, W / 2, 20, palette.cream, 14, 'center')
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
    },
    gameOver: 'Clubhouse closes, nice round'
}

// ------------------------------------------------------------------ 10. Shell Match
// A 7 x 7 board of shells, clams and fish. Swap two neighbours to line up three or more.
// Matches pop, the tiles above drop in, and each chain step pays more than the last.
const SHELL = { n: 7, kinds: 5, cell: 34, x0: 121, y0: 52, moves: 25, slide: 0.12, pop: 0.22, fall: 0.22 }
const SHELL_COLORS = [ palette.pink, palette.cyan, palette.yellow, palette.mint, palette.orange ]
const SHELL_STEPS = { ArrowLeft: [ 0, -1 ], ArrowRight: [ 0, 1 ], ArrowUp: [ -1, 0 ], ArrowDown: [ 1, 0 ], KeyA: [ 0, -1 ], KeyD: [ 0, 1 ], KeyW: [ -1, 0 ], KeyS: [ 1, 0 ] }

// A board-sized grid filled with one value.
function shellGrid(v)
{
    return Array.from({ length: SHELL.n }, () => Array(SHELL.n).fill(v))
}

function shellAdjacent(a, b)
{
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1
}

// A copy of the grid with two neighbouring cells swapped.
function shellSwapped(grid, a, b)
{
    const g = grid.map((row) => row.slice())
    g[a.r][a.c] = grid[b.r][b.c]
    g[b.r][b.c] = grid[a.r][a.c]
    return g
}

// Marks every tile that sits in a run of three or more, across or down. Empty cells are -1.
export function shellMatches(grid)
{
    const n = SHELL.n
    const hit = shellGrid(false)
    for(let r = 0; r < n; r++)
        for(let c = 0; c < n;)
        {
            let e = c
            while(e + 1 < n && grid[r][e + 1] === grid[r][c]) e++
            if(grid[r][c] >= 0 && e - c >= 2) for(let k = c; k <= e; k++) hit[r][k] = true
            c = e + 1
        }
    for(let c = 0; c < n; c++)
        for(let r = 0; r < n;)
        {
            let e = r
            while(e + 1 < n && grid[e + 1][c] === grid[r][c]) e++
            if(grid[r][c] >= 0 && e - r >= 2) for(let k = r; k <= e; k++) hit[k][c] = true
            r = e + 1
        }
    let count = 0
    for(const row of hit) for(const h of row) if(h) count++
    return { hit, count }
}

// A swap is valid only when it makes a line through one of the two tiles it moved.
export function shellValidSwap(grid, a, b)
{
    if(!shellAdjacent(a, b) || grid[a.r][a.c] < 0 || grid[b.r][b.c] < 0) return false
    const { hit } = shellMatches(shellSwapped(grid, a, b))
    return hit[a.r][a.c] || hit[b.r][b.c]
}

export function shellHasMove(grid)
{
    const n = SHELL.n
    for(let r = 0; r < n; r++)
        for(let c = 0; c < n; c++)
            if((c + 1 < n && shellValidSwap(grid, { r, c }, { r, c: c + 1 })) || (r + 1 < n && shellValidSwap(grid, { r, c }, { r: r + 1, c }))) return true
    return false
}

// The kinds that will not complete a run of three for a tile at (r, c). Only the two cells
// to the left and above are looked at, since the board is filled from the top left.
function shellFreeKinds(grid, r, c)
{
    const banned = []
    if(c >= 2 && grid[r][c - 1] === grid[r][c - 2]) banned.push(grid[r][c - 1])
    if(r >= 2 && grid[r - 1][c] === grid[r - 2][c]) banned.push(grid[r - 1][c])
    const free = []
    for(let k = 0; k < SHELL.kinds; k++) if(!banned.includes(k)) free.push(k)
    return free
}

// A new board with no line of three already on it and at least one valid move.
export function shellMakeBoard(rand = Math.random)
{
    for(;;)
    {
        const g = shellGrid(-1)
        for(let r = 0; r < SHELL.n; r++)
            for(let c = 0; c < SHELL.n; c++)
            {
                const free = shellFreeKinds(g, r, c)
                g[r][c] = free[Math.floor(rand() * free.length)]
            }
        if(shellHasMove(g)) return g
    }
}

// Shuffles the tiles of a board that has no move left. The kinds stay the same, and the
// result never has a line of three or a dead end. Falls back to a fresh board.
export function shellShuffle(grid, rand = Math.random)
{
    const n = SHELL.n
    const kinds = grid.flat()
    for(let tries = 0; tries < 200; tries++)
    {
        const k = kinds.slice()
        for(let i = k.length - 1; i > 0; i--)
        {
            const j = Math.floor(rand() * (i + 1))
            const t = k[i]
            k[i] = k[j]
            k[j] = t
        }
        const g = Array.from({ length: n }, (_, r) => k.slice(r * n, r * n + n))
        if(!shellMatches(g).count && shellHasMove(g)) return g
    }
    return shellMakeBoard(rand)
}

// Drops the tiles that are left to the bottom of each column and refills the top with new
// ones. offsets gives how far each tile has to travel, in cells, so it can be animated.
export function shellCollapse(grid, rand = Math.random)
{
    const n = SHELL.n
    const out = shellGrid(-1)
    const lift = shellGrid(0)
    for(let c = 0; c < n; c++)
    {
        let r = n - 1
        for(let from = n - 1; from >= 0; from--)
        {
            if(grid[from][c] < 0) continue
            out[r][c] = grid[from][c]
            lift[r][c] = r - from
            r--
        }
        // the new tiles start above the board, one row for each of them
        const fresh = r + 1
        for(; r >= 0; r--)
        {
            out[r][c] = Math.floor(rand() * SHELL.kinds)
            lift[r][c] = fresh
        }
    }
    return { grid: out, offsets: lift }
}

// One tile in its cell. Shells and fish are simple neon shapes, one colour per kind.
function drawShellTile(ctx, x, y, size, kind, scale = 1)
{
    const cx = x + size / 2
    const cy = y + size / 2
    const s = (size / 2 - 6) * scale
    const color = SHELL_COLORS[kind]
    roundRect(ctx, x + 3, y + 3, size - 6, size - 6, 8)
    ctx.fillStyle = 'rgba(255, 246, 236, 0.07)'
    ctx.fill()
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    if(kind === 0)
    {
        // a scallop: a fan with ridges
        ctx.beginPath()
        ctx.moveTo(cx, cy + s * 0.5)
        ctx.arc(cx, cy + s * 0.5, s * 1.1, Math.PI * 1.15, Math.PI * 1.85)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = palette.night
        ctx.lineWidth = 1
        ctx.beginPath()
        for(const a of [ 1.3, 1.5, 1.7 ])
        {
            ctx.moveTo(cx, cy + s * 0.5)
            ctx.lineTo(cx + Math.cos(a * Math.PI) * s * 1.1, cy + s * 0.5 + Math.sin(a * Math.PI) * s * 1.1)
        }
        ctx.stroke()
    }
    else if(kind === 1)
    {
        // a fish with a fork tail and an eye
        ctx.beginPath()
        ctx.ellipse(cx + s * 0.15, cy, s * 0.8, s * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(cx - s * 0.55, cy)
        ctx.lineTo(cx - s * 1.25, cy - s * 0.55)
        ctx.lineTo(cx - s * 1.25, cy + s * 0.55)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = palette.night
        ctx.beginPath()
        ctx.arc(cx + s * 0.5, cy - s * 0.12, Math.max(1, s * 0.1), 0, Math.PI * 2)
        ctx.fill()
    }
    else if(kind === 2)
    {
        // a starfish: five points
        ctx.beginPath()
        for(let i = 0; i < 10; i++)
        {
            const a = -Math.PI / 2 + (i * Math.PI) / 5
            const rr = i % 2 ? s * 0.45 : s
            if(i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
            else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
        }
        ctx.closePath()
        ctx.fill()
    }
    else if(kind === 3)
    {
        // a clam: a lens shape with its hinge line
        ctx.beginPath()
        ctx.ellipse(cx, cy, s * 0.95, s * 0.7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = palette.night
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(cx, cy - s * 0.7)
        ctx.quadraticCurveTo(cx + s * 0.25, cy, cx, cy + s * 0.7)
        ctx.stroke()
    }
    else
    {
        // a conch: a curved horn with a whorl at the tip
        ctx.lineWidth = Math.max(3, s * 0.45)
        ctx.beginPath()
        ctx.moveTo(cx - s * 0.8, cy + s * 0.7)
        ctx.quadraticCurveTo(cx + s * 1.0, cy + s * 0.6, cx + s * 0.55, cy - s * 0.9)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.strokeStyle = palette.night
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(cx + s * 0.55, cy - s * 0.9, s * 0.25, 0, Math.PI * 2)
        ctx.stroke()
    }
    ctx.shadowBlur = 0
}

export const shellMatch = {
    id: 'shell-match',
    title: 'Shell Match',
    blurb: 'Swap neighbouring shells and fish to line up three. Chains pay more, and you get 25 moves.',
    controls: 'Click or drag a tile onto a neighbour. Arrows and Space also work',
    reset()
    {
        this.grid = shellMakeBoard()
        this.score = 0
        this.moves = SHELL.moves
        this.status = 'playing'
        this.best = loadBest(this.id)
        // idle: waiting for a swap. slide, pop and fall: the board is busy and takes no input.
        this.phase = 'idle'
        this.timer = 0
        this.chain = 0
        this.offX = shellGrid(0)
        this.offY = shellGrid(0)
        this.pops = []
        this.popups = []
        this.bump = null
        this.drag = null
        this.sel = null
        this.cursor = { r: 3, c: 3 }
        this.keyUsed = false
        this.held = {}
        this.clock = 0
    },
    cellAt(x, y)
    {
        const c = Math.floor((x - SHELL.x0) / SHELL.cell)
        const r = Math.floor((y - SHELL.y0) / SHELL.cell)
        if(r < 0 || c < 0 || r >= SHELL.n || c >= SHELL.n) return null
        return { r, c }
    },
    attempt(a, b)
    {
        this.sel = null
        if(this.status !== 'playing' || this.phase !== 'idle') return
        if(!shellValidSwap(this.grid, a, b))
        {
            // no line would form, so the tile shakes and no move is used
            this.bump = { r: a.r, c: a.c, t: 0.3 }
            return
        }
        this.grid = shellSwapped(this.grid, a, b)
        // the two tiles slide into each other's places
        this.offX[b.r][b.c] = b.c - a.c
        this.offY[b.r][b.c] = b.r - a.r
        this.offX[a.r][a.c] = a.c - b.c
        this.offY[a.r][a.c] = a.r - b.r
        this.moves--
        this.chain = 0
        this.phase = 'slide'
        this.timer = SHELL.slide
    },
    // Looks for lines on the board. A line pops and scores, and a line that appears after a
    // fall is the next chain step. An empty board moves on to the end of the turn.
    resolve()
    {
        const m = shellMatches(this.grid)
        if(!m.count)
        {
            this.endTurn()
            return
        }
        this.chain++
        const pts = 10 * m.count * this.chain
        this.score += pts
        let sx = 0
        let sy = 0
        for(let r = 0; r < SHELL.n; r++)
            for(let c = 0; c < SHELL.n; c++)
            {
                if(!m.hit[r][c]) continue
                this.pops.push({ r, c, kind: this.grid[r][c], t: SHELL.pop })
                sx += SHELL.x0 + (c + 0.5) * SHELL.cell
                sy += SHELL.y0 + (r + 0.5) * SHELL.cell
                this.grid[r][c] = -1
            }
        this.popups.push({ x: sx / m.count, y: sy / m.count, t: 0.8, text: `+${pts}`, color: palette.yellow })
        this.phase = 'pop'
        this.timer = SHELL.pop
    },
    collapse()
    {
        const res = shellCollapse(this.grid)
        this.grid = res.grid
        this.offX = shellGrid(0)
        this.offY = res.offsets
        this.phase = 'fall'
        this.timer = SHELL.fall
    },
    endTurn()
    {
        this.chain = 0
        this.phase = 'idle'
        // a board with no move left is shuffled before play goes on
        if(!shellHasMove(this.grid))
        {
            this.grid = shellShuffle(this.grid)
            this.offX = shellGrid(0)
            this.offY = shellGrid(0)
            this.popups.push({ x: BOARD.W / 2, y: 150, t: 1, text: 'the shells reshuffle', color: palette.cyan })
        }
        if(this.moves <= 0) this.finish()
    },
    finish()
    {
        this.status = 'over'
        if(this.score > this.best) { this.best = this.score; saveBest(this.id, this.best) }
    },

    onPointer(x, y, type)
    {
        if(this.status !== 'playing') return
        const cell = this.cellAt(x, y)
        if(type === 'down')
        {
            if(!cell || this.phase !== 'idle') return
            this.drag = { origin: cell, used: false }
        }
        else if(type === 'move')
        {
            // a drag swaps as soon as it reaches a neighbour of the tile it started on
            if(!this.drag || this.drag.used || !cell || !shellAdjacent(this.drag.origin, cell)) return
            this.drag.used = true
            this.attempt(this.drag.origin, cell)
        }
        else if(type === 'up')
        {
            const d = this.drag
            this.drag = null
            if(!d || d.used || !cell) return
            if(cell.r === d.origin.r && cell.c === d.origin.c)
            {
                // a click selects a tile, and a second click on a neighbour swaps them
                if(this.sel && shellAdjacent(this.sel, cell)) this.attempt(this.sel, cell)
                else this.sel = this.sel && this.sel.r === cell.r && this.sel.c === cell.c ? null : cell
            }
            else if(shellAdjacent(d.origin, cell)) this.attempt(d.origin, cell)
        }
    },
    onKey(code, down)
    {
        const e = SHELL_STEPS[code] || code === 'Space' ? edge(this.held, code, down) : null
        if(e === 'down' && this.status === 'playing')
        {
            this.keyUsed = true
            if(code === 'Space')
            {
                const cur = { r: this.cursor.r, c: this.cursor.c }
                if(!this.sel) this.sel = cur
                else if(shellAdjacent(this.sel, cur)) this.attempt(this.sel, cur)
                else this.sel = cur
            }
            else
            {
                const step = SHELL_STEPS[code]
                this.cursor = { r: clamp(this.cursor.r + step[0], 0, SHELL.n - 1), c: clamp(this.cursor.c + step[1], 0, SHELL.n - 1) }
            }
        }
        if(down && code === 'Enter' && this.status !== 'playing') this.reset()
    },
    update(dt)
    {
        this.clock += dt
        // the offsets ease back to zero, so a tile slides or falls into its cell
        const k = Math.exp(-dt * 22)
        for(let r = 0; r < SHELL.n; r++)
            for(let c = 0; c < SHELL.n; c++)
            {
                this.offX[r][c] *= k
                this.offY[r][c] *= k
                if(Math.abs(this.offX[r][c]) < 0.002) this.offX[r][c] = 0
                if(Math.abs(this.offY[r][c]) < 0.002) this.offY[r][c] = 0
            }
        for(const p of this.pops) p.t -= dt
        this.pops = this.pops.filter((p) => p.t > 0)
        for(const p of this.popups) { p.t -= dt; p.y -= 26 * dt }
        this.popups = this.popups.filter((p) => p.t > 0)
        if(this.bump)
        {
            this.bump.t -= dt
            if(this.bump.t <= 0) this.bump = null
        }
        if(this.phase === 'idle' || this.status !== 'playing') return
        this.timer -= dt
        if(this.timer > 0) return
        if(this.phase === 'pop') this.collapse()
        else this.resolve()
    },
    draw(ctx, W, H)
    {
        background(ctx, W, H)
        const size = SHELL.n * SHELL.cell
        const x0 = SHELL.x0
        const y0 = SHELL.y0
        roundRect(ctx, x0 - 5, y0 - 5, size + 10, size + 10, 12)
        ctx.fillStyle = 'rgba(27, 21, 48, 0.55)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(45, 226, 230, 0.3)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        // falling tiles start above the tray, so the tray clips them
        ctx.save()
        ctx.beginPath()
        ctx.rect(x0, y0, size, size)
        ctx.clip()
        for(let r = 0; r < SHELL.n; r++)
            for(let c = 0; c < SHELL.n; c++)
            {
                const v = this.grid[r][c]
                if(v < 0) continue
                let x = x0 + (c - this.offX[r][c]) * SHELL.cell
                const y = y0 + (r - this.offY[r][c]) * SHELL.cell
                if(this.bump && this.bump.r === r && this.bump.c === c) x += Math.sin(this.bump.t * 70) * 3
                drawShellTile(ctx, x, y, SHELL.cell, v, 1)
            }
        for(const p of this.pops)
        {
            const k = Math.max(0, p.t / SHELL.pop)
            ctx.globalAlpha = k
            drawShellTile(ctx, x0 + p.c * SHELL.cell, y0 + p.r * SHELL.cell, SHELL.cell, p.kind, 1 + (1 - k) * 0.4)
        }
        ctx.globalAlpha = 1
        ctx.restore()
        const ring = (cell, color) =>
        {
            roundRect(ctx, x0 + cell.c * SHELL.cell + 2, y0 + cell.r * SHELL.cell + 2, SHELL.cell - 4, SHELL.cell - 4, 9)
            ctx.strokeStyle = color
            ctx.lineWidth = 2
            ctx.stroke()
        }
        if(this.sel) ring(this.sel, palette.cream)
        if(this.keyUsed) ring(this.cursor, 'rgba(255, 246, 236, 0.45)')
        for(const p of this.popups)
        {
            ctx.globalAlpha = Math.min(1, p.t * 2)
            neonText(ctx, p.text, p.x, p.y, p.color, 16, 'center')
        }
        ctx.globalAlpha = 1
        if(this.chain > 1 && this.phase !== 'idle') neonText(ctx, `chain x${this.chain}`, W / 2, 38, palette.pink, 14, 'center')
        neonText(ctx, `moves ${this.moves}`, W / 2, 20, palette.cream, 16, 'center')
        neonText(ctx, `${this.score}`, W - 18, 20, palette.yellow, 26, 'right')
        neonText(ctx, `best ${this.best}`, 18, 20, palette.cream, 14)
    },
    gameOver: 'The tide is out of moves'
}

export const GAMES = [ stackTower, coinCatch, neonBounce, chaiClicker, laneRacer, palmMerge, islandFishing, pilotHop, islandGolf, shellMatch ]
