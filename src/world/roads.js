import * as THREE from 'three'
import { surfacePoint, mapToDir } from '../core/geo.js'
import { layout, SIDEWALK } from './layout.js'
import { heightAt, roadEdgeDistance } from './terrain.js'

// Roads drawn as ribbons over the terrain: asphalt with a double yellow centre
// line and white edges, raised sidewalks with a curb, a terrazzo plaza and a
// wooden boardwalk out to the lighthouse.

function canvas(w, h, draw)
{
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d'), w, h)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    return t
}

function speckle(ctx, w, h, count, colors)
{
    for(let i = 0; i < count; i++)
    {
        ctx.fillStyle = colors[i % colors.length]
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
}

const textures = {
    road: () => canvas(256, 512, (ctx, w, h) =>
    {
        ctx.fillStyle = '#3E414D'
        ctx.fillRect(0, 0, w, h)
        speckle(ctx, w, h, 2600, [ '#474A57', '#363944', '#4D505C' ])
        // white edge lines
        ctx.fillStyle = '#F2EEE6'
        ctx.fillRect(w * 0.045, 0, w * 0.03, h)
        ctx.fillRect(w * 0.925, 0, w * 0.03, h)
        // double yellow centre line
        ctx.fillStyle = '#F5C542'
        ctx.fillRect(w * 0.47, 0, w * 0.022, h)
        ctx.fillRect(w * 0.508, 0, w * 0.022, h)
    }),
    sidewalk: () => canvas(128, 256, (ctx, w, h) =>
    {
        ctx.fillStyle = '#EFE2D2'
        ctx.fillRect(0, 0, w, h)
        speckle(ctx, w, h, 500, [ '#E6D7C4', '#F6EBDD' ])
        ctx.fillStyle = '#D5C4AF'
        for(let y = 0; y < h; y += h / 4) ctx.fillRect(0, y, w, 3)
        ctx.fillRect(0, 0, 4, h)
    }),
    boardwalk: () => canvas(128, 256, (ctx, w, h) =>
    {
        const planks = [ '#B98A5E', '#C4966A', '#AD7F55', '#BE9064' ]
        for(let i = 0; i < 8; i++)
        {
            ctx.fillStyle = planks[i % planks.length]
            ctx.fillRect(0, i * h / 8, w, h / 8 - 3)
            ctx.fillStyle = '#7E5A3A'
            ctx.fillRect(0, i * h / 8 + h / 8 - 3, w, 3)
        }
    }),
    terrazzo: () => canvas(512, 512, (ctx, w, h) =>
    {
        // pink and cream terrazzo tiles
        const tile = w / 8
        for(let i = 0; i < 8; i++)
            for(let j = 0; j < 8; j++)
            {
                ctx.fillStyle = (i + j) % 2 ? '#F6D5CF' : '#FBF1E6'
                ctx.fillRect(i * tile, j * tile, tile, tile)
            }
        speckle(ctx, w, h, 3000, [ '#E8A7A0', '#9FD8CF', '#F2C9A0', '#FFFFFF' ])
        ctx.strokeStyle = '#E3C4B6'
        ctx.lineWidth = 3
        for(let i = 0; i <= 8; i++)
        {
            ctx.beginPath(); ctx.moveTo(i * tile, 0); ctx.lineTo(i * tile, h); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(0, i * tile); ctx.lineTo(w, i * tile); ctx.stroke()
        }
    })
}

function material(map)
{
    return new THREE.MeshStandardMaterial({
        map,
        roughness: 0.9,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    })
}

// A strip alongside a polyline between two signed offsets (left normal positive)
function ribbon(points, from, to, { lift = 0.06, vLength = 6, keep = () => true, sideLift = null } = {})
{
    const positions = []
    const uvs = []
    const normals = []
    let v = 0
    const p3 = new THREE.Vector3()
    const n3 = new THREE.Vector3()
    const across = []
    for(let i = 0; i < points.length; i++)
    {
        const a = points[Math.max(0, i - 1)]
        const b = points[Math.min(points.length - 1, i + 1)]
        let tx = b.x - a.x
        let tz = b.z - a.z
        const len = Math.hypot(tx, tz) || 1
        tx /= len
        tz /= len
        const nx = -tz
        const nz = tx
        if(i > 0) v += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) / vLength
        across.push({ p: points[i], nx, nz, v })
    }
    const vertex = (c, offset, u, extraLift) =>
    {
        const x = c.p.x + c.nx * offset
        const z = c.p.z + c.nz * offset
        surfacePoint(x, z, heightAt(x, z) + lift + extraLift, p3)
        mapToDir(x, z, n3)
        positions.push(p3.x, p3.y, p3.z)
        normals.push(n3.x, n3.y, n3.z)
        uvs.push(u, c.v)
    }
    for(let i = 0; i < across.length - 1; i++)
    {
        const c0 = across[i]
        const c1 = across[i + 1]
        const mx = (c0.p.x + c1.p.x) / 2 + (c0.nx + c1.nx) / 2 * (from + to) / 2
        const mz = (c0.p.z + c1.p.z) / 2 + (c0.nz + c1.nz) / 2 * (from + to) / 2
        if(!keep(mx, mz)) continue
        const l0 = sideLift ? sideLift[0] : 0
        const l1 = sideLift ? sideLift[1] : 0
        // from < to, wound so the faces point away from the planet
        vertex(c0, from, 0, l0); vertex(c0, to, 1, l1); vertex(c1, from, 0, l0)
        vertex(c0, to, 1, l1); vertex(c1, to, 1, l1); vertex(c1, from, 0, l0)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    return g
}

function disc(cx, cz, radius, lift, tileSize)
{
    const positions = []
    const uvs = []
    const normals = []
    const rings = 8
    const segments = 56
    const p3 = new THREE.Vector3()
    const n3 = new THREE.Vector3()
    const point = (r, a) =>
    {
        const x = cx + Math.cos(a) * r
        const z = cz + Math.sin(a) * r
        surfacePoint(x, z, heightAt(x, z) + lift, p3)
        mapToDir(x, z, n3)
        positions.push(p3.x, p3.y, p3.z)
        normals.push(n3.x, n3.y, n3.z)
        uvs.push((x - cx) / tileSize, (z - cz) / tileSize)
    }
    for(let r = 0; r < rings; r++)
    {
        const r0 = radius * r / rings
        const r1 = radius * (r + 1) / rings
        for(let s = 0; s < segments; s++)
        {
            const a0 = s / segments * Math.PI * 2
            const a1 = (s + 1) / segments * Math.PI * 2
            point(r0, a0); point(r0, a1); point(r1, a0)
            point(r1, a0); point(r0, a1); point(r1, a1)
        }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    return g
}

export function createRoads()
{
    const group = new THREE.Group()
    group.name = 'roads'
    const mats = {
        road: material(textures.road()),
        sidewalk: material(textures.sidewalk()),
        curb: new THREE.MeshStandardMaterial({ color: '#D9CBB9', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        boardwalk: material(textures.boardwalk()),
        terrazzo: material(textures.terrazzo())
    }

    const inPlaza = (x, z) => layout.plazas.some((p) => Math.hypot(x - p.x, z - p.z) < p.r - 0.2)

    layout.paths.forEach((path, index) =>
    {
        const hw = path.halfWidth
        if(path.kind === 'boardwalk')
        {
            const mesh = new THREE.Mesh(ribbon(path.points, -hw, hw, { lift: 0.14, vLength: 2.5 }), mats.boardwalk)
            mesh.receiveShadow = true
            group.add(mesh)
            return
        }
        // asphalt (later roads sit a hair lower so junctions don't flicker)
        const lift = 0.07 - index * 0.004
        const road = new THREE.Mesh(ribbon(path.points, -hw, hw, { lift, vLength: 8, keep: (x, z) => !inPlaza(x, z) }), mats.road)
        road.receiveShadow = true
        group.add(road)

        // sidewalks and curbs, cut where they would cover another road
        const others = (x, z) =>
        {
            if(inPlaza(x, z)) return false
            // any asphalt (including this road's own) at this spot?
            return roadEdgeDistance(x, z) > 0.05
        }
        for(const side of [ 1, -1 ])
        {
            const a = side * hw
            const b = side * (hw + SIDEWALK)
            const walk = new THREE.Mesh(ribbon(path.points, side > 0 ? a : b, side > 0 ? b : a, { lift: 0.19, vLength: 4, keep: others }), mats.sidewalk)
            walk.receiveShadow = true
            group.add(walk)
            // curb face: a thin vertical-ish strip between road and sidewalk
            const curb = new THREE.Mesh(ribbon(path.points, a - 0.03, a + 0.03, { lift: 0.07, keep: others, sideLift: side > 0 ? [ 0, 0.12 ] : [ 0.12, 0 ] }), mats.curb)
            group.add(curb)
        }
    })

    // plazas and the paved turning circles at both ends of the main road
    const main = layout.main
    const ends = [ main.points[0], main.points[main.points.length - 1] ]
    for(const p of layout.plazas)
    {
        const mesh = new THREE.Mesh(disc(p.x, p.z, p.r, 0.12, 3), mats.terrazzo)
        mesh.receiveShadow = true
        group.add(mesh)
    }
    for(const e of ends)
    {
        const mesh = new THREE.Mesh(disc(e.x, e.z, main.halfWidth + SIDEWALK, 0.06, 4), mats.sidewalk)
        mesh.receiveShadow = true
        group.add(mesh)
    }
    return group
}
