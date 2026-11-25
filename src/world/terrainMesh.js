import * as THREE from 'three'
import { R, surfacePoint } from '../core/geo.js'
import { createNoise2D, mulberry32 } from '../core/noise.js'
import { heightAt, surfaceAt, coastDistance, SURFACE } from './terrain.js'
import { makeSeasonal } from './seasonal.js'

// Flat-shaded low-poly island: a jittered triangle grid in map space, wrapped onto
// the planet. Every triangle gets one colour from the surface under its centre.

export const PALETTE = {
    seabedShallow: '#7FDCCB',
    seabedDeep: '#1F7E9E',
    wetSand: '#E2CDA8',
    sand: [ '#F6E6CB', '#F3E0C2', '#F8EBD5' ],
    grass: [ '#86C25E', '#7DBA57', '#90C966', '#82BE5B' ],
    grassHigh: [ '#6FAE4F', '#76B353' ],
    path: [ '#E6D8C6', '#E1D2BF', '#EADDCC' ],
    road: '#454854',
    rock: '#B4A89A',
    planet: '#1B6F92'
}

const jitterNoise = createNoise2D(31)
const colorNoise = createNoise2D(41)

export function createTerrainMesh({ radius = 124, spacing = 1.45 } = {})
{
    const rowH = spacing * Math.sqrt(3) / 2
    const rows = Math.ceil(radius * 2 / rowH) + 1
    const cols = Math.ceil(radius * 2 / spacing) + 2
    const grid = []
    for(let j = 0; j < rows; j++)
    {
        const z = -radius + j * rowH
        const row = []
        for(let i = 0; i < cols; i++)
        {
            let x = -radius + i * spacing + (j % 2 ? spacing / 2 : 0)
            let zz = z
            const inside = Math.hypot(x, zz) <= radius + spacing
            if(inside)
            {
                x += jitterNoise(x * 0.9, zz * 0.9) * spacing * 0.22
                zz += jitterNoise(zz * 0.9 + 17, x * 0.9) * spacing * 0.22
            }
            row.push(inside ? { x, z: zz, h: heightAt(x, zz) } : null)
        }
        grid.push(row)
    }

    const positions = []
    const colors = []
    const color = new THREE.Color()
    const random = mulberry32(5)
    const v = new THREE.Vector3()

    const pushTri = (a, b, c) =>
    {
        if(!a || !b || !c) return
        const cx = (a.x + b.x + c.x) / 3
        const cz = (a.z + b.z + c.z) / 3
        faceColor(cx, cz, (a.h + b.h + c.h) / 3, Math.max(a.h, b.h, c.h) - Math.min(a.h, b.h, c.h), random, color)
        for(const p of [ a, b, c ])
        {
            surfacePoint(p.x, p.z, p.h, v)
            positions.push(v.x, v.y, v.z)
            colors.push(color.r, color.g, color.b)
        }
    }

    for(let j = 0; j < rows - 1; j++)
    {
        for(let i = 0; i < cols - 1; i++)
        {
            const odd = j % 2 === 1
            const a = grid[j][i]
            const b = grid[j][i + 1]
            const c = grid[j + 1][i]
            const d = grid[j + 1][i + 1]
            // winding chosen so faces point away from the planet centre
            if(odd)
            {
                pushTri(a, d, b)
                pushTri(a, c, d)
            }
            else
            {
                pushTri(a, c, b)
                pushTri(b, c, d)
            }
        }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    const material = makeSeasonal(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }), { key: 'terrain', foliage: 1, ground: true })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.receiveShadow = true
    mesh.name = 'terrain'
    return mesh
}

function pick(list, random)
{
    return list[Math.floor(random() * list.length)]
}

function faceColor(x, z, h, slope, random, out)
{
    const type = surfaceAt(x, z)
    const n = colorNoise(x * 0.08, z * 0.08)
    switch(type)
    {
        case SURFACE.SEABED:
        {
            const s = coastDistance(x, z)
            out.set(PALETTE.seabedShallow).lerp(new THREE.Color(PALETTE.seabedDeep), Math.min(1, -s / 9))
            break
        }
        case SURFACE.WET_SAND:
            out.set(PALETTE.wetSand)
            break
        case SURFACE.SAND:
            out.set(pick(PALETTE.sand, random))
            break
        case SURFACE.PATH:
            out.set(pick(PALETTE.path, random))
            break
        case SURFACE.ROAD:
            out.set(PALETTE.road)
            break
        default:
            if(slope > 1.1) out.set(PALETTE.rock)
            else if(h > 2.6 + n) out.set(pick(PALETTE.grassHigh, random))
            else out.set(pick(PALETTE.grass, random))
            // soft large-scale variation
            out.offsetHSL(n * 0.012, 0, n * 0.025)
    }
    return out
}

export function createPlanetCore()
{
    const geometry = new THREE.IcosahedronGeometry(R - 6.5, 10)
    const material = new THREE.MeshStandardMaterial({ color: PALETTE.planet, flatShading: true, roughness: 1 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'planet-core'
    return mesh
}
