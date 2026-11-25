import * as THREE from 'three'
import { Kit, clayMaterial } from '../models/kit.js'
import { frameMatrix, surfacePoint } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { duskAt } from './layout.js'
import { windMaterial } from './forest.js'
import { glowMaterial } from './neon.js'

// The small things that make the evening: lanterns with pools of light, fences,
// stepping stones, flower borders, grass tufts and fireflies. Each kind is one
// draw call.

const LANTERN_LIGHT = new THREE.Color('#FFB75E')
const POOL_LIGHT = new THREE.Color('#FFCF86')

// warm lantern glass: lit everywhere, brighter towards the sunset
function lanternColor(dusk)
{
    return LANTERN_LIGHT.clone().multiplyScalar(1.15 + 1.9 * dusk)
}

const _m = new THREE.Matrix4()
const _c = new THREE.Color()

// ------------------------------------------------------------------ lanterns
function lanternHead(clay, glow, y, dusk)
{
    const iron = '#3A2A22'
    clay.box(0.24, 0.04, 0.24, iron, { y })
    for(const [ x, z ] of [ [ -1, -1 ], [ 1, -1 ], [ -1, 1 ], [ 1, 1 ] ])
        clay.box(0.03, 0.3, 0.03, iron, { x: x * 0.1, y: y + 0.03, z: z * 0.1 })
    clay.box(0.26, 0.04, 0.26, iron, { y: y + 0.32 })
    clay.cone(0.2, 0.14, 4, iron, { y: y + 0.36, ry: Math.PI / 4 })
    clay.box(0.05, 0.06, 0.05, iron, { y: y + 0.5 })
    glow.box(0.17, 0.27, 0.17, lanternColor(dusk), { y: y + 0.04 })
}

function lantern(clay, glow, kind, dusk)
{
    const wood = '#5E4130'
    if(kind === 'short')
    {
        // a stake with the lantern sitting on top
        clay.box(0.22, 0.1, 0.22, '#4A3326', {})
        clay.box(0.1, 0.85, 0.1, wood, {})
        lanternHead(clay, glow, 0.85, dusk)
        return { head: { x: 0, z: 0 }, height: 1.0 }
    }
    // a post with an arm, the lantern hanging from it
    clay.box(0.26, 0.12, 0.26, '#4A3326', {})
    clay.box(0.13, 2.05, 0.13, wood, {})
    clay.box(0.19, 0.06, 0.19, wood, { y: 2.05 })
    clay.box(0.06, 0.07, 0.62, wood, { y: 1.92, z: 0.3 })
    clay.box(0.03, 0.12, 0.03, '#3A2A22', { y: 1.8, z: 0.52 })
    lanternHead(clay, glow, 1.28, dusk)
    return null
}

// ------------------------------------------------------------------ fences
function fenceRun(kit, fence)
{
    const posts = fence.posts
    const h = (p) => heightAt(p.x, p.z)
    const style = {
        beach: { post: [ 0.12, 1.0, '#8A6A4C' ], rails: [ [ 0.42, 0.06, 0.08 ], [ 0.8, 0.06, 0.08 ] ], rail: '#A58360' },
        rope: { post: [ 0.11, 0.92, '#7A5A40' ], rails: [ [ 0.74, 0.04, 0.04 ] ], rail: '#DCCDA6', sag: 0.09 },
        picket: { post: [ 0.09, 0.82, '#FBF7F0' ], rails: [ [ 0.24, 0.04, 0.06 ], [ 0.56, 0.04, 0.06 ] ], rail: '#F1ECE3', pickets: true }
    }[fence.kind]

    for(const p of posts)
    {
        // a lantern post already stands here
        if(p.lantern) continue
        frameMatrix(p.x, p.z, 0, h(p) - 0.15, 1, _m)
        kit.stack.push(_m.clone())
        kit.box(style.post[0], style.post[1] + 0.15, style.post[0], style.post[2], {})
        if(fence.kind === 'rope') kit.sphere(0.085, style.post[2], { y: style.post[1] + 0.17 })
        kit.stack.pop()
    }

    for(let i = 0; i < posts.length - 1; i++)
    {
        const a = posts[i]
        const b = posts[i + 1]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        const yaw = Math.atan2(b.x - a.x, b.z - a.z)
        const ha = h(a)
        const hb = h(b)
        const tilt = -Math.atan2(hb - ha, len)
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
        frameMatrix(mid.x, mid.z, yaw, (ha + hb) / 2, 1, _m)
        kit.stack.push(_m.clone())
        for(const [ y, t, d ] of style.rails)
        {
            if(style.sag)
            {
                // a rope dips between the posts
                for(const s of [ -1, 1 ])
                    kit.box(t, d, len / 2 + 0.02, style.rail, { y: y - style.sag / 2 + Math.tan(-tilt) * s * len / 4, z: s * len / 4, rx: tilt - s * style.sag / (len / 2), center: true })
            }
            else kit.box(t, d, len, style.rail, { y, rx: tilt, center: true })
        }
        if(style.pickets)
        {
            const n = Math.max(2, Math.round(len / 0.17))
            for(let k = 1; k < n; k++)
            {
                const z = -len / 2 + len * k / n
                const y = Math.tan(-tilt) * z
                kit.box(0.075, 0.66, 0.03, '#FBF7F0', { y: y - 0.02, z })
                kit.cone(0.055, 0.1, 4, '#FBF7F0', { y: y + 0.64, z, ry: Math.PI / 4, sz: 0.4 })
            }
        }
        kit.stack.pop()
    }
}

// ------------------------------------------------------------------ small things
function stoneGeometry()
{
    const g = new THREE.CylinderGeometry(0.34, 0.37, 0.09, 9)
    const p = g.attributes.position
    for(let i = 0; i < p.count; i++)
    {
        const a = Math.atan2(p.getZ(i), p.getX(i))
        const k = 1 + Math.sin(a * 3 + 1.3) * 0.1 + Math.sin(a * 5) * 0.05
        p.setX(i, p.getX(i) * k)
        p.setZ(i, p.getZ(i) * k * 0.82)
        if(p.getY(i) > 0) p.setY(i, p.getY(i) + Math.sin(a * 2) * 0.012)
    }
    const kit = new Kit()
    kit.add(g, '#ffffff', { y: 0.03 })
    return kit.geometry()
}

function tuftGeometry()
{
    // a handful of grass blades leaning outwards
    const positions = []
    const blades = 6
    for(let i = 0; i < blades; i++)
    {
        const a = i / blades * Math.PI * 2 + i * 0.7
        const lean = 0.12 + (i % 3) * 0.06
        const h = 0.3 + (i % 3) * 0.09
        const cx = Math.cos(a) * 0.05
        const cz = Math.sin(a) * 0.05
        const px = -Math.sin(a) * 0.035
        const pz = Math.cos(a) * 0.035
        positions.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const kit = new Kit()
    kit.add(g, '#ffffff', {})
    return kit.geometry()
}

function borderFlowerGeometry()
{
    // a neat little clump for the beds: leaves and three blossoms
    const kit = new Kit()
    kit.sphere(0.16, '#4E9A43', { y: 0.08, sy: 0.6 })
    for(const [ x, y, z, r ] of [ [ 0, 0.2, 0, 0.085 ], [ 0.12, 0.17, 0.07, 0.075 ], [ -0.1, 0.16, -0.09, 0.075 ] ])
        kit.sphere(r, '#ffffff', { x, y, z, sy: 0.75 })
    return kit.geometry()
}

const BORDER_COLORS = [ '#FF7FA8', '#FFE07A', '#FFFFFF', '#C996F0', '#FF9A6B' ].map((c) => new THREE.Color(c))
const STONE_COLORS = [ '#D9D0C3', '#CABFB0', '#E4DCCF' ].map((c) => new THREE.Color(c))
const TUFT_COLORS = [ '#6CAE4B', '#7DBD57', '#5E9F42' ].map((c) => new THREE.Color(c))

function instanced(geometry, material, items, place, colors)
{
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length))
    mesh.count = items.length
    items.forEach((item, i) =>
    {
        place(item, _m)
        mesh.setMatrixAt(i, _m)
        if(colors) mesh.setColorAt(i, colors(item, i))
    })
    mesh.instanceMatrix.needsUpdate = true
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    return mesh
}

// soft round pools of light on the ground
function poolTexture()
{
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.14)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

// ------------------------------------------------------------------ fireflies
function createFireflies(list)
{
    const positions = new Float32Array(list.length * 3)
    const phases = new Float32Array(list.length)
    const glows = new Float32Array(list.length)
    const p = new THREE.Vector3()
    list.forEach((f, i) =>
    {
        surfacePoint(f.x, f.z, heightAt(f.x, f.z) + f.h, p)
        positions.set([ p.x, p.y, p.z ], i * 3)
        phases[i] = f.phase
        glows[i] = f.glow
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aGlow', new THREE.BufferAttribute(glows, 1))
    geometry.computeBoundingSphere()

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uScale: { value: 800 },
            uColor: { value: new THREE.Color('#E9FF8F') }
        },
        vertexShader: /* glsl */ `
            uniform float uTime;
            uniform float uScale;
            attribute float aPhase;
            attribute float aGlow;
            varying float vLight;
            void main()
            {
                vec3 up = normalize(position);
                vec3 a = normalize(cross(up, vec3(1.0, 0.0, 0.0)));
                vec3 b = cross(up, a);
                float t = uTime;
                vec3 p = position
                    + a * (sin(t * 0.47 + aPhase * 3.1) * 0.55 + sin(t * 1.3 + aPhase) * 0.15)
                    + b * (cos(t * 0.39 + aPhase * 2.3) * 0.55 + cos(t * 1.1 + aPhase * 1.7) * 0.15)
                    + up * sin(t * 0.73 + aPhase * 1.9) * 0.28;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                // slow blinks, each on its own beat
                float blink = sin(t * (0.9 + fract(aPhase) * 1.4) + aPhase * 6.2831) * 0.5 + 0.5;
                blink = smoothstep(0.25, 1.0, blink);
                vLight = blink * aGlow;
                gl_PointSize = clamp(0.17 * uScale / -mv.z, 3.0, 56.0) * (0.55 + 0.45 * blink);
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            varying float vLight;
            void main()
            {
                float d = length(gl_PointCoord - 0.5) * 2.0;
                float core = max(0.0, 1.0 - d);
                float light = (core * core * core * core * 3.2 + core * core * 0.35) * vLight;
                gl_FragColor = vec4(uColor * light, 1.0);
                #include <colorspace_fragment>
            }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = true
    points.renderOrder = 4
    return points
}

// ------------------------------------------------------------------ build
export function createDetails(scatter, colliders)
{
    const group = new THREE.Group()
    group.name = 'details'

    // lanterns: posts and frames in clay, the glass in one glowing mesh
    const clay = new Kit()
    const glow = new Kit()
    const pools = []
    for(const l of scatter.lanterns)
    {
        const dusk = duskAt(l.x, l.z)
        frameMatrix(l.x, l.z, l.yaw, heightAt(l.x, l.z) + 0.02, 1, _m)
        clay.stack.push(_m.clone())
        glow.stack.push(_m.clone())
        lantern(clay, glow, l.kind, dusk)
        clay.stack.pop()
        glow.stack.pop()
        const reach = l.kind === 'post' ? 0.52 : 0
        pools.push({ x: l.x + Math.sin(l.yaw) * reach, z: l.z + Math.cos(l.yaw) * reach, r: l.kind === 'post' ? 2.4 : 1.8, k: 0.4 + 0.6 * dusk })
        colliders.push({ type: 'circle', x: l.x, z: l.z, r: 0.18, thin: true })
    }
    if(clay.parts.length)
    {
        group.add(clay.mesh(clayMaterial))
        const glass = new THREE.Mesh(glow.geometry(), glowMaterial)
        group.add(glass)
    }

    // fences, all in one mesh, with thin colliders along each rail
    const fences = new Kit()
    for(const f of scatter.fences)
    {
        fenceRun(fences, f)
        for(let i = 0; i < f.posts.length - 1; i++)
        {
            const a = f.posts[i]
            const b = f.posts[i + 1]
            const len = Math.hypot(b.x - a.x, b.z - a.z)
            colliders.push({ type: 'box', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, yaw: Math.atan2(b.x - a.x, b.z - a.z), hw: 0.1, hd: len / 2 + 0.05, thin: true })
        }
    }
    if(fences.parts.length) group.add(fences.mesh(clayMaterial))

    // stepping stones
    const stones = instanced(stoneGeometry(), clayMaterial, scatter.stones,
        (s, m) => frameMatrix(s.x, s.z, s.yaw, heightAt(s.x, s.z) - 0.01, s.scale, m),
        (s) => STONE_COLORS[s.shade % STONE_COLORS.length])
    stones.receiveShadow = true
    group.add(stones)

    // flower beds along the sidewalks
    const borders = instanced(borderFlowerGeometry(), windMaterial(5), scatter.borders,
        (f, m) => frameMatrix(f.x, f.z, f.yaw, heightAt(f.x, f.z) - 0.02, f.scale, m),
        (f) => BORDER_COLORS[f.color % BORDER_COLORS.length])
    borders.receiveShadow = true
    group.add(borders)

    // grass tufts
    const tuftMaterial = windMaterial(9)
    tuftMaterial.side = THREE.DoubleSide
    const tufts = instanced(tuftGeometry(), tuftMaterial, scatter.tufts,
        (t, m) => frameMatrix(t.x, t.z, t.yaw, heightAt(t.x, t.z) - 0.03, t.scale, m),
        (t) => TUFT_COLORS[t.shade % TUFT_COLORS.length])
    tufts.receiveShadow = true
    group.add(tufts)

    // pools of warm light under the lanterns and the street lights
    for(const l of scatter.lamps)
    {
        const dusk = duskAt(l.x, l.z)
        pools.push({ x: l.x + Math.cos(l.yaw) * 1.35, z: l.z - Math.sin(l.yaw) * 1.35, r: 3.6, k: 0.06 + 0.75 * dusk })
    }
    const poolMaterial = new THREE.MeshBasicMaterial({
        map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    })
    const disc = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
    const lightPools = instanced(disc, poolMaterial, pools,
        (p, m) => frameMatrix(p.x, p.z, 0, heightAt(p.x, p.z) + 0.24, p.r, m),
        (p) => _c.copy(POOL_LIGHT).multiplyScalar(p.k))
    lightPools.renderOrder = 2
    group.add(lightPools)

    // fireflies
    const fireflies = createFireflies(scatter.fireflies)
    group.add(fireflies)
    group.userData.fireflies = fireflies

    return group
}

export function updateDetails(group, time, camera, renderer)
{
    const f = group.userData.fireflies
    if(!f) return
    f.material.uniforms.uTime.value = time
    // pixels per metre at one metre away, so the fireflies keep their size
    const height = renderer ? renderer.getDrawingBufferSize(_size).y : window.innerHeight
    f.material.uniforms.uScale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
}

const _size = new THREE.Vector2()
