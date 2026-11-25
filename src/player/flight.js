import * as THREE from 'three'
import { frameQuaternion, surfacePoint } from '../core/geo.js'
import { heightAt } from '../world/terrain.js'

// An arcade flight model for the little plane. Everything is in the same
// units as the city (metres and seconds). It is not a real aerodynamic model:
// speed decides whether the wings have lift, the nose decides how fast you
// climb, and the bank decides how fast you turn.

const G = 9.8
const VMAX = 36 // full throttle, m/s
const VROT = 18 // the nose can lift from here
const VLIFT = 22 // and the plane leaves the ground
const VSTALL = 15 // below this the wings give up and you sink
const VCRUISE = 28
const MAX_PITCH = 0.36
const MAX_BANK = 0.62
const GROUND_PITCH_MAX = 0.2
const SAFE_TOUCHDOWN = -4.5 // sink rate you can land at
const CRASH_SINK = -9

export class Flight
{
    constructor(plane)
    {
        this.plane = plane
        // where a crashed plane is put back: the runway's near end
        this.spawn = { x: 0, z: 0, yaw: 0 }
        this.reset(0, 0, 0)
    }

    // put the plane on the ground at (x, z), nose towards yaw
    reset(x, z, yaw)
    {
        this.x = x
        this.z = z
        this.yaw = yaw
        this.v = 0 // speed along the nose
        this.vy = 0 // climb rate
        this.h = 0 // height above the ground
        this.pitch = 0
        this.bank = 0
        this.throttle = 0.6
        this.onGround = true
        this.crashed = 0
        this.landed = false
        this.bounces = 0
        this.hint = ''
        this.hintTime = 0
        this.spin = 0
    }

    say(text, seconds = 3) { this.hint = text; this.hintTime = seconds }

    // input: { x: right, y: forward }, both -1..1 (keys or stick)
    update(dt, input, colliders, resolveCollisions)
    {
        if(this.crashed > 0)
        {
            this.crashed -= dt
            this.v = Math.max(0, this.v - 30 * dt)
            this.pitch += (0.0 - this.pitch) * Math.min(1, dt * 2)
            if(this.crashed <= 0) this.reset(this.spawn.x, this.spawn.z, this.spawn.yaw)
            return
        }
        if(this.hintTime > 0) this.hintTime -= dt
        const ground = heightAt(this.x, this.z)

        // throttle: the keys step it, the stick does nothing to it
        this.spin += this.v * dt / 0.24

        if(this.onGround)
        {
            // taxi and take-off run
            const target = this.throttle * VMAX
            const k = this.throttle < 0.05 ? 6 : 0.22
            this.v += (target - this.v) * Math.min(1, dt * k) - (this.throttle < 0.05 ? 0 : 0.02 * this.v * dt)
            if(this.v < 0.02) this.v = 0
            // the nose comes up with the stick once the plane is moving fast enough
            const pitchWanted = input.y > 0 && this.v > VROT ? input.y * MAX_PITCH : Math.min(0, input.y * 0.1)
            this.pitch += (Math.max(-0.02, Math.min(GROUND_PITCH_MAX, pitchWanted)) - this.pitch) * Math.min(1, dt * 2.5)
            // steering on the ground: only while rolling
            const turn = -input.x * 1.25 * Math.min(1, this.v / 8)
            this.yaw += turn * dt
            this.bank += (-input.x * 0.1 - this.bank) * Math.min(1, dt * 4)
            // take off
            if(this.v >= VLIFT && this.pitch > 0.07)
            {
                this.onGround = false
                this.vy = this.v * Math.sin(this.pitch) * 0.6
                this.h = 0.05
                this.say('Airborne', 2)
            }
            this.vy = 0
            this.h = 0
        }
        else
        {
            // the throttle is set by the keys; the stick only moves the nose and the bank
            const target = this.throttle * VMAX
            this.v += (target - this.v) * Math.min(1, dt * 0.35)
            // the nose goes where the stick says
            const pitchWanted = input.y * MAX_PITCH
            this.pitch += (pitchWanted - this.pitch) * Math.min(1, dt * 2.2)
            // below stall speed the nose drops on its own
            if(this.v < VSTALL) this.pitch += (-0.25 - this.pitch) * Math.min(1, dt * 1.5)
            this.pitch = Math.max(-0.9, Math.min(0.9, this.pitch))
            // bank into the turn; turn at a rate that depends on the bank and the speed
            const bankWanted = -input.x * MAX_BANK
            this.bank += (bankWanted - this.bank) * Math.min(1, dt * 2.6)
            const turnRate = -(G * Math.tan(this.bank)) / Math.max(this.v, 8)
            this.yaw += turnRate * dt
            // lift: how much of the weight the wings take depends on speed
            const lift = Math.max(0, Math.min(1, (this.v - VSTALL) / (VCRUISE - VSTALL)))
            const climbWanted = lift > 0 ? Math.max(-9, Math.min(9, this.v * Math.sin(this.pitch) * 0.75 + (1 - lift) * -6)) : -7
            this.vy += (climbWanted - this.vy) * Math.min(1, dt * 2.0)
            this.h += this.vy * dt
            if(this.h <= 0)
            {
                this.h = 0
                if(this.vy > SAFE_TOUCHDOWN && this.pitch < 0.3 && Math.abs(this.bank) < 0.35)
                {
                    this.onGround = true
                    this.landed = true
                    this.pitch = Math.max(0, this.pitch) * 0.2
                    this.vy = 0
                    this.say('Touchdown. Nicely done', 4)
                    this.bounces = 0
                }
                else if(this.vy < CRASH_SINK || this.v < 5)
                {
                    this.crash(colliders)
                    return
                }
                else
                {
                    // a bump: bounce a little and carry on
                    this.vy = -this.vy * 0.25
                    this.bounces++
                    this.say('Bumpy landing. Keep the nose level', 3)
                    if(this.bounces > 3) this.crash(colliders)
                }
            }
        }

        // move along the nose, in the ground's plane
        const horizontal = this.onGround ? this.v : this.v * Math.cos(this.pitch)
        const nx = this.x + Math.sin(this.yaw) * horizontal * dt
        const nz = this.z + Math.cos(this.yaw) * horizontal * dt
        if(this.onGround && resolveCollisions)
        {
            const pos = resolveCollisions({ x: nx, z: nz }, 1.9, colliders)
            // a wingtip against anything solid: slow right down
            if(Math.hypot(pos.x - nx, pos.z - nz) > 0.01) this.v *= 0.5
            this.x = pos.x
            this.z = pos.z
        }
        else
        {
            this.x = nx
            this.z = nz
        }
        // never fly under the ground
        this.h = Math.max(this.h, 0)
        if(this.onGround) this.h = 0
        this.ground = heightAt(this.x, this.z)
        this.hintTime = Math.max(0, this.hintTime)
    }

    crash(colliders)
    {
        this.crashed = 2.2
        this.onGround = true
        this.h = 0
        this.vy = 0
        this.say('Crash! Back to the runway', 2.4)
    }

    // where the plane, and so the rider's camera, sits in the world
    apply(root, dt = 0)
    {
        const ground = heightAt(this.x, this.z)
        const h = ground + this.h
        surfacePoint(this.x, this.z, h, root.position)
        const q = frameQuaternion(this.x, this.z, this.yaw, new THREE.Quaternion())
        // nose up is a negative turn about x in the plane's own frame; bank right is positive about z
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.pitch))
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.bank))
        root.quaternion.copy(q)
        const p = this.plane
        for(const w of p.wheels) w.userData.spin.rotation.x = this.spin
        p.propeller.rotation.z = this.spin * 2.4
        // the strobe blinks, the nav lights stay on
        const blink = Math.floor(performance.now() / 420) % 2 === 0
        p.navs.strobe.visible = blink
        // the gear retracts a little in the air
        for(const w of p.wheels) w.position.y = this.onGround ? 0.24 : 0.34
    }

    get speedKmh() { return Math.round(this.v * 3.6) }
    get altitude() { return Math.max(0, Math.round(this.h)) }
}
