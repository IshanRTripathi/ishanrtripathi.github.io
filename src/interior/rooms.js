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
        lights,
        npcs: [
            { gender: 'm', x: -1.4, z: -2.4, yaw: Math.PI, pose: 'sit' },
            { gender: 'f', x: 3.4, z: -0.6, yaw: Math.PI, pose: 'sit' }
        ]
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
        lights,
        npcs: [
            { gender: 'f', x: -2.4, z: -2.85, yaw: 0, pose: 'idle' },
            { gender: 'm', x: 1.8, z: -2.4, yaw: Math.PI, pose: 'idle' }
        ]
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
        lights,
        npcs: [
            { gender: 'm', x: 1.6, z: 2.8, yaw: Math.PI / 2, pose: 'sit' },
            { gender: 'f', x: 3.4, z: 2.8, yaw: -Math.PI / 2, pose: 'sit' }
        ]
    })
}

// ------------------------------------------------------------------ the game arcade
export function buildArcade()
{
    const group = new THREE.Group()
    const kit = new Kit()
    const colliders = []
    const hw = 6
    const hd = 4
    const walls = '#2A1F4D'

    kit.box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4, '#1B1535', { y: -0.1 })
    kit.box(hw * 2 + 0.4, 5, 0.4, walls, { y: 2.5, z: -hd - 0.2 })
    kit.box(0.4, 5, hd * 2 + 0.4, walls, { x: -hw - 0.2, y: 2.5 })
    kit.box(0.4, 5, hd * 2 + 0.4, walls, { x: hw + 0.2, y: 2.5 })
    // the front wall, with the door in the middle
    kit.box(4.4, 5, 0.4, walls, { x: -3.8, y: 2.5, z: hd + 0.2 })
    kit.box(4.4, 5, 0.4, walls, { x: 3.8, y: 2.5, z: hd + 0.2 })
    kit.box(2.0, 0.8, 0.4, walls, { y: 4.6, z: hd + 0.2 })
    solid(colliders, 0, -hd - 0.2, hw + 0.2, 0.2)
    solid(colliders, -hw - 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, hw + 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, -3.8, hd + 0.2, 2.2, 0.2)
    solid(colliders, 3.8, hd + 0.2, 2.2, 0.2)

    // the game cabinets: three along the back wall, one on each side wall (each one is a game)
    const cabinets = [
        { x: -4.2, z: -3.2, face: 0, color: '#FF4FA3' },
        { x: -2.4, z: -3.2, face: 0, color: '#2DE2E6' },
        { x: -0.6, z: -3.2, face: 0, color: '#FFE45E' },
        { x: hw - 0.7, z: -1.2, face: -Math.PI / 2, color: '#A855F7' },
        { x: -hw + 0.7, z: -1.2, face: Math.PI / 2, color: '#FF8C42' }
    ]
    const cabinetKit = new Kit()
    for(const c of cabinets)
    {
        // the body faces the room; its screen is a glowing panel on the front
        cabinetKit.box(0.9, 1.8, 0.8, '#2B2450', { x: c.x, y: 0.9, z: c.z })
        solid(colliders, c.x, c.z, 0.45, 0.4)
    }
    kit.box(3.2, 0.5, 0.9, '#5A3F8C', { x: -2.6, y: 0.25, z: 2.0 })
    kit.box(3.2, 0.5, 0.9, '#5A3F8C', { x: 2.6, y: 0.25, z: 2.0 })
    group.add(kit.mesh())
    group.add(cabinetKit.mesh())
    for(const c of cabinets)
    {
        const screen = glow(group, 0.7, 0.5, 0.05, c.color, c.x + Math.sin(c.face) * 0.45, 1.25, c.z + Math.cos(c.face) * 0.45)
        screen.rotation.y = c.face
    }

    const sign = neonSign('Game Arcade', { color: NEON.pink, width: 3.6, height: 0.8, panel: true })
    sign.position.set(0, 3.4, -hd + 0.4)
    group.add(sign)

    const lights = [
        new THREE.HemisphereLight('#A89BFF', '#1B1535', 2.4),
        pointLight('#FF4FA3', 2.6, 16, -3.4, 2.6, -2.0),
        pointLight('#2DE2E6', 2.2, 16, 3.4, 2.6, -1.0),
        pointLight('#FFFFFF', 1.4, 18, 0, 3.2, 2.0)
    ]
    lights.forEach((l) => group.add(l))

    const points = [
        { kind: 'content', content: 'arcade', label: 'Play Stack Tower', x: -4.2, z: -1.6, r: 1.6 },
        { kind: 'content', content: 'arcade', label: 'Play Coin Catch', x: -2.4, z: -1.6, r: 1.6 },
        { kind: 'content', content: 'arcade', label: 'Play Neon Bounce', x: -0.6, z: -1.6, r: 1.6 },
        { kind: 'info', label: 'Prize counter', sub: 'Pick a game and play. Your best scores stay on this device.', x: 4.2, z: 3.0, r: 1.5 },
        { kind: 'sit', label: 'Sit and watch', yaw: Math.PI, x: -2.6, z: 2.0, r: 0.9 },
        { kind: 'sit', label: 'Sit and watch', yaw: Math.PI, x: 2.6, z: 2.0, r: 0.9 }
    ]

    return finish('arcade', group, {
        background: '#0E0A22',
        half: { x: hw, z: hd },
        colliders,
        spawn: { x: 0, z: 2.8, yaw: Math.PI },
        exit: { x: 0, z: hd - 0.5, r: 0.8 },
        points,
        lights,
        npcs: [
            { gender: 'f', x: 1.6, z: -1.2, yaw: Math.PI, pose: 'idle' }
        ]
    })
}

// ------------------------------------------------------------------ Ishan's studio (the living room)
export function buildStudio()
{
    const group = new THREE.Group()
    const kit = new Kit()
    const colliders = []
    const hw = 5
    const hd = 4
    const walls = '#F7AFC6'

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

    // a rug, the sofa on the left wall, a coffee table
    kit.box(4.0, 0.04, 3.2, '#2DE2E6', { x: -0.4, y: 0.01, z: 0.6 })
    kit.box(0.9, 0.5, 3.0, '#5A3F8C', { x: -4.3, y: 0.25, z: 0.6 })
    kit.box(0.5, 0.9, 3.0, '#5A3F8C', { x: -4.7, y: 0.6, z: 0.6 })
    solid(colliders, -4.3, 0.6, 0.45, 1.5)
    kit.box(1.4, 0.4, 0.8, '#8A5A3A', { x: -1.2, y: 0.2, z: 0.6 })
    solid(colliders, -1.2, 0.6, 0.7, 0.4)

    // the desk against the back wall, with its chair in front
    kit.box(2.6, 0.12, 1.0, '#8A5A3A', { x: 2.0, y: 1.0, z: -3.2 })
    kit.box(2.6, 0.95, 0.12, '#8A5A3A', { x: 2.0, y: 0.5, z: -3.6 })
    kit.box(0.5, 1.0, 0.5, '#5A3F8C', { x: 2.0, y: 0.5, z: -1.9 })
    solid(colliders, 2.0, -3.2, 1.3, 0.5)

    // the bookshelf on the right wall
    kit.box(0.5, 2.4, 2.4, '#8A5A3A', { x: 4.6, y: 1.2, z: -0.6 })
    for(let i = 0; i < 9; i++) kit.box(0.1, 0.5, 0.2, [ '#FF4FA3', '#2DE2E6', '#FFE45E', '#A855F7', '#FF8C42' ][i % 5], { x: 4.3, y: 0.5 + (i % 3) * 0.7, z: -1.6 + (i % 5) * 0.4 })
    solid(colliders, 4.6, -0.6, 0.3, 1.25)

    // a plant in the corner
    kit.cyl(0.35, 0.3, 0.6, 10, '#C9A36B', { x: 4.1, y: 0.3, z: 2.9 })
    kit.sphere(0.7, '#3E9C8F', { x: 4.1, y: 1.3, z: 2.9 }, 1)
    group.add(kit.mesh())

    // the window to the sea, the monitor on the desk, and the pin board by the sofa
    glow(group, 2.4, 1.6, 0.08, '#9AD0EC', -1.8, 2.3, -hd + 0.2)
    glow(group, 1.6, 0.9, 0.06, '#1C7F86', 2.0, 1.7, -3.1)
    const board = new Kit()
    board.box(1.2, 0.9, 0.06, '#C9A36B', { x: -2.6, y: 2.2, z: -hd + 0.2 })
    group.add(board.mesh())
    glow(group, 0.08, 0.08, 0.08, '#FFE45E', -2.6, 2.6, -hd + 0.25)

    const lights = [
        new THREE.HemisphereLight('#FFE9D2', '#8A5A3A', 2.0),
        pointLight('#FFC8A2', 2.0, 14, 0, 2.8, 0.5),
        pointLight('#FFF1A8', 1.2, 10, 2.0, 2.2, -1.8)
    ]
    lights.forEach((l) => group.add(l))

    const points = [
        { kind: 'content', content: 'career', label: 'Read the career timeline on the monitor', x: 2.0, z: -2.5, r: 1.5 },
        { kind: 'sit', label: 'Sit at the desk', yaw: Math.PI, x: 2.0, z: -1.9, r: 0.9 },
        { kind: 'sit', label: 'Sit on the sofa', yaw: Math.PI / 2, x: -3.9, z: 0.2, r: 0.9 },
        { kind: 'sit', label: 'Sit on the sofa', yaw: Math.PI / 2, x: -3.9, z: 1.2, r: 0.9 },
        { kind: 'content', content: 'contact', label: 'Read the pin board', x: -2.6, z: -2.9, r: 1.5 },
        { kind: 'info', label: 'Bookshelf', sub: 'Shelves of books and notes from the projects.', x: 3.4, z: -0.6, r: 1.5 }
    ]

    return finish('studio', group, {
        background: '#2A1B2E',
        half: { x: hw, z: hd },
        colliders,
        spawn: { x: 0, z: 2.6, yaw: Math.PI },
        exit: { x: 0, z: hd - 0.5, r: 0.8 },
        points,
        lights,
        npcs: []
    })
}

// ------------------------------------------------------------------ the Velvet Lounge (the night club)
export function buildLounge()
{
    const group = new THREE.Group()
    const kit = new Kit()
    const colliders = []
    const hw = 7
    const hd = 6
    const walls = '#43276A'
    const leather = '#B3183F'
    const dark = '#14102A'
    // every box and cylinder here is placed by its centre, so y is the middle of the piece
    const box = (w, h, d, color, t) => kit.box(w, h, d, color, { center: true, ...t })
    const cyl = (rt, rb, h, seg, color, t) => kit.cyl(rt, rb, h, seg, color, { center: true, ...t })

    // the floor, the walls, and the front wall with a doorway in the middle
    box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4, '#2A1E4F', { y: -0.1 })
    box(hw * 2 + 0.4, 5, 0.4, walls, { y: 2.5, z: -hd - 0.2 })
    box(0.4, 5, hd * 2 + 0.4, walls, { x: -hw - 0.2, y: 2.5 })
    box(0.4, 5, hd * 2 + 0.4, walls, { x: hw + 0.2, y: 2.5 })
    box(hw - 1.0, 5, 0.4, walls, { x: -(hw + 1.4) / 2, y: 2.5, z: hd + 0.2 })
    box(hw - 1.0, 5, 0.4, walls, { x: (hw + 1.4) / 2, y: 2.5, z: hd + 0.2 })
    box(2.4, 1.0, 0.4, walls, { y: 4.5, z: hd + 0.2 })
    solid(colliders, 0, -hd - 0.2, hw + 0.2, 0.2)
    solid(colliders, -hw - 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, hw + 0.2, 0, 0.2, hd + 0.2)
    solid(colliders, -(hw + 1.4) / 2, hd + 0.2, (hw - 1.0) / 2, 0.2)
    solid(colliders, (hw + 1.4) / 2, hd + 0.2, (hw - 1.0) / 2, 0.2)

    // the dance floor: a grid of tiles in the middle of the room, each pulsing on its own beat
    const tileColors = [ NEON.pink, NEON.cyan, NEON.purple, NEON.yellow ]
    const tiles = []
    for(let i = 0; i < 4; i++)
        for(let j = 0; j < 3; j++)
        {
            const mat = new THREE.MeshBasicMaterial({ color: tileColors[(i + j) % tileColors.length], toneMapped: false })
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 1.0), mat)
            mesh.position.set(-1.6 + i * 1.1, 0.02, 0.2 + j * 1.1)
            group.add(mesh)
            tiles.push({ mat, base: mat.color.clone(), phase: i * 0.9 + j * 1.7 })
        }

    // the DJ booth on the back wall: a raised platform with decks, and a speaker on each side
    box(4.8, 0.5, 2.0, '#3A2D6B', { x: 0, y: 0.25, z: -hd + 1.2 })
    solid(colliders, 0, -hd + 1.2, 2.4, 1.0)
    box(2.4, 0.08, 0.8, dark, { x: 0, y: 0.54, z: -hd + 1.2 })
    cyl(0.3, 0.3, 0.05, 16, '#0E0A22', { x: -0.6, y: 0.6, z: -hd + 1.2 })
    cyl(0.3, 0.3, 0.05, 16, '#0E0A22', { x: 0.6, y: 0.6, z: -hd + 1.2 })
    for(const x of [ -3.5, 3.5 ])
    {
        box(1.0, 2.0, 1.0, dark, { x, y: 1.0, z: -hd + 0.9 })
        solid(colliders, x, -hd + 0.9, 0.5, 0.5)
        glow(group, 0.6, 0.6, 0.06, NEON.pink, x, 1.3, -hd + 1.45)
    }

    // the bar along the left wall: a glowing back panel, a shelf of bottles, and a counter with a cyan strip under it
    glow(group, 0.06, 2.1, 7.0, NEON.purple, -hw + 0.04, 1.6, -0.6)
    box(0.6, 0.06, 7.0, '#3B2A5A', { x: -hw + 0.3, y: 1.25, z: -0.6 })
    const bottles = [ '#FF4FA3', '#2DE2E6', '#FFE45E', '#A855F7', '#FF8C42' ]
    for(let i = 0; i < 11; i++) cyl(0.07, 0.07, 0.36, 6, bottles[i % bottles.length], { x: -hw + 0.4, y: 1.46, z: -3.6 + i * 0.6 })
    box(1.2, 1.0, 7.0, '#2B2450', { x: -5.1, y: 0.5, z: -0.6 })
    box(1.4, 0.12, 7.2, dark, { x: -5.1, y: 1.06, z: -0.6 })
    solid(colliders, -5.1, -0.6, 0.6, 3.6)
    glow(group, 0.05, 0.06, 6.8, NEON.cyan, -4.47, 0.12, -0.6)
    // three bar stools in front of the counter
    for(const z of [ -2.8, -1.0, 0.8 ])
    {
        cyl(0.27, 0.27, 0.08, 12, leather, { x: -3.8, y: 0.8, z })
        cyl(0.05, 0.05, 0.76, 6, dark, { x: -3.8, y: 0.38, z })
        cyl(0.2, 0.2, 0.04, 12, dark, { x: -3.8, y: 0.02, z })
    }

    // two booths along the right wall, each with a leather bench, a table and a small lamp
    for(const z0 of [ -1.8, 1.8 ])
    {
        box(1.5, 0.45, 2.8, leather, { x: hw - 1.05, y: 0.225, z: z0 })
        box(0.45, 1.0, 2.8, leather, { x: hw - 0.25, y: 0.5, z: z0 })
        glow(group, 0.05, 0.05, 2.7, NEON.pink, hw - 0.5, 1.08, z0)
        cyl(0.4, 0.4, 0.06, 14, '#E9D7FF', { x: hw - 2.1, y: 0.76, z: z0 })
        cyl(0.06, 0.06, 0.72, 6, dark, { x: hw - 2.1, y: 0.36, z: z0 })
        glow(group, 0.18, 0.18, 0.18, NEON.yellow, hw - 2.1, 0.9, z0)
        solid(colliders, hw - 2.1, z0, 0.4, 0.4)
    }

    group.add(kit.mesh())

    // the script sign over the DJ booth, and a mirror ball over the dance floor on a short chain
    const sign = neonSign('Velvet', { color: NEON.pink, width: 3.6, height: 1.0, script: true })
    sign.position.set(0, 3.8, -hd + 0.4)
    group.add(sign)
    const ballMaterial = new THREE.MeshStandardMaterial({ color: '#E6EAF5', metalness: 0.2, roughness: 0.35, emissive: '#262B40' })
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), ballMaterial)
    ball.position.set(0, 3.7, 0.8)
    group.add(ball)
    const chainKit = new Kit()
    chainKit.box(0.04, 0.9, 0.04, '#8E8E96', { center: true, x: 0, y: 4.56, z: 0.8 })
    group.add(chainKit.mesh())

    const sweep = pointLight('#A855F7', 3.2, 14, 0, 3.6, 1.0)
    const lights = [
        new THREE.HemisphereLight('#A89BFF', '#1B1535', 2.0),
        pointLight('#FF4FA3', 3.0, 18, -3.6, 3.4, -2.6),
        pointLight('#2DE2E6', 2.6, 16, 3.8, 3.2, -1.0),
        pointLight('#FFC8A2', 1.0, 9, -5.4, 2.6, -0.6),
        sweep
    ]
    lights.forEach((l) => group.add(l))

    const points = [
        { kind: 'content', content: 'contact', label: 'Book the DJ', x: 0, z: -hd + 3.0, r: 1.8 },
        { kind: 'info', label: 'Dance floor', sub: 'The tiles pulse with the bass. Nobody here is keeping score.', x: 0.05, z: 1.3, r: 2.4 },
        { kind: 'info', label: 'Bar', sub: 'Two drinks on the house. The ginger is the same as the chai shack.', x: -3.9, z: 2.6, r: 1.4 },
        { kind: 'sit', label: 'Sit at the bar', yaw: -Math.PI / 2, x: -3.8, z: -2.8, r: 0.9 },
        { kind: 'sit', label: 'Sit at the bar', yaw: -Math.PI / 2, x: -3.8, z: -1.0, r: 0.9 },
        { kind: 'sit', label: 'Sit at the bar', yaw: -Math.PI / 2, x: -3.8, z: 0.8, r: 0.9 },
        { kind: 'sit', label: 'Sit in the booth', yaw: -Math.PI / 2, x: hw - 1.05, z: -2.5, r: 0.9 },
        { kind: 'sit', label: 'Sit in the booth', yaw: -Math.PI / 2, x: hw - 1.05, z: -1.1, r: 0.9 },
        { kind: 'sit', label: 'Sit in the booth', yaw: -Math.PI / 2, x: hw - 1.05, z: 1.1, r: 0.9 },
        { kind: 'sit', label: 'Sit in the booth', yaw: -Math.PI / 2, x: hw - 1.05, z: 2.5, r: 0.9 },
        { kind: 'info', label: 'Reserved booth', sub: 'Reserved for the regulars.', x: hw - 2.1, z: 1.8, r: 1.2 },
        { kind: 'info', label: 'Bouncer', sub: 'Arms folded. He nods you through.', x: -2.9, z: 4.2, r: 1.4 }
    ]

    const animate = (time) =>
    {
        for(const t of tiles) t.mat.color.copy(t.base).multiplyScalar(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 3.1 + t.phase)))
        ball.rotation.y = time * 0.6
        sweep.position.set(Math.sin(time * 0.45) * 3.2, 3.6, 1.3 + Math.cos(time * 0.45) * 1.5)
    }

    return finish('lounge', group, {
        background: '#16102E',
        half: { x: hw, z: hd },
        colliders,
        spawn: { x: 0, z: 3.6, yaw: Math.PI },
        exit: { x: 0, z: hd - 0.6, r: 0.9 },
        points,
        lights,
        animate,
        npcs: [
            { gender: 'f', x: -6.05, z: -0.6, yaw: Math.PI / 2, pose: 'idle' }, // the bartender, behind the bar
            { gender: 'f', x: -0.5, z: 1.3, yaw: Math.PI, pose: 'idle' },       // dancers
            { gender: 'm', x: 1.7, z: 2.4, yaw: Math.PI, pose: 'idle' },
            { gender: 'm', x: -2.9, z: 4.6, yaw: Math.PI, pose: 'idle' }        // the bouncer, inside the door
        ]
    })
}

export const ROOMS = { cinema: buildCinema, hospital: buildHospital, cafe: buildCafe, arcade: buildArcade, studio: buildStudio, lounge: buildLounge }
