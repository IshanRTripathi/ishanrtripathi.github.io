import * as THREE from 'three'
import { frameQuaternion, surfacePoint } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { createCarMesh } from './props.js'

// A few cars driving round the loop road in the right-hand lane. They slow
// down for whatever is in front of them, Ishan included.

const LANE = 1.2
const CRUISE = 7.5

export class Traffic
{
    constructor(loop, count = 5)
    {
        // precompute cumulative lengths of the closed loop
        this.points = loop
        this.lengths = [ 0 ]
        for(let i = 1; i <= loop.length; i++)
        {
            const a = loop[i - 1]
            const b = loop[i % loop.length]
            this.lengths.push(this.lengths[i - 1] + Math.hypot(b.x - a.x, b.z - a.z))
        }
        this.total = this.lengths[this.lengths.length - 1]
        this.cars = []
        for(let i = 0; i < count; i++)
        {
            const mesh = createCarMesh(i)
            const car = { mesh, s: this.total * i / count + 3, speed: CRUISE, x: 0, z: 0, yaw: 0, collider: { type: 'box', x: 0, z: 0, yaw: 0, hw: 0.95, hd: 2.15, dynamic: true } }
            this.cars.push(car)
            this.place(car)
        }
    }

    sample(s)
    {
        s = ((s % this.total) + this.total) % this.total
        let lo = 0
        let hi = this.lengths.length - 1
        while(hi - lo > 1)
        {
            const mid = (lo + hi) >> 1
            if(this.lengths[mid] <= s) lo = mid
            else hi = mid
        }
        const a = this.points[lo % this.points.length]
        const b = this.points[(lo + 1) % this.points.length]
        const seg = this.lengths[lo + 1] - this.lengths[lo] || 1
        const t = (s - this.lengths[lo]) / seg
        const tx = (b.x - a.x) / seg
        const tz = (b.z - a.z) / seg
        // right-hand lane: right of the direction of travel is (tz, -tx)
        return { x: a.x + (b.x - a.x) * t + tz * LANE, z: a.z + (b.z - a.z) * t - tx * LANE, yaw: Math.atan2(tx, tz) }
    }

    place(car)
    {
        const p = this.sample(car.s)
        // smooth the heading over a couple of metres so cars don't twitch on corners
        const ahead = this.sample(car.s + 2.5)
        car.x = p.x
        car.z = p.z
        car.yaw = Math.atan2(ahead.x - p.x, ahead.z - p.z)
        car.mesh.position.copy(surfacePoint(p.x, p.z, heightAt(p.x, p.z) + 0.07))
        car.mesh.quaternion.copy(frameQuaternion(p.x, p.z, car.yaw))
        Object.assign(car.collider, { x: car.x, z: car.z, yaw: car.yaw })
    }

    // obstacles: [{ x, z }] things the cars must not hit (Ishan, his vehicle)
    update(dt, obstacles)
    {
        for(const car of this.cars)
        {
            let target = CRUISE
            const fx = Math.sin(car.yaw)
            const fz = Math.cos(car.yaw)
            const check = (x, z, gap) =>
            {
                const dx = x - car.x
                const dz = z - car.z
                const along = dx * fx + dz * fz
                const side = Math.abs(dx * fz - dz * fx)
                if(along > 0 && along < gap && side < 2.2) target = Math.min(target, Math.max(0, (along - 3.2) * 1.4))
            }
            for(const o of obstacles) check(o.x, o.z, 9)
            for(const other of this.cars) if(other !== car) check(other.x, other.z, 10)
            const rate = target < car.speed ? 6 : 1.5
            car.speed += (target - car.speed) * Math.min(1, dt * rate)
            car.s += car.speed * dt
            this.place(car)
        }
    }
}

void THREE
