import * as THREE from 'three'
import { Kit } from '../models/kit.js'
import { neonSign } from '../world/neon.js'
import { NEON } from '../world/buildings.js'

// The rooms inside the buildings you can walk into. Each one is built once, from a few merged clay
// meshes (one per colour) and a handful of glowing panels and lights, in its own small scene. Nothing
// here is loaded from a file, so the first visit costs a few milliseconds and no download.
//
// A room is laid out in its own metres: the floor is at y = 0, the door is in the front wall (+z), and
// the player comes in at `spawn` facing into the room. `points` are things to walk up to and use:
//   { kind: 'info', label, sub }          shows a short line
//   { kind: 'content', content, label }   opens a card from the site (career or contact)
//   { kind: 'sit', label, yaw }           sit down facing `yaw`
// `exit` is the door zone, where you leave the building.

const glowMaterials = new Map()
function glowMaterial(color)
{
    if(!glowMaterials.has(color)) glowMaterials.set(color, new THREE.MeshBasicMaterial({ color, toneMapped: false }))
    return glowMaterials.get(color)
}

function glow(group, w, h, d, color, x, y, z)
{
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glowMaterial(color))
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
}

// a wall (or any solid block) that the player cannot walk through
function solid(colliders, x, z, hw, hd)
{
    colliders.push({ type: 'box', x, z, yaw: 0, hw, hd })
}

function pointLight(color, intensity, distance, x, y, z)
{
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.set(x, y, z)
    return light
}

function finish(name, group, extra)
{
    return { name, group, ...extra }
}

// ------------------------------------------------------------------ the movie hall
export function buildCinema()
{
    const group = new THREE.Group()
    const kit = new Kit()
    const colliders = []
    const hw = 7
    const hd = 6
    const navy = '#2B1D4A'
    const seatRed = '#B3183F'

    kit.box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4, '#4A1430', { y: -0.1 })
    kit.box(hw * 2 + 0.4, 5, 0.4, navy, { y: 2.5, z: -hd - 0.2 })
    kit.box(0.4, 5, hd * 2 + 0.4, navy, { x: -hw - 0.2, y: 2.5 })
    kit.box(0.4, 5, hd * 2 + 0.4, navy, { x: hw + 0.2, y: 2.5 })
    // the front wall, with the door in the middle
    kit.box(5.8, 5, 0.4, navy, { x: -4.1, y: 2.5, z: hd + 0.2 })
    kit.box(5.8, 5, 0.4, navy, { x: 4.1, y: 2.5, z: hd + 0.2 })
    kit.box(2.4, 1.1, 0.4, navy, { y: 4.45, z: hd + 0.2 })
    solid(colliders, 0, -hd - 0.2, hw + 0.2, 0.2)
    solid(colliders, -hw - 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, hw + 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, -4.1, hd + 0.2, 2.9, 0.2)
    solid(colliders, 4.1, hd + 0.2, 2.9, 0.2)

    // seats in four rows, with an aisle down the middle
    const rows = [ -2.4, -0.6, 1.2, 3.0 ]
    const cols = [ -5.4, -4.4, -3.4, -2.4, -1.4, 1.4, 2.4, 3.4, 4.4, 5.4 ]
    for(const z of rows) for(const x of cols)
    {
        kit.box(0.8, 0.45, 0.8, seatRed, { x, y: 0.225, z })
        kit.box(0.8, 0.8, 0.16, seatRed, { x, y: 0.7, z: z - 0.34 })
    }

    // the ticket counter by the door, and the popcorn stand on the other side
    kit.box(2.6, 1.0, 0.9, '#FFF3DE', { x: -4.6, y: 0.5, z: 4.2 })
    kit.box(2.8, 0.1, 1.1, '#B9895E', { x: -4.6, y: 1.05, z: 4.2 })
    solid(colliders, -4.6, 4.2, 1.4, 0.55)
    kit.box(2.4, 1.1, 1.1, '#E0483D', { x: 4.6, y: 0.55, z: 4.2 })
    kit.box(2.6, 0.1, 1.3, '#FFF1A8', { x: 4.6, y: 1.12, z: 4.2 })
    solid(colliders, 4.6, 4.2, 1.2, 0.6)

    // the screen: a dark frame, and a glowing panel that pulses
    kit.box(9.6, 4.8, 0.2, '#14102A', { y: 2.7, z: -hd + 0.1 })
    group.add(kit.mesh())
    const screen = glow(group, 9.0, 4.2, 0.1, '#2FB3BB', 0, 2.7, -hd + 0.25)
    const title = neonSign('Now showing', { color: NEON.yellow, width: 4.6, height: 0.5, panel: true })
    title.position.set(0, 5.2, -hd + 0.4)
    group.add(title)
    const tickets = neonSign('Tickets', { color: NEON.yellow, width: 1.8, height: 0.45 })
    tickets.position.set(-4.6, 2.1, 4.1)
    group.add(tickets)
    // neon along the walls
    glow(group, hw * 2, 0.08, 0.08, NEON.pink, 0, 4.7, -hd + 0.25)
    glow(group, 0.08, 0.08, hd * 2, NEON.pink, -hw + 0.25, 4.7, 0)
    glow(group, 0.08, 0.08, hd * 2, NEON.pink, hw - 0.25, 4.7, 0)

    const lights = [
        new THREE.HemisphereLight('#8E7CFF', '#2A1B3D', 0.9),
        pointLight('#FF4FA3', 1.4, 18, -4, 3.5, -2),
        pointLight('#2DE2E6', 1.0, 16, 0, 3.5, 4)
    ]
    lights.forEach((l) => group.add(l))

    const points = [
        { kind: 'content', content: 'career', label: 'Watch the career timeline', x: 0, z: -4.3, r: 2.2 },
        { kind: 'info', label: 'Buy a ticket', sub: 'Free for the first screening. Ask at the counter.', x: -4.6, z: 2.6, r: 1.5 },
        { kind: 'info', label: 'Popcorn', sub: 'Sold out, but the film is still worth the seat.', x: 4.6, z: 2.6, r: 1.5 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI, x: -1.4, z: 1.2, r: 0.9 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI, x: 1.4, z: 1.2, r: 0.9 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI, x: -2.4, z: -0.6, r: 0.9 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI, x: 2.4, z: -0.6, r: 0.9 }
    ]

    return finish('cinema', group, {
        background: '#120C24',
        half: { x: hw, z: hd },
        colliders,
        spawn: { x: 0, z: 3.6, yaw: Math.PI },
        exit: { x: 0, z: hd - 0.6, r: 0.9 },
        points,
        screen,
        screenColor: new THREE.Color('#2FB3BB'),
        lights
    })
}

// ------------------------------------------------------------------ the hospital
export function buildHospital()
{
    const group = new THREE.Group()
    const kit = new Kit()
    const colliders = []
    const hw = 6
    const hd = 5
    const wall = '#BFE5DE'

    kit.box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4, '#E9F4F2', { y: -0.1 })
    kit.box(hw * 2 + 0.4, 5, 0.4, wall, { y: 2.5, z: -hd - 0.2 })
    kit.box(0.4, 5, hd * 2 + 0.4, wall, { x: -hw - 0.2, y: 2.5 })
    kit.box(0.4, 5, hd * 2 + 0.4, wall, { x: hw + 0.2, y: 2.5 })
    // the front wall, with the door in the middle
    kit.box(5.2, 5, 0.4, wall, { x: -3.6, y: 2.5, z: hd + 0.2 })
    kit.box(5.2, 5, 0.4, wall, { x: 3.6, y: 2.5, z: hd + 0.2 })
    kit.box(2.0, 0.8, 0.4, wall, { y: 4.6, z: hd + 0.2 })
    solid(colliders, 0, -hd - 0.2, hw + 0.2, 0.2)
    solid(colliders, -hw - 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, hw + 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, -3.6, hd + 0.2, 2.6, 0.2)
    solid(colliders, 3.6, hd + 0.2, 2.6, 0.2)

    // the reception desk, with shelves behind it
    kit.box(4.6, 1.1, 1.0, '#FFFFFF', { x: -2.4, y: 0.55, z: -1.8 })
    kit.box(4.8, 0.1, 1.2, '#7FD1C2', { x: -2.4, y: 1.15, z: -1.8 })
    kit.box(4.6, 2.2, 0.4, '#FFFFFF', { x: -2.4, y: 1.1, z: -3.5 })
    solid(colliders, -2.4, -1.8, 2.4, 0.6)
    solid(colliders, -2.4, -3.5, 2.3, 0.2)

    // two waiting benches on the right, facing the desk
    for(const z of [ -1.0, 1.8 ])
    {
        kit.box(0.7, 0.4, 2.4, '#6FC3B3', { x: 3.6, y: 0.2, z })
        kit.box(0.14, 0.6, 2.4, '#6FC3B3', { x: 4.0, y: 0.7, z })
        solid(colliders, 3.6, z, 0.45, 1.3)
    }

    // two beds on the left, with a curtain between them and a pillow on each
    for(const z of [ -0.8, 2.6 ])
    {
        kit.box(1.7, 0.5, 2.8, '#FFFFFF', { x: -4.6, y: 0.25, z })
        kit.box(1.6, 0.2, 2.6, '#CFE8FF', { x: -4.6, y: 0.6, z })
        kit.box(0.9, 0.18, 0.5, '#FFFFFF', { x: -4.6, y: 0.78, z: z - 1.0 })
        solid(colliders, -4.6, z, 0.85, 1.4)
    }
    kit.box(0.08, 2.2, 2.0, '#8FB8FF', { x: -2.6, y: 1.1, z: 1.0 })

    // a vending machine against the back wall, and a notice board on the right
    kit.box(1.2, 2.0, 0.9, '#2FA4A0', { x: 5.0, y: 1.0, z: -4.5 })
    solid(colliders, 5.0, -4.5, 0.6, 0.45)
    kit.box(0.12, 1.4, 2.2, '#C9A36B', { x: 5.92, y: 1.6, z: 0.4 })
    group.add(kit.mesh())

    // the red cross on the back wall, the vending panel and the clinic sign
    glow(group, 0.5, 1.6, 0.06, '#E0483D', 0, 3.7, -hd + 0.25)
    glow(group, 1.6, 0.5, 0.06, '#E0483D', 0, 3.7, -hd + 0.25)
    glow(group, 0.9, 1.2, 0.05, '#FFF1A8', 5.0, 1.0, -4.04)
    const clinic = neonSign('Clinic', { color: NEON.cyan, width: 2.6, height: 0.6, panel: true })
    clinic.position.set(0, 4.1, -hd + 0.45)
    group.add(clinic)

    const lights = [
        new THREE.HemisphereLight('#FFFFFF', '#CDE9E3', 2.6),
        pointLight('#FFFFFF', 2.4, 24, 0, 4, 0),
        pointLight('#FFFFFF', 1.4, 16, -3, 3.5, 2.5)
    ]
    lights.forEach((l) => group.add(l))

    const points = [
        { kind: 'info', label: 'Reception', sub: 'Please take a number. Ishan will see you shortly.', x: -2.4, z: 0.4, r: 1.6 },
        { kind: 'sit', label: 'Sit and wait', yaw: -Math.PI / 2, x: 3.5, z: -1.0, r: 0.9 },
        { kind: 'sit', label: 'Sit and wait', yaw: -Math.PI / 2, x: 3.5, z: 1.8, r: 0.9 },
        { kind: 'content', content: 'contact', label: 'Read the notice board', x: 4.4, z: 0.4, r: 1.5 },
        { kind: 'info', label: 'Vending machine', sub: 'Out of order. Try the chai shack on the beach.', x: 5.0, z: -2.8, r: 1.5 },
        { kind: 'info', label: 'Bed', sub: 'Nobody is ill today. Good.', x: -4.6, z: -0.8, r: 1.6 }
    ]

    return finish('hospital', group, {
        background: '#DDEFEA',
        half: { x: hw, z: hd },
        colliders,
        spawn: { x: 0, z: 3.4, yaw: Math.PI },
        exit: { x: 0, z: hd - 0.4, r: 0.9 },
        points,
        lights
    })
}

// ------------------------------------------------------------------ the café (the chai shack)
export function buildCafe()
{
    const group = new THREE.Group()
    const kit = new Kit()
    const colliders = []
    const hw = 5
    const hd = 4
    const walls = '#3E9C8F'
    const wood = '#8A5A3A'

    kit.box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4, '#B9895E', { y: -0.1 })
    kit.box(hw * 2 + 0.4, 5, 0.4, walls, { y: 2.5, z: -hd - 0.2 })
    kit.box(0.4, 5, hd * 2 + 0.4, walls, { x: -hw - 0.2, y: 2.5 })
    kit.box(0.4, 5, hd * 2 + 0.4, walls, { x: hw + 0.2, y: 2.5 })
    // the front wall, with the door in the middle
    kit.box(3.6, 5, 0.4, walls, { x: -3.2, y: 2.5, z: hd + 0.2 })
    kit.box(3.6, 5, 0.4, walls, { x: 3.2, y: 2.5, z: hd + 0.2 })
    kit.box(2.0, 0.8, 0.4, walls, { y: 4.6, z: hd + 0.2 })
    solid(colliders, 0, -hd - 0.2, hw + 0.2, 0.2)
    solid(colliders, -hw - 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, hw + 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, -3.2, hd + 0.2, 1.8, 0.2)
    solid(colliders, 3.2, hd + 0.2, 1.8, 0.2)

    // the counter along the back, with shelves and two tea urns
    kit.box(5.6, 1.05, 0.9, wood, { x: -1.8, y: 0.525, z: -2.8 })
    kit.box(5.8, 0.1, 1.1, '#F5E6D3', { x: -1.8, y: 1.1, z: -2.8 })
    solid(colliders, -1.8, -2.8, 2.9, 0.55)
    kit.cyl(0.35, 0.4, 0.8, 10, '#C9A36B', { x: -3.4, y: 1.5, z: -2.8 })
    kit.cyl(0.35, 0.4, 0.8, 10, '#C9A36B', { x: -0.4, y: 1.5, z: -2.8 })
    kit.box(5.6, 1.2, 0.3, wood, { x: -1.8, y: 2.1, z: -hd + 0.25 })
    for(let i = 0; i < 6; i++) kit.cyl(0.09, 0.07, 0.22, 7, '#F4E1C1', { x: -3.4 + i * 0.5, y: 2.3, z: -3.9 })

    // stools at the counter, and two small tables with chairs by the window
    for(const x of [ -3.0, -1.8, -0.6 ])
    {
        kit.cyl(0.28, 0.28, 0.08, 10, '#C9A36B', { x, y: 0.45, z: -1.6 })
        kit.cyl(0.05, 0.05, 0.42, 6, '#5A3A22', { x, y: 0.21, z: -1.6 })
    }
    for(const z of [ 1.2, 2.8 ])
    {
        kit.cyl(0.5, 0.5, 0.06, 12, '#F5E6D3', { x: 2.5, y: 0.8, z })
        kit.cyl(0.07, 0.07, 0.78, 6, '#5A3A22', { x: 2.5, y: 0.4, z })
        solid(colliders, 2.5, z, 0.45, 0.45)
    }
    for(const [ x, z ] of [ [ 1.6, 1.2 ], [ 3.4, 1.2 ], [ 1.6, 2.8 ], [ 3.4, 2.8 ] ])
    {
        kit.box(0.5, 0.06, 0.5, '#E0483D', { x, y: 0.42, z })
        kit.box(0.5, 0.5, 0.06, '#E0483D', { x, y: 0.7, z: z + (x < 2.5 ? -0.22 : 0.22) })
    }
    group.add(kit.mesh())

    // the window to the sea, the menu board by the door, and the neon chai sign
    glow(group, 3.4, 1.8, 0.08, '#9AD0EC', 2.5, 2.4, -hd + 0.2)
    const sign = neonSign('Chai', { color: NEON.cyan, width: 1.8, height: 0.75, script: true })
    sign.position.set(-1.8, 3.6, -hd + 0.45)
    group.add(sign)
    glow(group, 1.6, 1.2, 0.06, '#1F2A2A', 3.6, 2.2, hd - 0.1)

    const lights = [
        new THREE.HemisphereLight('#FFE9D2', '#8A5A3A', 1.6),
        pointLight('#FFC8A2', 2.0, 14, -1.8, 2.6, 0),
        pointLight('#FFF1A8', 1.2, 10, 3.2, 2.4, 2.0)
    ]
    lights.forEach((l) => group.add(l))

    const points = [
        { kind: 'content', content: 'contact', label: 'Order a chai', x: -1.8, z: -0.6, r: 1.7 },
        { kind: 'info', label: 'Menu', sub: 'Masala chai, ginger chai, and the cheapest cup on the beach.', x: 3.6, z: 3.4, r: 1.6 },
        { kind: 'info', label: 'Look at the sea', sub: 'The sun goes down right there, most evenings.', x: 2.5, z: -2.0, r: 1.8 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI, x: -3.0, z: -1.6, r: 0.9 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI, x: -1.8, z: -1.6, r: 0.9 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI, x: -0.6, z: -1.6, r: 0.9 },
        { kind: 'sit', label: 'Sit down', yaw: Math.PI / 2, x: 1.6, z: 1.2, r: 0.9 },
        { kind: 'sit', label: 'Sit down', yaw: -Math.PI / 2, x: 3.4, z: 1.2, r: 0.9 }
    ]

    return finish('cafe', group, {
        background: '#1D2B2A',
        half: { x: hw, z: hd },
        colliders,
        spawn: { x: 0, z: 2.0, yaw: Math.PI },
        exit: { x: 0, z: hd - 0.5, r: 0.8 },
        points,
        lights
    })
}

export const ROOMS = { cinema: buildCinema, hospital: buildHospital, cafe: buildCafe }
