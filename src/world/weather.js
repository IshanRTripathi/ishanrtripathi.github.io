import * as THREE from 'three'

// Rain, snow and lightning. Rain and snow live in a box that follows the
// player; each drop wraps around inside it in world space, so walking through
// the weather looks right. One draw call each.

const BOX = 46
const HEIGHT = 26

function seeds(count, perItem)
{
    const data = new Float32Array(count * perItem * 3)
    for(let i = 0; i < count; i++)
    {
        const s = [ Math.random(), Math.random(), Math.random() ]
        for(let k = 0; k < perItem; k++) data.set(s, (i * perItem + k) * 3)
    }
    return data
}

const common = /* glsl */`
    uniform vec3 uCenter;
    uniform vec3 uUp;
    uniform vec3 uT;
    uniform vec3 uB;
    uniform float uTime;
    uniform float uAmount;
    // a spot in the box, fixed in the world and wrapping round as you move
    vec3 boxPoint(vec3 s, float y)
    {
        float u = fract(s.x - dot(uCenter, uT) / ${BOX.toFixed(1)}) - 0.5;
        float v = fract(s.z - dot(uCenter, uB) / ${BOX.toFixed(1)}) - 0.5;
        return uCenter + uT * u * ${BOX.toFixed(1)} + uB * v * ${BOX.toFixed(1)} + uUp * y;
    }
    float shown(vec3 s)
    {
        return step(fract(s.x * 7.31 + s.z * 3.17 + s.y * 1.3), uAmount);
    }`

function frameUniforms()
{
    return {
        uCenter: { value: new THREE.Vector3() },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uT: { value: new THREE.Vector3(1, 0, 0) },
        uB: { value: new THREE.Vector3(0, 0, 1) },
        uTime: { value: 0 },
        uAmount: { value: 0 }
    }
}

export function createRain(count = 1300)
{
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(seeds(count, 2), 3))
    const ends = new Float32Array(count * 2)
    for(let i = 0; i < count; i++) ends[i * 2 + 1] = 1
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))
    const uniforms = { ...frameUniforms(), uWind: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#DCE6F5') } }
    const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */`
            ${common}
            uniform vec3 uWind;
            attribute float aEnd;
            varying float vAlpha;
            void main()
            {
                vec3 s = position;
                float fall = uTime * (17.0 + s.y * 6.0);
                float y = mod(s.y * ${HEIGHT.toFixed(1)} - fall, ${HEIGHT.toFixed(1)}) - ${(HEIGHT * 0.3).toFixed(1)};
                vec3 p = boxPoint(s, y);
                // a short streak, slanted by the wind
                p += (uWind * 0.07 + uUp * 1.35) * aEnd;
                vAlpha = shown(s) * mix(1.0, 0.15, aEnd);
                gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uColor;
            varying float vAlpha;
            void main()
            {
                gl_FragColor = vec4(uColor, vAlpha * 0.38);
                #include <colorspace_fragment>
            }`
    })
    const mesh = new THREE.LineSegments(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = 5
    mesh.visible = false
    return mesh
}

export function createSnow(count = 1500)
{
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(seeds(count, 1), 3))
    const uniforms = { ...frameUniforms(), uScale: { value: 800 } }
    const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */`
            ${common}
            uniform float uScale;
            varying float vAlpha;
            void main()
            {
                vec3 s = position;
                float fall = uTime * (1.1 + s.y * 0.7);
                float y = mod(s.y * ${HEIGHT.toFixed(1)} - fall, ${HEIGHT.toFixed(1)}) - ${(HEIGHT * 0.3).toFixed(1)};
                vec3 p = boxPoint(s, y);
                // flakes drift from side to side as they fall
                p += uT * sin(uTime * 0.7 + s.z * 31.0) * 0.45 + uB * cos(uTime * 0.53 + s.x * 23.0) * 0.45;
                vec4 mv = viewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = clamp((0.07 + s.z * 0.05) * uScale / -mv.z, 1.0, 16.0);
                vAlpha = shown(s);
            }`,
        fragmentShader: /* glsl */`
            varying float vAlpha;
            void main()
            {
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.12, d) * vAlpha * 0.95;
                gl_FragColor = vec4(vec3(1.0), a);
                #include <colorspace_fragment>
            }`
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = 5
    points.visible = false
    return points
}

// a jagged bolt far off in the sky, rebuilt for every strike
export function createBolt()
{
    const max = 40
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3))
    geometry.setDrawRange(0, 0)
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(3.2, 3.3, 4.2), toneMapped: false, transparent: true, fog: false })
    const bolt = new THREE.LineSegments(geometry, material)
    bolt.frustumCulled = false
    bolt.visible = false
    bolt.renderOrder = 1

    const point = new THREE.Vector3()
    bolt.userData.strike = (center, up, t, b) =>
    {
        const positions = geometry.attributes.position.array
        let n = 0
        const add = (a, c) =>
        {
            if(n >= max) return
            positions.set([ a.x, a.y, a.z, c.x, c.y, c.z ], n * 6)
            n++
        }
        const az = Math.random() * Math.PI * 2
        const dist = 120 + Math.random() * 60
        const side = t.clone().multiplyScalar(Math.cos(az)).addScaledVector(b, Math.sin(az))
        const across = t.clone().multiplyScalar(-Math.sin(az)).addScaledVector(b, Math.cos(az))
        const walk = (from, height, steps, spread) =>
        {
            let prev = from.clone()
            for(let i = 1; i <= steps; i++)
            {
                point.copy(from).addScaledVector(up, -height * i / steps)
                    .addScaledVector(across, (Math.random() - 0.5) * spread * 2)
                    .addScaledVector(side, (Math.random() - 0.5) * spread)
                add(prev, point)
                if(i === Math.floor(steps * 0.4) && Math.random() < 0.8) walk(point.clone(), height * 0.35, 5, spread * 0.8)
                prev = point.clone()
            }
        }
        const top = center.clone().addScaledVector(side, dist).addScaledVector(up, 90 + Math.random() * 20)
        walk(top, 95, 16, 5)
        geometry.attributes.position.needsUpdate = true
        geometry.setDrawRange(0, n * 2)
    }
    return bolt
}
