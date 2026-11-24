import { person, links, projects, achievements, career, contact } from '../content.js'

// Everything outside the canvas: title, HUD, letters, the page view and touch controls.

const ICONS = {
    tiffin: '<rect x="13" y="16" width="22" height="7" rx="2"/><rect x="13" y="24" width="22" height="7" rx="2"/><rect x="13" y="32" width="22" height="7" rx="2"/><path d="M15 16c0-9 18-9 18 0"/>',
    calculator: '<rect x="14" y="7" width="20" height="34" rx="2"/><rect x="18" y="11" width="12" height="7"/><path stroke-width="4" d="M19 25h0M24 25h0M29 25h0M19 31h0M24 31h0M29 31h0M19 37h0M24 37h0M29 37h0"/>',
    clock: '<circle cx="24" cy="27" r="12"/><path d="M24 20v7l5 3M13 15l5-4M35 15l-5-4"/>',
    phone: '<rect x="15" y="7" width="18" height="34" rx="3"/><circle cx="24" cy="20" r="5"/><path d="M19 32h10"/>',
    arcade: '<path d="M19 10v28M29 10v28M10 19h28M10 29h28M12 12l5 5M17 12l-5 5"/><circle cx="34" cy="34" r="3"/>',
    trophies: '<path d="M16 10h16v8a8 8 0 0 1-16 0zM16 13h-4a4 4 0 0 0 4 6M32 13h4a4 4 0 0 1-4 6M24 26v6M20 32h8v6h-8z"/>',
    station: '<rect x="13" y="8" width="22" height="25" rx="4"/><path d="M13 20h22M17 33l-4 6M31 33l4 6M15 39h18"/><circle cx="18" cy="27" r="1.5"/><circle cx="30" cy="27" r="1.5"/>',
    chai: '<path d="M14 20h20l-3 18H17zM34 24h3a3 3 0 0 1 0 6h-4M20 15c0-3 3-3 3-6M27 15c0-3 3-3 3-6"/>'
}

const iconFor = (content) =>
    content.building ? ICONS[content.building] : ICONS[{ achievements: 'trophies', career: 'station', contact: 'chai' }[content.id]] || ICONS.chai

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function postmarkDate()
{
    const d = new Date()
    const months = [ 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC' ]
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

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
        this.prompt = this.$('.prompt')
        this.promptKey = this.$('.prompt-key')
        this.promptLabel = this.$('.prompt-label')
        this.prompt.addEventListener('click', () => onPrompt())
        this.toast = this.$('.place-toast')
        this.touch = this.$('.touch')

        this.soundButton = this.$('[data-action="sound"]')
        this.soundButton.addEventListener('click', () =>
        {
            const on = this.soundButton.getAttribute('aria-pressed') !== 'true'
            this.soundButton.setAttribute('aria-pressed', String(on))
            this.soundButton.textContent = on ? 'Sound on' : 'Sound off'
            onSound(on)
        })

        // letter
        this.letterLayer = this.$('.letter-layer')
        this.letter = this.$('.letter')
        this.letterLayer.addEventListener('click', (e) =>
        {
            if(e.target.closest('[data-action="close"]')) this.closeLetter()
        })
        this.onClose = onClose

        // page view
        this.pageLayer = this.$('.page-layer')
        this.renderPage()
        document.querySelectorAll('[data-action="page"]').forEach((b) => b.addEventListener('click', () => this.openPage()))
        this.$('[data-action="close-page"]').addEventListener('click', () => this.closePage())

        window.addEventListener('keydown', (e) =>
        {
            if(e.key === 'Escape')
            {
                if(!this.letterLayer.hidden) this.closeLetter()
                else if(!this.pageLayer.hidden) this.closePage()
            }
            if(e.key === 'Tab') this.trapFocus(e)
        })
        this.lastFocus = null
    }

    get modalOpen()
    {
        return !this.letterLayer.hidden || !this.pageLayer.hidden
    }

    ready()
    {
        this.explore.disabled = false
        this.explore.querySelector('.sign-button-label').textContent = 'Explore the island'
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
        if(this.isTouch) this.touch.hidden = false
    }

    fadeHelp()
    {
        if(!this.help.classList.contains('is-faded')) this.help.classList.add('is-faded')
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

    showPlace(name)
    {
        clearTimeout(this.toastTimer)
        this.toast.textContent = name
        this.toast.classList.add('is-visible')
        this.toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), 2400)
    }

    // ---------------------------------------------------------------- letters
    openLetter(content)
    {
        this.lastFocus = document.activeElement
        const L = this.letter
        L.style.setProperty('--stamp', content.stamp || 'var(--sea)')
        L.querySelector('.stamp-icon').innerHTML = iconFor(content)
        L.querySelector('.postmark-date').textContent = postmarkDate()
        L.querySelector('.letter-title').textContent = content.title
        L.querySelector('.letter-line').textContent = content.line
        L.querySelector('.letter-to').innerHTML = content.id === 'contact'
            ? 'To,<br>whoever made it all the way to the beach'
            : 'To,<br>whoever walked over to this board'

        const body = L.querySelector('.letter-content')
        const link = L.querySelector('.letter-link')
        let html = ''
        let primary = null

        if(content.id === 'career')
        {
            html += '<ul class="letter-list">' + content.stops.map((s) => `
                <li><strong><a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.place)}</a></strong><span class="when">${escape(s.when)}</span>
                <span class="note">${escape(s.role)}. ${escape(s.note)}</span></li>`).join('') + '</ul>'
            const linkedin = links.find((l) => l.label === 'LinkedIn')
            primary = { href: linkedin.href, label: 'See it on LinkedIn' }
        }
        else if(content.id === 'achievements')
        {
            html += `<p>${escape(content.body)}</p>`
            html += '<ul class="letter-list">' + content.items.map((i) => `<li><strong>${escape(i.title)}</strong><span class="when">${escape(i.detail)}</span></li>`).join('') + '</ul>'
        }
        else if(content.id === 'contact')
        {
            html += `<p>${escape(content.body)}</p>`
            html += '<ul class="letter-list">' + links.map((l) => `<li><span>${escape(l.label)}</span><a class="when" href="${escape(l.href)}" target="_blank" rel="noopener">${escape(l.text)}</a></li>`).join('') + '</ul>'
            primary = { href: links[0].href, label: 'Write to me' }
        }
        else
        {
            html += `<p>${escape(content.body)}</p>`
            html += `<dl class="letter-facts"><dt>My role</dt><dd>${escape(content.role)}</dd><dt>Built with</dt><dd>${content.stack.map(escape).join(', ')}</dd></dl>`
            if(content.url) primary = { href: content.url, label: `Open ${content.title}` }
        }
        body.innerHTML = html

        if(primary)
        {
            link.hidden = false
            link.href = primary.href
            link.querySelector('.sign-button-label').textContent = primary.label
            if(primary.href.startsWith('mailto:')) link.removeAttribute('target')
            else link.setAttribute('target', '_blank')
        }
        else link.hidden = true

        this.prompt.hidden = true
        this.letterLayer.hidden = false
        this.letterLayer.classList.remove('is-opening')
        void this.letterLayer.offsetWidth
        this.letterLayer.classList.add('is-opening')
        L.scrollTop = 0
        L.focus({ preventScroll: true })
    }

    closeLetter()
    {
        if(this.letterLayer.hidden) return
        this.letterLayer.hidden = true
        if(this.lastFocus && this.lastFocus !== document.body) this.lastFocus.focus?.()
        else document.activeElement?.blur?.()
        this.onClose?.()
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
        this.closeLetter()
        this.pageLayer.hidden = false
        this.$('.page').focus({ preventScroll: true })
        this.prompt.hidden = true
    }

    closePage()
    {
        this.pageLayer.hidden = true
        if(this.lastFocus && this.lastFocus !== document.body) this.lastFocus.focus?.()
        this.onClose?.()
    }

    trapFocus(e)
    {
        const layer = !this.letterLayer.hidden ? this.letterLayer : !this.pageLayer.hidden ? this.pageLayer : null
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
