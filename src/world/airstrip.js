import * as THREE from 'three'
import { surfacePoint, frameMatrix } from '../core/geo.js'
import { heightAt } from './terrain.js'
import { Kit, clayMaterial } from '../models/kit.js'
import { neonMaterial } from './neon.js'

// The runway: dark asphalt laid on the ground the terrain flattened for it,
// white centre dashes, neon edge lights, green and red thresholds at the ends,
// and a windsock by the near end. Everything follows the planet's curve.

const ASPHALT = '#4A4D59'
const PAINT = '#FFF6EC'
const LIFT = 0.12

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
        indices.push(a, c, b, b, c, d)
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
        for(const k of [ 0, 1, 2, 0, 2, 3 ])
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

    // lights and a windsock, in one clay and one neon mesh
    const clay = new Kit()
    const glow = new Kit()
    const _m = new THREE.Matrix4()
    const place = (kit, x, z, yaw, lift) =>
    {
        frameMatrix(x, z, yaw, heightAt(x, z) + lift, 1, _m)
        kit.stack.push(_m.clone())
        return () => kit.stack.pop()
    }
    // edge lights every 9 metres, down both sides
    for(let i = 0; i < pts.length; i++)
    {
        const { n } = frame(i)
        for(const side of [ -1, 1 ])
        {
            const x = pts[i].x + n.x * (hw + 0.6) * side
            const z = pts[i].z + n.z * (hw + 0.6) * side
            const pop = place(glow, x, z, 0, 0.35)
            glow.sphere(0.2, '#FFE45E', {}, 1)
            pop()
        }
    }
    // thresholds: green at the take-off end, red at the far end
    for(const [ i, color ] of [ [ 0, '#6CFF8E' ], [ pts.length - 1, '#FF2E4D' ] ])
    {
        const { n, t } = frame(i)
        for(let k = -hw; k <= hw + 0.01; k += 2)
        {
            const pop = place(glow, pts[i].x + n.x * k + t.x * 1.2, pts[i].z + n.z * k + t.z * 1.2, 0, 0.3)
            glow.sphere(0.18, color, {}, 1)
            pop()
        }
    }
    // a windsock by the near end: a pole, and a striped sleeve that streams with the wind
    {
        const { n, t } = frame(0)
        const x = pts[0].x - n.x * (hw + 3.2) - t.x * 2
        const z = pts[0].z - n.z * (hw + 3.2) - t.z * 2
        const pop = place(clay, x, z, 0, 0)
        clay.cyl(0.05, 0.07, 3.6, 6, '#F3EEE6', { y: 1.8 })
        clay.cone(0.26, 1.6, 8, '#FF8C42', { y: 3.2, rx: Math.PI / 2, rz: 0.3, center: true, sz: 1 })
        clay.box(0.2, 0.06, 1.6, '#FFF6EC', { y: 3.2, z: 0.8, rx: 0.05 })
        pop()
    }
    if(clay.parts.length) group.add(clay.mesh(clayMaterial))
    if(glow.parts.length) group.add(new THREE.Mesh(glow.geometry(), neonMaterial))
    return group
}
