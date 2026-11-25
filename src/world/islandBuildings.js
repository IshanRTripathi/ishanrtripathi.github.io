import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { frameMatrix } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { ISLANDS, structureSpots } from './islands.js'
import { glowMaterial } from './neon.js'

// The landmarks of the islands: a stilt hut in the jungle, a log cabin on the
// frosty peak, and an oasis with a tent in the dunes. Each is built in its own
// frame, standing on the ground at its spot.

const _m = new THREE.Matrix4()

// run fn in a frame standing on the ground at (x, z), turned to yaw, for every kit given
function on(kits, x, z, yaw, fn)
{
    frameMatrix(x, z, yaw, heightAt(x, z), 1, _m)
    for(const k of kits) k.stack.push(_m.clone())
    fn()
    for(const k of kits) k.stack.pop()
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

// the buildings, and the colliders that keep you from walking through them
export function buildIslandStructures()
{
    const kit = new Kit()
    const glow = new Kit()
    const colliders = []
    for(const island of ISLANDS)
    {
        for(const spot of structureSpots(island))
        {
            if(spot.kind === 'hut') colliders.push({ type: 'box', ...hut(kit, glow, spot.x, spot.z), yaw: 0 })
            else if(spot.kind === 'cabin') colliders.push({ type: 'box', ...cabin(kit, glow, spot.x, spot.z) })
            else if(spot.kind === 'oasis') colliders.push({ type: 'circle', ...oasis(kit, glow, spot.x, spot.z), r: 4.4 })
            else if(spot.kind === 'tent') colliders.push({ type: 'circle', ...tent(kit, spot.x, spot.z), r: 1.6 })
        }
    }
    const group = new THREE.Group()
    group.name = 'island-structures'
    if(kit.parts.length) group.add(kit.mesh(clayMaterial))
    if(glow.parts.length) group.add(new THREE.Mesh(glow.geometry(), glowMaterial))
    return { group, colliders }
}
