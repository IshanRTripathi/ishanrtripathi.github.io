import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { neonMaterial } from './neon.js'

// An original 1980s-style wedge convertible: long low nose, pop-up lights,
// side strakes, two bucket seats. Wheels are separate so they can spin and steer.

const TYRE = '#22242A'
const RIM = '#D8DDE3'

function wedge(kit, paint, stripe, stripe2, interior)
{
    const W = 1.76
    // body slab pieces (low poly, chunky)
    kit.box(W, 0.32, 4.1, paint, { y: 0.3 })
    kit.box(W, 0.26, 2.2, paint, { y: 0.62, z: -0.9 })
    // sloping nose
    kit.box(W, 0.24, 1.9, paint, { y: 0.56, z: 1.1, rx: 0.09 })
    // side strakes and stripes
    for(const sx of [ -1, 1 ])
    {
        kit.box(0.04, 0.08, 3.9, stripe, { x: sx * W / 2, y: 0.5 })
        kit.box(0.04, 0.05, 3.9, stripe2, { x: sx * W / 2, y: 0.42 })
        for(let i = 0; i < 4; i++) kit.box(0.05, 0.05, 0.5, '#2B2D31', { x: sx * (W / 2 + 0.005), y: 0.64 - i * 0.07, z: -0.55 })
    }
    // bumpers, grille, tail lights
    kit.box(W + 0.04, 0.16, 0.12, '#2B2D31', { y: 0.24, z: 2.08 })
    kit.box(W + 0.04, 0.16, 0.12, '#2B2D31', { y: 0.24, z: -2.08 })
    kit.box(W * 0.9, 0.1, 0.06, '#E0483D', { y: 0.62, z: -2.03 })
    // closed pop-up headlights
    for(const sx of [ -0.55, 0.55 ]) kit.box(0.5, 0.06, 0.38, paint, { x: sx, y: 0.79, z: 1.55, rx: 0.09 })
    // cockpit: windscreen frame, seats, wheel
    kit.box(W - 0.2, 0.55, 0.06, '#9FD8E8', { y: 0.78, z: 0.35, rx: -0.55 })
    kit.box(W - 0.1, 0.06, 0.08, '#2B2D31', { y: 1.22, z: 0.12, rx: -0.55 })
    kit.box(W - 0.3, 0.12, 1.4, interior, { y: 0.62, z: -0.45 })
    for(const sx of [ -0.42, 0.42 ])
    {
        kit.box(0.55, 0.14, 0.6, interior, { x: sx, y: 0.7, z: -0.45 })
        kit.box(0.55, 0.62, 0.14, interior, { x: sx, y: 0.7, z: -0.8, rx: -0.15 })
    }
    kit.torus(0.17, 0.03, '#2B2D31', { x: 0.42, y: 1.0, z: 0.05, rx: -0.9 }, 4, 10)
    // roll bar
    kit.box(W - 0.15, 0.08, 0.08, '#2B2D31', { y: 1.25, z: -1.12 })
    for(const sx of [ -1, 1 ]) kit.box(0.08, 0.5, 0.08, '#2B2D31', { x: sx * (W / 2 - 0.12), y: 0.78, z: -1.12 })
}

export class Car
{
    constructor({ paint = '#F7F3EE', stripe = '#FF4FA3', stripe2 = '#2DE2E6', interior = '#C8414B', lights = true } = {})
    {
        this.root = new THREE.Group()
        this.root.name = 'car'
        this.lean = new THREE.Group()
        this.root.add(this.lean)

        const kit = new Kit()
        wedge(kit, paint, stripe, stripe2, interior)
        this.lean.add(kit.mesh(clayMaterial))

        if(lights)
        {
            const glow = new Kit()
            glow.box(1.5, 0.06, 0.04, '#FF2E4D', { y: 0.62, z: -2.07 })
            const g = new THREE.Mesh(glow.geometry(), neonMaterial)
            this.lean.add(g)
        }

        const wheel = () =>
        {
            const w = new Kit()
            w.cyl(0.34, 0.34, 0.26, 12, TYRE, { rz: Math.PI / 2, center: true })
            w.cyl(0.2, 0.2, 0.28, 8, RIM, { rz: Math.PI / 2, center: true })
            const group = new THREE.Group()
            const spin = w.mesh(clayMaterial)
            group.add(spin)
            group.userData.spin = spin
            return group
        }
        this.wheels = []
        for(const [ x, z, front ] of [ [ 0.8, 1.35, true ], [ -0.8, 1.35, true ], [ 0.8, -1.35, false ], [ -0.8, -1.35, false ] ])
        {
            const w = wheel()
            w.position.set(x, 0.34, z)
            w.userData.front = front
            this.root.add(w)
            this.wheels.push(w)
        }
        // driver's seat (left-hand drive: the car's left is +x)
        this.seat = new THREE.Vector3(0.42, 0.2, -0.45)
        this.steerAngle = 0
    }

    update(dt, speed, steer, lean)
    {
        const spin = speed * dt / 0.34
        this.steerAngle += (steer * 0.45 - this.steerAngle) * Math.min(1, dt * 10)
        for(const w of this.wheels)
        {
            w.userData.spin.rotation.x += spin
            if(w.userData.front) w.rotation.y = this.steerAngle
        }
        this.lean.rotation.z += (lean - this.lean.rotation.z) * Math.min(1, dt * 6)
    }
}
