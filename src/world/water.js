import * as THREE from 'three'
import { R } from '../core/geo.js'
import { coastGLSL } from './layout.js'
import { islandsGLSL } from './islands.js'

// Faceted sea around the whole planet: low waves, shallow turquoise near the
// island, and bands of foam rolling onto the beach.

export function createWater()
{
    // 40 divisions: the waves are small, so this is plenty and costs about half of 54
const geometry = new THREE.IcosahedronGeometry(R, 40)
    const uniforms = {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#13719A') },
        uShallow: { value: new THREE.Color('#25C2C2') },
        uShore: { value: new THREE.Color('#A2F2DE') },
        uFoam: { value: new THREE.Color('#FFF8EC') }
    }
    const material = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.32,
        metalness: 0.0,
        flatShading: true,
        transparent: true
    })

    material.onBeforeCompile = (shader) =>
    {
        Object.assign(shader.uniforms, uniforms)
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                uniform float uTime;
                varying vec3 vSeaPos;
                float seaWave(vec3 p)
                {
                    float w = 0.0;
                    w += sin(dot(p, vec3(0.42, 0.11, 0.33)) + uTime * 1.25) * 0.075;
                    w += sin(dot(p, vec3(-0.27, 0.21, 0.47)) * 1.3 + uTime * 1.6) * 0.055;
                    w += sin(dot(p, vec3(0.61, -0.35, -0.18)) * 1.9 + uTime * 2.1) * 0.03;
                    return w;
                }`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                transformed += normalize(position) * seaWave(position);
                vSeaPos = transformed;`)

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform float uTime;
                uniform vec3 uDeep;
                uniform vec3 uShallow;
                uniform vec3 uShore;
                uniform vec3 uFoam;
                varying vec3 vSeaPos;
                ${coastGLSL()}
                ${islandsGLSL()}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec3 dir = normalize(vSeaPos);
                float theta = acos(clamp(dir.y, -1.0, 1.0));
                float phi = atan(dir.z, dir.x);
                // distance to the nearest shore: the main island, or any of the islands
                float rr = theta * ${R.toFixed(1)};
                float s = max(coastRadius(phi) - rr, islandSigned(vec2(rr * cos(phi), rr * sin(phi))));
                float depth = clamp(-s / 12.0, 0.0, 1.0);
                vec3 water = mix(uShore, uShallow, smoothstep(0.0, 0.22, depth));
                water = mix(water, uDeep, smoothstep(0.18, 1.0, depth));

                // foam: a solid lip at the shore plus bands rolling in
                float wobble = sin(phi * 37.0 + uTime * 0.6) * 0.25 + sin(phi * 91.0) * 0.15;
                float lip = smoothstep(-1.15 + wobble, -0.35, s);
                float band = fract(s * 0.42 + uTime * 0.28 + wobble * 0.3);
                float bands = smoothstep(0.82, 0.9, band) * smoothstep(-4.8, -1.2, s);
                float foam = clamp(max(lip, bands * 0.85), 0.0, 1.0);

                diffuseColor.rgb = mix(water, uFoam, foam);
                diffuseColor.a = mix(mix(0.62, 0.94, smoothstep(0.02, 0.4, depth)), 1.0, foam);`)
    }

    // eight patches, one per octant of the sphere, so the camera can skip the far side of the planet
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    const pos = flat.attributes.position.array
    const buckets = Array.from({ length: 8 }, () => [])
    for(let i = 0; i < pos.length; i += 9)
    {
        const cx = pos[i] + pos[i + 3] + pos[i + 6]
        const cy = pos[i + 1] + pos[i + 4] + pos[i + 7]
        const cz = pos[i + 2] + pos[i + 5] + pos[i + 8]
        const k = (cx > 0 ? 1 : 0) | (cy > 0 ? 2 : 0) | (cz > 0 ? 4 : 0)
        for(let j = 0; j < 9; j++) buckets[k].push(pos[i + j])
    }
    const group = new THREE.Group()
    group.name = 'water'
    group.renderOrder = 2
    group.userData.uniforms = uniforms
    for(const arr of buckets)
    {
        if(!arr.length) continue
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
        g.computeBoundingSphere()
        const mesh = new THREE.Mesh(g, material)
        mesh.renderOrder = 2
        mesh.receiveShadow = true
        group.add(mesh)
    }
    return group
}
