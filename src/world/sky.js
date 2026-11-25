import * as THREE from 'three'

// Sky dome that follows the camera. The gradient is measured against the
// local "up" under the camera, so the horizon stays level wherever you stand.

export function createSky()
{
    const uniforms = {
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uSun: { value: new THREE.Vector3(0, 1, 0) },
        uZenith: { value: new THREE.Color('#4A4FB0') },
        uMid: { value: new THREE.Color('#E58AB8') },
        uHorizon: { value: new THREE.Color('#FFC287') },
        uGlow: { value: new THREE.Color('#FF7A4D') },
        uGround: { value: new THREE.Color('#F4A783') },
        uSpace: { value: 0 }
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
            uniform vec3 uZenith;
            uniform vec3 uMid;
            uniform vec3 uHorizon;
            uniform vec3 uGlow;
            uniform vec3 uGround;
            uniform float uSpace;
            varying vec3 vDir;
            varying float vScreenY;
            void main()
            {
                vec3 dir = normalize(vDir);
                float h = dot(dir, uUp);
                float sunH = dot(uSun, uUp);
                float sunDot = max(dot(dir, uSun), 0.0);

                // a low sun warms the whole horizon
                float low = 1.0 - smoothstep(0.0, 0.7, sunH);
                vec3 horizon = mix(uHorizon, uGlow, low * 0.55);
                vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.28, h));
                col = mix(col, uZenith, smoothstep(0.25, 0.95, h));
                col = mix(col, uGround, smoothstep(0.0, -0.25, h));

                // sun glow and disc
                col += uGlow * pow(sunDot, 12.0) * (0.35 + low * 0.5);
                col += vec3(1.0, 0.93, 0.8) * smoothstep(0.9993, 0.9997, sunDot);

                // seen from far away, fade towards a calm dusk gradient
                vec3 space = mix(vec3(1.0, 0.42, 0.24), vec3(0.98, 0.45, 0.45), smoothstep(-0.5, 0.0, vScreenY));
                space = mix(space, vec3(0.62, 0.22, 0.52), smoothstep(0.0, 0.35, vScreenY));
                space = mix(space, vec3(0.14, 0.12, 0.38), smoothstep(0.35, 0.8, vScreenY));
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
