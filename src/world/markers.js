import * as THREE from 'three'
import { surfacePoint, mapToDir } from '../core/geo.js'
import { heightAt } from './terrain.js'

// Glowing columns of light where a project can be opened. Walk into one.

const vertexShader = /* glsl */`
    varying vec2 vUv;
    varying float vDepth;
    void main()
    {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
    }
`
const fragmentShader = /* glsl */`
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uStrength;
    varying vec2 vUv;
    varying float vDepth;
    void main()
    {
        // fade out when the camera is right on top of it
        float fade = pow(1.0 - vUv.y, 1.6) * smoothstep(3.0, 9.0, vDepth);
        float bands = 0.75 + 0.25 * sin(vUv.y * 18.0 - uTime * 3.0);
        gl_FragColor = vec4(uColor * 1.15, fade * bands * 0.34 * uStrength);
    }
`

export const MARKER_COLORS = { project: '#FF3EA5', career: '#FFE45E', achievements: '#FFE45E', contact: '#2DE2E6' }

export class Markers
{
    constructor(interactables)
    {
        this.group = new THREE.Group()
        this.items = []
        const column = new THREE.CylinderGeometry(1.1, 1.1, 2.6, 24, 1, true)
        column.translate(0, 1.3, 0)
        const ring = new THREE.RingGeometry(0.9, 1.15, 32)
        ring.rotateX(-Math.PI / 2)
        for(const item of interactables)
        {
            const kind = item.content.id in MARKER_COLORS ? item.content.id : 'project'
            const color = new THREE.Color(MARKER_COLORS[kind])
            const uniforms = { uColor: { value: color }, uTime: { value: 0 }, uStrength: { value: 1 } }
            const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })
            const mesh = new THREE.Mesh(column, material)
            const ringMesh = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }))
            ringMesh.position.y = 0.05
            mesh.add(ringMesh)
            // stand it just in front of the board, on the sidewalk side
            const at = item.markerAt || item
            mesh.position.copy(surfacePoint(at.x, at.z, heightAt(at.x, at.z) + 0.2))
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mapToDir(at.x, at.z))
            mesh.renderOrder = 4
            this.group.add(mesh)
            this.items.push({ item, mesh, uniforms, at })
            item.marker = { x: at.x, z: at.z }
        }
    }

    update(time, visited)
    {
        for(const m of this.items)
        {
            m.uniforms.uTime.value = time
            const seen = visited.has(m.item.content.id)
            m.uniforms.uStrength.value += ((seen ? 0.35 : 1) - m.uniforms.uStrength.value) * 0.05
            m.mesh.scale.setScalar(1 + Math.sin(time * 2 + m.at.x) * 0.03)
        }
    }
}
