import * as THREE from 'three'
import { surfacePoint, frameQuaternion, mapToDir } from '../core/geo.js'
import { heightAt, coastDistance } from '../world/terrain.js'
import { layout } from '../world/layout.js'
import { Character } from './character.js'
import { place } from '../world/world.js'
import { buildParachute, updateParachute } from '../world/parachute.js'
import { ISLANDS } from '../world/islands.js'

const WALK = 2.7
const RUN = 6.2
const TURN_RATE = 9

function angleDiff(a, b)
{
    let d = a - b
    while(d > Math.PI) d -= Math.PI * 2
    while(d < -Math.PI) d += Math.PI * 2
    return d
}

// the middle of the nearest land: the main island, or the island you are closest to
function nearestLand(x, z)
{
    let best = { x: 0, z: 0, d: Infinity }
    const candidates = [ { x: 0, z: 0 }, ...ISLANDS.map((i) => i.at) ]
    for(const c of candidates)
    {
        const d = Math.hypot(c.x - x, c.z - z)
        if(d < best.d) best = { x: c.x, z: c.z, d }
    }
    return best
}

// the nearest dry land to a point out at sea: searched outward in rings, so you come
// ashore where you are, not on whichever island's middle is closest
function nearestShore(x, z)
{
    for(let r = 1; r <= 180; r++)
        for(let k = 0; k < 24; k++)
        {
            const a = (k / 24) * Math.PI * 2
            const dx = Math.cos(a)
            const dz = Math.sin(a)
            if(coastDistance(x + dx * r, z + dz * r) < 0.6) continue
            // step back in from the far side, to the water's edge
            let d = r
            while(d > 0 && coastDistance(x + dx * d, z + dz * d) >= 0.6) d -= 0.1
            return { x: x + dx * (d + 0.1), z: z + dz * (d + 0.1) }
        }
    return null
}

// how far along a ramp a value is, from a (0) to b (1), for a > b too
function ramp(a, b, x)
{
    return Math.max(0, Math.min(1, (x - a) / (b - a)))
}

// the lean of the body while falling: a free-fall dive, and a tilt into a turn
const _tiltEuler = new THREE.Euler()
const _tiltQuat = new THREE.Quaternion()

// Push a circle out of every collider it overlaps (map space)
export function resolveCollisions(pos, radius, colliders)
{
    for(let pass = 0; pass < 2; pass++)
    {
        for(const c of colliders)
        {
            if(c.disabled) continue
            const dx = pos.x - c.x
            const dz = pos.z - c.z
            if(dx * dx + dz * dz > 400) continue
            if(c.type === 'circle')
            {
                const d = Math.hypot(dx, dz)
                const min = c.r + radius
                if(d < min && d > 1e-6)
                {
                    pos.x = c.x + dx / d * min
                    pos.z = c.z + dz / d * min
                }
            }
            else
            {
                // box in its own frame: forward = (sin yaw, cos yaw)
                const fx = Math.sin(c.yaw)
                const fz = Math.cos(c.yaw)
                const u = dx * fz - dz * fx // along the box's right
                const v = dx * fx + dz * fz // along its forward
                const cu = Math.max(-c.hw, Math.min(c.hw, u))
                const cv = Math.max(-c.hd, Math.min(c.hd, v))
                const inside = u === cu && v === cv
                let nu, nv
                if(inside)
                {
                    // push out along the shallowest side
                    const pu = c.hw - Math.abs(u)
                    const pv = c.hd - Math.abs(v)
                    if(pu < pv) { nu = Math.sign(u || 1) * (c.hw + radius); nv = v }
                    else { nu = u; nv = Math.sign(v || 1) * (c.hd + radius) }
                }
                else
                {
                    const ou = u - cu
                    const ov = v - cv
                    const d = Math.hypot(ou, ov)
                    if(d >= radius) continue
                    nu = cu + ou / d * radius
                    nv = cv + ov / d * radius
                }
                pos.x = c.x + nu * fz + nv * fx
                pos.z = c.z - nu * fx + nv * fz
            }
        }
    }
    return pos
}

export class Player
{
    constructor(world, input)
    {
        this.world = world
        this.input = input
        this.character = new Character()
        world.scene.add(this.character.root)

        this.x = layout.spawn.x
        this.z = layout.spawn.z
        this.yaw = layout.spawn.yaw
        this.speed = 0
        this.turn = 0
        this.mode = 'walk' // walk | ride | script | sit
        this.script = null
        this.idleTime = 0
        this.steer = 0
        this.position = new THREE.Vector3()
        this.up = new THREE.Vector3()
        this.nearby = null
        this.nearVehicle = null
        this.vehicle = null
        this.atChai = false
        this.chaiDone = false
        this.events = new EventTarget()
        // the parachute, shown only while falling
        this.parachute = buildParachute()
        this.parachute.root.visible = false
        this.character.root.add(this.parachute.root)
        this.chute = null // { h, open, yaw } while falling under the canopy
        this.ejected = null // the plane we bailed out of, flying on without us
        this.landing = null // seconds since the canopy came down, while it folds up on the ground
        this.canopyState = { open: 0, pitch: 0, bank: 0, collapse: 0 }
        this.sync()
    }

    emit(name, detail)
    {
        this.events.dispatchEvent(new CustomEvent(name, { detail }))
    }

    // ---------------------------------------------------------------- scripted moves
    // steps: [{ to: {x, z}, speed }, { face: yaw }, { wave: seconds }, { sit: true }, { wait: s }]
    runScript(steps, onDone, { cancellable = false } = {})
    {
        this.mode = 'script'
        this.speed = 0
        this.script = { steps: [ ...steps ], t: 0, onDone, cancellable }
    }

    updateScript(dt)
    {
        const s = this.script
        const step = s.steps[0]
        if(!step)
        {
            this.script = null
            const done = s.onDone
            if(this.mode === 'script') this.mode = 'walk'
            this.character.setState({ wave: false })
            if(done) done()
            return
        }
        s.t += dt
        let finished = false
        if(step.to)
        {
            const dx = step.to.x - this.x
            const dz = step.to.z - this.z
            const d = Math.hypot(dx, dz)
            const target = Math.atan2(dx, dz)
            this.turnTowards(target, dt, 7)
            const want = Math.max(0.7, Math.min(step.speed ?? WALK, d * 2.5))
            this.speed += (want - this.speed) * Math.min(1, dt * 8)
            const advance = this.speed * dt
            if(advance >= d || d < 0.06)
            {
                this.x = step.to.x
                this.z = step.to.z
                finished = true
                // keep walking speed if another walk follows, so there is no stop-start
                if(!(s.steps[1] && s.steps[1].to)) this.speed = 0
            }
            else
            {
                // head for the target even while still turning
                this.x += dx / d * advance
                this.z += dz / d * advance
            }
        }
        else if(step.face !== undefined)
        {
            this.speed = 0
            this.turnTowards(step.face, dt, 6)
            finished = Math.abs(angleDiff(step.face, this.yaw)) < 0.03
        }
        else if(step.wave)
        {
            this.speed = 0
            this.character.setState({ wave: true })
            finished = s.t > step.wave
            if(finished) this.character.setState({ wave: false })
        }
        else if(step.sit)
        {
            this.mode = 'sit'
            this.script.sitting = true
            finished = true
        }
        else if(step.wait !== undefined) finished = s.t > step.wait
        else if(step.call) { step.call(); finished = true }

        if(finished)
        {
            s.steps.shift()
            s.t = 0
        }
    }

    turnTowards(target, dt, rate = TURN_RATE)
    {
        const diff = angleDiff(target, this.yaw)
        const step = Math.sign(diff) * Math.min(Math.abs(diff), rate * dt)
        this.yaw += step
        this.turn = step / Math.max(dt, 1e-4)
        return diff
    }

    // ---------------------------------------------------------------- update
    update(dt, cameraYaw, time)
    {
        const input = this.input
        this.turn *= Math.exp(-dt * 6)

        const canStand = this.mode === 'sit' || (this.mode === 'script' && this.script?.cancellable)
        if(canStand && (input.moving || input.consume('KeyE', 'Space'))) this.standUp()
        else if(this.mode === 'script' || (this.mode === 'sit' && this.script)) this.updateScript(dt)
        else if(this.mode === 'chute') this.updateChute(dt)
        else if(this.mode === 'ride' && this.vehicle && this.vehicle.flight) this.updateFlight(dt)
        else if(this.mode === 'ride') this.updateRide(dt)
        else this.updateWalk(dt, cameraYaw)

        // interactions
        if(this.mode === 'walk' || this.mode === 'ride')
        {
            this.findNearby()
            if(input.consume('KeyE'))
            {
                if(this.mode === 'ride') this.dismount()
                else if(this.nearVehicle) this.mount(this.nearVehicle)
            }
            if(input.consume('Enter') && this.nearby) this.emit('read', this.nearby.content)
        }
        this.checkChai(dt)
        if(this.ejected) this.updateEjected(dt)
        this.sync(dt)
    }

    // ---------------------------------------------------------------- parachute
    // E in the air: bail out. The plane is left to glide down, and you float to the ground
    eject()
    {
        const v = this.vehicle
        const f = v.flight
        f.throttle = 0
        f.say('Bailed out. The plane glides on without you', 3)
        this.ejected = v
        // the canopy starts on the plane's heading; it turns back toward land if it drifts out to sea
        this.chute = { h: f.h, open: 0, yaw: this.yaw, sway: 0, swayVel: 0, pitch: 0, home: nearestLand(f.x, f.z) }
        this.landing = null
        this.x = f.x
        this.z = f.z
        this.vehicle = null
        this.nearVehicle = null
        this.nearby = null
        this.mode = 'chute'
        this.speed = 0
        this.emit('eject')
    }

    updateChute(dt)
    {
        const c = this.chute
        const input = this.input
        // the canopy fills over about a second and a half; until then you fall fast
        c.open = Math.min(1, c.open + dt / 1.3)
        const brake = Math.max(0, input.move.y) // W slows the fall
        const dive = Math.max(0, -input.move.y) // S speeds it up
        const turn = input.move.x
        // steer with A and D: the canopy turns on the wind, slower while it is still filling
        c.yaw -= turn * 0.6 * dt * c.open
        // out over the sea, the canopy turns itself back toward the land it came from
        if(coastDistance(this.x, this.z) < 0)
        {
            const want = Math.atan2(c.home.x - this.x, c.home.z - this.z)
            c.yaw += angleDiff(want, c.yaw) * (1 - Math.exp(-dt * 0.9)) * c.open
        }
        // a slow wander on the wind, so the glide is never quite a straight line
        c.time = (c.time || 0) + dt
        c.yaw += Math.sin(c.time * 0.6) * 0.12 * c.open * dt
        // the glide: forward, a little slower when you brake
        const forward = 4.6 * c.open * (1 - 0.3 * brake)
        // the sink: a fast fall until the canopy fills, then a slow glide that quickens in a dive
        // and eases off in the last few metres (the flare)
        let sink = (1 - c.open) * 9 + c.open * Math.max(1.6, 4.2 - 1.6 * brake + 1.6 * dive)
        sink *= 1 - 0.5 * c.open * ramp(7, 1.5, c.h)
        // the pendulum: steering swings the harness out, and the canopy follows on a spring
        c.swayVel += (turn * 4 * c.open - 5 * c.sway - 2 * c.swayVel) * dt
        c.sway += c.swayVel * dt
        // the canopy tips forward when you brake and back when you dive
        const pitch = (brake * 0.16 - dive * 0.12) * c.open
        c.pitch += (pitch - c.pitch) * (1 - Math.exp(-dt * 3))
        c.h -= sink * dt
        this.yaw = c.yaw
        this.x += Math.sin(c.yaw) * forward * dt
        this.z += Math.cos(c.yaw) * forward * dt
        if(c.h <= 0) this.landChute()
    }

    landChute()
    {
        // a landing in the sea brings you ashore: to the nearest dry land, wherever it is
        if(coastDistance(this.x, this.z) < 0.6)
        {
            const shore = nearestShore(this.x, this.z)
            if(shore) { this.x = shore.x; this.z = shore.z }
            this.emit('splash')
        }
        this.chute = null
        this.mode = 'walk'
        this.speed = 0
        // the canopy folds up on the ground for a moment before it is put away
        this.landing = 0
        this.emit('landed')
    }

    // the plane flies on, with its throttle cut, until it lands or crashes; then it is left where it ends up
    updateEjected(dt)
    {
        const v = this.ejected
        const f = v.flight
        f.update(dt, { x: 0, y: -0.25 }, this.world.colliders, resolveCollisions)
        v.x = f.x
        v.z = f.z
        v.yaw = f.yaw
        if(v.collider)
        {
            v.collider.x = f.x
            v.collider.z = f.z
            v.collider.yaw = f.yaw
            v.collider.disabled = !f.onGround
        }
        f.apply(v.model.root)
        if(f.onGround && f.v < 1 && f.crashed <= 0) this.ejected = null
    }

    updateWalk(dt, cameraYaw)
    {
        const input = this.input
        const mx = input.move.x
        const my = input.move.y
        const amount = Math.hypot(mx, my)
        let targetSpeed = 0
        if(amount > 0.05)
        {
            // camera-relative direction in map space
            const fx = Math.sin(cameraYaw)
            const fz = Math.cos(cameraYaw)
            const rx = -fz
            const rz = fx
            const dx = fx * my + rx * mx
            const dz = fz * my + rz * mx
            const diff = this.turnTowards(Math.atan2(dx, dz), dt)
            targetSpeed = amount * (input.run ? RUN : WALK) * THREE.MathUtils.clamp(Math.cos(diff) * 0.8 + 0.35, 0, 1)
        }
        const accel = targetSpeed > this.speed ? 10 : 14
        this.speed += (targetSpeed - this.speed) * Math.min(1, dt * accel)
        if(this.speed < 0.02) this.speed = 0
        this.move(dt, 0.32)
    }

    move(dt, radius)
    {
        const nx = this.x + Math.sin(this.yaw) * this.speed * dt
        const nz = this.z + Math.cos(this.yaw) * this.speed * dt
        const pos = resolveCollisions({ x: nx, z: nz }, radius, this.world.colliders)
        // the sea stops you once it gets deep
        if(coastDistance(pos.x, pos.z) < -1.4)
        {
            this.speed *= 0.5
            return
        }
        const moved = Math.hypot(pos.x - this.x, pos.z - this.z)
        // slow down when walking into something
        if(dt > 0 && this.speed > 0.1 && moved < this.speed * dt * 0.35) this.speed *= 0.85
        this.x = pos.x
        this.z = pos.z
    }

    // ---------------------------------------------------------------- vehicles
    mount(vehicle)
    {
        // a car from the traffic: it stops and is yours
        if(vehicle.traffic) vehicle = this.world.takeTrafficCar(vehicle.traffic)
        if(!vehicle) return
        this.vehicle = vehicle
        vehicle.collider.disabled = true
        vehicle.ridden = true
        this.mode = 'ride'
        this.x = vehicle.x
        this.z = vehicle.z
        this.yaw = vehicle.yaw
        this.speed = 0
        this.steer = 0
        this.emit('mount', vehicle)
    }

    dismount()
    {
        const v = this.vehicle
        // in the air, E bails out under the parachute
        if(v.flight && !v.flight.onGround)
        {
            this.eject()
            return
        }
        // on the ground a plane can only be left when it is nearly still
        if(v.flight && Math.abs(v.flight.v) > 3)
        {
            v.flight.say('Slow down before you climb out', 3)
            return
        }
        v.x = this.x
        v.z = this.z
        // step out on the driver's side (the vehicle's left); a boat is left at the shore, on whichever
        // side or end has land, and out on the open sea there is nowhere to step
        const reach = v.box.hw + 0.6
        const lx = Math.cos(this.yaw)
        const lz = -Math.sin(this.yaw)
        let exit = { x: lx * reach, z: lz * reach }
        if(v.kind === 'boat')
        {
            const ahead = v.box.hd + 0.6
            const options = [
                { x: lx * reach, z: lz * reach },
                { x: -lx * reach, z: -lz * reach },
                { x: Math.sin(this.yaw) * ahead, z: Math.cos(this.yaw) * ahead }
            ]
            const dry = options.find((o) => coastDistance(this.x + o.x, this.z + o.z) >= 0.4)
            if(!dry)
            {
                this.emit('notice', 'Sail to the shore to get out')
                return
            }
            exit = dry
        }
        v.ridden = false
        v.x = this.x
        v.z = this.z
        v.yaw = this.yaw
        this.world.parkVehicle(v)
        const pos = resolveCollisions({ x: this.x + exit.x, z: this.z + exit.z }, 0.32, this.world.colliders)
        this.x = pos.x
        this.z = pos.z
        this.mode = 'walk'
        this.speed = 0
        this.vehicle = null
        this.emit('dismount', v)
    }

    // the map's fast travel: stand on the ground at a spot, facing a way. A car or a
    // grounded plane is left first; nothing happens in the air, or while falling or sitting
    jumpTo(x, z, yaw)
    {
        if(this.mode === 'chute' || this.mode === 'script' || this.mode === 'sit' || this.ejected) return false
        if(this.mode === 'ride')
        {
            if(this.vehicle.flight && !this.vehicle.flight.onGround) return false
            this.dismount()
            if(this.mode === 'ride') return false
        }
        this.x = x
        this.z = z
        this.yaw = yaw
        this.speed = 0
        this.steer = 0
        this.sync()
        this.emit('jump', { x, z })
        return true
    }

    // the plane: the keys and stick fly it, and its own model moves it
    updateFlight(dt)
    {
        const v = this.vehicle
        const f = v.flight
        const input = this.input
        // R and F set the throttle (the touch buttons do the same)
        const up = (input.down('KeyR') ? 1 : 0) + (input.throttleHold > 0 ? 1 : 0)
        const down = (input.down('KeyF') ? 1 : 0) + (input.throttleHold < 0 ? 1 : 0)
        f.throttle = Math.max(0, Math.min(1, f.throttle + (up - down) * 0.7 * dt))
        f.update(dt, { x: input.move.x, y: input.move.y }, this.world.colliders, resolveCollisions)
        this.x = f.x
        this.z = f.z
        this.yaw = f.yaw
        this.speed = f.v
        v.x = f.x
        v.z = f.z
        v.yaw = f.yaw
    }

    updateRide(dt)
    {
        const v = this.vehicle
        const input = this.input
        const throttle = input.move.y
        const steer = input.move.x
        const target = throttle > 0 ? throttle * v.maxSpeed * (input.run ? 1.15 : 1) : throttle < 0 ? throttle * v.reverse : 0
        const accel = Math.abs(target) > Math.abs(this.speed) ? v.accel : 3.5
        this.speed += (target - this.speed) * Math.min(1, dt * accel)
        this.steer += (steer - this.steer) * Math.min(1, dt * 6)
        const grip = Math.min(1, Math.abs(this.speed) / 3)
        const yawRate = -this.steer * v.steer * grip * Math.sign(this.speed || 1)
        this.yaw += yawRate * dt
        this.turn = yawRate
        const before = { x: this.x, z: this.z }
        // a boat sails the sea; everything else drives on land
        if(v.kind === 'boat') this.sail(dt)
        else this.move(dt, v.radius)
        // bumping into something at speed stops you
        const moved = Math.hypot(this.x - before.x, this.z - before.z)
        if(Math.abs(this.speed) > 3 && moved < Math.abs(this.speed) * dt * 0.3) this.speed *= 0.4
        // scooters lean into turns, cars roll a little the other way
        const amount = Math.min(1, Math.abs(this.speed) / 8)
        // scooters lean into turns, cars roll a little the other way, boats heel a little into them
        const lean = v.kind === 'scooter' ? this.steer * amount * 0.38 : v.kind === 'boat' ? this.steer * amount * 0.08 : -this.steer * amount * 0.05
        v.model.update(dt, this.speed, -this.steer, lean)
    }

    // a boat sails the sea: it stops at the shore, and nothing else stops it
    sail(dt)
    {
        const nx = this.x + Math.sin(this.yaw) * this.speed * dt
        const nz = this.z + Math.cos(this.yaw) * this.speed * dt
        if(coastDistance(nx, nz) > -1.2)
        {
            this.speed *= 0.3
            return
        }
        this.x = nx
        this.z = nz
    }

    standUp()
    {
        this.script = null
        this.mode = 'walk'
        this.character.setState({ wave: false })
        this.emit('stand')
    }

    // ---------------------------------------------------------------- chai stall ending
    checkChai(dt)
    {
        const stool = this.world.stool
        if(!stool) return
        const d = Math.hypot(this.x - stool.x, this.z - stool.z)
        const near = d < 5
        if(near !== this.atChai)
        {
            this.atChai = near
            if(near) this.chaiArmed = true
            this.emit(near ? 'chai-near' : 'chai-leave')
        }
        if(this.mode !== 'walk' || !near || !this.chaiArmed || this.input.moving || this.speed > 0.05)
        {
            this.idleTime = 0
            return
        }
        this.idleTime += dt
        if(this.idleTime > 1.4)
        {
            this.idleTime = 0
            this.chaiArmed = false
            const seat = { x: stool.x, z: stool.z }
            this.runScript([
                { to: { x: stool.x + Math.sin(stool.yaw) * 0.55, z: stool.z + Math.cos(stool.yaw) * 0.55 }, speed: 2.2 },
                { face: stool.yaw },
                { call: () => { this.x = seat.x; this.z = seat.z; this.yaw = stool.yaw } },
                { sit: true },
                { wait: 0.6 },
                { call: () => this.emit('sat') },
                { wave: 2.6 },
                { call: () => this.emit('waved') }
            ], null, { cancellable: true })
        }
    }

    // ---------------------------------------------------------------- nearby
    findNearby()
    {
        let best = null
        let bestD = Infinity
        for(const item of this.world.interactables)
        {
            const d = Math.hypot(item.x - this.x, item.z - this.z)
            if(d < item.radius && d < bestD) { best = item; bestD = d }
        }
        if(best !== this.nearby)
        {
            this.nearby = best
            this.emit('nearby', best)
        }
        let vehicle = null
        if(this.mode === 'walk')
        {
            for(const v of this.world.vehicles)
                if(Math.hypot(v.x - this.x, v.z - this.z) < v.box.hd + 1.4) vehicle = v
            // or any car in the traffic that has stopped next to you
            const car = vehicle ? null : this.world.trafficCarNear?.(this.x, this.z)
            if(car)
            {
                car.offer = car.offer || { traffic: car, label: 'Drive this car', box: { hd: 2.15 } }
                vehicle = car.offer
            }
        }
        if(vehicle !== this.nearVehicle)
        {
            this.nearVehicle = vehicle
            this.emit('vehicle', vehicle)
        }
    }

    // ---------------------------------------------------------------- sync visuals
    sync(dt = 0)
    {
        // in the plane the camera follows the aircraft, up in the air as well as on the ground
        const flying = this.mode === 'ride' && this.vehicle && this.vehicle.flight
        const chuting = this.mode === 'chute' && this.chute
        this.bobTime = (this.bobTime || 0) + dt
        // a boat floats on the sea: its height is the sea's, not the seabed's
        const sailing = this.mode === 'ride' && this.vehicle && this.vehicle.kind === 'boat'
        const h = (sailing ? 0 : heightAt(this.x, this.z)) + (flying ? this.vehicle.flight.h : chuting ? this.chute.h : 0)
        const root = this.character.root
        // the character is swapped for the real model when it loads, so the canopy follows the current one
        if(this.parachute.root.parent !== root) root.add(this.parachute.root)
        // sitting on the stool: face the visitor (stool yaw), seat height handled by the pose
        let yaw = this.yaw
        if(this.mode === 'sit' && this.world.stool) yaw = this.world.stool.yaw
        surfacePoint(this.x, this.z, h, this.position)
        mapToDir(this.x, this.z, this.up)

        if(flying)
        {
            // the plane is placed by its own flight model; the rider sits inside it
            const plane = this.vehicle
            plane.flight.apply(plane.model.root)
            root.position.copy(plane.model.root.position)
            root.quaternion.copy(plane.model.root.quaternion)
        }
        else if(this.mode === 'ride' && this.vehicle)
        {
            const v = this.vehicle
            place(v.model.root, this.x, this.z, this.yaw, h + 0.05 + (sailing ? Math.sin(this.bobTime * 1.4) * 0.07 : 0))
            // the hull heels a little into a turn
            if(sailing) v.model.root.rotateZ(v.model.lean.rotation.z)
            v.x = this.x
            v.z = this.z
            v.yaw = this.yaw
            // the rider sits in the seat and follows the body's lean
            root.position.copy(v.model.root.position)
            root.quaternion.copy(v.model.root.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), v.model.lean.rotation.z))
            root.translateX(v.seat.x)
            root.translateY(v.seat.y)
            root.translateZ(v.seat.z)
        }
        else
        {
            root.position.copy(this.position)
            root.quaternion.copy(frameQuaternion(this.x, this.z, yaw))
        }
        // falling: the body tips forward in a free fall and comes upright as the canopy fills; it leans into a turn
        if(chuting)
        {
            _tiltEuler.set(-1.0 * (1 - this.chute.open) ** 2, 0, this.chute.sway * 0.12)
            root.quaternion.multiply(_tiltQuat.setFromEuler(_tiltEuler))
        }
        // the canopy: shown while you fall, and while it folds up on the ground after a landing
        if(this.landing !== null) this.landing += dt
        const folding = this.landing !== null && this.landing < 0.9
        if(this.landing !== null && !folding) this.landing = null
        if(chuting) this.canopyState = { open: this.chute.open, pitch: this.chute.pitch, bank: this.chute.sway * 0.3, collapse: 0 }
        this.parachute.root.visible = !!chuting || folding
        if(chuting || folding)
        {
            this.canopyState.collapse = folding && !chuting ? this.landing / 0.9 : 0
            updateParachute(this.parachute, this.canopyState, dt)
        }
        // inside a closed car you can't see the driver
        root.visible = !(this.mode === 'ride' && this.vehicle && this.vehicle.hideRider)

        this.character.setState({
            speed: this.mode === 'ride' ? 0 : this.speed,
            walkSpeed: WALK,
            runSpeed: RUN,
            turn: this.mode === 'ride' ? 0 : this.turn,
            // hanging in the harness looks like sitting: the same pose
            mode: this.mode === 'ride' ? 'ride' : this.mode === 'sit' || this.mode === 'chute' ? 'sit' : this.speed > 0.05 ? 'move' : 'idle'
        })
        this.character.update(dt)
    }
}
