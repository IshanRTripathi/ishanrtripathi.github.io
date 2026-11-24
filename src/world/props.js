import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { frameMatrix } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { C, NEON } from './buildings.js'
import { neonMaterial } from './neon.js'

// Beach props, boats and simple car bodies for parked cars and traffic.

export const CAR_PAINTS = [
    { paint: '#F28AAE', stripe: '#FFFFFF', stripe2: '#2DE2E6', interior: '#2B2D31' },
    { paint: '#2FA4A0', stripe: '#FFE45E', stripe2: '#FFFFFF', interior: '#F3E9DA' },
    { paint: '#FFF1A8', stripe: '#FF4FA3', stripe2: '#A855F7', interior: '#C8414B' },
    { paint: '#9AD0EC', stripe: '#FFFFFF', stripe2: '#FF8C42', interior: '#2B2D31' },
    { paint: '#C9B6E4', stripe: '#2DE2E6', stripe2: '#FFFFFF', interior: '#3B3F4A' },
    { paint: '#E0483D', stripe: '#FFFFFF', stripe2: '#FFE45E', interior: '#2B2D31' }
]

// A chunky 80s coupe in one mesh (no moving parts): good for traffic and parking
export function simpleCar(kit, { paint, stripe, interior })
{
    const W = 1.76
    kit.box(W, 0.34, 4.1, paint, { y: 0.28 })
    kit.box(W, 0.28, 1.9, paint, { y: 0.6, z: 1.05, rx: 0.08 })
    kit.box(W, 0.3, 1.6, paint, { y: 0.6, z: -1.2 })
    // cabin with a hard top
    kit.box(W - 0.15, 0.48, 1.7, '#9FD8E8', { y: 0.62, z: -0.25 })
    kit.box(W - 0.1, 0.1, 1.5, paint, { y: 1.1, z: -0.35 })
    for(const sx of [ -1, 1 ]) kit.box(0.04, 0.08, 3.9, stripe, { x: sx * W / 2, y: 0.48 })
    kit.box(W + 0.04, 0.16, 0.12, '#2B2D31', { y: 0.22, z: 2.08 })
    kit.box(W + 0.04, 0.16, 0.12, '#2B2D31', { y: 0.22, z: -2.08 })
    kit.box(W * 0.9, 0.1, 0.06, '#E0483D', { y: 0.62, z: -2.03 })
    kit.box(W - 0.3, 0.1, 0.9, interior, { y: 0.62, z: -0.25 })
    for(const [ x, z ] of [ [ 0.8, 1.35 ], [ -0.8, 1.35 ], [ 0.8, -1.35 ], [ -0.8, -1.35 ] ])
    {
        kit.cyl(0.34, 0.34, 0.26, 10, '#22242A', { x, y: 0.34, z, rz: Math.PI / 2, center: true })
        kit.cyl(0.2, 0.2, 0.28, 8, '#D8DDE3', { x, y: 0.34, z, rz: Math.PI / 2, center: true })
    }
}

export function createCarMesh(paintIndex)
{
    const kit = new Kit()
    simpleCar(kit, CAR_PAINTS[paintIndex % CAR_PAINTS.length])
    return kit.mesh(clayMaterial)
}

function lifeguardTower(kit, variant)
{
    const walls = [ C.lavender, C.mint, C.flamingo ]
    const wall = walls[variant % walls.length]
    for(const [ x, z ] of [ [ -0.9, -0.9 ], [ 0.9, -0.9 ], [ -0.9, 0.9 ], [ 0.9, 0.9 ] ])
        kit.box(0.14, 1.9, 0.14, C.white, { x, y: 0, z })
    kit.box(2.4, 0.15, 2.4, C.white, { y: 1.9 })
    kit.box(2.0, 1.6, 2.0, wall, { y: 2.05 })
    kit.box(1.4, 0.7, 0.06, C.glass, { y: 2.7, z: 1.01 })
    kit.box(2.4, 0.12, 2.6, C.flamingo, { y: 3.65, rx: 0.1 })
    kit.box(0.9, 0.08, 2.6, C.white, { y: 0.9, z: 2.1, rx: -0.65 })
    kit.cyl(0.03, 0.03, 1.2, 4, C.white, { x: 0.9, y: 3.7 })
    kit.box(0.04, 0.35, 0.6, C.red, { x: 0.9, y: 4.5, z: 0.3 })
}

function umbrella(kit, color)
{
    const stripes = [ [ C.flamingo, C.white ], [ C.teal, C.white ], [ C.lemon, C.coral ], [ C.sky, C.white ] ][color % 4]
    kit.cyl(0.04, 0.04, 2.3, 5, C.white, { rz: 0.12 })
    for(let i = 0; i < 8; i++)
    {
        const g = new THREE.ConeGeometry(1.25, 0.55, 8, 1, true, i / 8 * Math.PI * 2, Math.PI * 2 / 8)
        g.translate(0, 0.275, 0)
        kit.add(g, stripes[i % 2], { x: 0.25, y: 2.05, rz: 0.12 })
    }
    // two loungers
    for(const sx of [ -0.7, 0.7 ])
    {
        kit.box(0.6, 0.08, 1.7, C.white, { x: sx, y: 0.3, z: 0.6 })
        kit.box(0.6, 0.08, 0.6, C.white, { x: sx, y: 0.45, z: -0.25, rx: -0.6 })
        kit.box(0.5, 0.03, 1.4, stripes[0], { x: sx, y: 0.36, z: 0.6 })
    }
}

function speedboat(kit)
{
    kit.box(1.8, 0.6, 5.0, C.white, { y: -0.25 })
    kit.box(1.4, 0.4, 1.6, C.white, { y: -0.2, z: 3.0, rx: 0.25, sx: 0.8 })
    kit.box(1.85, 0.12, 5.05, C.teal, { y: 0.1 })
    kit.box(1.85, 0.06, 5.05, C.flamingo, { y: -0.02 })
    kit.box(1.4, 0.5, 0.08, '#9FD8E8', { y: 0.4, z: 1.0, rx: -0.5 })
    kit.box(1.4, 0.3, 1.6, '#F3E9DA', { y: 0.35, z: -0.6 })
    kit.box(0.5, 0.7, 0.5, C.black, { y: -0.2, z: -2.6 })
}

function yacht(kit)
{
    kit.box(3.2, 1.0, 10, C.white, { y: -0.5 })
    kit.box(2.4, 0.8, 3, C.white, { y: -0.4, z: 5.5, rx: 0.2, sx: 0.7 })
    kit.box(3.25, 0.14, 10.05, C.ink, { y: 0.35 })
    kit.box(2.6, 1.0, 5.0, C.white, { y: 0.5, z: -0.8 })
    kit.box(2.62, 0.4, 4.6, C.glass, { y: 0.9, z: -0.8 })
    kit.box(2.0, 0.8, 2.8, C.white, { y: 1.5, z: -1.4 })
    kit.box(2.02, 0.3, 2.4, C.glass, { y: 1.85, z: -1.3 })
    kit.cyl(0.05, 0.05, 1.4, 5, C.steel, { y: 2.3, z: -1.8 })
}

const _m = new THREE.Matrix4()

// Everything static on the beach in one mesh
export function createBeach(scatter)
{
    const kit = new Kit()
    for(const t of scatter.towers)
    {
        frameMatrix(t.x, t.z, t.yaw, heightAt(t.x, t.z), 1, _m)
        kit.stack.push(_m.clone())
        lifeguardTower(kit, t.variant)
        kit.stack.pop()
    }
    for(const u of scatter.umbrellas)
    {
        frameMatrix(u.x, u.z, u.yaw, heightAt(u.x, u.z) - 0.05, 1, _m)
        kit.stack.push(_m.clone())
        umbrella(kit, u.color)
        kit.stack.pop()
    }
    for(const c of scatter.parkedCars)
    {
        frameMatrix(c.x, c.z, c.yaw, heightAt(c.x, c.z) + 0.06, 1, _m)
        kit.stack.push(_m.clone())
        simpleCar(kit, CAR_PAINTS[(c.paint + 2) % CAR_PAINTS.length])
        kit.stack.pop()
    }
    const group = new THREE.Group()
    group.add(kit.mesh(clayMaterial))
    return group
}

export function createBoat(kind)
{
    const kit = new Kit()
    if(kind === 'yacht') yacht(kit)
    else speedboat(kit)
    const mesh = kit.mesh(clayMaterial)
    if(kind === 'yacht')
    {
        const n = new Kit()
        n.box(3.3, 0.05, 0.05, NEON.cyan, { y: 0.42, z: 5.0, center: true })
        n.box(3.3, 0.05, 0.05, NEON.cyan, { y: 0.42, z: -5.0, center: true })
        mesh.add(new THREE.Mesh(n.geometry(), neonMaterial))
    }
    return mesh
}
