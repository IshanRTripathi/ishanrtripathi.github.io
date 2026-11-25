import * as THREE from 'three'
import { R, mapTangent } from '../core/geo.js'
import { heightAt } from '../world/terrain.js'
import { BAY_ANGLE } from '../world/layout.js'
import { clamp } from '../core/noise.js'

function angleDiff(a, b)
{
    let d = a - b
    while(d > Math.PI) d -= Math.PI * 2
    while(d < -Math.PI) d += Math.PI * 2
    return d
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export class CameraRig
{
    constructor(camera, input)
    {
        this.camera = camera
        this.input = input
        this.mode = 'orbit' // orbit | fly | follow
        this.yaw = 0
        this.pitch = 0.36
        this.distance = 8
        this.orbitAngle = BAY_ANGLE + 1.25
        this.fly = null
        this.lastDrag = -Infinity
        this.pose = { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }
        this.smoothed = null
        this.viewShift = { x: 0, y: 0 }
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    orbitPose(time, out)
    {
        const a = this.orbitAngle + (this.reducedMotion ? 0 : time * 0.035)
        const e = 0.92
        const d = R * 3.7
        out.position.set(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d + R * 0.2, Math.sin(a) * Math.cos(e) * d)
        out.target.set(0, R * 0.42, 0)
        out.up.set(0, 1, 0)
        return out
    }

    followPose(player, out)
    {
        // cars get a wider view
        const wanted = this.distance
        if(player.mode === 'ride' && player.vehicle && player.vehicle.kind === 'car') this.distance = Math.max(this.distance, 11)
        // the plane gets room to see the ground fall away
        if(player.mode === 'ride' && player.vehicle && player.vehicle.kind === 'plane') this.distance = Math.max(this.distance, 17)
        const result = this.followPoseAt(player, out)
        this.distance = wanted
        return result
    }

    followPoseAt(player, out)
    {
        const P = player.position
        const U = player.up
        const F = mapTangent(player.x, player.z, Math.sin(this.yaw), Math.cos(this.yaw), new THREE.Vector3())
        const lift = player.mode === 'sit' ? 0.9 : 1.35
        out.position.copy(P)
            .addScaledVector(U, lift + this.distance * Math.sin(this.pitch))
            .addScaledVector(F, -this.distance * Math.cos(this.pitch))
        out.target.copy(P).addScaledVector(U, lift - 0.05)
        out.up.copy(U)

        // pull in rather than end up inside a building
        const minimum = player.mode === 'ride' && player.vehicle && (player.vehicle.kind === 'car' || player.vehicle.kind === 'plane') ? (player.vehicle.kind === 'plane' ? 8 : 6.5) : 3
        const dist = Math.max(Math.min(minimum, this.distance), this.clearDistance(player, this.distance))
        if(dist < this.distance)
        {
            out.position.copy(P)
                .addScaledVector(U, lift + dist * Math.sin(this.pitch))
                .addScaledVector(F, -dist * Math.cos(this.pitch))
        }

        // keep the camera above the ground it is over
        const back = dist * Math.cos(this.pitch)
        const cx = player.x - Math.sin(this.yaw) * back
        const cz = player.z - Math.cos(this.yaw) * back
        const ground = R + heightAt(cx, cz) + 0.7
        const len = out.position.length()
        if(len < ground) out.position.multiplyScalar(ground / len)
        return out
    }

    clearDistance(player, distance)
    {
        if(!this.colliders) return distance
        const steps = 14
        const back = Math.cos(this.pitch)
        const sx = -Math.sin(this.yaw) * back
        const sz = -Math.cos(this.yaw) * back
        for(let i = 1; i <= steps; i++)
        {
            const d = distance * i / steps
            const x = player.x + sx * d
            const z = player.z + sz * d
            for(const c of this.colliders)
            {
                if(c.type !== 'box' || c.thin) continue
                const dx = x - c.x
                const dz = z - c.z
                if(dx * dx + dz * dz > 300) continue
                const fx = Math.sin(c.yaw)
                const fz = Math.cos(c.yaw)
                const u = dx * fz - dz * fx
                const v = dx * fx + dz * fz
                if(Math.abs(u) < c.hw + 0.4 && Math.abs(v) < c.hd + 0.4 && !this.contains(c, player.x, player.z))
                    return Math.max(3, distance * (i - 1) / steps - 0.3)
            }
        }
        return distance
    }

    contains(c, x, z)
    {
        const dx = x - c.x
        const dz = z - c.z
        const fx = Math.sin(c.yaw)
        const fz = Math.cos(c.yaw)
        return Math.abs(dx * fz - dz * fx) < c.hw + 0.1 && Math.abs(dx * fx + dz * fz) < c.hd + 0.1
    }

    // after a jump: the camera goes straight to where the player is, instead of sliding there
    snap()
    {
        this.smoothed = null
    }

    startFly(duration = 3.6)
    {
        this.mode = 'fly'
        this.fly = { t: 0, duration: this.reducedMotion ? 0.01 : duration, from: null }
    }

    update(dt, time, player)
    {
        const input = this.input

        // manual control
        if(this.mode !== 'orbit')
        {
            if(input.drag.dx || input.drag.dy)
            {
                // thumbs on small screens need more turn per pixel than a mouse
                const k = input.drag.touch ? 1.6 : 1
                this.yaw -= input.drag.dx * 0.0055 * k
                this.pitch = clamp(this.pitch + input.drag.dy * 0.004 * k, 0.06, 1.15)
                this.lastDrag = time
            }
            if(input.zoom) this.distance = clamp(this.distance * Math.pow(1.12, input.zoom), 3.5, 18)

            // drift behind the player while they move away from the camera
            const sinceDrag = time - this.lastDrag
            if(player.mode === 'ride')
            {
                if(sinceDrag > 0.8) this.yaw += angleDiff(player.yaw, this.yaw) * (1 - Math.exp(-dt * (player.vehicle && player.vehicle.kind === 'car' ? 4 : 2.6)))
            }
            else if(player.mode === 'sit' && player.world.stool)
            {
                const want = player.world.stool.yaw + Math.PI
                this.yaw += angleDiff(want, this.yaw) * (1 - Math.exp(-dt * 1.6))
                this.pitch += (0.2 - this.pitch) * (1 - Math.exp(-dt * 1.6))
            }
            else if(player.speed > 0.4 && sinceDrag > 1.2)
            {
                const diff = angleDiff(player.yaw, this.yaw)
                const facing = Math.max(0, Math.cos(diff))
                this.yaw += diff * (1 - Math.exp(-dt * 1.5 * facing * Math.min(1, player.speed / 3)))
            }
        }

        const pose = this.pose
        if(this.mode === 'orbit') this.orbitPose(time, pose)
        else if(this.mode === 'follow') this.followPose(player, pose)
        else if(this.mode === 'fly')
        {
            const f = this.fly
            f.t += dt
            const k = clamp(f.t / f.duration, 0, 1)
            const e = easeInOut(k)
            const a = this.orbitPose(time, { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() })
            const b = this.followPose(player, { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() })
            // swing around the planet instead of cutting through it
            const da = a.position.clone().normalize()
            const db = b.position.clone().normalize()
            const dir = slerpVectors(da, db, e)
            const radius = THREE.MathUtils.lerp(a.position.length(), b.position.length(), easeInOut(clamp(k * 1.08, 0, 1)))
            pose.position.copy(dir).multiplyScalar(radius)
            pose.target.lerpVectors(a.target, b.target, easeInOut(clamp(k * 1.25, 0, 1)))
            pose.up.copy(slerpVectors(a.up, b.up, e))
            if(k >= 1)
            {
                this.mode = 'follow'
                this.fly = null
            }
        }

        // smoothing (orbit and fly already move smoothly)
        if(!this.smoothed || this.mode !== 'follow')
        {
            this.smoothed = { position: pose.position.clone(), target: pose.target.clone(), up: pose.up.clone() }
        }
        else
        {
            const k = 1 - Math.exp(-dt * 7)
            const kt = 1 - Math.exp(-dt * 12)
            this.smoothed.position.lerp(pose.position, k)
            this.smoothed.target.lerp(pose.target, kt)
            this.smoothed.up.lerp(pose.up, k).normalize()
        }

        const cam = this.camera
        cam.position.copy(this.smoothed.position)
        cam.up.copy(this.smoothed.up)
        cam.lookAt(this.smoothed.target)

        // in the title screen the planet sits off-centre, next to the text
        const target = this.mode === 'orbit' && this.titleShift ? this.titleShift : { x: 0, y: 0 }
        const ks = 1 - Math.exp(-dt * 2.5)
        this.viewShift.x += (target.x - this.viewShift.x) * ks
        this.viewShift.y += (target.y - this.viewShift.y) * ks
        const w = window.innerWidth
        const h = window.innerHeight
        if(Math.abs(this.viewShift.x) + Math.abs(this.viewShift.y) > 0.5) cam.setViewOffset(w, h, -this.viewShift.x, -this.viewShift.y, w, h)
        else if(cam.view) cam.clearViewOffset()
    }

    get localUp()
    {
        return this.smoothed ? this.smoothed.up : this.pose.up
    }
}

function slerpVectors(a, b, t)
{
    const dot = clamp(a.dot(b), -1, 1)
    const omega = Math.acos(dot)
    if(omega < 1e-4) return a.clone().lerp(b, t).normalize()
    const s = Math.sin(omega)
    return a.clone().multiplyScalar(Math.sin((1 - t) * omega) / s).addScaledVector(b, Math.sin(t * omega) / s)
}

