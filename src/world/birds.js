import * as THREE from 'three'
import { R, mapToDir, mapTangent } from '../core/geo.js'
import { BAY_ANGLE, coastRadius } from './layout.js'
import { mulberry32 } from '../core/noise.js'

// Flocks over the island and seagulls circling the bay. One instanced mesh;
// the wings flap in the vertex shader.

function birdGeometry()
{
    // body along +z, wings on x. The `wing` attribute holds the distance from
    // the body so the shader can fold the wing tips more than the roots.
    const positions = [
        // body (a thin diamond)
        0, 0, 0.35, 0.06, 0, 0, 0, 0.06, 0,
        0, 0, 0.35, 0, 0.06, 0, -0.06, 0, 0,
        0, 0, -0.3, 0, 0.06, 0, 0.06, 0, 0,
        0, 0, -0.3, -0.06, 0, 0, 0, 0.06, 0,
        // left wing
        0.05, 0, 0.12, 0.62, 0, -0.05, 0.05, 0, -0.1,
        // right wing
        -0.05, 0, 0.12, -0.05, 0, -0.1, -0.62, 0, -0.05,
        // tail
        0, 0, -0.25, 0.1, 0, -0.42, -0.1, 0, -0.42
    ]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const wing = []
    for(let i = 0; i < positions.length; i += 3) wing.push(Math.abs(positions[i]) > 0.07 ? Math.abs(positions[i]) : 0)
    g.setAttribute('wing', new THREE.Float32BufferAttribute(wing, 1))
    g.computeVertexNormals()
    return g
}

export class Birds
{
    constructor()
    {
        const random = mulberry32(12)
        this.birds = []
        // three flocks drifting across the island
        for(let f = 0; f < 3; f++)
        {
            const center = { r: 12 + f * 9, a: random() * Math.PI * 2, speed: (0.05 + random() * 0.03) * (f % 2 ? 1 : -1), alt: 20 + f * 4 }
            for(let i = 0; i < 7; i++)
                this.birds.push({ kind: 'flock', center, ox: (random() - 0.5) * 7, oz: (random() - 0.5) * 7, oy: (random() - 0.5) * 2, phase: random() * 10, flap: 9 + random() * 3 })
        }
        // gulls over the bay
        for(let i = 0; i < 6; i++)
        {
            const a = BAY_ANGLE + (random() - 0.5) * 0.9
            const r = coastRadius(a) + random() * 6 - 2
            this.birds.push({ kind: 'gull', cx: Math.cos(a) * r, cz: Math.sin(a) * r, radius: 4 + random() * 6, speed: (0.35 + random() * 0.25) * (i % 2 ? 1 : -1), alt: 7 + random() * 6, phase: random() * 10, flap: 4.5 + random() * 2 })
        }

        const material = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, side: THREE.DoubleSide, roughness: 0.9 })
        material.onBeforeCompile = (shader) =>
        {
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nattribute float wing;\nattribute float flapPhase;')
                .replace('#include <begin_vertex>', `#include <begin_vertex>
                    float flapAngle = sin(flapPhase) * 0.9;
                    transformed.y += wing * sin(flapAngle) * 1.1;
                    transformed.x *= mix(1.0, cos(flapAngle), step(0.01, wing));`)
        }
        const geometry = birdGeometry()
        this.flapPhase = new THREE.InstancedBufferAttribute(new Float32Array(this.birds.length), 1)
        geometry.setAttribute('flapPhase', this.flapPhase)
        this.mesh = new THREE.InstancedMesh(geometry, material, this.birds.length)
        this.mesh.frustumCulled = false
        this.mesh.castShadow = false
        const dark = new THREE.Color('#3A3F4A')
        const white = new THREE.Color('#F7F5F0')
        this.birds.forEach((b, i) => this.mesh.setColorAt(i, b.kind === 'gull' ? white : dark))
        this.mesh.instanceColor.needsUpdate = true

        this._m = new THREE.Matrix4()
        this._p = new THREE.Vector3()
        this._up = new THREE.Vector3()
        this._fwd = new THREE.Vector3()
        this._right = new THREE.Vector3()
    }

    position(b, t)
    {
        if(b.kind === 'flock')
        {
            const c = b.center
            const a = c.a + t * c.speed
            const wob = Math.sin(t * 0.7 + b.phase) * 1.2
            return { x: Math.cos(a) * c.r + b.ox + wob, z: Math.sin(a) * c.r + b.oz + Math.cos(t * 0.5 + b.phase), y: c.alt + b.oy + Math.sin(t + b.phase) * 0.6 }
        }
        const a = t * b.speed + b.phase
        return { x: b.cx + Math.cos(a) * b.radius, z: b.cz + Math.sin(a) * b.radius, y: b.alt + Math.sin(t * 0.8 + b.phase) * 1.2 }
    }

    update(time, dt = 1 / 60)
    {
        this.birds.forEach((b, i) =>
        {
            const p = this.position(b, time)
            const n = this.position(b, time + 0.05)
            const dx = n.x - p.x
            const dz = n.z - p.z
            mapToDir(p.x, p.z, this._up)
            mapTangent(p.x, p.z, dx, dz, this._fwd)
            this._right.crossVectors(this._up, this._fwd).normalize()
            const scale = b.kind === 'gull' ? 1.5 : 1.0
            // gulls bank into their circle
            const bank = b.kind === 'gull' ? Math.sign(b.speed) * 0.35 : 0
            this._m.makeBasis(this._right.multiplyScalar(scale), this._up.clone().multiplyScalar(scale), this._fwd.multiplyScalar(scale))
            this._m.multiply(new THREE.Matrix4().makeRotationZ(bank))
            this._p.copy(this._up).multiplyScalar(R + p.y)
            this._m.setPosition(this._p)
            this.mesh.setMatrixAt(i, this._m)
            // gulls glide most of the time, flocks flap steadily
            const glide = b.kind === 'gull' ? Math.max(0, Math.sin(time * 0.6 + b.phase)) : 1
            b.acc = (b.acc ?? b.phase) + dt * b.flap * (0.2 + 0.8 * glide)
            this.flapPhase.array[i] = b.acc
        })
        this.mesh.instanceMatrix.needsUpdate = true
        this.flapPhase.needsUpdate = true
    }
}
