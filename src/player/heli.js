import * as THREE from 'three'
import { frameQuaternion, surfacePoint } from '../core/geo.js'
import { groundAt as renderedGround } from '../world/terrain.js'

// The sea is flat, so a helicopter can set down on the water as well as on the land.
const groundAt = (x, z) => Math.max(0, renderedGround(x, z))

// An easy-to-fly helicopter. It keeps the same fields and methods as the plane's flight model
// (src/player/flight.js), so the player, the camera, the HUD and the missions treat both alike.
//
// The keys: R climbs and F descends (the touch + and − buttons do the same), W and S fly forward and
// back, A and D turn. Let go of everything and it hovers where it is: no stalling, no speed to
// keep up, and a landing is only a matter of letting it down. It never crashes from a hard
// landing, only from a very fast drop.

const VMAX = 24 // forward, m/s
const VBACK = 0.3 // reverse is this share of the forward speed
const CLIMB = 7 // m/s
const DESCEND = 5 // m/s
const TURN = 1.4 // radians a second
const CRASH_SINK = -9
// how fast the rotor spools up (a share of full speed a second)
const SPOOL = 0.9

export class HeliFlight
{
    constructor(model)
    {
        this.heli = model
        this.kind = 'heli'
        // where a crashed helicopter is put back
        this.spawn = { x: 0, z: 0, yaw: 0 }
        this.reset(0, 0, 0)
    }

    // put the helicopter on the ground at (x, z), nose towards yaw
    reset(x, z, yaw)
    {
        this.x = x
        this.z = z
        this.yaw = yaw
        this.v = 0 // speed along the nose (negative in reverse)
        this.vy = 0 // climb rate
        this.h = 0 // height above the ground
        this.pitch = 0
        this.bank = 0
        this.throttle = 0.5 // shown as the collective: half is a hover
        this.onGround = true
        this.crashed = 0
        this.landed = false
        this.hint = ''
        this.hintTime = 0
        this.spin = 0 // how far the rotor has turned
        this.rotor = 0 // how fast it is turning: 0 stopped, 1 full
        this.ground = groundAt(x, z)
    }

    say(text, seconds = 3) { this.hint = text; this.hintTime = seconds }

    // input: { x: right, y: forward, lift: climb } each -1..1. Without a `lift` there is no pilot
    // (the rider baled out), and the helicopter settles gently onto the ground.
    update(dt, input, colliders, resolveCollisions)
    {
        if(this.crashed > 0)
        {
            this.crashed -= dt
            this.v = 0
            if(this.crashed <= 0) this.reset(this.spawn.x, this.spawn.z, this.spawn.yaw)
            return
        }
        if(this.hintTime > 0) this.hintTime -= dt
        const pilot = input.lift !== undefined
        const lift = pilot ? input.lift : -0.4
        const forward = pilot ? input.y : 0
        const turn = pilot ? input.x : 0

        // the rotor spools up when it is asked for lift, and winds down on the ground when it is not
        const wanted = !this.onGround || lift > 0 || forward !== 0 ? 1 : 0.2
        this.rotor += (wanted - this.rotor) * Math.min(1, dt * SPOOL)
        this.spin += this.rotor * dt * 28
        const power = Math.min(1, Math.max(0, (this.rotor - 0.45) / 0.45))

        // up and down: the stick sets the climb rate, and with nothing held it settles to a hover
        const vyWanted = lift > 0 ? lift * CLIMB * power : lift * DESCEND
        this.vy += (vyWanted - this.vy) * Math.min(1, dt * 2.5)
        this.h += this.vy * dt
        if(this.h > 0.2 && this.vy > 0.3) this.onGround = false
        if(this.h <= 0)
        {
            if(this.vy < CRASH_SINK)
            {
                this.crash()
                return
            }
            if(!this.onGround)
            {
                this.landed = true
                this.say('Touchdown', 2.5)
            }
            this.h = 0
            this.vy = Math.max(0, this.vy)
            this.onGround = true
        }

        // along the ground: full speed in the air, a slow crawl on the skids
        const grip = this.onGround ? 0.12 : 1
        const vWanted = (forward > 0 ? forward * VMAX : forward * VMAX * VBACK) * grip
        this.v += (vWanted - this.v) * Math.min(1, dt * (forward ? 0.9 : 1.6))
        if(Math.abs(this.v) < 0.02) this.v = 0
        // turning on the spot, quicker when it is moving a little
        this.yaw += -turn * TURN * (this.onGround ? 0.6 : 1) * dt

        // the body leans into what it is doing: the nose down for forward, wings level in a hover
        const pitchWanted = -(this.v / VMAX) * 0.3
        const bankWanted = -turn * 0.28 * (this.onGround ? 0 : 1)
        this.pitch += (pitchWanted - this.pitch) * Math.min(1, dt * 3)
        this.bank += (bankWanted - this.bank) * Math.min(1, dt * 3)
        this.throttle = 0.5 + Math.max(-0.5, Math.min(0.5, this.vy / (2 * CLIMB)))

        const nx = this.x + Math.sin(this.yaw) * this.v * dt
        const nz = this.z + Math.cos(this.yaw) * this.v * dt
        // low flying is stopped by walls and trees; up high it flies over them
        if(resolveCollisions && this.h < 5)
        {
            const pos = resolveCollisions({ x: nx, z: nz }, 1.9, colliders)
            if(Math.hypot(pos.x - nx, pos.z - nz) > 0.01) this.v *= 0.5
            this.x = pos.x
            this.z = pos.z
        }
        else
        {
            this.x = nx
            this.z = nz
        }
        this.ground = groundAt(this.x, this.z)
    }

    crash()
    {
        this.crashed = 2.2
        this.onGround = true
        this.h = 0
        this.vy = 0
        this.say('Hard landing! Back to the pad', 2.4)
    }

    // where the helicopter, and so the rider's camera, sits in the world
    apply(root)
    {
        const ground = groundAt(this.x, this.z)
        surfacePoint(this.x, this.z, ground + this.h, root.position)
        const q = frameQuaternion(this.x, this.z, this.yaw, new THREE.Quaternion())
        // nose up is a negative turn about x in the helicopter's own frame; bank right is positive about z
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.pitch))
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.bank))
        root.quaternion.copy(q)
        this.heli.rotor.rotation.y = this.spin
        this.heli.tailRotor.rotation.x = this.spin * 1.6
    }

    get speedKmh() { return Math.round(Math.abs(this.v) * 3.6) }
    get altitude() { return Math.max(0, Math.round(this.h)) }
}
