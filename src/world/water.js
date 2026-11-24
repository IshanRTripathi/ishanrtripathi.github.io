import * as THREE from 'three'
import { R } from '../core/geo.js'
import { coastGLSL } from './layout.js'

// Faceted sea around the whole planet: low waves, shallow turquoise near the
// island, and bands of foam rolling onto the beach.

export function createWater()
{
    const geometry = new THREE.IcosahedronGeometry(R, 54)
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
                ${coastGLSL()}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec3 dir = normalize(vSeaPos);
                float theta = acos(clamp(dir.y, -1.0, 1.0));
                float phi = atan(dir.z, dir.x);
                float s = coastRadius(phi) - theta * ${R.toFixed(1)};
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

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'water'
    mesh.renderOrder = 2
    mesh.receiveShadow = true
    mesh.userData.uniforms = uniforms
    return mesh
}
