import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { neonMaterial } from './neon.js'

// A little cream-and-pink sport plane, built from the same clay parts as the
// rest of the city. Nose towards +z, wheels on the ground at y = 0.

const PAINT = '#FBF7F0'
const STRIPE = '#FF4FA3'
const STRIPE2 = '#2DE2E6'
const GLASS = '#9FD8E8'
const DARK = '#2B2D31'
const TYRE = '#22242A'
const RIM = '#D8DDE3'

export function buildPlane()
{
    const root = new THREE.Group()
    root.name = 'plane'
    const body = new THREE.Group()
    root.add(body)

    const kit = new Kit()
    // fuselage: a long tube, rounded nose, tapered tail
    kit.cyl(0.42, 0.5, 4.2, 12, PAINT, { y: 1.05, z: -0.4, rx: Math.PI / 2, center: true })
    kit.cone(0.46, 0.9, 12, PAINT, { y: 1.05, z: 1.85, rx: Math.PI / 2, center: true })
    kit.cyl(0.14, 0.3, 1.6, 8, PAINT, { y: 1.12, z: -2.9, rx: Math.PI / 2, center: true })
    // stripes along the side
    for(const sx of [ -1, 1 ]) kit.box(0.04, 0.12, 3.6, STRIPE, { x: sx * 0.47, y: 1.02, z: -0.5 })
    kit.box(0.04, 0.08, 3.6, STRIPE2, { x: 0, y: 0.56, z: -0.5 })
    // canopy
    kit.box(0.7, 0.42, 1.2, GLASS, { y: 1.52, z: 0.5 })
    kit.box(0.74, 0.08, 1.24, DARK, { y: 1.74, z: 0.5 })
    // main wings (low, straight) and tailplane
    kit.box(8.2, 0.12, 1.5, PAINT, { y: 0.96, z: 0.3 })
    for(const sx of [ -1, 1 ]) kit.box(1.1, 0.12, 1.3, STRIPE, { x: sx * 3.6, y: 0.97, z: 0.25 })
    kit.box(2.6, 0.1, 0.9, PAINT, { y: 1.1, z: -2.25 })
    // tail fin, rudder stripe
    kit.box(0.1, 1.05, 0.95, PAINT, { y: 1.6, z: -2.25 })
    kit.box(0.12, 0.42, 0.6, STRIPE, { y: 1.8, z: -2.45 })
    // struts from fuselage to wings
    for(const sx of [ -1, 1 ]) kit.box(0.06, 0.5, 0.06, DARK, { x: sx * 1.4, y: 0.5, z: 0.3 })
    // landing gear: two mains, a nose wheel
    for(const sx of [ -1, 1 ]) kit.box(0.08, 0.5, 0.08, DARK, { x: sx * 1.05, y: 0.12, z: 0.25 })
    kit.box(0.08, 0.5, 0.08, DARK, { y: 0.12, z: 1.4 })
    body.add(kit.mesh(clayMaterial))

    // wheels, spun by the speed
    const wheels = []
    for(const [ x, z ] of [ [ -1.05, 0.25 ], [ 1.05, 0.25 ], [ 0, 1.4 ] ])
    {
        const w = new Kit()
        w.cyl(0.24, 0.24, 0.16, 10, TYRE, { rz: Math.PI / 2, center: true })
        w.cyl(0.12, 0.12, 0.18, 8, RIM, { rz: Math.PI / 2, center: true })
        const group = new THREE.Group()
        group.position.set(x, 0.24, z)
        const spin = w.mesh(clayMaterial)
        group.add(spin)
        group.userData.spin = spin
        body.add(group)
        wheels.push(group)
    }

    // propeller at the nose
    const propeller = new THREE.Group()
    propeller.position.set(0, 1.05, 2.42)
    const blades = new Kit()
    blades.box(0.14, 1.9, 0.05, DARK, { x: 0, y: 0, z: 0, center: true })
    blades.box(0.14, 0.2, 0.05, DARK, { x: 0, y: 0, z: 0, center: true })
    propeller.add(blades.mesh(clayMaterial))
    body.add(propeller)

    // navigation lights: red on the left wingtip, green on the right, white strobe on the tail
    const navs = {}
    for(const [ key, x, color ] of [ [ 'red', -4.12, '#FF2E4D' ], [ 'green', 4.12, '#6CFF8E' ] ])
    {
        const g = new Kit()
        g.sphere(0.12, color, { x, y: 1.0, z: 0.3 }, 1)
        const mesh = new THREE.Mesh(g.geometry(), neonMaterial)
        body.add(mesh)
        navs[key] = mesh
    }
    const tail = new Kit()
    tail.sphere(0.1, '#FFFFFF', { y: 1.9, z: -2.5 }, 1)
    const strobe = new THREE.Mesh(tail.geometry(), neonMaterial)
    body.add(strobe)
    navs.strobe = strobe

    return {
        root,
        body,
        propeller,
        wheels,
        navs,
        // where a rider sits (the canopy) and the camera looks from
        seat: new THREE.Vector3(0, 1.2, 0.55),
        // how far the wheels sit off the ground
        gear: 0.24
    }
}
