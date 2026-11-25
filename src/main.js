import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { R } from './core/geo.js'
import { smoothstep } from './core/noise.js'
import { Input } from './core/input.js'
import { Quality } from './core/quality.js'
import { Ambience } from './core/audio.js'
import { ArcadeHall } from './ui/arcade.js'
import { FullMap } from './ui/fullmap.js'
import { layout } from './world/layout.js'
import { coastDistance } from './world/terrain.js'
import { createLights } from './world/lights.js'
import { UI } from './ui/ui.js'
import { projects } from './content.js'

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

const FOG = new THREE.Color('#F5AE93')

class App
{
    constructor()
    {
        this.canvas = document.querySelector('canvas.world')
        this.canvas.tabIndex = -1
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' })
        this.renderer.setSize(window.innerWidth, window.innerHeight, false)
        this.renderer.toneMapping = THREE.NeutralToneMapping
        this.renderer.toneMappingExposure = 1.04
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFShadowMap
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1400)
        this.fog = new THREE.Fog(FOG.clone(), 60, 210)
        this.scene.fog = this.fog
        // phones get a smaller shadow map and resolution cap
        this.lights = createLights(this.scene, { shadowSize: isTouch ? 1024 : 2048 })

        // neon glow
        this.composer = new EffectComposer(this.renderer)
        this.composer.addPass(new RenderPass(this.scene, this.camera))
        this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.4, 0.95)
        this.composer.addPass(this.bloom)
        this.composer.addPass(new OutputPass())
        this.bloomOn = !params.has('nobloom')
        this.quality = new Quality(this.renderer, {
            maxRatio: isTouch ? 1.5 : 2,
            onRatio: (ratio) => { this.composer.setPixelRatio(ratio); this.composer.setSize(window.innerWidth, window.innerHeight) },
            onLowest: () => this.setBloom(false)
        })


        this.input = new Input(this.canvas)
        ui.bindStick(this.input)
        ui.bindFullscreen()
        ui.bindRotateHint()
        this.ambience = new Ambience()
        // every button clicks; closing a card and starting a game have their own sounds
        document.addEventListener('click', (e) =>
        {
            const button = e.target.closest?.('button')
            if(!button) return
            const kind = button.matches('[data-action*="close"], [data-fullmap="close"]') ? 'close'
                : button.matches('[data-action="play"]') ? 'confirm'
                : button.matches('[data-action="phone"]') ? 'switch'
                : 'click'
            this.ambience.ui(kind)
        })
        // the Game Arcade hall, opened from its door
        this.arcade = new ArcadeHall({ onClose: () => this.canvas.focus({ preventScroll: true }) })
        ui.bindThrottle(this.input)
        // the city map, opened with M or the Map button; the city pauses behind it
        this.fullMap = new FullMap({
            canOpen: () => this.state === 'play' && !this.arcade.isOpen && !ui.modalOpen,
            onJump: (dest) => this.jump(dest)
        })
        ui.onMap = () => this.fullMap.toggle()
        ui.externalModal = () => this.arcade.isOpen || this.fullMap.isOpen
        this.wasFlying = false
        this.timer = new THREE.Timer()
        this.timer.connect(document)
        this.time = 0
        this.state = 'title' // title | intro | play
        this.raycaster = new THREE.Raycaster()
        this.visited = new Set()
        this.inMarker = null

        window.addEventListener('resize', () => this.resize())
        // mobile browsers resize the visible area when their toolbars slide away
        window.visualViewport?.addEventListener('resize', () => this.resize())
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250))
        window.addEventListener('keydown', (e) =>
        {
            if(this.state === 'play' && e.code === 'KeyP' && !(e.target instanceof HTMLInputElement)) ui.togglePhone()
        })
        this.resize()
    }

    setBloom(on)
    {
        this.bloomOn = on
    }

    async build()
    {
        // signs are painted on canvases, so wait for the fonts first
        await Promise.race([
            Promise.all([
                document.fonts.load('80px "Anton"'),
                document.fonts.load('80px "Yellowtail"'),
                document.fonts.load('500 34px "Barlow Semi Condensed"'),
                document.fonts.load('600 34px "Barlow Semi Condensed"')
            ]),
            new Promise((resolve) => setTimeout(resolve, 3000))
        ]).catch(() => {})

        const [ { World }, { Player }, { CameraRig }, { occlusion }, { Minimap }, { Environment } ] = await Promise.all([
            import('./world/world.js'),
            import('./player/player.js'),
            import('./player/cameraRig.js'),
            import('./world/forest.js'),
            import('./ui/minimap.js'),
            import('./world/environment.js')
        ])
        this.occlusion = occlusion
        this.world = new World(this.scene)
        this.world.renderer = this.renderer
        // the places the map can fly you to: the city's airstrip, and each island's
        this.destinations = this.world.airstrips.map((strip) => this.destinationFor(strip))
        this.fullMap.setDestinations(this.destinations)
        // time of day, seasons and weather
        this.environment = new Environment({
            scene: this.scene, renderer: this.renderer, lights: this.lights, sky: this.world.sky, fog: this.fog,
            bloom: this.bloom, ambience: this.ambience, details: this.world.details, params
        })
        ui.bindSky({
            state: () => this.environment.state,
            set: (kind, value) =>
            {
                if(kind === 'time') this.environment.setTime(value)
                if(kind === 'season') this.environment.setSeason(value)
                if(kind === 'weather') this.environment.setWeather(value)
            }
        })
        this.player = new Player(this.world, this.input)
        this.rig = new CameraRig(this.camera, this.input)
        this.rig.titleShift = this.titleShift()
        this.rig.viewShift = { ...this.rig.titleShift }
        this.rig.colliders = this.world.colliders
        this.minimap = new Minimap(ui.minimapCanvas)
        this.loadCharacter()

        // stops in the order the road passes them
        const order = [ 'achievements', ...projects.map((p) => p.id), 'career', 'contact' ]
        this.stops = order.map((id) => this.world.interactables.find((i) => i.content.id === id)).filter(Boolean)
        // every stop on the city map: where it is, what it's called and how to colour it
        this.mapStops = this.world.interactables.map((i) =>
        {
            const at = i.marker || i
            const arcade = i.content.kind === 'arcade'
            const color = arcade || i.content.id === 'contact' ? '#2DE2E6' : i.content.id === 'career' || i.content.id === 'achievements' ? '#FFE45E' : '#FF3EA5'
            return { id: i.content.id, x: at.x, z: at.z, label: arcade ? 'Game Arcade' : i.content.place, color, size: 8 }
        })

        // hide the character inside the house until the intro
        const door = this.doorPoints()
        this.player.x = door.inside.x
        this.player.z = door.inside.z
        this.player.yaw = door.yaw
        this.player.sync()

        this.bindPlayerEvents()
        this.canvas.addEventListener('pointerup', (e) => this.click(e))

        // compile shaders before the first frame anyone sees
        this.rig.update(0, 0, this.player)
        this.environment.prepareCompile(true)
        this.renderer.compile(this.scene, this.camera)
        this.environment.prepareCompile(false)
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
        const w = window.innerWidth
        const h = window.innerHeight
        // phones sideways: planet on the right half, beside the text
        if(w > h && h < 540) return { x: w * 0.24, y: h * 0.06 }
        if(w > 900) return { x: w * 0.2, y: 0 }
        // portrait: the planet rises from the bottom, under the text
        if(h > w) return { x: 0, y: h * 0.3 }
        return { x: w * 0.12, y: h * 0.12 }
    }

    doorPoints()
    {
        const main = layout.main
        const start = main.at(0)
        const out = main.at(6 / main.length)
        return {
            inside: layout.studioInside,
            door: layout.studioDoor,
            out,
            yaw: Math.atan2(start.tx, start.tz),
            outYaw: Math.atan2(out.tx, out.tz)
        }
    }

    // a place to fly to: beside the plane at the near end of an airstrip, facing down it
    destinationFor(strip)
    {
        const { runway } = strip
        const start = runway.start
        // a few metres to the side of the plane, so you stand beside it, not in it
        const side = { x: -runway.t.z, z: runway.t.x }
        return {
            id: strip.id,
            label: strip.name,
            x: runway.mid.x,
            z: runway.mid.z,
            spot: { x: start.x + side.x * 4.5, z: start.z + side.z * 4.5, yaw: start.yaw }
        }
    }

    // the map's fast travel: close the map and stand beside the plane at that airstrip
    jump(dest)
    {
        if(this.state !== 'play' || this.arcade.isOpen) return false
        if(!this.player.jumpTo(dest.spot.x, dest.spot.z, dest.spot.yaw))
        {
            ui.showArea('Not yet', 'Land the plane and stop before you jump')
            return false
        }
        // the camera turns to face the way you now face, down the strip, and goes straight there
        this.rig.yaw = dest.spot.yaw
        this.rig.snap()
        this.fullMap.close()
        this.ambience.ui('confirm')
        ui.showArea(dest.label, 'Your plane is parked at the near end of the strip')
        return true
    }

    explore(skip = false)
    {
        if(this.state !== 'title') return
        this.state = 'intro'
        // on phones: go fullscreen and sideways where the browser allows it (needs this tap)
        if(isTouch && !skip) ui.enterFullscreen()
        ui.enterWorld()
        ui.setPlaying(true)
        this.canvas.focus({ preventScroll: true })
        const door = this.doorPoints()
        // the camera ends up in front of Ishan, looking back at his place with
        // the name sign over the door in shot (a little to one side, so the
        // parked car doesn't pull the camera in)
        this.rig.yaw = door.outYaw + Math.PI + 0.42
        this.rig.distance = 7.2
        this.rig.pitch = 0.15
        this.rig.startFly(skip ? 0.01 : 3.8)

        this.player.runScript([
            { wait: skip ? 0 : 1.7 },
            { to: { x: door.door.x, z: door.door.z }, speed: 2.0 },
            { to: { x: door.out.x, z: door.out.z }, speed: 2.4 },
            { face: door.outYaw },
            { wave: skip ? 0.2 : 2.2 },
            { call: () => { this.settleTarget = door.outYaw } }
        ], () =>
        {
            this.state = 'play'
            this.input.enabled = true
            ui.showHud()
            this.helpTimer = this.time
        })
    }

    bindPlayerEvents()
    {
        const events = this.player.events
        events.addEventListener('read', (e) =>
        {
            this.ambience.ui('open')
            this.openStop(e.detail)
        })
        events.addEventListener('nearby', (e) =>
        {
            const item = e.detail
            if(item && item.content.place !== this.lastPlace)
            {
                this.lastPlace = item.content.place
                ui.showArea(item.content.place, item.content.title !== item.content.place ? item.content.title : '')
            }
        })
        events.addEventListener('eject', () =>
        {
            this.ambience.whoosh()
            ui.showArea('Bailed out', 'Steer with A and D, W slows the fall')
        })
        events.addEventListener('landed', () =>
        {
            this.ambience.ui('drop')
            ui.showArea('Back on the ground', 'Your parachute got you down safely')
        })
        events.addEventListener('splash', () =>
        {
            this.ambience.splash()
            ui.showArea('Splash!', 'The sea brought you back to the nearest shore')
        })
        events.addEventListener('waved', () =>
        {
            if(!this.sawContact)
            {
                this.sawContact = true
                const contact = this.world.interactables.find((i) => i.id === 'contact')
                if(contact) setTimeout(() => { if(this.player.mode === 'sit') this.openStop(contact.content) }, 400)
            }
        })
    }

    openStop(content)
    {
        // the arcade is a place to play, not a project to read
        if(content.kind === 'arcade')
        {
            this.input.keys.clear()
            this.arcade.open()
            return
        }
        const index = projects.findIndex((p) => p.id === content.id)
        ui.openCard(content, index >= 0 ? { index, total: projects.length } : {})
        this.input.keys.clear()
        const before = this.visited.size
        this.visited.add(content.id)
        if(this.visited.size === this.stops.length && before < this.stops.length)
            setTimeout(() => ui.showArea('All caught up', 'Thanks for looking around'), 600)
    }

    nextStop()
    {
        return this.stops.find((s) => !this.visited.has(s.content.id)) || null
    }

    promptAction()
    {
        const p = this.player
        if(p.mode === 'ride') p.dismount()
        else if(p.nearVehicle) p.mount(p.nearVehicle)
        else if(p.nearby) this.openStop(p.nearby.content)
        else if(p.mode === 'sit') p.standUp()
    }

    updatePrompt()
    {
        const p = this.player
        if(this.state !== 'play') return ui.setPrompt(null)
        if(p.mode === 'ride') return ui.setPrompt('E', p.vehicle.kind === 'car' ? 'Get out of the car' : p.vehicle.kind === 'plane' ? (p.vehicle.flight.onGround ? 'Get out of the plane' : 'Bail out with the parachute') : 'Get off the scooter')
        if(p.mode === 'sit') return ui.setPrompt('W', 'Stand up')
        if(p.nearVehicle) return ui.setPrompt('E', p.nearVehicle.label)
        if(p.nearby) return ui.setPrompt('Enter', `See ${p.nearby.content.title}`)
        ui.setPrompt(null)
    }

    // walking (or driving slowly) into a marker opens that stop
    checkMarkers()
    {
        const p = this.player
        if(p.mode !== 'walk' && !(p.mode === 'ride' && Math.abs(p.speed) < 3)) return
        let inside = null
        for(const item of this.world.interactables)
        {
            const m = item.marker
            if(m && Math.hypot(m.x - p.x, m.z - p.z) < 1.25) inside = item
        }
        if(inside && inside !== this.inMarker && !ui.modalOpen) this.openStop(inside.content)
        this.inMarker = inside
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
        if(!hit || hit.distance > 70) return
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
        if(item) this.openStop(item.content)
    }

    resize()
    {
        const w = window.innerWidth
        const h = window.innerHeight
        this.camera.aspect = w / h
        this.camera.fov = w < h ? 58 : 45
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(w, h, false)
        this.composer.setPixelRatio(this.renderer.getPixelRatio())
        this.composer.setSize(w, h)
        if(this.rig) this.rig.titleShift = this.titleShift()
    }

    tick()
    {
        this.timer.update()
        const dt = Math.min(this.timer.getDelta(), 1 / 20)
        // resize before drawing: resizing clears the canvas, so doing it after
        // the frame would show one blank frame each time the resolution changes
        this.quality.update(dt)
        this.step(dt)
        if(this.bloomOn) this.composer.render(dt)
        else this.renderer.render(this.scene, this.camera)
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
        const obstacles = this.state === 'title' ? [] : [ { x: this.player.x, z: this.player.z } ]
        this.world.night = this.environment.nightness ?? 0
        this.world.update(time, dt, this.camera, obstacles)
        this.world.markers.update(time, this.visited)

        // light, sky and fog follow where we are
        const camDist = this.camera.position.length()
        const space = smoothstep(R * 1.25, R * 2.4, camDist)
        const focus = this.state === 'title' ? new THREE.Vector3(0, R, 0) : this.player.position
        this.environment.update(dt, focus, { camera: this.camera, space, time })
        this.lights.update(focus)
        this.occlusion.uFadeOn.value = this.rig.mode === 'follow' ? 1 : 0
        this.occlusion.uFadeTarget.value.copy(this.player.position).addScaledVector(this.player.up, 1.1)
        const sky = this.world.sky.userData.uniforms
        sky.uUp.value.copy(this.rig.localUp)
        sky.uSpace.value = space
        this.fog.near = THREE.MathUtils.lerp(this.environment.fogNear, 500, space)
        this.fog.far = THREE.MathUtils.lerp(this.environment.fogFar, 1400, space)
        // the HUD shows the season, the time and the weather
        if(Math.floor(time) !== Math.floor(time - dt)) ui.setSky(this.environment.label)

        if(this.state === 'play')
        {
            if(input.moving && this.time - this.helpTimer > 2.5) ui.fadeHelp()
            if(this.time - this.helpTimer > 25) ui.fadeHelp()
            this.updatePrompt()
            this.checkMarkers()
            const shore = smoothstep(14, 0, coastDistance(this.player.x, this.player.z))
            this.ambience.update(time, shore)
            const flying = this.player.mode === 'ride' && this.player.vehicle && this.player.vehicle.flight
            // the engines: a car while you drive it, the drone while the plane is in the air
            const vehicle = this.player.mode === 'ride' ? this.player.vehicle : null
            this.ambience.setVehicle({
                car: vehicle && vehicle.kind === 'car' ? Math.min(1, Math.abs(this.player.speed) / (vehicle.maxSpeed || 10)) : null,
                plane: flying ? vehicle.flight.throttle : null
            })
            ui.setFlight(flying ? this.player.vehicle.flight : null)
            if(this.player.mode === 'chute') ui.setChute(this.player.chute)
            // the how-to card opens when you climb in, and closes when you climb out
            if(flying && !this.wasFlying) ui.showFlightTips(true)
            if(!flying && this.wasFlying) ui.showFlightTips(false)
            this.wasFlying = !!flying
            this.updatePlaneTip()
            this.updateMap()
            if(this.fullMap.isOpen) this.drawFullMap()
        }
    }

    // a tip above the plane while you stand next to it
    updatePlaneTip()
    {
        const p = this.player
        const plane = p.mode === 'walk' && p.nearVehicle && p.nearVehicle.kind === 'plane' ? p.nearVehicle : null
        if(!plane || ui.modalOpen)
        {
            ui.setPlaneTip(null)
            return
        }
        const at = new THREE.Vector3()
        plane.model.root.getWorldPosition(at)
        at.y += 4.5
        at.project(this.camera)
        if(at.z > 1 || at.z < -1)
        {
            ui.setPlaneTip(null)
            return
        }
        ui.setPlaneTip({ x: (at.x + 1) / 2 * window.innerWidth, y: (1 - at.y) / 2 * window.innerHeight })
    }

    // the city map: the stops, the airstrip, the plane and the route to the next stop
    drawFullMap()
    {
        const p = this.player
        this.fullMap.draw({
            player: { x: p.x, z: p.z, yaw: p.yaw },
            stops: this.mapStops,
            vehicles: this.world.vehicles.map((v) => ({ kind: v.kind, x: v.x, z: v.z, yaw: v.yaw })),
            runways: this.world.airstrips.map((strip) => strip.runway.points),
            route: this.mapRoute || [],
            visited: this.visited
        })
    }

    updateMap()
    {
        // the map does not need every frame
        this.mapFrame = (this.mapFrame || 0) + 1
        if(this.mapFrame % 2) return
        const next = this.nextStop()
        const blips = this.world.interactables.map((i) => ({
            x: i.marker ? i.marker.x : i.x,
            z: i.marker ? i.marker.z : i.z,
            color: i.content.id === 'contact' ? '#2DE2E6' : i.content.id === 'career' || i.content.id === 'achievements' ? '#FFE45E' : '#FF3EA5',
            dim: this.visited.has(i.content.id),
            size: next && next === i ? 8 : 6
        }))
        for(const v of this.world.vehicles)
            if(this.player.vehicle !== v) blips.push({ x: v.x, z: v.z, color: '#FFF6EC', size: 4 })
        const target = next ? (next.marker || next) : null
        this.mapRoute = this.minimap.routePoints(this.player, target)
        const distance = this.minimap.update(this.player, this.rig.yaw, blips, target)
        ui.setProgress(this.visited.size, this.stops.length)
        ui.setNext(next ? `Next: ${next.content.place}${distance ? `, ${Math.round(distance / 10) * 10 || 10} m` : ''}` : 'Chai at the beach is always open')
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
