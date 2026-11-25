// Height and surface of the island, as pure functions of map coordinates.

import { createNoise2D, fbm, smoothstep, lerp, clamp } from '../core/noise.js'
import { layout, coastRadius, beachWidth } from './layout.js'
import { ISLANDS, islandSigned, islandHeight, nearestIsland } from './islands.js'

const noise = createNoise2D(7)
const noiseB = createNoise2D(19)

// ------------------------------------------------------------------ path distance index
const CELL = 4
const segIndex = new Map()
const segments = []

// the runway counts as a road for everything placed on the ground
const strips = [ ...layout.paths ]
if(layout.runway) strips.push({ points: layout.runway.points, halfWidth: layout.runway.width / 2, edge: layout.runway.width / 2 + 1, kind: 'road' })

for(const path of strips)
{
    for(let i = 0; i < path.points.length - 1; i++)
    {
        const a = path.points[i]
        const b = path.points[i + 1]
        const seg = { ax: a.x, az: a.z, bx: b.x, bz: b.z, half: path.halfWidth, edge: path.edge, road: path.kind === 'road' }
        segments.push(seg)
        const minX = Math.floor((Math.min(a.x, b.x) - 8) / CELL)
        const maxX = Math.floor((Math.max(a.x, b.x) + 8) / CELL)
        const minZ = Math.floor((Math.min(a.z, b.z) - 8) / CELL)
        const maxZ = Math.floor((Math.max(a.z, b.z) + 8) / CELL)
        for(let cx = minX; cx <= maxX; cx++)
            for(let cz = minZ; cz <= maxZ; cz++)
            {
                const key = cx * 10007 + cz
                let list = segIndex.get(key)
                if(!list) segIndex.set(key, list = [])
                list.push(seg)
            }
    }
}

function segmentDistance(s, x, z)
{
    const dx = s.bx - s.ax
    const dz = s.bz - s.az
    const len2 = dx * dx + dz * dz || 1
    const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / len2, 0, 1)
    const px = s.ax + dx * t - x
    const pz = s.az + dz * t - z
    return Math.sqrt(px * px + pz * pz)
}

// Distance to the outer edge of the nearest road, sidewalk, boardwalk or plaza
// (negative inside). Capped at 8.
export function pathEdgeDistance(x, z)
{
    let best = 8
    const list = segIndex.get(Math.floor(x / CELL) * 10007 + Math.floor(z / CELL))
    if(list)
        for(const s of list)
        {
            const d = segmentDistance(s, x, z) - s.edge
            if(d < best) best = d
        }
    for(const p of layout.plazas)
    {
        const d = Math.hypot(x - p.x, z - p.z) - p.r
        if(d < best) best = d
    }
    return best
}

// Distance to the edge of the asphalt (or boardwalk) only, sidewalks excluded.
export function roadEdgeDistance(x, z)
{
    let best = 8
    const list = segIndex.get(Math.floor(x / CELL) * 10007 + Math.floor(z / CELL))
    if(list)
        for(const s of list)
        {
            const d = segmentDistance(s, x, z) - s.half
            if(d < best) best = d
        }
    return best
}

// ------------------------------------------------------------------ coast
// signed distance to the shore of the main island only: the placement of the main island uses this
export function mainCoastDistance(x, z)
{
    const r = Math.hypot(x, z)
    const phi = Math.atan2(z, x)
    return coastRadius(phi) - r
}

// signed distance to the nearest shore, of the main island or of any island: positive on land
export function coastDistance(x, z)
{
    const r = Math.hypot(x, z)
    const phi = Math.atan2(z, x)
    return Math.max(coastRadius(phi) - r, nearestIsland(x, z).s)
}

// ------------------------------------------------------------------ height
function rawHeight(x, z)
{
    const r = Math.hypot(x, z)
    const phi = Math.atan2(z, x)
    const s = coastRadius(phi) - r
    if(s < 0)
        return Math.max(-6.5, s * 0.75 + 0.12)

    const bw = beachWidth(phi)
    const beach = 0.12 + s * 0.07
    const inland = smoothstep(bw - 1, bw + 5, s)
    const hillMask = smoothstep(bw + 3, bw + 15, s)
    const h = smoothstep(-0.25, 0.75, fbm(noise, x * 0.022 + 3.1, z * 0.022 - 1.7, 3))
    const hills = h * 3.2 * hillMask
    const bumps = noiseB(x * 0.22, z * 0.22) * 0.16 * inland

    const pathK = smoothstep(4.5, 0.0, pathEdgeDistance(x, z))
    return Math.min(beach, 0.6) + inland * 0.45 + hills * (1 - 0.8 * pathK) + bumps * (1 - pathK)
}

// Building pads: flatten the ground under every site
const pads = layout.sites.map((site) =>
{
    const radius = Math.max(site.w, site.d) * 0.62 + 0.8
    return { x: site.x, z: site.z, radius, height: rawHeight(site.x, site.z) }
})

// The runway: a flat strip at one height, so the plane can roll along it
const runwayPads = []
if(layout.runway)
{
    const pts = layout.runway.points
    const samples = []
    for(let i = 0; i < pts.length - 1; i++)
        for(let k = 0; k < 4; k++)
            samples.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * k / 4, z: pts[i].z + (pts[i + 1].z - pts[i].z) * k / 4 })
    samples.push(pts[pts.length - 1])
    const top = Math.max(...samples.map((p) => rawHeight(p.x, p.z))) + 0.35
    for(const p of samples) runwayPads.push({ x: p.x, z: p.z, radius: 6.5, height: top })
}
const allPads = [ ...pads, ...runwayPads ]

// the ground of the main island, or of whichever island is higher here
function landHeight(x, z)
{
    let h = rawHeight(x, z)
    for(let i = 0; i < ISLANDS.length; i++)
    {
        const s = islandSigned(ISLANDS[i], x, z)
        // far from an island there is only sea, which is the same as the main island's sea
        if(s > -6)
        {
            const v = islandHeight(i, x, z, s)
            if(v > h) h = v
        }
    }
    return h
}

export function heightAt(x, z)
{
    let h = landHeight(x, z)
    for(const pad of allPads)
    {
        const d = Math.hypot(x - pad.x, z - pad.z)
        if(d < pad.radius + 3)
            h = lerp(h, pad.height, smoothstep(pad.radius + 3, pad.radius, d))
    }
    return h
}

export function padHeight(siteId)
{
    const i = layout.sites.findIndex((s) => s.id === siteId)
    return pads[i].height
}

// ------------------------------------------------------------------ surface type
export const SURFACE = { SEABED: 0, SAND: 1, GRASS: 2, PATH: 3, ROCK: 4, WET_SAND: 5, ROAD: 6, JUNGLE: 7, SNOW: 8, DUNE: 9 }

// the ground on an island, by how far in from the shore it is
function islandGround(isl)
{
    if(isl.s < 0.9) return SURFACE.WET_SAND
    if(isl.s < 3) return SURFACE.SAND
    const theme = isl.island.theme
    return theme === 'jungle' ? SURFACE.JUNGLE : theme === 'frost' ? SURFACE.SNOW : SURFACE.DUNE
}

export function surfaceAt(x, z)
{
    const r = Math.hypot(x, z)
    const phi = Math.atan2(z, x)
    const s = coastRadius(phi) - r
    const isl = nearestIsland(x, z)
    if(isl.s > s && isl.s >= -0.4) return islandGround(isl)
    if(s < -0.4) return SURFACE.SEABED
    if(s < 0.9) return SURFACE.WET_SAND
    if(roadEdgeDistance(x, z) < 0) return SURFACE.ROAD
    if(pathEdgeDistance(x, z) < 0.2) return SURFACE.PATH
    const bw = beachWidth(phi) + noise(x * 0.15 + 9, z * 0.15) * 1.2
    if(s < bw) return SURFACE.SAND
    return SURFACE.GRASS
}

export function isWalkable(x, z)
{
    return coastDistance(x, z) > -1.6
}
