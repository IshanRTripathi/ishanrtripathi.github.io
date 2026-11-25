import { GAMES, BOARD } from '../arcade/games.js'

// The arcade hall: a game-select screen, then the chosen game on a neon board.
// It opens over the city when you go in through the arcade's door, and closes
// back to the street. Everything is built in the DOM, so there is no extra
// markup in the page.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export class ArcadeHall
{
    constructor({ onClose } = {})
    {
        this.onClose = onClose
        this.open_ = false
        this.game = null
        this.root = document.createElement('div')
        this.root.className = 'arcade'
        this.root.hidden = true
        this.root.setAttribute('role', 'dialog')
        this.root.setAttribute('aria-modal', 'true')
        this.root.setAttribute('aria-labelledby', 'arcade-title')
        this.root.innerHTML = `
            <div class="arcade-backdrop"></div>
            <div class="arcade-panel" tabindex="-1">
                <header class="arcade-head">
                    <h2 id="arcade-title" class="arcade-title">Game Arcade</h2>
                    <button type="button" class="arcade-close" data-arcade="close">Leave the arcade</button>
                </header>
                <div class="arcade-body"></div>
            </div>`
        document.body.appendChild(this.root)
        this.body = this.root.querySelector('.arcade-body')
        this.panel = this.root.querySelector('.arcade-panel')
        this.root.addEventListener('click', (e) =>
        {
            const btn = e.target.closest('[data-arcade]')
            if(!btn) return
            const action = btn.dataset.arcade
            if(action === 'close') this.close()
            else if(action === 'back') this.menu()
            else if(action === 'play') this.play(btn.dataset.id)
            else if(action === 'again') this.game && this.game.reset()
        })
        window.addEventListener('keydown', (e) => this.onKey(e, true))
        window.addEventListener('keyup', (e) => this.onKey(e, false))
    }

    get isOpen() { return this.open_ }

    open()
    {
        this.open_ = true
        this.root.hidden = false
        this.menu()
        this.panel.focus({ preventScroll: true })
    }

    close()
    {
        if(!this.open_) return
        this.open_ = false
        this.root.hidden = true
        this.stop()
        this.onClose?.()
    }

    menu()
    {
        this.stop()
        this.game = null
        this.body.innerHTML = `
            <p class="arcade-intro">Pick a game. Your best scores stay on this device.</p>
            <ul class="arcade-games">
                ${GAMES.map((g) => `
                    <li><button type="button" class="arcade-game" data-arcade="play" data-id="${esc(g.id)}">
                        <span class="arcade-game-title">${esc(g.title)}</span>
                        <span class="arcade-game-blurb">${esc(g.blurb)}</span>
                        <span class="arcade-game-controls">${esc(g.controls)}</span>
                    </button></li>`).join('')}
            </ul>`
        this.body.querySelector('.arcade-game')?.focus({ preventScroll: true })
    }

    play(id)
    {
        const game = GAMES.find((g) => g.id === id)
        if(!game) return
        this.game = game
        this.body.innerHTML = `
            <div class="arcade-play">
                <div class="arcade-bar">
                    <button type="button" class="arcade-back" data-arcade="back">All games</button>
                    <span class="arcade-name">${esc(game.title)}</span>
                    <button type="button" class="arcade-again" data-arcade="again">Restart</button>
                </div>
                <div class="arcade-board"><canvas class="arcade-canvas" width="${BOARD.W * 2}" height="${BOARD.H * 2}" aria-label="${esc(game.title)}"></canvas>
                    <p class="arcade-over" hidden></p>
                </div>
                <p class="arcade-help">${esc(game.controls)}</p>
            </div>`
        this.canvas = this.body.querySelector('.arcade-canvas')
        this.ctx = this.canvas.getContext('2d')
        this.overEl = this.body.querySelector('.arcade-over')
        game.reset()
        this.bindBoard()
        this.last = performance.now()
        this.raf = requestAnimationFrame((t) => this.frame(t))
    }

    bindBoard()
    {
        const point = (e, type) =>
        {
            if(!this.game) return
            const r = this.canvas.getBoundingClientRect()
            const x = (e.clientX - r.left) / r.width * BOARD.W
            const y = (e.clientY - r.top) / r.height * BOARD.H
            this.game.onPointer?.(x, y, type)
            if(type === 'down') e.preventDefault()
        }
        this.canvas.addEventListener('pointerdown', (e) => { try { this.canvas.setPointerCapture(e.pointerId) } catch {} point(e, 'down') })
        this.canvas.addEventListener('pointermove', (e) => { if(e.buttons) point(e, 'move') })
        this.canvas.addEventListener('pointerup', (e) => point(e, 'up'))
    }

    frame(now)
    {
        if(!this.game || !this.canvas) return
        const dt = Math.min(0.05, (now - this.last) / 1000)
        this.last = now
        const g = this.game
        g.update(dt)
        const ctx = this.ctx
        ctx.setTransform(2, 0, 0, 2, 0, 0)
        ctx.clearRect(0, 0, BOARD.W, BOARD.H)
        g.draw(ctx, BOARD.W, BOARD.H)
        if(g.status === 'over')
        {
            this.overEl.hidden = false
            this.overEl.textContent = `${g.gameOver}. Score ${g.score}. Press Enter or Restart to play again.`
        }
        else this.overEl.hidden = true
        this.raf = requestAnimationFrame((t) => this.frame(t))
    }

    stop()
    {
        if(this.raf) cancelAnimationFrame(this.raf)
        this.raf = null
    }

    onKey(e, down)
    {
        if(!this.open_) return
        if(e.code === 'Escape' && down)
        {
            if(this.game) this.menu()
            else this.close()
            e.preventDefault()
            return
        }
        // the games take the arrows and space; the rest of the city is paused
        if(this.game) this.game.onKey?.(e.code, down)
        if(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault()
    }
}
