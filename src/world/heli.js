import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'

// A little teal-and-cream helicopter, built from the same clay parts as the plane and the
// city. Nose towards +z, the skids on the ground at y = 0. It has a main rotor and a tail
// rotor that turn, and a seat under the bubble.

const BODY = '#2AB7C9'
const CREAM = '#FBF7F0'
const STRIPE = '#FF4FA3'
const GLASS = '#9FD8E8'
const DARK = '#2B2D31'

export function buildHeli()
{
    const root = new THREE.Group()
    root.name = 'heli'
    const body = new THREE.Group()
    root.add(body)

    const kit = new Kit()
    // the cabin: a short tube with a rounded back, and the bubble canopy at the front
    kit.cyl(0.78, 0.78, 2.2, 14, BODY, { y: 1.25, z: -0.1, rx: Math.PI / 2, center: true })
    kit.sphere(0.78, BODY, { y: 1.25, z: -1.2 }, 1)
    kit.sphere(0.8, GLASS, { y: 1.3, z: 1.0 }, 1)
    kit.box(1.5, 0.12, 1.6, CREAM, { y: 2.08, z: -0.2 })
    // a stripe down each side
    for(const sx of [ -1, 1 ]) kit.box(0.04, 0.16, 2.0, STRIPE, { x: sx * 0.79, y: 1.0, z: -0.15 })
    // the tail boom, a fin with a stripe, and a small tailplane
    kit.cyl(0.14, 0.3, 3.6, 8, BODY, { y: 1.55, z: -3.0, rx: Math.PI / 2, center: true })
    kit.box(0.1, 1.1, 0.8, CREAM, { y: 1.95, z: -4.55 })
    kit.box(0.12, 0.4, 0.5, STRIPE, { y: 2.3, z: -4.6 })
    kit.box(1.3, 0.08, 0.5, CREAM, { y: 1.6, z: -4.3 })
    // the skids and their struts
    for(const sx of [ -1, 1 ])
    {
        kit.box(0.1, 0.1, 3.0, DARK, { x: sx * 0.85, y: 0.1, z: 0.1 })
        kit.box(0.08, 0.7, 0.08, DARK, { x: sx * 0.8, y: 0.45, z: 0.8 })
        kit.box(0.08, 0.7, 0.08, DARK, { x: sx * 0.8, y: 0.45, z: -0.5 })
    }
    // the mast the rotor sits on
    kit.cyl(0.12, 0.16, 0.5, 8, DARK, { y: 2.3, z: -0.2, center: true })
    body.add(kit.mesh(clayMaterial))

    // the main rotor: two long blades crossed, turning about the mast
    const rotor = new THREE.Group()
    rotor.position.set(0, 2.6, -0.2)
    const blades = new Kit()
    blades.box(7.4, 0.05, 0.3, DARK, { center: true })
    blades.box(0.3, 0.05, 7.4, DARK, { center: true })
    rotor.add(blades.mesh(clayMaterial))
    body.add(rotor)

    // the tail rotor: a small pair of blades on the fin, turning about the x axis
    const tailRotor = new THREE.Group()
    tailRotor.position.set(0.16, 2.0, -4.6)
    const tail = new Kit()
    tail.box(0.05, 1.1, 0.12, DARK, { center: true })
    tail.box(0.05, 0.12, 1.1, DARK, { center: true })
    tailRotor.add(tail.mesh(clayMaterial))
    body.add(tailRotor)

    return {
        root,
        body,
        rotor,
        tailRotor,
        // where a rider sits (under the bubble) and the camera looks from
        seat: new THREE.Vector3(0, 1.25, 0.55),
        // how far the skids sit off the ground
        gear: 0.1
    }
}
