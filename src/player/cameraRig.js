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
        this.clearNow = null // the eased clear distance behind the player (see updateClearance)
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
        const wanted = this.distance
        this.distance = this.reach(player, wanted)
        const result = this.followPoseAt(player, out)
        this.distance = wanted
        return result
    }

    // how far back the camera wants to be for what the player is doing right now
    reach(player, distance)
    {
        // under the canopy: far enough back to see the whole chute, and the ground coming up
        if(player.mode === 'chute') return Math.max(distance, 13)
        if(player.mode !== 'ride' || !player.vehicle) return distance
        // cars get a wider view, the plane room to see the ground fall away, a boat a wide view over the water
        const kind = player.vehicle.kind
        if(kind === 'car') return Math.max(distance, 11)
        if(kind === 'plane') return Math.max(distance, 17)
        if(kind === 'boat') return Math.max(distance, 12)
        return distance
    }

    followPoseAt(player, out)
    {
        const P = player.position
        const U = player.up
        const F = mapTangent(player.x, player.z, Math.sin(this.yaw), Math.cos(this.yaw), new THREE.Vector3())
        // the look-at point: the rider, or the canopy above him while he hangs under it
        // in the plane the camera looks at the aircraft itself, so it stays in the middle of the frame
        const inPlane = player.mode === 'ride' && player.vehicle && player.vehicle.flight
        const lift = player.mode === 'sit' ? 0.9 : player.mode === 'chute' ? 3.1 : inPlane ? 0.2 : 1.35
        out.position.copy(P)
            .addScaledVector(U, lift + this.distance * Math.sin(this.pitch))
            .addScaledVector(F, -this.distance * Math.cos(this.pitch))
        out.target.copy(P).addScaledVector(U, lift - 0.05)
        out.up.copy(U)

        // pull in rather than end up inside a building (the clear distance is eased, so this never jumps)
        const minimum = player.mode === 'chute' ? 9 : player.mode === 'ride' && player.vehicle && (player.vehicle.kind === 'car' || player.vehicle.kind === 'plane' || player.vehicle.kind === 'boat') ? (player.vehicle.kind === 'plane' ? 8 : 6.5) : 3
        const clear = this.clearNow == null ? this.clearDistance(player, this.distance) : Math.min(this.clearNow, this.distance)
        const dist = Math.max(Math.min(minimum, this.distance), clear)
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

    // the eased clear distance: a wall that appears behind the camera pulls it in quickly, and one
    // that goes away lets it drift back slowly. Without this the camera jumped by whole steps as
    // walls and cars moved past it.
    updateClearance(player, dt)
    {
        const want = this.clearDistance(player, this.reach(player, this.distance))
        if(this.clearNow == null)
        {
            this.clearNow = want
            return
        }
        // the speed is capped, so a wall that just touched the back ray moves the camera as a steady
        // dolly (pulling in faster than it drifts back out) rather than as a sudden step
        const gap = want - this.clearNow
        const cap = (gap < 0 ? 9 : 2.5) * dt
        this.clearNow += clamp(gap, -cap, cap)
    }

    // how far back the camera can go along the back ray before a wall stands in the way. This is the
    // exact distance at which the ray first enters a wall (not a sampled step), so it changes smoothly
    // as the player moves instead of stepping.
    clearDistance(player, distance)
    {
        if(!this.colliders) return distance
        const back = Math.cos(this.pitch)
        const dirX = -Math.sin(this.yaw) * back
        const dirZ = -Math.cos(this.yaw) * back
        const reach = (distance + 12) * (distance + 12)
        let hit = Infinity
        for(const c of this.colliders)
        {
            // traffic drives past: it passes in front of the lens and never pulls the camera in
            if(c.type !== 'box' || c.thin || c.dynamic) continue
            const px = player.x - c.x
            const pz = player.z - c.z
            if(px * px + pz * pz > reach) continue
            if(this.contains(c, player.x, player.z)) continue
            // the ray, in the wall's own frame: u and v are linear in the distance s along the ray
            const fx = Math.sin(c.yaw)
            const fz = Math.cos(c.yaw)
            const u0 = px * fz - pz * fx
            const v0 = px * fx + pz * fz
            const du = dirX * fz - dirZ * fx
            const dv = dirX * fx + dirZ * fz
            const Hu = c.hw + 0.4
            const Hv = c.hd + 0.4
            let lo = 0
            let high = distance
            if(Math.abs(du) < 1e-9) { if(Math.abs(u0) >= Hu) continue }
            else
            {
                const a = (-Hu - u0) / du
                const b = (Hu - u0) / du
                lo = Math.max(lo, Math.min(a, b))
                high = Math.min(high, Math.max(a, b))
            }
            if(Math.abs(dv) < 1e-9) { if(Math.abs(v0) >= Hv) continue }
            else
            {
                const a = (-Hv - v0) / dv
                const b = (Hv - v0) / dv
                lo = Math.max(lo, Math.min(a, b))
                high = Math.min(high, Math.max(a, b))
            }
            if(lo < high && lo < hit) hit = lo
        }
        return hit < distance ? Math.max(3, hit - 0.3) : distance
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
        this.clearNow = null
    }

    startFly(duration = 3.6)
    {
        this.mode = 'fly'
        this.fly = { t: 0, duration: this.reducedMotion ? 0.01 : duration, from: null }
        this.clearNow = null
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
                if(sinceDrag > 0.8) this.yaw += angleDiff(player.yaw, this.yaw) * (1 - Math.exp(-dt * (player.vehicle && player.vehicle.kind === 'plane' ? 7 : player.vehicle && player.vehicle.kind === 'car' ? 4 : 2.6)))
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

        if(this.mode !== 'orbit') this.updateClearance(player, dt)

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

        // smoothing. The orbit is already smooth, so it is copied straight over. The fly and follow
        // poses ease toward their target, so a character's step, a turning yaw or a changed distance
        // reaches the lens as a glide rather than a jump.
        if(!this.smoothed || this.mode === 'orbit')
        {
            this.smoothed = { position: pose.position.clone(), target: pose.target.clone(), up: pose.up.clone() }
        }
        else
        {
            // in the plane the camera has to keep up with it: a slow ease lets a climbing plane drift out
            // of the top of the frame, so it locks on tight
            const flying = player.mode === 'ride' && player.vehicle && player.vehicle.flight
            const fast = this.mode === 'fly' ? 9 : flying ? 40 : 7
            const turn = this.mode === 'fly' ? 13 : flying ? 60 : 12
            const k = 1 - Math.exp(-dt * fast)
            const kt = 1 - Math.exp(-dt * turn)
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

// spherical interpolation between two unit directions. Directions that are almost opposite have no
// single arc between them, so the path swings round through a side direction instead.
function slerpVectors(a, b, t)
{
    const dot = clamp(a.dot(b), -1, 1)
    const omega = Math.acos(dot)
    if(omega < 1e-4) return a.clone().lerp(b, t).normalize()
    if(omega > 2.9)
    {
        const side = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
        const m = new THREE.Vector3().crossVectors(a, side).normalize()
        return t < 0.5 ? slerpVectors(a, m, t * 2) : slerpVectors(m, b, t * 2 - 1)
    }
    const s = Math.sin(omega)
    return a.clone().multiplyScalar(Math.sin((1 - t) * omega) / s).addScaledVector(b, Math.sin(t * omega) / s)
}
