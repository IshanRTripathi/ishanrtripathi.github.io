import * as THREE from 'three'
import { R } from './core/geo.js'
import { smoothstep } from './core/noise.js'
import { Input } from './core/input.js'
import { Quality } from './core/quality.js'
import { Ambience } from './core/audio.js'
import { layout } from './world/layout.js'
import { coastDistance } from './world/terrain.js'
import { createLights, SUN_DIRECTION } from './world/lights.js'
import { UI } from './ui/ui.js'

const params = new URLSearchParams(location.search)
const isTouch = window.matchMedia('(pointer: coarse)').matches || params.has('touch')

const ui = new UI({
    isTouch,
    onExplore: () => app.explore(),
    onClose: () => app.canvas.focus({ preventScroll: true }),
    onSound: (on) => app.ambience.setEnabled(on),
    onPrompt: () => app.promptAction()
})

function webglAvailable()
{
    try
    {
        const c = document.createElement('canvas')
        return !!(window.WebGL2RenderingContext && c.getContext('webgl2'))
    }
    catch
    {
        return false
    }
}

class App
{
    constructor()
    {
        this.canvas = document.querySelector('canvas.world')
        this.canvas.tabIndex = -1
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' })
        this.renderer.setSize(window.innerWidth, window.innerHeight, false)
        this.renderer.toneMapping = THREE.NeutralToneMapping
        this.renderer.toneMappingExposure = 1.02
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFShadowMap
        this.quality = new Quality(this.renderer)

        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1200)
        this.fog = new THREE.Fog('#F2D3AE', 60, 190)
        this.scene.fog = this.fog
        this.lights = createLights(this.scene)

        this.input = new Input(this.canvas)
        this.ambience = new Ambience()
        this.timer = new THREE.Timer()
        this.timer.connect(document)
        this.time = 0
        this.state = 'title' // title | intro | play
        this.raycaster = new THREE.Raycaster()

        window.addEventListener('resize', () => this.resize())
        this.resize()
    }

    async build()
    {
        // signs are painted on canvases, so wait for the fonts first
        await Promise.race([
            Promise.all([ document.fonts.load('80px "Yatra One"'), document.fonts.load('500 34px "Hind"'), document.fonts.load('600 34px "Hind"') ]),
            new Promise((resolve) => setTimeout(resolve, 3000))
        ]).catch(() => {})

        const [ { World }, { Player }, { CameraRig }, { occlusion } ] = await Promise.all([
            import('./world/world.js'),
            import('./player/player.js'),
            import('./player/cameraRig.js'),
            import('./world/forest.js')
        ])
        this.occlusion = occlusion
        this.world = new World(this.scene)
        this.world.sky.userData.uniforms.uSun.value.copy(SUN_DIRECTION)
        this.player = new Player(this.world, this.input)
        this.rig = new CameraRig(this.camera, this.input)
        this.rig.titleShift = this.titleShift()
        this.rig.viewShift = { ...this.rig.titleShift }
        this.rig.colliders = this.world.colliders
        this.loadCharacter()

        // hide the character inside the studio until the intro
        const door = this.doorPoints()
        this.player.x = door.inside.x
        this.player.z = door.inside.z
        this.player.yaw = door.yaw
        this.player.sync()

        this.bindPlayerEvents()
        this.canvas.addEventListener('pointerup', (e) => this.click(e))

        // compile shaders before the first frame anyone sees
        this.rig.update(0, 0, this.player)
        this.renderer.compile(this.scene, this.camera)
        this.renderer.setAnimationLoop(() => this.tick())

        if(params.has('debug')) window.app = this
        ui.ready()
        window.__ready = true
        if(params.has('play')) this.explore(true)
    }

    async loadCharacter()
    {
        const { registry } = await import('./models/registry.js')
        const model = await registry.character()
        if(!model) return
        const { TripoCharacter } = await import('./player/tripoCharacter.js')
        const replacement = new TripoCharacter(model)
        const old = this.player.character
        this.scene.remove(old.root)
        this.scene.add(replacement.root)
        this.player.character = replacement
        this.player.sync()
    }

    titleShift()
    {
        // push the planet to the right of the title text on wide screens
        const w = window.innerWidth
        const h = window.innerHeight
        if(w > 900) return { x: w * 0.2, y: 0 }
        // portrait: the planet rises from the bottom, under the text
        if(h > w) return { x: 0, y: h * 0.3 }
        return { x: w * 0.12, y: h * 0.12 }
    }

    doorPoints()
    {
        const main = layout.main
        const start = main.at(0)
        const door = layout.studioDoor
        const out = main.at(9.5 / main.length)
        return {
            inside: { x: start.x - start.tx * 2.4, z: start.z - start.tz * 2.4 },
            door,
            out,
            yaw: Math.atan2(start.tx, start.tz),
            outYaw: Math.atan2(out.tx, out.tz)
        }
    }

    explore(skip = false)
    {
        if(this.state !== 'title') return
        this.state = 'intro'
        ui.enterWorld()
        this.canvas.focus({ preventScroll: true })
        const door = this.doorPoints()
        // the camera ends up in front of Ishan, looking back at the studio
        this.rig.yaw = door.outYaw + Math.PI
        this.rig.distance = 8.5
        this.rig.pitch = 0.3
        this.rig.startFly(skip ? 0.01 : 3.8)

        this.player.runScript([
            { wait: skip ? 0 : 1.7 },
            { to: { x: door.door.x, z: door.door.z }, speed: 2.0 },
            { to: { x: door.out.x, z: door.out.z }, speed: 2.4 },
            { face: door.outYaw },
            { wave: skip ? 0.2 : 2.2 },
            { call: () => this.settle(door.outYaw) }
        ], () =>
        {
            this.state = 'play'
            this.input.enabled = true
            ui.showHud()
            this.helpTimer = this.time
        })
    }

    // after the wave, swing the camera round behind Ishan
    settle(yaw)
    {
        this.settleTarget = yaw
    }

    bindPlayerEvents()
    {
        const events = this.player.events
        events.addEventListener('read', (e) => this.openLetter(e.detail))
        events.addEventListener('nearby', (e) =>
        {
            const item = e.detail
            if(item && item.content.place !== this.lastPlace)
            {
                this.lastPlace = item.content.place
                ui.showPlace(item.content.place)
            }
        })
        events.addEventListener('waved', () =>
        {
            if(!this.sawContact)
            {
                this.sawContact = true
                const contact = this.world.interactables.find((i) => i.id === 'contact')
                if(contact) setTimeout(() => { if(this.player.mode === 'sit') this.openLetter(contact.content) }, 400)
            }
        })
        events.addEventListener('chai-near', () => ui.showPlace('Chai Stall'))
        events.addEventListener('mount', () => ui.showPlace('Scooter'))
    }

    openLetter(content)
    {
        ui.openLetter(content)
        this.input.keys.clear()
    }

    promptAction()
    {
        const p = this.player
        if(p.mode === 'ride') p.dismount()
        else if(p.nearScooter) p.mount()
        else if(p.nearby) this.openLetter(p.nearby.content)
        else if(p.mode === 'sit') p.standUp()
    }

    updatePrompt()
    {
        const p = this.player
        if(this.state !== 'play') return ui.setPrompt(null)
        if(p.mode === 'ride') return ui.setPrompt('E', 'Get off the scooter')
        if(p.mode === 'sit') return ui.setPrompt('W', 'Stand up')
        if(p.nearScooter) return ui.setPrompt('E', 'Ride the scooter')
        if(p.nearby) return ui.setPrompt('Enter', `Read about ${p.nearby.content.title}`)
        ui.setPrompt(null)
    }

    click(e)
    {
        if(this.state === 'title' || ui.modalOpen) return
        if(this.input.drag.moved > 6) return
        const rect = this.canvas.getBoundingClientRect()
        const pointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
        this.raycaster.setFromCamera(pointer, this.camera)
        const targets = []
        for(const item of this.world.interactables)
        {
            if(item.face) targets.push(item.face)
            if(item.siteObject) targets.push(item.siteObject)
        }
        const hit = this.raycaster.intersectObjects(targets, true)[0]
        if(!hit || hit.distance > 60) return
        const item = this.world.interactables.find((i) =>
        {
            let o = hit.object
            while(o)
            {
                if(o === i.face || o === i.siteObject) return true
                o = o.parent
            }
            return false
        })
        if(item) this.openLetter(item.content)
    }

    resize()
    {
        const w = window.innerWidth
        const h = window.innerHeight
        this.camera.aspect = w / h
        this.camera.fov = w < h ? 58 : 45
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(w, h, false)
        if(this.rig) this.rig.titleShift = this.titleShift()
    }

    tick()
    {
        this.timer.update()
        const dt = Math.min(this.timer.getDelta(), 1 / 20)
        this.step(dt)
        this.renderer.render(this.scene, this.camera)
        this.quality.update(dt)
        this.input.endFrame()
    }

    // debug helper: run the simulation forward without drawing
    simulate(seconds, dt = 1 / 30)
    {
        for(let t = 0; t < seconds; t += dt)
        {
            this.step(dt)
            this.input.endFrame()
        }
    }

    step(dt)
    {
        this.time += dt
        const time = this.time
        const input = this.input
        input.update(time)

        if(ui.modalOpen)
        {
            input.keys.clear()
            input.move.x = 0
            input.move.y = 0
        }

        if(this.state !== 'title') this.player.update(dt, this.rig.yaw, time)

        if(this.settleTarget !== undefined)
        {
            let d = this.settleTarget - this.rig.yaw
            while(d > Math.PI) d -= Math.PI * 2
            while(d < -Math.PI) d += Math.PI * 2
            this.rig.yaw += d * (1 - Math.exp(-dt * 2.4))
            this.rig.lastDrag = time
            if(Math.abs(d) < 0.01 || input.drag.dx) this.settleTarget = undefined
        }

        this.rig.update(dt, time, this.player)
        this.world.update(time, dt, this.camera)

        // light, sky and fog follow where we are
        const camDist = this.camera.position.length()
        const space = smoothstep(R * 1.25, R * 2.4, camDist)
        const focus = this.state === 'title' ? new THREE.Vector3(0, R, 0) : this.player.position
        this.lights.update(focus)
        this.occlusion.uFadeOn.value = this.rig.mode === 'follow' ? 1 : 0
        this.occlusion.uFadeTarget.value.copy(this.player.position).addScaledVector(this.player.up, 1.1)
        const sky = this.world.sky.userData.uniforms
        sky.uUp.value.copy(this.rig.localUp)
        sky.uSpace.value = space
        this.fog.near = THREE.MathUtils.lerp(55, 400, space)
        this.fog.far = THREE.MathUtils.lerp(190, 1200, space)
        // the low sun near the bay warms the haze
        const sunLocal = SUN_DIRECTION.dot(this.rig.localUp)
        this.fog.color.set('#F2D3AE').lerp(new THREE.Color('#F4B98C'), smoothstep(0.55, 0.1, sunLocal) * 0.7)

        if(this.state === 'play')
        {
            if(input.moving && this.time - this.helpTimer > 2.5) ui.fadeHelp()
            if(this.time - this.helpTimer > 25) ui.fadeHelp()
            this.updatePrompt()
            const shore = smoothstep(14, 0, coastDistance(this.player.x, this.player.z))
            this.ambience.update(time, shore)
        }

    }
}


let app
if(!webglAvailable())
{
    ui.openPage()
    document.querySelector('[data-action="close-page"]').hidden = true
}
else
{
    app = new App()
    requestAnimationFrame(() => app.build())
}
