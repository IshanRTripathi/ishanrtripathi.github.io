import * as THREE from 'three'
import { Kit } from '../models/kit.js'
import { C } from './buildings.js'

// A classic 1960s-style scooter: mint body, cream seat, round headlight.
// Wheels and handlebar are separate so they can spin and steer.

const BODY = '#9AD3BC'
const BODY_DARK = '#7FBFA6'

export class Scooter
{
    constructor()
    {
        this.root = new THREE.Group()
        this.root.name = 'scooter'
        this.lean = new THREE.Group()
        this.root.add(this.lean)

        const kit = new Kit()
        // floorboard and rear body
        kit.box(0.42, 0.1, 0.8, BODY_DARK, { y: 0.28, z: 0.1 })
        kit.box(0.5, 0.42, 0.75, BODY, { y: 0.32, z: -0.42 })
        kit.sphere(0.3, BODY, { y: 0.62, z: -0.5, sx: 0.9, sz: 1.35, sy: 0.55 }, 1)
        // seat
        kit.box(0.34, 0.12, 0.72, C.cream, { y: 0.74, z: -0.38 })
        kit.box(0.36, 0.05, 0.74, '#D9CBA8', { y: 0.72, z: -0.38 })
        // leg shield and front mudguard
        kit.box(0.46, 0.68, 0.1, BODY, { y: 0.3, z: 0.52, rx: -0.15 })
        kit.sphere(0.2, BODY, { y: 0.44, z: 0.78, sx: 0.8, sy: 0.6, sz: 1.2 })
        // tail light and spare wheel
        kit.box(0.14, 0.07, 0.05, C.red, { y: 0.62, z: -0.92 })
        kit.cyl(0.18, 0.18, 0.08, 10, '#2B2D31', { y: 0.5, z: -0.85, rx: Math.PI / 2, center: true })
        kit.cyl(0.11, 0.11, 0.1, 10, C.cream, { y: 0.5, z: -0.86, rx: Math.PI / 2, center: true })
        const body = kit.mesh()
        this.lean.add(body)

        // steering column with handlebar, headlight and mirror
        this.steer = new THREE.Group()
        this.steer.position.set(0, 0.2, 0.6)
        this.steer.rotation.x = -0.28
        const s = new Kit()
        s.cyl(0.04, 0.04, 0.85, 6, '#5C6670', {})
        s.box(0.7, 0.05, 0.05, '#5C6670', { y: 0.85 })
        s.box(0.1, 0.06, 0.06, '#2B2D31', { x: -0.33, y: 0.85, center: true })
        s.box(0.1, 0.06, 0.06, '#2B2D31', { x: 0.33, y: 0.85, center: true })
        s.box(0.3, 0.14, 0.14, BODY, { y: 0.8, z: 0.02 })
        s.cyl(0.09, 0.09, 0.07, 10, '#FFF4CF', { y: 0.82, z: 0.1, rx: Math.PI / 2, center: true })
        s.cyl(0.005, 0.005, 0.25, 4, '#C8CDD2', { x: 0.22, y: 0.88, z: 0 })
        s.cyl(0.06, 0.06, 0.02, 8, '#C8CDD2', { x: 0.22, y: 1.13, rx: Math.PI / 2, center: true })
        this.steer.add(s.mesh())
        this.lean.add(this.steer)

        const wheel = () =>
        {
            const w = new Kit()
            w.cyl(0.2, 0.2, 0.12, 12, '#2B2D31', { rz: Math.PI / 2, center: true })
            w.cyl(0.1, 0.1, 0.14, 8, '#C8CDD2', { rz: Math.PI / 2, center: true })
            return w.mesh()
        }
        this.front = wheel()
        this.front.position.set(0, 0.2, 0.68)
        this.rear = wheel()
        this.rear.position.set(0, 0.2, -0.5)
        this.lean.add(this.front, this.rear)

        // where the rider's hands and seat are, in scooter space
        this.seat = new THREE.Vector3(0, 0.12, -0.3)
    }

    update(dt, speed, steer, lean)
    {
        const spin = speed * dt / 0.2
        this.front.rotation.x += spin
        this.rear.rotation.x += spin
        this.steer.rotation.y += ((steer * 0.4) - this.steer.rotation.y) * Math.min(1, dt * 10)
        this.lean.rotation.z += (lean - this.lean.rotation.z) * Math.min(1, dt * 6)
    }
}

