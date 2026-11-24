import { person, links, projects, achievements, career, contact } from '../content.js'

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
        this.prompt = this.$('.prompt')
        this.promptKey = this.$('.prompt-key')
        this.promptLabel = this.$('.prompt-label')
        this.prompt.addEventListener('click', () => onPrompt())
        this.area = this.$('.area')
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
        return !this.cardLayer.hidden || !this.pageLayer.hidden || !this.phoneLayer.hidden
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
        const now = new Date()
        this.$('.phone-clock').textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
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
        this.phoneView.innerHTML = html
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
    bindStick(input)
    {
        const stick = this.$('.stick')
        const knob = this.$('.stick-knob')
        let id = null
        const radius = 50
        const set = (e) =>
        {
            const r = stick.getBoundingClientRect()
            let dx = e.clientX - (r.left + r.width / 2)
            let dy = e.clientY - (r.top + r.height / 2)
            const len = Math.hypot(dx, dy)
            if(len > radius) { dx = dx / len * radius; dy = dy / len * radius }
            knob.style.transform = `translate(${dx}px, ${dy}px)`
            input.stick.x = dx / radius
            input.stick.y = -dy / radius
        }
        stick.addEventListener('pointerdown', (e) =>
        {
            id = e.pointerId
            input.stick.active = true
            input.stick.pointerId = id
            stick.setPointerCapture(id)
            set(e)
            e.stopPropagation()
        })
        stick.addEventListener('pointermove', (e) => { if(e.pointerId === id) set(e) })
        const end = (e) =>
        {
            if(e.pointerId !== id) return
            id = null
            input.stick.active = false
            input.stick.x = 0
            input.stick.y = 0
            knob.style.transform = ''
        }
        stick.addEventListener('pointerup', end)
        stick.addEventListener('pointercancel', end)
    }
}
