import * as THREE from 'three'
import { surfacePoint, frameQuaternion } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { Kit, clayMaterial } from '../models/kit.js'

// Every airstrip, the main one and one on each island: dark asphalt laid on the
// ground the terrain flattened for it, white centre dashes and bars at the ends,
// runway lights that run in a chase along the strip (brighter at night), green and
// red thresholds, and a windsock whose sleeve swings with the wind. Everything
// follows the planet's curve.

const ASPHALT = '#4A4D59'
const PAINT = '#FFF6EC'
const LIFT = 0.12
const YELLOW = new THREE.Color('#FFE45E')
const GREEN = new THREE.Color('#6CFF8E')
const RED = new THREE.Color('#FF2E4D')

// shared by every airstrip, so one update drives them all: the clock, how dark it is,
// and how many pixels a metre of light is on screen
export const airstripUniforms = { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 800 } }

// the wind as an angle: a slow sway with a quicker flutter on top
export function windAngle(time)
{
    return 0.9 * Math.sin(time * 0.21) + 0.35 * Math.sin(time * 0.67 + 1.3)
}

// a soft dot of light; each one flashes in turn along the strip, so the lights run like a chase
const lightMaterial = new THREE.ShaderMaterial({
    uniforms: airstripUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
        attribute vec3 aColor;
        attribute float aSeq;
        uniform float uScale;
        varying vec3 vColor;
        varying float vSeq;
        void main()
        {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp(0.45 * uScale / -mv.z, 2.0, 16.0);
            vColor = aColor;
            vSeq = aSeq;
        }`,
    fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uNight;
        varying vec3 vColor;
        varying float vSeq;
        void main()
        {
            float d = length(gl_PointCoord - 0.5);
            float core = smoothstep(0.5, 0.0, d);
            float chase = 0.5 + 0.5 * sin(uTime * 3.4 - vSeq);
            float level = mix(0.5, 1.0, uNight) * (0.3 + 0.7 * chase * chase);
            gl_FragColor = vec4(vColor * level * 2.4, core * level);
            #include <colorspace_fragment>
        }`
})

export function buildAirstrip(runway)
{
    const group = new THREE.Group()
    group.name = 'airstrip'
    const pts = runway.points
    const hw = runway.width / 2
    const lay = (x, z, lift = LIFT) => surfacePoint(x, z, heightAt(x, z) + lift, new THREE.Vector3())

    // the tangent and normal of the strip at each point, in map space
    const frame = (i) =>
    {
        const a = pts[Math.max(0, i - 1)]
        const b = pts[Math.min(pts.length - 1, i + 1)]
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
        const t = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }
        return { t, n: { x: -t.z, z: t.x } }
    }

    // asphalt: a ribbon of quads, two vertices per point
    const positions = []
    for(let i = 0; i < pts.length; i++)
    {
        const { n } = frame(i)
        for(const side of [ -1, 1 ])
        {
            const x = pts[i].x + n.x * hw * side
            const z = pts[i].z + n.z * hw * side
            const v = lay(x, z)
            positions.push(v.x, v.y, v.z)
        }
    }
    const indices = []
    for(let i = 0; i < pts.length - 1; i++)
    {
        const a = i * 2
        const b = a + 1
        const c = a + 2
        const d = a + 3
        // wound so the faces point up, out of the ground (the other way round, they are culled from above)
        indices.push(a, b, c, b, d, c)
    }
    const asphaltGeo = new THREE.BufferGeometry()
    asphaltGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    asphaltGeo.setIndex(indices)
    asphaltGeo.computeVertexNormals()
    const asphalt = new THREE.Mesh(asphaltGeo, new THREE.MeshStandardMaterial({ color: ASPHALT, roughness: 0.92, metalness: 0, flatShading: true }))
    asphalt.receiveShadow = true
    group.add(asphalt)

    // white paint: a dashed centre line and bars at both thresholds
    const paint = []
    const quad = (cx, cz, t, n, along, across) =>
    {
        const corners = [
            [ -along, -across ], [ along, -across ], [ along, across ], [ -along, across ]
        ].map(([ u, w ]) => ({ x: cx + t.x * u + n.x * w, z: cz + t.z * u + n.z * w }))
        // the same winding as the asphalt, so the paint faces up too
        for(const k of [ 0, 2, 1, 0, 3, 2 ])
        {
            const v = lay(corners[k].x, corners[k].z, LIFT + 0.02)
            paint.push(v.x, v.y, v.z)
        }
    }
    let arc = 0
    for(let i = 0; i < pts.length - 1; i++)
    {
        const a = pts[i]
        const b = pts[i + 1]
        const seg = Math.hypot(b.x - a.x, b.z - a.z)
        for(let s = 0; s < seg; s += 9)
        {
            const f = frame(i)
            const cx = a.x + (b.x - a.x) * s / seg
            const cz = a.z + (b.z - a.z) * s / seg
            if(arc > 4.5 && arc < pts.length * 6 - 8) quad(cx, cz, f.t, f.n, 2.6, 0.14)
            arc += 9
        }
    }
    // a bar across the strip, just inside each end
    for(const [ i, inward ] of [ [ 0, 1 ], [ pts.length - 1, -1 ] ])
    {
        const f = frame(i)
        quad(pts[i].x + f.t.x * 4 * inward, pts[i].z + f.t.z * 4 * inward, f.t, f.n, 0.7, hw * 0.8)
    }
    if(paint.length)
    {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(paint, 3))
        group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: PAINT, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })))
    }

    // the runway lights: a row down each side every 9 metres, and the thresholds
    const lights = { positions: [], colors: [], seq: [] }
    const light = (x, z, color, seq) =>
    {
        const v = lay(x, z, 0.35)
        lights.positions.push(v.x, v.y, v.z)
        lights.colors.push(color.r, color.g, color.b)
        lights.seq.push(seq)
    }
    for(let i = 0; i < pts.length; i++)
    {
        const { n } = frame(i)
        for(const side of [ -1, 1 ]) light(pts[i].x + n.x * (hw + 0.6) * side, pts[i].z + n.z * (hw + 0.6) * side, YELLOW, i * 0.55)
    }
    // thresholds: green at the take-off end, red at the far end
    for(const [ i, color ] of [ [ 0, GREEN ], [ pts.length - 1, RED ] ])
    {
        const { n, t } = frame(i)
        for(let k = -hw; k <= hw + 0.01; k += 2) light(pts[i].x + n.x * k + t.x * 1.2, pts[i].z + n.z * k + t.z * 1.2, color, 0)
    }
    const lightGeo = new THREE.BufferGeometry()
    lightGeo.setAttribute('position', new THREE.Float32BufferAttribute(lights.positions, 3))
    lightGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(lights.colors, 3))
    lightGeo.setAttribute('aSeq', new THREE.Float32BufferAttribute(lights.seq, 1))
    group.add(new THREE.Points(lightGeo, lightMaterial))

    // a windsock by the near end: a pole, and a striped sleeve on top that swings to point downwind
    const windsock = new THREE.Group()
    windsock.name = 'windsock'
    {
        const { n, t } = frame(0)
        const x = pts[0].x - n.x * (hw + 3.2) - t.x * 2
        const z = pts[0].z - n.z * (hw + 3.2) - t.z * 2
        windsock.position.copy(surfacePoint(x, z, heightAt(x, z)))
        windsock.quaternion.copy(frameQuaternion(x, z, 0))
    }
    const pole = new Kit()
    pole.cyl(0.05, 0.07, 3.6, 6, '#F3EEE6', { y: 1.8 })
    windsock.add(pole.mesh(clayMaterial))
    const sleeve = new THREE.Group()
    sleeve.position.y = 3.2
    const cloth = new Kit()
    cloth.cone(0.26, 1.6, 8, '#FF8C42', { rx: Math.PI / 2, rz: 0.3, center: true, sz: 1 })
    cloth.box(0.2, 0.06, 1.6, '#FFF6EC', { z: 0.8, rx: 0.05 })
    sleeve.add(cloth.mesh(clayMaterial))
    windsock.add(sleeve)
    group.add(windsock)
    group.userData.sleeve = sleeve

    return group
}

// the windsock turns with the wind; the lights follow the shared clock (see airstripUniforms)
export function animateAirstrip(group, time)
{
    const sleeve = group.userData.sleeve
    if(sleeve) sleeve.rotation.y = windAngle(time)
}
