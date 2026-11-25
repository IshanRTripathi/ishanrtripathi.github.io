import { person, links, projects, achievements, career, contact, credits } from '../content.js'

// Everything outside the canvas: title, HUD, briefing cards, the phone, the
// page view and touch controls.

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const APP_COLORS = { Email: '#FF8C42', LinkedIn: '#2F6FD6', GitHub: '#2B2D31', X: '#111111', YouTube: '#E0483D' }

export class UI
{
    constructor({ onExplore, onClose, onSound, onPrompt, isTouch })
    {
        this.body = document.body
        this.isTouch = isTouch
        if(isTouch) this.body.classList.add('is-touch')
        this.$ = (s) => document.querySelector(s)

        this.$('[data-content="intro"]').textContent = person.intro

        this.explore = this.$('[data-action="explore"]')
        this.explore.addEventListener('click', () => onExplore())

        this.hudTop = this.$('.hud-top')
        this.help = this.$('.hud-help')
        this.progress = this.$('.hud-progress')
        this.minimapEl = this.$('.minimap')
        this.minimapCanvas = this.$('.minimap-canvas')
        this.nextEl = this.$('.minimap-next')
        // the minimap is a way into the city map: tap it, or press Enter when it has focus
        this.minimapEl.setAttribute('role', 'button')
        this.minimapEl.setAttribute('tabindex', '0')
        this.minimapEl.setAttribute('aria-label', 'Open the city map')
        this.prompt = this.$('.prompt')
        this.promptKey = this.$('.prompt-key')
        this.promptLabel = this.$('.prompt-label')
        this.prompt.addEventListener('click', () => onPrompt())
        this.area = this.$('.area')
        this.islandTip = this.$('.island-tip')
        this.fadeEl = this.$('.fade')
        this.touch = this.$('.touch')
        this.onClose = onClose

        if(isTouch)
        {
            this.minimapCanvas.width = 128
            this.minimapCanvas.height = 128
        }

        this.soundButton = this.$('[data-action="sound"]')
        this.soundButton.addEventListener('click', () =>
        {
            const on = this.soundButton.getAttribute('aria-pressed') !== 'true'
            this.soundButton.setAttribute('aria-pressed', String(on))
            this.soundButton.textContent = on ? 'Sound on' : 'Sound off'
            onSound(on)
        })

        // briefing card
        this.cardLayer = this.$('.card-layer')
        this.card = this.$('.card')
        this.cardLayer.addEventListener('click', (e) => { if(e.target.closest('[data-action="close"]')) this.closeCard() })

        // the map, the plane's tips and how-to-fly
        this.$('[data-action="map"]').addEventListener('click', () => this.onMap?.())
        this.minimapEl.addEventListener('click', () => this.onMap?.())
        this.minimapEl.addEventListener('keydown', (e) => { if(e.key === 'Enter') this.onMap?.() })
        document.querySelectorAll('[data-flight-tips]').forEach((b) => b.addEventListener('click', () => this.showFlightTips(b.dataset.flightTips === 'show')))

        // phone
        this.phoneLayer = this.$('.phone-layer')
        this.phoneView = this.$('.phone-view')
        this.$('[data-action="phone"]').addEventListener('click', () => this.togglePhone())
        this.phoneLayer.addEventListener('click', (e) =>
        {
            if(e.target.closest('[data-action="close-phone"]')) this.closePhone()
            const open = e.target.closest('[data-phone]')
            if(open) this.phoneScreen(open.dataset.phone)
        })

        // page view
        this.pageLayer = this.$('.page-layer')
        this.renderPage()
        document.querySelectorAll('[data-action="page"]').forEach((b) => b.addEventListener('click', () => this.openPage()))
        this.$('[data-action="close-page"]').addEventListener('click', () => this.closePage())

        window.addEventListener('keydown', (e) =>
        {
            if(e.key === 'Escape')
            {
                if(!this.cardLayer.hidden) this.closeCard()
                else if(!this.phoneLayer.hidden) this.closePhone()
                else if(!this.pageLayer.hidden) this.closePage()
            }
            if(e.key === 'Tab') this.trapFocus(e)
        })
        this.lastFocus = null
    }

    get modalOpen()
    {
        return !this.cardLayer.hidden || !this.pageLayer.hidden || !this.phoneLayer.hidden || !!this.externalModal?.()
    }

    // ---------------------------------------------------------------- the plane
    // the flight readout at the top of the screen, while you are in the plane
    setFlight(f)
    {
        const el = this.$('.flight-hud')
        if(!el) return
        if(!f)
        {
            el.hidden = true
            return
        }
        el.hidden = false
        el.classList.remove('is-chute')
        this.$('[data-flight="speed"]').textContent = String(f.speedKmh)
        this.$('[data-flight="alt"]').textContent = String(f.altitude)
        this.$('.flight-throttle-fill').style.transform = `scaleX(${f.throttle.toFixed(2)})`
        const hint = this.flightTip(f)
        if(this.flightHint !== hint)
        {
            this.flightHint = hint
            this.$('.flight-hint').textContent = hint
        }
    }

    // the readout while under the parachute: height, and how to steer
    setChute(c)
    {
        const el = this.$('.flight-hud')
        if(!el) return
        if(!c)
        {
            el.hidden = true
            return
        }
        el.hidden = false
        el.classList.add('is-chute')
        this.$('[data-flight="speed"]').textContent = '–'
        this.$('[data-flight="alt"]').textContent = String(Math.max(0, Math.round(c.h)))
        this.$('.flight-throttle-fill').style.transform = 'scaleX(0)'
        const hint = c.open < 1 ? 'Parachute opening' : 'A and D steer. W slows the fall, S dives'
        if(this.flightHint !== hint)
        {
            this.flightHint = hint
            this.$('.flight-hint').textContent = hint
        }
    }

    // what to do next, from where the plane is: the hint changes as you take off, fly and land
    flightTip(f)
    {
        if(f.hintTime > 0) return f.hint
        if(!f.onGround)
        {
            if(f.h < 40 && f.vy < -1.5) return 'Landing: ease off with F, level the nose, and line up with the strip'
            return 'In the air. W climbs, S levels off, A and D bank'
        }
        if(f.v < 1) return 'Hold R to add power. The plane lifts off at about 80 km/h'
        if(f.v < 21.5) return `Keep holding R: ${f.speedKmh} km/h, about 80 to lift off`
        if(f.pitch < 0.07) return 'Now push W to lift the nose'
        return 'Pulling up'
    }

    // the how-to card, shown when you climb in and hidden again after a while
    showFlightTips(on)
    {
        const el = this.$('.flight-tips')
        if(!el) return
        clearTimeout(this.flightTipsTimer)
        el.hidden = !on
        if(on) this.flightTipsTimer = setTimeout(() => { el.hidden = true }, 45000)
    }

    // a tip above the plane while you stand next to it: at is the plane's place on screen, or null
    setPlaneTip(at)
    {
        const el = this.$('.plane-tip')
        if(!el) return
        if(!at)
        {
            el.hidden = true
            return
        }
        el.hidden = false
        el.style.left = `${at.x}px`
        el.style.top = `${at.y}px`
    }

    // the throttle buttons on a touch screen: hold to change the power
    bindThrottle(input)
    {
        for(const btn of document.querySelectorAll('[data-throttle]'))
        {
            const dir = btn.dataset.throttle === 'up' ? 1 : -1
            const release = () => { input.throttleHold = 0 }
            btn.addEventListener('pointerdown', (e) => { e.preventDefault(); input.throttleHold = dir; btn.setPointerCapture?.(e.pointerId) })
            btn.addEventListener('pointerup', release)
            btn.addEventListener('pointercancel', release)
            btn.addEventListener('lostpointercapture', release)
        }
    }

    ready()
    {
        this.explore.disabled = false
        this.explore.querySelector('.button-label').textContent = 'Explore the city'
    }

    enterWorld()
    {
        this.body.classList.remove('is-title')
        this.explore.blur()
    }

    showHud()
    {
        this.hudTop.hidden = false
        this.help.hidden = false
        this.minimapEl.hidden = false
        if(this.isTouch) this.touch.hidden = false
    }

    fadeHelp()
    {
        if(!this.help.classList.contains('is-faded')) this.help.classList.add('is-faded')
    }

    setProgress(seen, total)
    {
        const text = seen >= total ? `Seen everything. <strong>${seen}/${total}</strong>` : `Stops seen <strong>${seen}/${total}</strong>`
        if(this.progress.innerHTML !== text) this.progress.innerHTML = text
    }

    setNext(text)
    {
        if(this.nextEl.textContent !== text) this.nextEl.textContent = text
    }

    setPrompt(key, label)
    {
        if(!label || this.modalOpen)
        {
            this.prompt.hidden = true
            return
        }
        this.prompt.hidden = false
        this.promptKey.textContent = key
        this.promptLabel.textContent = label
    }

    // inside a building the city's map and its "next stop" line are hidden
    setInside(on)
    {
        document.body.classList.toggle('in-room', !!on)
    }

    // the screen goes dark (true) or comes back (false), for going in and out of buildings
    fade(on)
    {
        this.fadeEl.classList.toggle('is-on', !!on)
    }

    // the name of an island, under the pointer on the landing screen; a touch shows it for a moment
    showIslandTip(name, sub, x, y, touch = false)
    {
        const tip = this.islandTip
        tip.querySelector('.island-tip-name').textContent = name
        tip.querySelector('.island-tip-sub').textContent = sub
        // beside the pointer, kept on screen
        const left = Math.min(x + 16, window.innerWidth - 256)
        tip.style.left = `${Math.max(8, left)}px`
        tip.style.top = `${Math.max(8, y + 16)}px`
        tip.classList.add('is-visible')
        tip.setAttribute('aria-hidden', 'false')
        clearTimeout(this.islandTipTimer)
        if(touch) this.islandTipTimer = setTimeout(() => this.hideIslandTip(), 2600)
    }

    hideIslandTip()
    {
        clearTimeout(this.islandTipTimer)
        this.islandTip.classList.remove('is-visible')
        this.islandTip.setAttribute('aria-hidden', 'true')
    }

    showArea(name, sub = '')
    {
        clearTimeout(this.areaTimer)
        this.area.querySelector('.area-name').textContent = name
        this.area.querySelector('.area-sub').textContent = sub
        this.area.classList.add('is-visible')
        this.areaTimer = setTimeout(() => this.area.classList.remove('is-visible'), 2600)
    }

    // ---------------------------------------------------------------- briefing cards
    openCard(content, { index = null, total = null } = {})
    {
        this.lastFocus = document.activeElement
        this.closePhone(false)
        const C = this.card
        const kicker = index !== null ? `Project ${index + 1} of ${total}` : content.place
        C.querySelector('.card-kicker').textContent = kicker
        C.querySelector('.card-title').textContent = content.title
        C.querySelector('.card-line').textContent = content.line

        const body = C.querySelector('.card-content')
        const link = C.querySelector('.card-link')
        let html = ''
        let primary = null
        if(content.id === 'career')
        {
            html += this.careerList()
            const linkedin = links.find((l) => l.label === 'LinkedIn')
            primary = { href: linkedin.href, label: 'See it on LinkedIn' }
        }
        else if(content.id === 'achievements')
        {
            html += `<p>${escape(content.body)}</p>`
            html += '<ul class="card-list">' + content.items.map((i) => `<li><strong>${escape(i.title)}</strong><span class="when">${escape(i.detail)}</span></li>`).join('') + '</ul>'
        }
        else if(content.id === 'contact')
        {
            html += `<p>${escape(content.body)}</p>`
            html += this.linkList()
            primary = { href: links[0].href, label: 'Write to me' }
        }
        else
        {
            html += `<p>${escape(content.body)}</p>`
            html += `<dl class="card-facts"><dt>My role</dt><dd>${escape(content.role)}</dd><dt>Built with</dt><dd>${content.stack.map(escape).join(', ')}</dd></dl>`
            if(content.url) primary = { href: content.url, label: `Open ${content.title}` }
        }
        body.innerHTML = html
        if(primary)
        {
            link.hidden = false
            link.href = primary.href
            link.querySelector('.button-label').textContent = primary.label
            if(primary.href.startsWith('mailto:')) link.removeAttribute('target')
            else link.setAttribute('target', '_blank')
        }
        else link.hidden = true

        this.prompt.hidden = true
        this.cardLayer.hidden = false
        this.cardLayer.classList.remove('is-opening')
        void this.cardLayer.offsetWidth
        this.cardLayer.classList.add('is-opening')
        C.scrollTop = 0
        C.focus({ preventScroll: true })
    }

    closeCard()
    {
        if(this.cardLayer.hidden) return
        this.cardLayer.hidden = true
        this.restoreFocus()
        this.onClose?.()
    }

    careerList()
    {
        return '<ul class="card-list">' + career.stops.map((s) => `
            <li><strong><a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.place)}</a></strong><span class="when">${escape(s.when)}</span>
            <span class="note">${escape(s.role)}. ${escape(s.note)}</span></li>`).join('') + '</ul>'
    }

    linkList()
    {
        return '<ul class="card-list">' + links.map((l) => `<li><span>${escape(l.label)}</span><a class="when" href="${escape(l.href)}" ${l.href.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener"'}>${escape(l.text)}</a></li>`).join('') + '</ul>'
    }

    // ---------------------------------------------------------------- phone
    togglePhone()
    {
        if(this.phoneLayer.hidden) this.openPhone()
        else this.closePhone()
    }

    openPhone(screen = 'home')
    {
        this.lastFocus = document.activeElement
        this.closeCard()
        this.phoneLayer.hidden = false
        this.phoneScreen(screen)
        // the phone shows the time in the city
        const now = new Date()
        this.$('.phone-clock').textContent = this.sky ? this.sky.state().clock : `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
        this.prompt.hidden = true
        this.$('.phone').focus({ preventScroll: true })
    }

    closePhone(notify = true)
    {
        if(this.phoneLayer.hidden) return
        this.phoneLayer.hidden = true
        if(notify)
        {
            this.restoreFocus()
            this.onClose?.()
        }
    }

    phoneScreen(name)
    {
        const back = '<button class="phone-back" type="button" data-phone="home">Back</button>'
        let html = ''
        if(name === 'home')
        {
            const app = (label, color, attrs, letter) => `<li><${attrs.startsWith('href') ? 'a' : 'button type="button"'} class="phone-app" ${attrs}><span class="phone-app-icon" style="--app:${color}">${letter}</span>${escape(label)}</${attrs.startsWith('href') ? 'a' : 'button'}></li>`
            html += `<h2 id="phone-title" class="phone-heading">Ishan's phone</h2><ul class="phone-apps">`
            html += app('Contact', '#FF3EA5', 'data-phone="contact"', 'I')
            html += app('Career', '#A855F7', 'data-phone="career"', 'C')
            html += app('Trophies', '#F2B705', 'data-phone="trophies"', 'T')
            if(this.sky) html += app('Sky', '#3C7AD4', 'data-phone="sky"', 'S')
            for(const l of links)
                html += app(l.label, APP_COLORS[l.label] || '#2FA4A0', `href="${escape(l.href)}" ${l.href.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener"'}`, l.label[0])
            html += '</ul>'
        }
        else if(name === 'contact')
            html += `${back}<h2 id="phone-title" class="phone-heading">${escape(person.name)}</h2><div class="phone-contact"><p>${escape(contact.body)}</p>${this.linkList()}</div>`
        else if(name === 'career')
            html += `${back}<h2 id="phone-title" class="phone-heading">Career</h2><div class="phone-contact">${this.careerList()}</div>`
        else if(name === 'trophies')
            html += `${back}<h2 id="phone-title" class="phone-heading">Trophies</h2><div class="phone-contact"><ul class="card-list">${achievements.items.map((i) => `<li><strong>${escape(i.title)}</strong><span class="note">${escape(i.detail)}</span></li>`).join('')}</ul></div>`
        else if(name === 'sky' && this.sky)
            html += `${back}<h2 id="phone-title" class="phone-heading">Sky</h2>${this.skyControls()}`
        this.phoneView.innerHTML = html
    }

    // ---------------------------------------------------------------- time, seasons, weather
    bindSky(sky)
    {
        this.sky = sky
        this.phoneView.addEventListener('click', (e) =>
        {
            const chip = e.target.closest('[data-sky]')
            if(!chip) return
            sky.set(chip.dataset.sky, chip.dataset.value)
            this.phoneScreen('sky')
            this.setSky(sky.state().label)
            this.$(`[data-sky="${chip.dataset.sky}"][data-value="${chip.dataset.value}"]`)?.focus()
        })
    }

    setSky(text)
    {
        const el = this.$('.hud-sky')
        if(el && el.textContent !== text) el.textContent = text
    }

    skyControls()
    {
        const state = this.sky.state()
        const group = (kind, title, options) => `<fieldset class="sky-group"><legend>${title}</legend><div class="sky-chips">${options.map(([ value, label ]) =>
            `<button type="button" class="sky-chip" data-sky="${kind}" data-value="${value}" aria-pressed="${state[kind] === value}">${label}</button>`).join('')}</div></fieldset>`
        return `<div class="phone-contact sky">
            <p class="sky-now">${escape(state.label)}</p>
            ${group('time', 'Time of day', [ [ 'auto', 'Auto' ], [ 'dawn', 'Dawn' ], [ 'day', 'Day' ], [ 'dusk', 'Dusk' ], [ 'night', 'Night' ] ])}
            ${group('season', 'Season', [ [ 'auto', 'Auto' ], [ 'spring', 'Spring' ], [ 'summer', 'Summer' ], [ 'autumn', 'Autumn' ], [ 'winter', 'Winter' ] ])}
            ${group('weather', 'Weather', [ [ 'auto', 'Auto' ], [ 'clear', 'Clear' ], [ 'cloudy', 'Cloudy' ], [ 'rain', 'Rain' ], [ 'storm', 'Storm' ], [ 'snow', 'Snow' ], [ 'fog', 'Fog' ] ])}
            <p class="note">Auto lets the day, the seasons and the weather change on their own.</p>
        </div>`
    }

    // ---------------------------------------------------------------- page view
    renderPage()
    {
        const p = this.$('.page-content')
        let html = `<h1 id="page-title">${escape(person.name)}</h1><p class="page-role">${escape(person.role)}</p><p>${escape(person.about)}</p>`
        html += '<h2>Projects</h2>'
        for(const pr of projects)
        {
            html += `<div class="page-entry"><h3>${pr.url ? `<a href="${escape(pr.url)}" target="_blank" rel="noopener">${escape(pr.title)}</a>` : escape(pr.title)}</h3>
                <p class="meta">${escape(pr.role)}. ${pr.stack.map(escape).join(', ')}</p><p>${escape(pr.body)}</p></div>`
        }
        html += '<h2>Career</h2>'
        for(const s of career.stops)
            html += `<div class="page-entry"><h3><a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.place)}</a></h3><p class="meta">${escape(s.role)}, ${escape(s.when)}</p><p>${escape(s.note)}</p></div>`
        html += '<h2>Achievements</h2>'
        for(const a of achievements.items)
            html += `<div class="page-entry"><h3>${escape(a.title)}</h3><p class="meta">${escape(a.detail)}</p></div>`
        html += `<h2>Say hi</h2><p>${escape(contact.body)}</p>`
        html += '<div class="page-entry">' + links.map((l) => `<p><strong>${escape(l.label)}</strong>: <a href="${escape(l.href)}" target="_blank" rel="noopener">${escape(l.text)}</a></p>`).join('') + '</div>'
        html += '<h2>Credits</h2><div class="page-entry">' + credits.map((c) => `<p>${escape(c.what)} by <a href="${escape(c.href)}" target="_blank" rel="noopener">${escape(c.who)}</a>, free under CC0.</p>`).join('') + '</div>'
        p.innerHTML = html
    }

    openPage()
    {
        this.lastFocus = document.activeElement
        this.closeCard()
        this.closePhone(false)
        this.pageLayer.hidden = false
        this.$('.page').focus({ preventScroll: true })
        this.prompt.hidden = true
    }

    closePage()
    {
        this.pageLayer.hidden = true
        this.restoreFocus()
        this.onClose?.()
    }

    restoreFocus()
    {
        if(this.lastFocus && this.lastFocus !== document.body) this.lastFocus.focus?.()
        else document.activeElement?.blur?.()
    }

    trapFocus(e)
    {
        const layer = !this.cardLayer.hidden ? this.cardLayer : !this.phoneLayer.hidden ? this.phoneLayer : !this.pageLayer.hidden ? this.pageLayer : null
        if(!layer) return
        const focusable = [ ...layer.querySelectorAll('a[href]:not([hidden]), button:not([hidden]), [tabindex="-1"]') ].filter((el) => el.offsetParent !== null || el === document.activeElement)
        if(!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    // ---------------------------------------------------------------- touch stick
    // A floating joystick: it appears wherever the left thumb lands in the zone.
    bindStick(input)
    {
        const zone = this.$('.touch-zone')
        const stick = this.$('.stick')
        const knob = this.$('.stick-knob')
        let id = null
        let center = null
        const radius = () => stick.offsetWidth * 0.42
        const home = () =>
        {
            stick.style.left = ''
            stick.style.top = ''
            stick.style.bottom = ''
        }
        const set = (e) =>
        {
            let dx = e.clientX - center.x
            let dy = e.clientY - center.y
            const r = radius()
            const len = Math.hypot(dx, dy)
            if(len > r) { dx = dx / len * r; dy = dy / len * r }
            knob.style.transform = `translate(${dx}px, ${dy}px)`
            input.stick.x = dx / r
            input.stick.y = -dy / r
            stick.classList.toggle('is-running', Math.hypot(dx, dy) / r > 0.92)
        }
        zone.addEventListener('pointerdown', (e) =>
        {
            if(id !== null) return
            id = e.pointerId
            zone.setPointerCapture(id)
            // centre the stick under the thumb, kept fully on screen
            const size = stick.offsetWidth
            const x = Math.min(Math.max(e.clientX, size / 2 + 8), window.innerWidth - size / 2 - 8)
            const y = Math.min(Math.max(e.clientY, size / 2 + 8), window.innerHeight - size / 2 - 8)
            stick.style.left = `${x - size / 2}px`
            stick.style.top = `${y - size / 2}px`
            stick.style.bottom = 'auto'
            stick.classList.add('is-active')
            center = { x, y }
            input.stick.active = true
            input.stick.pointerId = id
            set(e)
            e.preventDefault()
        })
        zone.addEventListener('pointermove', (e) => { if(e.pointerId === id) set(e) })
        const end = (e) =>
        {
            if(e.pointerId !== id) return
            id = null
            input.stick.active = false
            input.stick.x = 0
            input.stick.y = 0
            knob.style.transform = ''
            stick.classList.remove('is-active', 'is-running')
            home()
        }
        zone.addEventListener('pointerup', end)
        zone.addEventListener('pointercancel', end)
        zone.addEventListener('lostpointercapture', end)
    }

    // ---------------------------------------------------------------- fullscreen and orientation
    bindFullscreen()
    {
        const button = this.$('[data-action="fullscreen"]')
        const supported = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen)
        button.hidden = !supported || !this.isTouch
        button.addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : this.enterFullscreen()))
        document.addEventListener('fullscreenchange', () =>
        {
            button.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'
        })
    }

    // fullscreen, then lock to landscape where the browser allows it (Android Chrome does,
    // iPhone Safari has neither and simply keeps going)
    async enterFullscreen()
    {
        try
        {
            if(!document.fullscreenElement && document.documentElement.requestFullscreen)
                await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
            if(screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape')
        }
        catch {}
    }

    // the rotate hint shows on phones held upright while playing, until dismissed
    bindRotateHint()
    {
        this.rotateHint = this.$('.rotate-hint')
        this.rotateDismissed = false
        this.$('[data-action="dismiss-rotate"]').addEventListener('click', () =>
        {
            this.rotateDismissed = true
            this.updateRotateHint()
        })
        const query = window.matchMedia('(orientation: portrait)')
        query.addEventListener?.('change', () => this.updateRotateHint())
        window.addEventListener('resize', () => this.updateRotateHint())
    }

    setPlaying(playing)
    {
        this.playing = playing
        this.body.classList.toggle('is-playing', playing)
        this.updateRotateHint()
    }

    updateRotateHint()
    {
        if(!this.rotateHint) return
        const portrait = window.innerHeight > window.innerWidth
        const phone = Math.min(window.innerWidth, window.innerHeight) < 600
        this.rotateHint.hidden = !(this.isTouch && this.playing && portrait && phone && !this.rotateDismissed)
    }
}
