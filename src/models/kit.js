import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeSeasonal } from '../world/seasonal.js'

// A tiny modelling kit: every part is a primitive with a flat vertex colour.
// All parts merge into one mesh, so a whole building is a single draw call.

export const clayMaterial = makeSeasonal(new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.88,
    metalness: 0
}), { key: 'clay' })

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _c = new THREE.Color()

export class Kit
{
    constructor()
    {
        this.parts = []
        this.stack = [ new THREE.Matrix4() ]
    }

    // nested transforms: kit.push({ x, y, z, ry }) ... kit.pop()
    push(t = {})
    {
        const m = toMatrix(t)
        this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m))
        return this
    }

    pop()
    {
        this.stack.pop()
        return this
    }

    add(geometry, color, t = {})
    {
        let g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
        g.deleteAttribute('uv')
        if(g.attributes.uv1) g.deleteAttribute('uv1')
        const m = this.stack[this.stack.length - 1].clone().multiply(toMatrix(t))
        g.applyMatrix4(m)
        const count = g.attributes.position.count
        const colors = new Float32Array(count * 3)
        _c.set(color)
        for(let i = 0; i < count; i++)
        {
            colors[i * 3] = _c.r
            colors[i * 3 + 1] = _c.g
            colors[i * 3 + 2] = _c.b
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.parts.push(g)
        return this
    }

    // box resting on y (bottom at t.y) unless center: true
    box(w, h, d, color, t = {})
    {
        const g = new THREE.BoxGeometry(w, h, d)
        if(!t.center) g.translate(0, h / 2, 0)
        return this.add(g, color, t)
    }

    cyl(rTop, rBottom, h, segments, color, t = {})
    {
        const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments)
        if(!t.center) g.translate(0, h / 2, 0)
        return this.add(g, color, t)
    }

    cone(r, h, segments, color, t = {})
    {
        const g = new THREE.ConeGeometry(r, h, segments)
        if(!t.center) g.translate(0, h / 2, 0)
        return this.add(g, color, t)
    }

    sphere(r, color, t = {}, detail = 0)
    {
        return this.add(new THREE.IcosahedronGeometry(r, detail), color, t)
    }

    torus(r, tube, color, t = {}, radial = 6, tubular = 12, arc = Math.PI * 2)
    {
        return this.add(new THREE.TorusGeometry(r, tube, radial, tubular, arc), color, t)
    }

    // extruded 2D shape, extruded along +z from 0 to depth
    extrude(points, depth, color, t = {})
    {
        const shape = new THREE.Shape(points.map(([ x, y ]) => new THREE.Vector2(x, y)))
        const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
        return this.add(g, color, t)
    }

    geometry()
    {
        const merged = mergeGeometries(this.parts, false)
        merged.computeVertexNormals()
        merged.computeBoundingSphere()
        return merged
    }

    mesh(material = clayMaterial)
    {
        const mesh = new THREE.Mesh(this.geometry(), material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        return mesh
    }
}

function toMatrix(t)
{
    _e.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ')
    _q.setFromEuler(_e)
    const s = t.s ?? 1
    _s.set(t.sx ?? s, t.sy ?? s, t.sz ?? s)
    _p.set(t.x || 0, t.y || 0, t.z || 0)
    return _m.compose(_p, _q, _s).clone()
}

// deterministic jitter for colour variation
export function shade(hex, amount)
{
    const c = new THREE.Color(hex)
    const hsl = {}
    c.getHSL(hsl)
    c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)))
    return '#' + c.getHexString()
}
