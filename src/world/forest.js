import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { frameMatrix } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { C } from './buildings.js'

// Instanced trees and small props. Each type is one draw call.

const wind = {
    uTime: { value: 0 },
    // trees between the camera and this point fade out so Ishan is never hidden
    uFadeTarget: { value: new THREE.Vector3() },
    uFadeOn: { value: 0 }
}

export const occlusion = wind

const BAYER = `
float bayer4(vec2 p)
{
    ivec2 i = ivec2(mod(p, 4.0));
    const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[i.x + i.y * 4] + 0.5) / 16.0;
}`

export function windMaterial(strength = 1)
{
    const material = clayMaterial.clone()
    material.onBeforeCompile = (shader) =>
    {
        shader.uniforms.uTime = wind.uTime
        shader.uniforms.uFadeTarget = wind.uFadeTarget
        shader.uniforms.uFadeOn = wind.uFadeOn
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vFadeWorld;')
            .replace('#include <project_vertex>', `#include <project_vertex>
                #ifdef USE_INSTANCING
                    vFadeWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                #else
                    vFadeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
                #endif`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                #ifdef USE_INSTANCING
                    float phase = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
                #else
                    float phase = 0.0;
                #endif
                float bend = max(transformed.y, 0.0);
                bend = bend * bend * ${(0.0035 * strength).toFixed(5)};
                transformed.x += sin(uTime * 1.3 + phase) * bend + sin(uTime * 2.9 + phase * 1.7) * bend * 0.3;
                transformed.z += cos(uTime * 1.1 + phase * 1.3) * bend * 0.6;`)
        // dissolve whatever stands right in front of the camera or between
        // the camera and Ishan (screen-door dither, no transparency sorting)
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform vec3 uFadeTarget;
                uniform float uFadeOn;
                varying vec3 vFadeWorld;
                ${BAYER}`)
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                float fadeNear = 1.0 - smoothstep(1.2, 4.0, length(vViewPosition));
                vec3 seg = uFadeTarget - cameraPosition;
                float segLen = max(length(seg), 0.001);
                vec3 segDir = seg / segLen;
                float along = dot(vFadeWorld - cameraPosition, segDir);
                float toLine = length(vFadeWorld - (cameraPosition + segDir * clamp(along, 0.0, segLen)));
                float fadeLine = (1.0 - smoothstep(1.4, 3.0, toLine)) * step(along, segLen - 0.9) * uFadeOn;
                float fade = max(fadeNear, fadeLine * 0.9);
                if(fade > bayer4(gl_FragCoord.xy)) discard;`)
    }
    return material
}

export function updateWind(time)
{
    wind.uTime.value = time
}

// ------------------------------------------------------------------ tree models
const leaf = {
    palm: [ '#5E9E3F', '#6DAE45' ],
    rain: [ '#7DB44B', '#8CC055', '#72A845' ],
    mango: [ '#3F7E3B', '#4A8C3F', '#367236' ],
    slender: [ '#B4C75A', '#A6BE52' ]
}

function palmGeometry()
{
    const kit = new Kit()
    // curved trunk from stacked, tilted segments
    let x = 0
    let y = 0
    const segs = 7
    for(let i = 0; i < segs; i++)
    {
        const tilt = 0.05 + i * 0.035
        const r = 0.26 - i * 0.018
        kit.cyl(r - 0.02, r, 1.05, 6, i % 2 ? '#9C7A55' : '#8B6B49', { x, y, rz: -tilt })
        x += Math.sin(tilt) * 1.0
        y += Math.cos(tilt) * 1.0
    }
    // fronds
    const fronds = 8
    for(let i = 0; i < fronds; i++)
    {
        const a = i / fronds * Math.PI * 2
        kit.push({ x, y: y + 0.1, ry: a })
        kit.box(0.5, 0.06, 2.6, leaf.palm[i % 2], { z: 1.25, rx: 0.42, center: true })
        kit.box(0.34, 0.05, 1.2, leaf.palm[(i + 1) % 2], { y: -0.55, z: 2.7, rx: 0.9, center: true })
        kit.pop()
    }
    // coconuts
    for(let i = 0; i < 3; i++)
    {
        const a = i / 3 * Math.PI * 2
        kit.sphere(0.2, '#6B4A2A', { x: x + Math.cos(a) * 0.25, y: y - 0.15, z: Math.sin(a) * 0.25 })
    }
    return kit.geometry()
}

function rainGeometry()
{
    const kit = new Kit()
    kit.cyl(0.32, 0.5, 2.4, 7, '#7A5A40', {})
    kit.cyl(0.14, 0.22, 1.9, 5, '#7A5A40', { x: 0.6, y: 2.0, rz: -0.7 })
    kit.cyl(0.14, 0.22, 1.9, 5, '#7A5A40', { x: -0.5, y: 2.0, rz: 0.75, ry: 0.4 })
    // wide umbrella canopy of chunky clusters
    const clusters = [ [ 0, 3.7, 0, 2.6 ], [ 2.1, 3.4, 0.6, 1.8 ], [ -2.0, 3.45, -0.4, 1.9 ], [ 0.6, 3.5, 2.0, 1.7 ], [ -0.6, 3.4, -2.0, 1.8 ], [ 1.6, 3.6, -1.6, 1.5 ], [ -1.4, 3.6, 1.7, 1.5 ] ]
    clusters.forEach(([ x, y, z, r ], i) => kit.sphere(r, leaf.rain[i % 3], { x, y, z, sy: 0.48 }, 1))
    return kit.geometry()
}

function mangoGeometry()
{
    const kit = new Kit()
    kit.cyl(0.26, 0.36, 1.8, 6, '#6A4C34', {})
    const clusters = [ [ 0, 3.1, 0, 1.9 ], [ 0.9, 2.6, 0.5, 1.3 ], [ -0.9, 2.7, -0.3, 1.3 ], [ 0.2, 2.5, -1.0, 1.2 ], [ -0.3, 3.9, 0.3, 1.2 ] ]
    clusters.forEach(([ x, y, z, r ], i) => kit.sphere(r, leaf.mango[i % 3], { x, y, z, sy: 0.92 }, 1))
    return kit.geometry()
}

function slenderGeometry()
{
    const kit = new Kit()
    kit.cyl(0.16, 0.24, 3.4, 6, '#8E7458', {})
    kit.sphere(1.1, leaf.slender[0], { y: 4.2, sy: 1.7 }, 1)
    kit.sphere(0.8, leaf.slender[1], { y: 5.7, sy: 1.4 }, 1)
    return kit.geometry()
}

function bushGeometry()
{
    const kit = new Kit()
    kit.sphere(0.7, '#5F9A43', { y: 0.35, sy: 0.75 }, 1)
    kit.sphere(0.5, '#6FAA4B', { x: 0.5, y: 0.3, z: 0.2, sy: 0.75 }, 1)
    kit.sphere(0.45, '#568F3D', { x: -0.45, y: 0.28, z: -0.15, sy: 0.75 }, 1)
    return kit.geometry()
}

function flowerGeometry()
{
    // a low clump of blossoms; colour comes from instanceColor
    const kit = new Kit()
    const heads = [ [ 0, 0.16, 0, 0.09 ], [ 0.16, 0.12, 0.08, 0.075 ], [ -0.12, 0.13, 0.12, 0.08 ], [ 0.05, 0.1, -0.15, 0.07 ], [ -0.15, 0.09, -0.06, 0.065 ] ]
    for(const [ x, y, z, r ] of heads) kit.sphere(r, '#ffffff', { x, y, z, sy: 0.7 })
    return kit.geometry()
}

function rockGeometry()
{
    const g = new THREE.IcosahedronGeometry(0.6, 0)
    const p = g.attributes.position
    for(let i = 0; i < p.count; i++)
    {
        const y = p.getY(i)
        p.setY(i, y < 0 ? y * 0.3 : y * 0.7)
        p.setX(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.15))
    }
    const kit = new Kit()
    kit.add(g, '#A39886', { y: 0.12 })
    return kit.geometry()
}

function lampGeometry()
{
    const kit = new Kit()
    kit.cyl(0.08, 0.12, 3.6, 6, '#3E4A52', {})
    kit.box(0.9, 0.08, 0.08, '#3E4A52', { y: 3.5, x: 0.4 })
    kit.cone(0.28, 0.3, 6, '#3E4A52', { y: 3.2, x: 0.8 })
    kit.sphere(0.16, '#FFE6A8', { y: 3.2, x: 0.8 })
    return kit.geometry()
}

function boatGeometry()
{
    const kit = new Kit()
    // a Konkan fishing boat: long hull, small cabin, a mast with a flag
    kit.box(1.6, 0.6, 5.2, '#2F79B8', { y: -0.2 })
    kit.box(1.7, 0.16, 5.3, C.white, { y: 0.38 })
    kit.box(1.0, 0.5, 1.0, C.red, { y: 0.4, z: 2.7, rx: 0.5 })
    kit.box(1.1, 0.8, 1.4, C.white, { y: 0.4, z: -0.8 })
    kit.box(1.2, 0.1, 1.6, C.red, { y: 1.2, z: -0.8 })
    kit.cyl(0.05, 0.05, 2.6, 5, C.wood, { y: 0.4, z: 0.9 })
    kit.box(0.04, 0.4, 0.6, C.turmeric, { y: 2.6, z: 1.2 })
    return kit.geometry()
}

// ------------------------------------------------------------------ build
const _m = new THREE.Matrix4()

function instanced(geometry, material, items, place)
{
    const mesh = new THREE.InstancedMesh(geometry, material, items.length)
    items.forEach((item, i) =>
    {
        place(item, _m)
        mesh.setMatrixAt(i, _m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}

export function createForest(scatter)
{
    const group = new THREE.Group()
    group.name = 'forest'
    const treeMaterial = windMaterial(1)
    const palmMaterial = windMaterial(0.8)
    const geometries = { palm: palmGeometry(), rain: rainGeometry(), mango: mangoGeometry(), slender: slenderGeometry() }

    for(const type of Object.keys(geometries))
    {
        const items = scatter.trees.filter((t) => t.type === type)
        if(!items.length) continue
        group.add(instanced(geometries[type], type === 'palm' ? palmMaterial : treeMaterial, items, (t, m) =>
        {
            frameMatrix(t.x, t.z, t.yaw, heightAt(t.x, t.z) - 0.1, t.scale, m)
        }))
    }

    const bushMaterial = windMaterial(2.5)
    const bushes = instanced(bushGeometry(), bushMaterial, scatter.bushes, (b, m) => frameMatrix(b.x, b.z, b.yaw, heightAt(b.x, b.z) - 0.05, b.scale, m))
    bushes.castShadow = false
    group.add(bushes)

    const flowers = instanced(flowerGeometry(), windMaterial(6), scatter.flowers, (f, m) => frameMatrix(f.x, f.z, f.yaw, heightAt(f.x, f.z) - 0.02, f.scale, m))
    const palette = [ '#F4C65A', '#EE7A6A', '#FFF6EA', '#D58BE0' ].map((c) => new THREE.Color(c))
    scatter.flowers.forEach((f, i) => flowers.setColorAt(i, palette[f.color]))
    flowers.castShadow = false
    group.add(flowers)

    const rocks = instanced(rockGeometry(), clayMaterial, scatter.rocks, (r, m) => frameMatrix(r.x, r.z, r.yaw, heightAt(r.x, r.z) - 0.1, r.scale, m))
    group.add(rocks)

    const lamps = instanced(lampGeometry(), clayMaterial, scatter.lamps, (l, m) => frameMatrix(l.x, l.z, l.yaw + Math.PI / 2, heightAt(l.x, l.z) - 0.05, 1, m))
    group.add(lamps)

    return group
}

export function createBoats(scatter)
{
    const meshes = []
    const geometry = boatGeometry()
    for(const b of scatter.boats)
    {
        const mesh = new THREE.Mesh(geometry, clayMaterial)
        mesh.castShadow = true
        mesh.userData.boat = b
        meshes.push(mesh)
    }
    return meshes
}

