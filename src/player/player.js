import * as THREE from 'three'
import { surfacePoint, frameQuaternion, mapToDir } from '../core/geo.js'
import { heightAt, coastDistance } from '../world/terrain.js'
import { layout } from '../world/layout.js'
import { Character } from './character.js'
import { place } from '../world/world.js'

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
        this.sync(dt)
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
        this.vehicle = vehicle
        vehicle.collider.disabled = true
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
        v.x = this.x
        v.z = this.z
        v.yaw = this.yaw
        this.world.parkVehicle(v)
        // step out on the driver's side (the vehicle's left)
        const lx = Math.cos(this.yaw)
        const lz = -Math.sin(this.yaw)
        const out = v.box.hw + 0.6
        const pos = resolveCollisions({ x: this.x + lx * out, z: this.z + lz * out }, 0.32, this.world.colliders)
        this.x = pos.x
        this.z = pos.z
        this.mode = 'walk'
        this.speed = 0
        this.vehicle = null
        this.emit('dismount', v)
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
        this.move(dt, v.radius)
        // bumping into something at speed stops you
        const moved = Math.hypot(this.x - before.x, this.z - before.z)
        if(Math.abs(this.speed) > 3 && moved < Math.abs(this.speed) * dt * 0.3) this.speed *= 0.4
        // scooters lean into turns, cars roll a little the other way
        const amount = Math.min(1, Math.abs(this.speed) / 8)
        const lean = v.kind === 'scooter' ? this.steer * amount * 0.38 : -this.steer * amount * 0.05
        v.model.update(dt, this.speed, -this.steer, lean)
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
            for(const v of this.world.vehicles)
                if(Math.hypot(v.x - this.x, v.z - this.z) < v.box.hd + 1.4) vehicle = v
        if(vehicle !== this.nearVehicle)
        {
            this.nearVehicle = vehicle
            this.emit('vehicle', vehicle)
        }
    }

    // ---------------------------------------------------------------- sync visuals
    sync(dt = 0)
    {
        const h = heightAt(this.x, this.z)
        const root = this.character.root
        // sitting on the stool: face the visitor (stool yaw), seat height handled by the pose
        let yaw = this.yaw
        if(this.mode === 'sit' && this.world.stool) yaw = this.world.stool.yaw
        surfacePoint(this.x, this.z, h, this.position)
        mapToDir(this.x, this.z, this.up)

        if(this.mode === 'ride' && this.vehicle)
        {
            const v = this.vehicle
            place(v.model.root, this.x, this.z, this.yaw, h + 0.05)
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

        this.character.setState({
            speed: this.mode === 'ride' ? 0 : this.speed,
            walkSpeed: WALK,
            runSpeed: RUN,
            turn: this.mode === 'ride' ? 0 : this.turn,
            mode: this.mode === 'ride' ? 'ride' : this.mode === 'sit' ? 'sit' : this.speed > 0.05 ? 'move' : 'idle'
        })
        this.character.update(dt)
    }
}
