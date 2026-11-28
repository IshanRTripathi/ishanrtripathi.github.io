// Height and surface of the island, as pure functions of map coordinates.

import { createNoise2D, fbm, smoothstep, lerp, clamp } from '../core/noise.js'
import { layout, coastRadius, beachWidth } from './layout.js'
import { ISLANDS, islandSigned, islandHeight, nearestIsland } from './islands.js'
import { clearZone } from './runways.js'

const noise = createNoise2D(7)
const noiseB = createNoise2D(19)

// ------------------------------------------------------------------ path distance index
const CELL = 4
const segIndex = new Map()
const segments = []

// the runways count as roads for everything placed on the ground: the main one, and one on each island
const runways = [ layout.runway, ...ISLANDS.map((island) => island.runway) ].filter(Boolean)
const strips = [ ...layout.paths ]
for(const runway of runways) strips.push({ points: runway.points, halfWidth: runway.width / 2, edge: runway.width / 2 + 1, kind: 'road' })

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
    // taller hills than a flat park, and a broad swell that lifts the middle of the island, away from the coast and the roads
    const swell = smoothstep(bw + 14, bw + 50, s) * 1.8
    const hills = h * 5.4 * hillMask + swell
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

// Each airstrip is a flat strip at one height, so the plane can roll along it: the
// ground under it is levelled to the highest point of it, plus a little. The main
// strip is levelled to the main island's ground, each island's to its own.
function runwayPads(runway, ground)
{
    const pts = runway.points
    const samples = []
    for(let i = 0; i < pts.length - 1; i++)
        for(let k = 0; k < 4; k++)
            samples.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * k / 4, z: pts[i].z + (pts[i + 1].z - pts[i].z) * k / 4 })
    samples.push(pts[pts.length - 1])
    const top = Math.max(...samples.map((p) => ground(p.x, p.z))) + 0.35
    // one pad at each corner point is enough: the pads overlap along the strip
    return pts.map((p) => ({ x: p.x, z: p.z, radius: 6.5, height: top }))
}
const allPads = [
    ...pads,
    ...(layout.runway ? runwayPads(layout.runway, rawHeight) : []),
    ...ISLANDS.flatMap((island) => runwayPads(island.runway, landHeight))
]

// The clear ground in front of every airstrip (see runways.js): nothing is placed in it
const clearZones = runways.map(clearZone)

// how far a point is from the nearest clear ground (negative inside it)
export function clearDistance(x, z)
{
    let best = 30
    for(const zone of clearZones)
    {
        const d = segmentDistance(zone, x, z) - zone.half
        if(d < best) best = d
    }
    return best
}

// how far a point is from anything placement must keep clear: the paths, and the airstrips' clear ground
export function placementDistance(x, z)
{
    return Math.min(pathEdgeDistance(x, z), clearDistance(x, z))
}

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

// The ground as it is drawn. The terrain mesh is built from heights sampled at its corners
// and drawn as flat triangles between them, so between corners it is not quite heightAt.
// Every triangle is recorded here, and groundAt reads the one under a point, so a character
// stands on the ground the eye sees, not on the smooth field it was sampled from.
const GROUND_CELL = 4
const groundTris = [] // nine numbers per triangle: map x, z and height of each corner
const groundCells = new Map()

export function addGroundTriangle(a, b, c)
{
    const index = groundTris.length / 9
    groundTris.push(a.x, a.z, a.h, b.x, b.z, b.h, c.x, c.z, c.h)
    const x0 = Math.floor(Math.min(a.x, b.x, c.x) / GROUND_CELL)
    const x1 = Math.floor(Math.max(a.x, b.x, c.x) / GROUND_CELL)
    const z0 = Math.floor(Math.min(a.z, b.z, c.z) / GROUND_CELL)
    const z1 = Math.floor(Math.max(a.z, b.z, c.z) / GROUND_CELL)
    for(let cx = x0; cx <= x1; cx++)
        for(let cz = z0; cz <= z1; cz++)
        {
            const key = cx * 10007 + cz
            let list = groundCells.get(key)
            if(!list) groundCells.set(key, list = [])
            list.push(index)
        }
}

export function groundAt(x, z)
{
    const list = groundCells.get(Math.floor(x / GROUND_CELL) * 10007 + Math.floor(z / GROUND_CELL))
    if(list)
        for(const index of list)
        {
            const k = index * 9
            const ax = groundTris[k]
            const az = groundTris[k + 1]
            const bx = groundTris[k + 3]
            const bz = groundTris[k + 4]
            const cx = groundTris[k + 6]
            const cz = groundTris[k + 7]
            // barycentric coordinates of the point in the triangle, in map space
            const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
            if(Math.abs(den) < 1e-9) continue
            const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den
            const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den
            const w = 1 - u - v
            const eps = -1e-6
            if(u >= eps && v >= eps && w >= eps)
                return u * groundTris[k + 2] + v * groundTris[k + 5] + w * groundTris[k + 8]
        }
    // off the mesh (before it is built, or past its edge): the smooth field
    return heightAt(x, z)
}

export function padHeight(siteId)
{
    const i = layout.sites.findIndex((s) => s.id === siteId)
    return pads[i].height
}

// ------------------------------------------------------------------ surface type
export const SURFACE = { SEABED: 0, SAND: 1, GRASS: 2, PATH: 3, ROCK: 4, WET_SAND: 5, ROAD: 6, JUNGLE: 7, SNOW: 8, DUNE: 9, VOLCANIC: 10 }

// the inland ground of each island's theme; anything not listed is sand dunes
const GROUND = { jungle: SURFACE.JUNGLE, frost: SURFACE.SNOW, geyser: SURFACE.VOLCANIC, harbour: SURFACE.GRASS, meadow: SURFACE.GRASS, ridge: SURFACE.GRASS, mangrove: SURFACE.JUNGLE }

// the ground on an island, by how far in from the shore it is
function islandGround(isl)
{
    if(isl.s < 0.9) return SURFACE.WET_SAND
    if(isl.s < 3) return SURFACE.SAND
    return GROUND[isl.island.theme] ?? SURFACE.DUNE
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
