import * as THREE from 'three'

// Sky dome that follows the camera. The gradient is measured against the
// local "up" under the camera, so the horizon stays level wherever you stand.
// The environment sets the colours through the day; this adds the sun and
// moon, stars at night, drifting clouds and lightning.

export function createSky()
{
    const uniforms = {
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uSun: { value: new THREE.Vector3(0, 1, 0) },
        uMoon: { value: new THREE.Vector3(0, -1, 0) },
        uZenith: { value: new THREE.Color('#4A4FB0') },
        uMid: { value: new THREE.Color('#E58AB8') },
        uHorizon: { value: new THREE.Color('#FFC287') },
        uGlow: { value: new THREE.Color('#FF7A4D') },
        uGround: { value: new THREE.Color('#F4A783') },
        uSpace: { value: 0 },
        uNight: { value: 0 },
        uSunDisc: { value: 1 },
        uCloud: { value: 0.2 },
        uCloudLit: { value: new THREE.Color('#FFE9DA') },
        uCloudShade: { value: new THREE.Color('#C9A2B8') },
        uFlash: { value: 0 },
        uTime: { value: 0 }
    }
    const material = new THREE.ShaderMaterial({
        uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */`
            varying vec3 vDir;
            varying float vScreenY;
            void main()
            {
                vDir = normalize(position);
                vScreenY = normalize((modelViewMatrix * vec4(position, 0.0)).xyz).y;
                vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_Position = p.xyww;
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 uUp;
            uniform vec3 uSun;
            uniform vec3 uMoon;
            uniform vec3 uZenith;
            uniform vec3 uMid;
            uniform vec3 uHorizon;
            uniform vec3 uGlow;
            uniform vec3 uGround;
            uniform float uSpace;
            uniform float uNight;
            uniform float uSunDisc;
            uniform float uCloud;
            uniform vec3 uCloudLit;
            uniform vec3 uCloudShade;
            uniform float uFlash;
            uniform float uTime;
            varying vec3 vDir;
            varying float vScreenY;

            float hash13(vec3 p)
            {
                p = fract(p * 0.1031);
                p += dot(p, p.zyx + 31.32);
                return fract((p.x + p.y) * p.z);
            }
            float hash12(vec2 p)
            {
                vec3 q = fract(vec3(p.xyx) * 0.1031);
                q += dot(q, q.yzx + 33.33);
                return fract((q.x + q.y) * q.z);
            }
            float noise(vec2 p)
            {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            float fbm(vec2 p)
            {
                float v = 0.0;
                float a = 0.5;
                for(int i = 0; i < 4; i++)
                {
                    v += a * noise(p);
                    p = p * 2.03 + vec2(13.1, 7.7);
                    a *= 0.5;
                }
                return v;
            }

            void main()
            {
                vec3 dir = normalize(vDir);
                float h = dot(dir, uUp);
                float sunH = dot(uSun, uUp);
                float sunDot = max(dot(dir, uSun), 0.0);

                // a low sun warms the whole horizon
                float low = (1.0 - smoothstep(0.0, 0.7, sunH)) * smoothstep(-0.25, 0.0, sunH);
                vec3 horizon = mix(uHorizon, uGlow, low * 0.55);
                vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.28, h));
                col = mix(col, uZenith, smoothstep(0.25, 0.95, h));
                col = mix(col, uGround, smoothstep(0.0, -0.25, h));

                // stars, twinkling, above the horizon
                vec3 sp = dir * 150.0;
                vec3 cell = floor(sp);
                float seed = hash13(cell);
                vec3 offset = vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.3)) - 0.5;
                float star = step(0.92, seed) * smoothstep(0.2, 0.0, length(fract(sp) - 0.5 - offset * 0.5));
                star *= 0.55 + 0.45 * sin(uTime * (1.5 + seed * 3.0) + seed * 40.0);
                float clear = 1.0 - smoothstep(0.35, 0.9, uCloud);
                col += vec3(0.82, 0.88, 1.0) * star * uNight * smoothstep(0.02, 0.2, h) * clear * 1.4;

                // sun glow and disc
                col += uGlow * pow(sunDot, 12.0) * (0.35 + low * 0.5) * smoothstep(-0.15, 0.02, sunH) * (0.4 + 0.6 * uSunDisc);
                col += vec3(1.0, 0.93, 0.8) * smoothstep(0.9993, 0.9997, sunDot) * uSunDisc * smoothstep(-0.03, 0.01, sunH);

                // the moon, with a soft halo
                float moonDot = max(dot(dir, uMoon), 0.0);
                col += vec3(0.55, 0.62, 0.9) * pow(moonDot, 60.0) * 0.35 * uNight;
                col += vec3(0.95, 0.96, 1.0) * smoothstep(0.99955, 0.99975, moonDot) * uNight * (0.35 + 0.65 * clear);

                // clouds drifting across the upper sky
                vec3 tangent = normalize(cross(uUp, vec3(0.0, 0.0, 1.0)));
                vec3 bitangent = cross(uUp, tangent);
                vec2 uv = vec2(dot(dir, tangent), dot(dir, bitangent)) / (h + 0.22);
                uv = uv * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
                float n = fbm(uv * 1.7);
                float cover = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.32, n) * smoothstep(-0.02, 0.18, h);
                vec3 cloud = mix(uCloudShade, uCloudLit, smoothstep(0.35, 0.85, fbm(uv * 3.1 + 4.0)) * 0.7 + pow(sunDot, 6.0) * 0.4);
                col = mix(col, cloud, cover * 0.92);

                // lightning lights up the whole sky
                col += vec3(0.75, 0.8, 1.0) * uFlash * (0.5 + 0.5 * smoothstep(-0.1, 0.5, h));

                // seen from far away, fade towards a calm gradient (dusk by day, deep blue at night)
                vec3 space = mix(vec3(1.0, 0.42, 0.24), vec3(0.98, 0.45, 0.45), smoothstep(-0.5, 0.0, vScreenY));
                space = mix(space, vec3(0.62, 0.22, 0.52), smoothstep(0.0, 0.35, vScreenY));
                space = mix(space, vec3(0.14, 0.12, 0.38), smoothstep(0.35, 0.8, vScreenY));
                vec3 spaceNight = mix(vec3(0.16, 0.14, 0.34), vec3(0.05, 0.06, 0.16), smoothstep(-0.3, 0.6, vScreenY));
                spaceNight += vec3(0.8, 0.85, 1.0) * star * smoothstep(-0.2, 0.3, vScreenY);
                space = mix(space, spaceNight, uNight);
                col = mix(col, space, uSpace);

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 24), material)
    mesh.frustumCulled = false
    mesh.renderOrder = -1
    mesh.name = 'sky'
    mesh.userData.uniforms = uniforms
    return mesh
}
