import * as THREE from 'three'
import { resolveCollisions } from '../player/player.js'
import { ROOMS } from './rooms.js'

// Going in and out of buildings. While you are inside, the planet is not drawn at all: only the room
// is (its own small scene, its own lights, built once). The character is moved into the room and back.

const WALK = 2.6
const RUN = 5.2
const RADIUS = 0.32
const FADE_MS = 360

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function angleDiff(a, b)
{
    let d = a - b
    while(d > Math.PI) d -= Math.PI * 2
    while(d < -Math.PI) d += Math.PI * 2
    return d
}

export class Interior
{
    constructor({ input, ui, player, camera, rig, renderer, world, openContent })
    {
        this.input = input
        this.ui = ui
        this.player = player
        this.camera = camera
        this.rig = rig
        this.renderer = renderer
        this.world = world
        this.openContent = openContent
        this.rooms = {}
        this.active = false
        this.busy = false
        this.current = null // { room, site } while inside
        this.scene = null
        this.x = 0
        this.z = 0
        this.yaw = 0
        this.speed = 0
        this.camYaw = Math.PI
        this.pitch = 0.3
        this.dist = 6.4
        this.sitting = null
        this.near = null
        this.time = 0
    }

    // the room for a kind of building, built the first time anyone goes in
    roomFor(kind)
    {
        if(!this.rooms[kind])
        {
            const room = ROOMS[kind]()
            const scene = new THREE.Scene()
            scene.background = new THREE.Color(room.background)
            scene.add(room.group)
            room.scene = scene
            this.rooms[kind] = room
            // compile its materials now, so the first frame inside does not stutter
            this.renderer.compile(scene, this.camera)
        }
        return this.rooms[kind]
    }

    // through the door: the screen goes dark for a moment, the room appears, and the screen comes back
    enter(site)
    {
        if(this.busy || this.active) return
        this.busy = true
        this.ui.fade(true)
        setTimeout(() =>
        {
            const room = this.roomFor(site.interior)
            this.start(room, site)
            this.ui.fade(false)
            setTimeout(() => { this.busy = false }, FADE_MS)
        }, FADE_MS)
    }

    start(room, site)
    {
        const p = this.player
        this.current = { room, site }
        this.scene = room.scene
        this.ui.setInside(true)
        // the character walks into the room, and is not moved by the world while it is in there
        room.scene.add(p.character.root)
        p.mode = 'interior'
        this.x = room.spawn.x
        this.z = room.spawn.z
        this.yaw = room.spawn.yaw
        this.camYaw = room.spawn.yaw
        this.speed = 0
        this.sitting = null
        this.active = true
    }

    // out through the door: back on the planet, facing away from the building
    exit()
    {
        if(!this.active || this.busy) return
        this.busy = true
        this.ui.fade(true)
        setTimeout(() =>
        {
            const { site } = this.current
            const p = this.player
            this.world.scene.add(p.character.root)
            p.mode = 'walk'
            p.x = site.entrance.x
            p.z = site.entrance.z
            p.yaw = site.yaw
            p.speed = 0
            p.sync(0)
            // the camera goes to the street side, looking back at the building and the character
            this.rig.yaw = site.yaw + Math.PI
            this.rig.snap()
            this.current = null
            this.scene = null
            this.active = false
            this.ui.setInside(false)
            this.sitting = null
            this.ui.fade(false)
            setTimeout(() => { this.busy = false }, FADE_MS)
        }, FADE_MS)
    }

    update(dt, time)
    {
        if(!this.active || !this.current) return
        this.time = time
        const room = this.current.room
        const input = this.input
        const character = this.player.character

        // movement: stands you up from a seat, otherwise camera-relative walking, with the room's walls
        if(this.sitting && input.moving) this.sitting = null
        if(!this.sitting)
        {
            const mx = input.move.x
            const my = input.move.y
            const amount = Math.hypot(mx, my)
            let target = 0
            if(amount > 0.05)
            {
                const fx = Math.sin(this.camYaw)
                const fz = Math.cos(this.camYaw)
                const dx = fx * my + -fz * mx
                const dz = fz * my + fx * mx
                const want = Math.atan2(dx, dz)
                const diff = angleDiff(want, this.yaw)
                this.yaw += diff * (1 - Math.exp(-dt * 9))
                target = amount * (input.run ? RUN : WALK) * clamp(Math.cos(diff) * 0.8 + 0.35, 0, 1)
            }
            this.speed += (target - this.speed) * Math.min(1, dt * 10)
            if(this.speed < 0.02) this.speed = 0
            const nx = this.x + Math.sin(this.yaw) * this.speed * dt
            const nz = this.z + Math.cos(this.yaw) * this.speed * dt
            const pos = resolveCollisions({ x: nx, z: nz }, RADIUS, room.colliders)
            this.x = clamp(pos.x, -room.half.x + 0.45, room.half.x - 0.45)
            this.z = clamp(pos.z, -room.half.z + 0.45, room.half.z - 0.45)
        }

        // the camera: drag to turn it, otherwise it drifts behind the way you walk
        if(input.drag.dx || input.drag.dy)
        {
            const k = input.drag.touch ? 1.6 : 1
            this.camYaw -= input.drag.dx * 0.0055 * k
            this.pitch = clamp(this.pitch + input.drag.dy * 0.004 * k, 0.12, 0.9)
        }
        else if(this.speed > 0.4) this.camYaw += angleDiff(this.yaw, this.camYaw) * (1 - Math.exp(-dt * 2.4))
        if(input.zoom) this.dist = clamp(this.dist * Math.pow(1.12, input.zoom), 4, 9)

        // the character: its pose from the speed, or sitting
        const sitState = this.sitting ? 'sit' : this.speed > 0.1 ? 'move' : 'idle'
        character.setState({ mode: sitState, speed: this.speed, walkSpeed: WALK, runSpeed: RUN, turn: 0 })
        character.update(dt)
        const root = character.root
        root.position.set(this.sitting ? this.sitting.x : this.x, 0, this.sitting ? this.sitting.z : this.z)
        root.rotation.set(0, this.sitting ? this.sitting.yaw : this.yaw, 0)

        // the camera stays inside the walls
        const cam = this.camera
        const back = this.dist * Math.cos(this.pitch)
        const high = this.dist * Math.sin(this.pitch)
        const fx = Math.sin(this.camYaw)
        const fz = Math.cos(this.camYaw)
        const cx = clamp(this.x - fx * back, -room.half.x + 0.3, room.half.x - 0.3)
        const cz = clamp(this.z - fz * back, -room.half.z + 0.3, room.half.z - 0.3)
        cam.position.set(cx, 1.4 + high, cz)
        cam.up.set(0, 1, 0)
        cam.lookAt(this.x, 1.3, this.z)
        cam.clearViewOffset()

        // the nearest thing to use, if you are close enough to it
        let best = null
        let bestD = Infinity
        const points = room.points.filter((pt) => !(pt.kind === 'sit' && this.sitting))
        for(const pt of points)
        {
            const d = Math.hypot(pt.x - this.x, pt.z - this.z)
            if(d < pt.r && d < bestD) { best = pt; bestD = d }
        }
        const ex = room.exit
        if(!this.sitting && Math.hypot(ex.x - this.x, ex.z - this.z) < ex.r) best = { kind: 'exit', label: 'Leave' }
        this.near = best

        // the screen pulses, like a film playing (dimmer and brighter, never grey)
        if(room.screen) room.screen.material.color.copy(room.screenColor).multiplyScalar(0.8 + 0.2 * Math.sin(time * 2.2))

        if(input.consume('KeyE') || input.consume('Enter')) this.act()
    }

    act()
    {
        if(!this.active || this.busy) return
        if(this.sitting)
        {
            // standing up: a step forward, out of the seat
            this.x = this.sitting.x + Math.sin(this.sitting.yaw) * 0.6
            this.z = this.sitting.z + Math.cos(this.sitting.yaw) * 0.6
            this.yaw = this.sitting.yaw
            this.sitting = null
            return
        }
        const pt = this.near
        if(!pt) return
        if(pt.kind === 'exit') this.exit()
        else if(pt.kind === 'sit')
        {
            this.sitting = { x: pt.x, z: pt.z, yaw: pt.yaw }
            this.speed = 0
        }
        else if(pt.kind === 'content') this.openContent(pt.content)
        else if(pt.kind === 'info') this.ui.showArea(pt.label, pt.sub)
    }

    // the prompt for the key, while you are inside
    prompt()
    {
        if(!this.active) return null
        if(this.sitting) return { key: 'E', label: 'Stand up' }
        return this.near ? { key: 'E', label: this.near.label } : null
    }
}
