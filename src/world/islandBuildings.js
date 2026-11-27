import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { frameMatrix, frameQuaternion, surfacePoint } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { ISLANDS, structureSpots, signSpots, buoySpots } from './islands.js'
import { glowMaterial } from './neon.js'
import { createSignBoard } from './signs.js'

// The landmarks of the islands. The first three are the stilt hut in the jungle, the
// log cabin on the frosty peak and the oasis with a tent in the dunes. The rest make
// the islands read as real places: a fish market and a boat shed, a solar farm, a wind
// turbine, a dive shop, a hot spring, a geothermal station, a ferris wheel, bungalows
// and beach bars. Each is built in its own frame, standing on the ground at its spot.
// Turbines and the ferris wheel turn on their own (see animate).

const _m = new THREE.Matrix4()

// run fn in a frame standing on the ground at (x, z), turned to yaw, for every kit given
function on(kits, x, z, yaw, fn)
{
    frameMatrix(x, z, yaw, heightAt(x, z), 1, _m)
    for(const k of kits) k.stack.push(_m.clone())
    fn()
    for(const k of kits) k.stack.pop()
}

// a part that turns: its own group, standing on the ground, with a turning child at the hub
const turning = []
// a light that blinks on the shared clock: { object, period }
const blinking = []
function standing(x, z, yaw)
{
    const group = new THREE.Group()
    frameMatrix(x, z, yaw, heightAt(x, z), 1, _m)
    group.applyMatrix4(_m)
    return group
}

function hut(kit, glow, x, z)
{
    on([ kit, glow ], x, z, 0, () =>
    {
        for(const [ lx, lz ] of [ [ -1.6, -1.6 ], [ 1.6, -1.6 ], [ -1.6, 1.6 ], [ 1.6, 1.6 ] ])
            kit.cyl(0.12, 0.12, 1.8, 6, '#7A5A3A', { x: lx, y: 0, z: lz })
        kit.box(3.6, 0.18, 3.6, '#B98A4E', { y: 1.8 })
        kit.box(3.0, 1.9, 3.0, '#D9B26B', { y: 2.0 })
        kit.cone(2.7, 1.7, 4, '#8A6A3A', { y: 3.9, ry: Math.PI / 4 })
        kit.box(0.8, 1.4, 0.12, '#5E4130', { y: 2.0, z: 1.52 })
        glow.box(0.5, 0.5, 0.06, '#FFC46B', { x: -0.9, y: 2.9, z: 1.52 })
    })
    return { x, z, hw: 2, hd: 2, yaw: 0 }
}

function cabin(kit, glow, x, z)
{
    const yaw = 0.3
    on([ kit, glow ], x, z, yaw, () =>
    {
        kit.box(4.4, 2.4, 3.6, '#8A5A3A', { y: 0.2 })
        // a snowy roof, two slopes
        kit.box(4.8, 0.22, 2.5, '#EEF6FB', { y: 2.7, z: -1.15, rx: 0.5 })
        kit.box(4.8, 0.22, 2.5, '#EEF6FB', { y: 2.7, z: 1.15, rx: -0.5 })
        kit.box(0.5, 1.5, 0.5, '#6B4A38', { x: 1.4, y: 3.0, z: -0.9 })
        kit.box(0.9, 1.8, 0.1, '#4B3224', { y: 0.3, z: 1.82 })
        glow.box(0.8, 0.7, 0.05, '#FFC46B', { x: -1.3, y: 1.2, z: 1.82 })
        glow.box(0.8, 0.7, 0.05, '#FFC46B', { x: 1.1, y: 1.2, z: 1.82 })
    })
    return { x, z, hw: 2.4, hd: 2, yaw }
}

function oasis(kit, glow, x, z)
{
    on([ kit ], x, z, 0, () =>
    {
        kit.cyl(4.2, 4.4, 0.35, 20, '#D9C7A3', { y: 0 })
        kit.cyl(3.6, 3.6, 0.1, 20, '#2DB8D8', { y: 0.3 })
        kit.cyl(0.9, 1.0, 0.25, 10, '#B8A88A', { x: 1.2, y: 0.3, z: -1.1 })
    })
    return { x, z, radius: 4.4 }
}

function tent(kit, x, z)
{
    on([ kit ], x, z, 0.6, () =>
    {
        kit.cone(1.8, 2.2, 6, '#E0483D', { y: 0.2 })
        kit.cyl(0.04, 0.04, 2.6, 5, '#F3EEE6', { y: 0.2 })
        kit.box(0.6, 0.35, 0.05, '#FFE45E', { x: 0.4, y: 2.4, z: 0.1 })
    })
    return { x, z, radius: 1.8 }
}

// the harbour's market: an open stall with a striped awning, a counter and ice and crates of fish
function fishmarket(kit, glow, x, z, yaw)
{
    on([ kit, glow ], x, z, yaw, () =>
    {
        kit.box(7, 0.3, 4.6, '#8C6B4A', { y: 0.15 })
        for(const [ px, pz ] of [ [ -3.2, -2 ], [ 3.2, -2 ], [ -3.2, 2 ], [ 3.2, 2 ] ]) kit.cyl(0.12, 0.12, 2.9, 6, '#5E4130', { x: px, y: 0.3, z: pz })
        for(let i = 0; i < 6; i++) kit.box(1.2, 0.12, 5.2, i % 2 ? '#FFF6EC' : '#2F6B8F', { x: -3 + i * 1.2, y: 3.2, z: 0, rx: 0.14 })
        kit.box(5.8, 1, 0.8, '#E9D3A6', { y: 0.5, z: 1.6 })
        kit.box(1.8, 0.5, 0.8, '#BFE6F2', { x: -2, y: 1.3, z: 1.6 })
        kit.box(1, 0.4, 0.6, '#D98B3A', { x: 1.8, y: 1.2, z: 1.6 })
        kit.box(1, 0.4, 0.6, '#D98B3A', { x: 2.5, y: 1.2, z: 1.6 })
        glow.box(2.4, 0.4, 0.06, '#2DE2E6', { y: 2.6, z: 2.3 })
    })
    return { x, z, hw: 3.6, hd: 2.4, yaw }
}

// the boat shed: a painted shed with a big door, a pitched roof and a rowing boat on the racks outside
function boathouse(kit, x, z, yaw)
{
    on([ kit ], x, z, yaw, () =>
    {
        kit.box(7, 3, 6, '#A24B3A', { y: 0.2 })
        kit.box(7.8, 0.25, 4, '#4B3224', { y: 3.9, z: -1.8, rx: 0.5 })
        kit.box(7.8, 0.25, 4, '#4B3224', { y: 3.9, z: 1.8, rx: -0.5 })
        kit.box(4.4, 2.6, 0.12, '#3B2A22', { y: 0.4, z: 3.08 })
        kit.box(1.6, 0.6, 4.2, '#F3EEE6', { x: 5.2, y: 1.4, z: 0.4 })
        kit.box(0.2, 1, 0.2, '#6B4A38', { x: 4.4, y: 0.6, z: -1.6 })
        kit.box(0.2, 1, 0.2, '#6B4A38', { x: 6, y: 0.6, z: 2.2 })
    })
    return { x, z, hw: 3.8, hd: 3.2, yaw }
}

// a solar farm: rows of tilted panels on posts
function solar(kit, x, z, yaw)
{
    on([ kit ], x, z, yaw, () =>
    {
        for(let r = 0; r < 3; r++)
            for(let c = 0; c < 3; c++)
            {
                const px = -4 + c * 4
                const pz = -3 + r * 3
                kit.box(0.14, 1.8, 0.14, '#B8C2CC', { x: px, y: 0, z: pz })
                kit.box(3.4, 0.14, 2.3, '#1F3F73', { x: px, y: 1.9, z: pz, rx: -0.5 })
            }
    })
    return { x, z, hw: 6, hd: 4.4, yaw }
}

// a wind turbine: a tapered tower and a nacelle, with three blades that turn on the hub
function turbine(x, z, yaw)
{
    const group = standing(x, z, yaw)
    const body = new Kit()
    body.cyl(0.22, 0.42, 17, 8, '#F4F6F8', { y: 0 })
    body.box(0.9, 0.9, 2.2, '#E3E8EC', { y: 17.6, z: 0.6 })
    group.add(body.mesh())
    const rotor = new THREE.Group()
    rotor.position.set(0, 17.6, 1.9)
    const blades = new Kit()
    for(let k = 0; k < 3; k++) blades.box(0.42, 7.6, 0.16, '#FFFFFF', { rz: (k * Math.PI * 2) / 3 })
    blades.cyl(0.36, 0.36, 0.6, 8, '#DDE5EC', { z: 0.1, rx: Math.PI / 2, center: true })
    rotor.add(blades.mesh())
    group.add(rotor)
    turning.push({ object: rotor, speed: 0.8, phase: x })
    return group
}

// a dive shop: a sea-blue hut with a red roof, a rack of orange tanks and a neon sign
function diveshop(kit, glow, x, z, yaw)
{
    on([ kit, glow ], x, z, yaw, () =>
    {
        kit.box(4.4, 2.6, 3.4, '#2F7FA8', { y: 0.2 })
        kit.cone(3.4, 1.4, 4, '#C8372D', { y: 2.8, ry: Math.PI / 4 })
        kit.box(0.9, 1.6, 0.1, '#FFF6EC', { y: 0.2, z: 1.72 })
        for(let i = 0; i < 3; i++) kit.cyl(0.32, 0.32, 1.8, 8, '#FF8C42', { x: 3.2, y: 0.2, z: -1.2 + i * 0.9 })
        glow.box(2.6, 0.5, 0.06, '#2DE2E6', { y: 2.2, z: 1.72 })
    })
    return { x, z, hw: 2.4, hd: 2, yaw }
}

// a hot spring: a stone-rimmed pool with a few rocks and a puff of steam
function hotspring(kit, x, z)
{
    on([ kit ], x, z, 0, () =>
    {
        kit.cyl(3.2, 3.4, 0.3, 20, '#8B7B6A', { y: 0 })
        kit.cyl(2.6, 2.6, 0.1, 20, '#5FD3E0', { y: 0.2 })
        for(let i = 0; i < 7; i++) kit.sphere(0.45, '#8B7B6A', { x: Math.cos(i * 0.9) * 3.1, y: 0.2, z: Math.sin(i * 0.9) * 3.1 })
        for(let i = 0; i < 3; i++) kit.sphere(0.7 - i * 0.12, '#FFFFFF', { x: (i - 1) * 0.4, y: 1.8 + i * 0.9, z: 0.3 * i })
    })
    return { x, z, radius: 3.2 }
}

// a geothermal station: a plant hall with a roof and two hyperbolic cooling towers, and a pipe run
function geothermal(kit, x, z, yaw)
{
    on([ kit ], x, z, yaw, () =>
    {
        kit.box(7, 1.4, 5, '#6E7480', { y: 0.2 })
        kit.box(7.2, 0.2, 5.2, '#4A4F5A', { y: 1.6 })
        for(const tx of [ -3.2, 1.8 ])
        {
            kit.cyl(1.3, 2.2, 3, 10, '#DCE3EA', { x: tx, y: 1.6, z: -0.6 })
            kit.cyl(1.8, 1.3, 3, 10, '#DCE3EA', { x: tx, y: 4.6, z: -0.6 })
        }
        kit.cyl(0.25, 0.25, 9, 6, '#B8C2CC', { x: 0, y: 1.2, z: 3.2, rz: Math.PI / 2, center: true })
    })
    return { x, z, hw: 4.4, hd: 3.2, yaw }
}

// a ferris wheel: an A-frame of legs, a wheel with twelve gondolas, and a hub that turns
function ferris(x, z, yaw)
{
    const group = standing(x, z, yaw)
    const legs = new Kit()
    legs.box(0.4, 10.3, 0.4, '#8A6A3A', { x: -4, rz: -0.4 })
    legs.box(0.4, 10.3, 0.4, '#8A6A3A', { x: 4, rz: 0.4 })
    legs.box(8.4, 0.4, 2.4, '#6B4A38', { y: 0.2 })
    group.add(legs.mesh())
    const wheel = new THREE.Group()
    wheel.position.set(0, 9.5, 0.6)
    const rim = new Kit()
    rim.torus(8, 0.3, '#FFE45E', {}, 6, 24)
    for(let k = 0; k < 12; k++)
    {
        const a = (k * Math.PI) / 6
        rim.box(0.2, 8, 0.2, '#FFF6EC', { rz: a - Math.PI / 2 })
        rim.box(1.4, 1.1, 1.4, k % 2 ? '#2DE2E6' : '#FF3EA5', { x: Math.cos(a) * 8, y: Math.sin(a) * 8 - 0.55 })
    }
    wheel.add(rim.mesh())
    const lights = new Kit()
    for(let k = 0; k < 12; k++) lights.sphere(0.3, '#FFE45E', { x: Math.cos((k * Math.PI) / 6) * 8, y: Math.sin((k * Math.PI) / 6) * 8 })
    wheel.add(new THREE.Mesh(lights.geometry(), glowMaterial))
    group.add(wheel)
    turning.push({ object: wheel, speed: 0.22, phase: 0 })
    return group
}

// a beach bar: a deck on posts, a counter room under a thatched roof, a hatch and a neon sign
function beachbar(kit, glow, x, z, yaw)
{
    on([ kit, glow ], x, z, yaw, () =>
    {
        kit.box(6, 0.3, 4, '#A0703C', { y: 0.3 })
        for(const [ px, pz ] of [ [ -2.8, -1.8 ], [ 2.8, -1.8 ], [ -2.8, 1.8 ], [ 2.8, 1.8 ] ]) kit.cyl(0.12, 0.12, 2.4, 6, '#6B4A2C', { x: px, y: 0.3, z: pz })
        kit.box(5.4, 2.2, 3.6, '#E9D3A6', { y: 0.6 })
        kit.cone(4.2, 2.4, 4, '#C98B4A', { y: 2.8, ry: Math.PI / 4 })
        kit.box(2.4, 0.9, 0.12, '#3B5BA9', { y: 1.2, z: 1.82 })
        glow.box(3, 0.4, 0.06, '#FF3EA5', { y: 2.2, z: 1.9 })
    })
    return { x, z, hw: 3, hd: 2.2, yaw }
}

// a bungalow with a thatched roof on stilts, with a glowing window
function bungalow(kit, glow, x, z, yaw)
{
    on([ kit, glow ], x, z, yaw, () =>
    {
        for(const [ px, pz ] of [ [ -1.5, -1.3 ], [ 1.5, -1.3 ], [ -1.5, 1.3 ], [ 1.5, 1.3 ] ]) kit.cyl(0.1, 0.1, 1.2, 5, '#6B4A2C', { x: px, y: 0, z: pz })
        kit.box(3.4, 0.14, 3, '#B98A4E', { y: 1.2 })
        kit.box(2.6, 1.6, 2.2, '#F3E2C2', { y: 1.35 })
        kit.cone(2.4, 1.6, 4, '#9C7A3E', { y: 2.95, ry: Math.PI / 4 })
        glow.box(0.6, 0.6, 0.06, '#FFC46B', { x: 0.7, y: 1.6, z: 1.12 })
    })
    return { x, z, hw: 1.9, hd: 1.7, yaw }
}

// a buoy: a red can with a white band and a yellow light on top, floating on the sea and bobbing
const bobbing = []
function buoy(x, z, phase)
{
    const kit = new Kit()
    kit.cyl(0.35, 0.5, 1.2, 8, '#D9473D', { y: 0 })
    kit.cyl(0.36, 0.36, 0.25, 8, '#F4F6F8', { y: 0.5 })
    kit.sphere(0.2, '#FFE45E', { y: 1.5 })
    const group = new THREE.Group()
    group.add(kit.mesh(clayMaterial))
    group.position.copy(surfacePoint(x, z, 0))
    group.quaternion.copy(frameQuaternion(x, z, 0))
    bobbing.push({ object: group, base: group.position.clone(), up: group.position.clone().normalize(), phase })
    return group
}

// a lighthouse: a banded tower with a gallery and a glowing lantern room, and a beam that turns
function lighthouse(x, z, yaw)
{
    const group = standing(x, z, yaw)
    const tower = new Kit()
    for(let b = 0; b < 5; b++) tower.cyl(1.5 - b * 0.03, 1.7 - b * 0.03, 2.8, 12, b % 2 ? '#F4F6F8' : '#D9473D', { y: b * 2.8 })
    tower.cyl(1.9, 1.9, 0.35, 12, '#5E6470', { y: 14 })
    tower.cone(1.4, 1.0, 10, '#3B3F4A', { y: 15.95 })
    group.add(tower.mesh())
    const lantern = new Kit()
    lantern.cyl(1.05, 1.05, 1.6, 10, '#FFE45E', { y: 14.35 })
    group.add(new THREE.Mesh(lantern.geometry(), glowMaterial))
    const lamp = new THREE.Group()
    lamp.position.set(0, 15.1, 0)
    const beam = new Kit()
    beam.box(0.5, 0.6, 12, '#FFF3B0', { z: 6 })
    lamp.add(new THREE.Mesh(beam.geometry(), glowMaterial))
    group.add(lamp)
    turning.push({ object: lamp, speed: 0.9, phase: x, axis: 'y' })
    return group
}

// a radio mast: a tapered lattice tower with cross bars, and a red light on the top that blinks
function radiomast(x, z, yaw)
{
    const group = standing(x, z, yaw)
    const mast = new Kit()
    for(const [ lx, lz ] of [ [ -1.1, -1.1 ], [ 1.1, -1.1 ], [ -1.1, 1.1 ], [ 1.1, 1.1 ] ]) mast.cyl(0.14, 0.4, 22, 5, '#C9D1DA', { x: lx, z: lz })
    for(let k = 1; k < 8; k++) mast.box(2.2 - k * 0.2, 0.12, 2.2 - k * 0.2, '#E3E8EC', { y: k * 2.8 })
    mast.cyl(0.12, 0.12, 3, 6, '#E3E8EC', { y: 22 })
    group.add(mast.mesh())
    const lamp = new Kit()
    lamp.sphere(0.45, '#FF3E3E', { y: 25.2 })
    const light = new THREE.Mesh(lamp.geometry(), glowMaterial)
    group.add(light)
    blinking.push({ object: light, period: 1.6 })
    return group
}

// an observatory: a drum with a dome, a door, and a telescope pointed at the sky
function observatory(kit, x, z)
{
    on([ kit ], x, z, 0.5, () =>
    {
        kit.cyl(3.4, 3.6, 3, 16, '#E9E2D2', { y: 0 })
        kit.sphere(3.5, '#F4F0E6', { y: 3 })
        kit.box(1, 2.2, 0.3, '#5E6470', { y: 0.1, z: 3.5 })
        kit.cyl(0.22, 0.22, 4.6, 8, '#BFC6CF', { y: 5.4, rx: -0.9, center: true })
    })
    return { x, z, radius: 3.6 }
}

// the buildings, the colliders that keep you from walking through them, the notice boards, and
// the turning parts (animate turns them on the shared clock)
export function buildIslandStructures()
{
    const kit = new Kit()
    const glow = new Kit()
    const colliders = []
    const group = new THREE.Group()
    group.name = 'island-structures'
    turning.length = 0
    blinking.length = 0
    bobbing.length = 0
    const boxed = (spot) => colliders.push({ type: 'box', ...spot, yaw: spot.yaw || 0 })

    for(const island of ISLANDS)
    {
        for(const spot of structureSpots(island))
        {
            const { kind, x, z, yaw = 0 } = spot
            if(kind === 'hut') boxed(hut(kit, glow, x, z))
            else if(kind === 'cabin') boxed(cabin(kit, glow, x, z))
            else if(kind === 'oasis') colliders.push({ type: 'circle', ...oasis(kit, glow, x, z), r: 4.4 })
            else if(kind === 'tent') colliders.push({ type: 'circle', ...tent(kit, x, z), r: 1.6 })
            else if(kind === 'fishmarket') boxed(fishmarket(kit, glow, x, z, yaw))
            else if(kind === 'boathouse') boxed(boathouse(kit, x, z, yaw))
            else if(kind === 'solar') boxed(solar(kit, x, z, yaw))
            else if(kind === 'turbine')
            {
                group.add(turbine(x, z, yaw))
                colliders.push({ type: 'circle', x, z, r: 0.9 })
            }
            else if(kind === 'diveshop') boxed(diveshop(kit, glow, x, z, yaw))
            else if(kind === 'hotspring') colliders.push({ type: 'circle', ...hotspring(kit, x, z), r: 3.2 })
            else if(kind === 'geothermal') boxed(geothermal(kit, x, z, yaw))
            else if(kind === 'ferris')
            {
                group.add(ferris(x, z, yaw))
                colliders.push({ type: 'box', x, z, yaw, hw: 4.6, hd: 1.4 })
            }
            else if(kind === 'beachbar') boxed(beachbar(kit, glow, x, z, yaw))
            else if(kind === 'bungalow') boxed(bungalow(kit, glow, x, z, yaw))
            else if(kind === 'lighthouse')
            {
                group.add(lighthouse(x, z, yaw))
                colliders.push({ type: 'circle', x, z, r: 2.2 })
            }
            else if(kind === 'radiomast')
            {
                group.add(radiomast(x, z, yaw))
                colliders.push({ type: 'circle', x, z, r: 1.2 })
            }
            else if(kind === 'observatory') colliders.push({ type: 'circle', ...observatory(kit, x, z), r: 3.6 })
        }
    }

    // the notice boards: each one stands on the ground and faces the middle of its island
    for(const island of ISLANDS)
    {
        for(const sign of signSpots(island))
        {
            const board = createSignBoard({ title: sign.title, line: sign.line })
            board.position.copy(surfacePoint(sign.x, sign.z, heightAt(sign.x, sign.z)))
            board.quaternion.copy(frameQuaternion(sign.x, sign.z, sign.yaw))
            group.add(board)
        }
    }

    // the buoys out on the water, each bobbing on its own phase
    for(const island of ISLANDS)
        buoySpots(island).forEach((b, i) => group.add(buoy(b.x, b.z, i + island.seed)))

    if(kit.parts.length) group.add(kit.mesh(clayMaterial))
    if(glow.parts.length) group.add(new THREE.Mesh(glow.geometry(), glowMaterial))

    // the turning parts: each one turns about its own axis, the turbines' blades about the nacelle
    const animate = (time) =>
    {
        for(const t of turning) t.object.rotation[t.axis || 'z'] = time * t.speed + t.phase
        for(const b of blinking) b.object.visible = time % b.period < 0.35
        for(const b of bobbing) b.object.position.copy(b.base).addScaledVector(b.up, Math.sin(time * 1.3 + b.phase) * 0.12)
    }
    return { group, colliders, animate }
}
