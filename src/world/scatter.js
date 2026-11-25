// Deterministic placement of trees and small props. Pure data, so the check
// script can verify that nothing ends up on a path, in the sea or in a building.

import { mulberry32, createNoise2D } from '../core/noise.js'
import { layout, ROAD_HALF, SIDEWALK, BAY_ANGLE, coastRadius, beachWidth, duskAt } from './layout.js'
import { pathEdgeDistance, roadEdgeDistance, coastDistance } from './terrain.js'

const noise = createNoise2D(77)

// how far from the middle the land is scattered with trees, bushes and blocks
const WORLD_EXTENT = 112

// clearance around each site (circle approximation of its footprint)
export const siteRadius = (site) => Math.hypot(site.w, site.d) / 2

function blockedBySite(x, z, margin)
{
    for(const site of layout.sites)
    {
        if(Math.hypot(x - site.x, z - site.z) < siteRadius(site) + margin) return true
        if(site.sign && Math.hypot(x - site.sign.x, z - site.sign.z) < 1.8 + margin * 0.5) return true
        if(site.stool && Math.hypot(x - site.stool.x, z - site.stool.z) < 1.5 + margin * 0.5) return true
    }
    for(const prop of layout.props)
        if(Math.hypot(x - prop.x, z - prop.z) < 2 + margin) return true
    if(layout.studioDoor && Math.hypot(x - layout.studioDoor.x, z - layout.studioDoor.z) < 6) return true
    return false
}

// Street lights along every road, alternating sides
function placeLamps()
{
    const lamps = []
    for(const path of layout.paths)
    {
        if(path.kind !== 'road') continue
        const count = Math.floor(path.length / 13)
        for(let i = 1; i < count; i++)
        {
            const p = path.at(i / count)
            const side = i % 2 ? 1 : -1
            const x = p.x - p.tz * side * (ROAD_HALF + 0.45)
            const z = p.z + p.tx * side * (ROAD_HALF + 0.45)
            if(blockedBySite(x, z, 0.6)) continue
            if(layout.sites.some((site) => site.sign && Math.hypot(x - site.sign.x, z - site.sign.z) < 5)) continue
            if(roadEdgeDistance(x, z) < 0.3) continue
            if(lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 6)) continue
            lamps.push({ x, z, yaw: Math.atan2(p.tx, p.tz) + (side > 0 ? 0 : Math.PI) })
        }
    }
    return lamps
}

// Hotels and apartment blocks facing the roads, wherever there is room
function fillerCorners(f)
{
    const fx = Math.sin(f.yaw)
    const fz = Math.cos(f.yaw)
    const out = []
    for(const a of [ -1, -0.5, 0, 0.5, 1 ])
        for(const b of [ -1, -0.5, 0, 0.5, 1 ])
        {
            const u = a * f.w / 2
            const v = b * f.d / 2
            out.push({ x: f.x + fz * u + fx * v, z: f.z - fx * u + fz * v })
        }
    return out
}

function placeFillers()
{
    const random = mulberry32(310)
    const fillers = []
    for(const path of layout.paths)
    {
        if(path.kind !== 'road') continue
        const step = 5
        const count = Math.floor(path.length / step)
        for(const row of [ 0, 1 ])
        for(let i = 0; i <= count; i++)
            for(const side of [ 1, -1 ])
            {
                if(random() < 0.2) continue
                const p = path.at(Math.min(1, (i + random() * 0.3) / count))
                const w = 6.5 + random() * 2.5
                const d = 5.5 + random() * 2
                // the second row sits behind the first, a little taller
                const dist = ROAD_HALF + SIDEWALK + 1.4 + d / 2 + row * 9.5
                const x = p.x - p.tz * side * dist
                const z = p.z + p.tx * side * dist
                const f = { x, z, w, d, yaw: Math.atan2(p.x - x, p.z - z), floors: 2 + row + Math.floor(random() * 2.6), variant: Math.floor(random() * 64) }
                const r = Math.hypot(w, d) / 2
                const phi = Math.atan2(z, x)
                if(coastDistance(x, z) < beachWidth(phi) + r) continue
                if(layout.sites.some((site) => Math.hypot(x - site.x, z - site.z) < siteRadius(site) + r + 0.8)) continue
                if(layout.sites.some((site) => site.sign && Math.hypot(x - site.sign.x, z - site.sign.z) < r + 2)) continue
                if(layout.studioDoor && Math.hypot(x - layout.studioDoor.x, z - layout.studioDoor.z) < r + 6) continue
                if(layout.props.some((prop) => Math.hypot(x - prop.x, z - prop.z) < r + 3)) continue
                if(fillers.some((o) => Math.hypot(x - o.x, z - o.z) < r + Math.hypot(o.w, o.d) / 2 + 0.6)) continue
                if(fillerCorners(f).some((c) => pathEdgeDistance(c.x, c.z) < 0.5 || coastDistance(c.x, c.z) < 3)) continue
                fillers.push(f)
            }
    }

    // fill the open ground further from the roads, each block facing the nearest road
    for(let i = 0; i < 16000 && fillers.length < 80; i++)
    {
        const x = (random() * 2 - 1) * WORLD_EXTENT
        const z = (random() * 2 - 1) * WORLD_EXTENT
        const w = 6.5 + random() * 2.5
        const d = 5.5 + random() * 2
        const r = Math.hypot(w, d) / 2
        const phi = Math.atan2(z, x)
        if(coastDistance(x, z) < beachWidth(phi) + r + 1) continue
        if(pathEdgeDistance(x, z) < r + 2) continue
        if(layout.sites.some((site) => Math.hypot(x - site.x, z - site.z) < siteRadius(site) + r + 1.5)) continue
        if(layout.sites.some((site) => site.sign && Math.hypot(x - site.sign.x, z - site.sign.z) < r + 3)) continue
        if(fillers.some((o) => Math.hypot(x - o.x, z - o.z) < r + Math.hypot(o.w, o.d) / 2 + 2.5)) continue
        // face the nearest point of any road
        let best = null
        for(const path of layout.paths)
        {
            const n = path.nearest(x, z)
            if(!best || n.distance < best.distance) best = { ...n, path }
        }
        const q = best.path.points[best.index]
        const f = { x, z, w, d, yaw: Math.atan2(q.x - x, q.z - z), floors: 2 + Math.floor(random() * 3.6), variant: Math.floor(random() * 64) }
        if(fillerCorners(f).some((c) => pathEdgeDistance(c.x, c.z) < 1 || coastDistance(c.x, c.z) < 3)) continue
        fillers.push(f)
    }
    return fillers
}

function nearFiller(fillers, x, z, margin)
{
    return fillers.some((f) => Math.hypot(x - f.x, z - f.z) < Math.hypot(f.w, f.d) / 2 + margin)
}

// Royal palms planted along the sidewalks
function placeStreetPalms(lamps, fillers)
{
    const palms = []
    for(const path of layout.paths)
    {
        if(path.kind !== 'road') continue
        const count = Math.floor(path.length / 8)
        for(let i = 0; i <= count; i++)
            for(const side of [ 1, -1 ])
            {
                const p = path.at((i + (side > 0 ? 0 : 0.5)) / count)
                const x = p.x - p.tz * side * (ROAD_HALF + SIDEWALK * 0.62)
                const z = p.z + p.tx * side * (ROAD_HALF + SIDEWALK * 0.62)
                if(roadEdgeDistance(x, z) < 0.45) continue
                if(blockedBySite(x, z, 0.8)) continue
                if(layout.sites.some((site) => site.sign && Math.hypot(x - site.sign.x, z - site.sign.z) < 4)) continue
                if(lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 2.5)) continue
                if(palms.some((t) => Math.hypot(t.x - x, t.z - z) < 4.5)) continue
                if(coastDistance(x, z) < 2) continue
                palms.push({ type: 'royal', x, z, yaw: i * 1.7, scale: 0.95 + ((i * 7) % 5) * 0.05, street: true })
            }
    }
    return palms
}
function placeTrees(lamps, fillers)
{
    const random = mulberry32(2024)
    const trees = []
    const near = (x, z, d) =>
    {
        for(const t of trees) if((t.x - x) ** 2 + (t.z - z) ** 2 < d * d) return true
        for(const l of lamps) if((l.x - x) ** 2 + (l.z - z) ** 2 < 2.2 * 2.2) return true
        return false
    }

    // coconut palms along the beach, thicker around the bay
    for(let i = 0; i < 8000 && trees.length < 130; i++)
    {
        const phi = random() * Math.PI * 2
        const bw = beachWidth(phi)
        const r = coastRadius(phi) - (1.8 + random() * (bw + 3))
        const x = Math.cos(phi) * r
        const z = Math.sin(phi) * r
        const bay = Math.cos(phi - BAY_ANGLE)
        if(random() > 0.55 + bay * 0.4) continue
        if(coastDistance(x, z) < 1.6) continue
        if(pathEdgeDistance(x, z) < 1.3) continue
        if(blockedBySite(x, z, 1.6)) continue
        if(nearFiller(fillers, x, z, 1.5)) continue
        if(near(x, z, 3.4)) continue
        trees.push({ type: 'palm', x, z, yaw: random() * Math.PI * 2, scale: 0.85 + random() * 0.4, lean: random() })
    }

    // tropical green between the blocks, denser where the noise says so
    const inland = [ 'rain', 'palm', 'slender', 'royal', 'rain' ]
    for(let i = 0; i < 160000 && trees.length < 480; i++)
    {
        const x = (random() * 2 - 1) * WORLD_EXTENT
        const z = (random() * 2 - 1) * WORLD_EXTENT
        const s = coastDistance(x, z)
        const phi = Math.atan2(z, x)
        if(s < beachWidth(phi) + 1.5) continue
        const density = noise(x * 0.045, z * 0.045) * 0.5 + 0.5
        if(random() > 0.04 + 0.8 * Math.min(1, Math.max(0, (density - 0.35) / 0.4))) continue
        const type = inland[Math.floor(random() * inland.length)]
        const canopy = type === 'rain' ? 3.6 : type === 'palm' ? 2.6 : 1.6
        if(pathEdgeDistance(x, z) < canopy + 0.6) continue
        if(blockedBySite(x, z, 4.5 + canopy)) continue
        if(nearFiller(fillers, x, z, canopy + 0.8)) continue
        if(near(x, z, type === 'rain' ? 4.4 : 3.0)) continue
        trees.push({ type, x, z, yaw: random() * Math.PI * 2, scale: 0.8 + random() * 0.45, lean: random() })
    }
    return trees
}

function placeDecor(trees, fillers)
{
    const random = mulberry32(99)
    const bushes = []
    const flowers = []
    const rocks = []
    for(let i = 0; i < 26000; i++)
    {
        const x = (random() * 2 - 1) * WORLD_EXTENT
        const z = (random() * 2 - 1) * WORLD_EXTENT
        const s = coastDistance(x, z)
        if(s < 0.5) continue
        const pd = pathEdgeDistance(x, z)
        if(pd < 0.6) continue
        if(blockedBySite(x, z, 0.8)) continue
        if(nearFiller(fillers, x, z, 0.3)) continue
        const phi = Math.atan2(z, x)
        const onBeach = s < beachWidth(phi)
        const roll = random()
        if(onBeach)
        {
            if(roll < 0.05 && rocks.length < 60) rocks.push({ x, z, yaw: random() * 6.28, scale: 0.4 + random() * 0.8 })
            continue
        }
        if(roll < 0.12 && bushes.length < 380)
        {
            if(trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 1.4)) continue
            bushes.push({ x, z, yaw: random() * 6.28, scale: 0.6 + random() * 0.7 })
        }
        else if(roll < 0.5 && pd < 4 && flowers.length < 900)
        {
            flowers.push({ x, z, yaw: random() * 6.28, scale: 0.7 + random() * 0.6, color: Math.floor(random() * 4) })
        }
        else if(roll < 0.53 && rocks.length < 160)
        {
            rocks.push({ x, z, yaw: random() * 6.28, scale: 0.3 + random() * 0.6 })
        }
    }
    return { bushes, flowers, rocks }
}

function placeBoats()
{
    // speedboats and a yacht off the beach
    const boats = []
    for(const [ da, out, kind ] of [ [ -0.18, 7, 'speedboat' ], [ 0.12, 11, 'yacht' ], [ 0.3, 6.5, 'speedboat' ], [ -0.45, 9, 'speedboat' ] ])
    {
        const phi = BAY_ANGLE + da
        const r = coastRadius(phi) + out
        boats.push({ kind, x: Math.cos(phi) * r, z: Math.sin(phi) * r, yaw: phi + Math.PI / 2 + da * 3 })
    }
    return boats
}

// Lifeguard towers, umbrellas and loungers on the sunset beach
function placeBeach(trees)
{
    const random = mulberry32(55)
    const towers = []
    const umbrellas = []
    for(const start of [ -0.3, 0.32 ])
    {
        // walk along the beach until the spot is clear of the road and the shack
        for(let k = 0; k < 20; k++)
        {
            const phi = BAY_ANGLE + start + Math.sign(start) * k * 0.03
            const r = coastRadius(phi) - beachWidth(phi) * 0.45
            const x = Math.cos(phi) * r
            const z = Math.sin(phi) * r
            if(pathEdgeDistance(x, z) < 2 || blockedBySite(x, z, 2)) continue
            towers.push({ x, z, yaw: phi + Math.PI, variant: towers.length })
            break
        }
    }
    for(let i = 0; i < 400 && umbrellas.length < 9; i++)
    {
        const phi = BAY_ANGLE + (random() - 0.5) * 1.1
        const r = coastRadius(phi) - 1.8 - random() * (beachWidth(phi) - 2.5)
        const x = Math.cos(phi) * r
        const z = Math.sin(phi) * r
        if(pathEdgeDistance(x, z) < 1) continue
        if(blockedBySite(x, z, 1.5)) continue
        if(towers.some((t) => Math.hypot(t.x - x, t.z - z) < 4)) continue
        if(umbrellas.some((u) => Math.hypot(u.x - x, u.z - z) < 3.2)) continue
        if(trees.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue
        umbrellas.push({ x, z, yaw: phi + Math.PI + (random() - 0.5), color: umbrellas.length % 4 })
    }
    return { towers, umbrellas }
}

// Cars parked by the beach, outside the traffic loop
function placeParkedCars()
{
    const main = layout.main
    const cars = []
    const palette = [ 0, 1, 2, 3, 4 ]
    ;[ [ 0.86, 1 ], [ 0.9, -1 ], [ 0.935, 1 ] ].forEach(([ f, side ], i) =>
    {
        const p = main.at(f)
        const x = p.x - p.tz * side * (ROAD_HALF - 1.0)
        const z = p.z + p.tx * side * (ROAD_HALF - 1.0)
        cars.push({ x, z, yaw: Math.atan2(p.tx, p.tz) + (side > 0 ? 0 : Math.PI), paint: palette[i % palette.length] })
    })
    return cars
}

// A closed loop for traffic: the main road from the plaza junction round to the
// north junction, then back down the short cut
function trafficLoop()
{
    const main = layout.main
    const cut = layout.paths[2]
    const n = main.points.length - 1
    const i0 = Math.round(0.06 * n)
    const i1 = Math.round(0.765 * n)
    return [ ...main.points.slice(i0, i1 + 1), ...[ ...cut.points ].reverse().slice(1, -1) ]
}

// ------------------------------------------------------------------ evening details
// Lanterns, fences, stepping stones, flower borders, grass tufts and fireflies.

// point at distance s along a path, pushed sideways (left normal) by offset
function along(path, s, offset = 0)
{
    const p = path.at(Math.min(1, Math.max(0, s / path.length)))
    return { x: p.x - p.tz * offset, z: p.z + p.tx * offset, tx: p.tx, tz: p.tz, yaw: Math.atan2(p.tx, p.tz) }
}

// inside a city block's footprint (grown by margin)?
function inFiller(fillers, x, z, margin)
{
    for(const f of fillers)
    {
        const dx = x - f.x
        const dz = z - f.z
        const fx = Math.sin(f.yaw)
        const fz = Math.cos(f.yaw)
        if(Math.abs(dx * fz - dz * fx) < f.w / 2 + margin && Math.abs(dx * fx + dz * fz) < f.d / 2 + margin) return true
    }
    return false
}

// which side of a road (+1 left, -1 right) faces the sea at this point
function seaSide(p, offset)
{
    const left = coastDistance(p.x - p.tz * offset, p.z + p.tx * offset)
    const right = coastDistance(p.x + p.tz * offset, p.z - p.tx * offset)
    return left < right ? 1 : -1
}

// stones from a start point heading along (dx, dz), until stop() says so
function stoneTrail(stones, x, z, dx, dz, { step = 0.78, max = 8, wobble = 0.22, seed = 1, stop })
{
    const random = mulberry32(seed)
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len
    for(let i = 0; i < max; i++)
    {
        const side = (random() - 0.5) * 2 * wobble
        const sx = x + dx * step * i - dz * side
        const sz = z + dz * step * i + dx * side
        if(stop && stop(sx, sz, i)) break
        stones.push({ x: sx, z: sz, yaw: random() * Math.PI, scale: 0.85 + random() * 0.3, shade: Math.floor(random() * 3) })
    }
}

function placeDetails({ lamps, fillers, streetPalms, trees, bushes, umbrellas, towers })
{
    const main = layout.main
    const boardwalk = layout.paths.find((p) => p.kind === 'boardwalk')
    const chai = layout.sites.find((s) => s.kind === 'chai')
    const lighthouse = layout.sites.find((s) => s.kind === 'lighthouse')
    const lanterns = []
    const posts = [] // fence runs: arrays of { x, z }, joined by rails
    const fences = []
    const stones = []
    const clearOf = (list, x, z, d) => list.some((o) => Math.hypot(o.x - x, o.z - z) < d)

    // --- lanterns along the lighthouse boardwalk, alternating sides
    const bwHalf = boardwalk.halfWidth
    for(let s = 4.5, i = 0; s < boardwalk.length - 2; s += 5.2, i++)
    {
        const side = i % 2 ? 1 : -1
        const p = along(boardwalk, s, side * (bwHalf + 0.38))
        // the arm reaches over the boards
        lanterns.push({ x: p.x, z: p.z, yaw: p.yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2), kind: 'post' })
    }

    // --- the beach road: lanterns and a low wooden fence between the sidewalk and the sand
    const edge = ROAD_HALF + SIDEWALK
    const fenceOffset = edge + 0.42
    const fencePoint = (s) =>
    {
        const q = along(main, s)
        const side = seaSide(q, fenceOffset)
        return { ...along(main, s, side * fenceOffset), side }
    }
    const beachBlocked = (p, extra = 0) =>
    {
        const phi = Math.atan2(p.z, p.x)
        return coastDistance(p.x, p.z) > beachWidth(phi) + 5 ||
            coastDistance(p.x, p.z) < 1 ||
            pathEdgeDistance(p.x, p.z) < 0.12 ||
            blockedBySite(p.x, p.z, 0.3) ||
            clearOf(lamps, p.x, p.z, 0.9) || clearOf(streetPalms, p.x, p.z, 0.6 + extra) || clearOf(trees, p.x, p.z, 0.7 + extra) ||
            clearOf(umbrellas, p.x, p.z, 1.4 + extra) || clearOf(towers, p.x, p.z, 1.7 + extra)
    }
    // the arm reaches back over the sidewalk
    const lanternYaw = (p) => p.yaw + (p.side > 0 ? Math.PI / 2 : -Math.PI / 2)
    for(const f of [ 0.852, 0.897, 0.942 ])
    {
        const p = fencePoint(f * main.length)
        if(!beachBlocked(p, 0.3)) lanterns.push({ x: p.x, z: p.z, yaw: lanternYaw(p), kind: 'post', fenceS: f * main.length })
    }
    // a pair where the road runs out onto the sand
    {
        const q = along(main, main.length)
        for(const side of [ 1, -1 ])
        {
            const p = { ...along(main, main.length - 0.6, side * (edge + 0.45)), side }
            if(!beachBlocked(p, 0.2) && Math.hypot(p.x - chai.stool.x, p.z - chai.stool.z) > 1.4 && Math.hypot(p.x - chai.sign.x, p.z - chai.sign.z) > 1.8)
                lanterns.push({ x: p.x, z: p.z, yaw: q.yaw + Math.PI, kind: 'post' })
        }
    }
    // the fence, with one gap down to the sand
    const gapAt = 0.92 * main.length
    // posts every 1.8 m; the lantern posts stand in the line and carry the rails
    const stations = lanterns.filter((l) => l.fenceS !== undefined).map((l) => ({ s: l.fenceS, lantern: l }))
    for(let s = 0.83 * main.length; s <= 0.972 * main.length; s += 1.8)
        if(!stations.some((st) => st.lantern && Math.abs(st.s - s) < 0.6)) stations.push({ s })
    stations.sort((a, b) => a.s - b.s)
    let run = []
    const endRun = () => { if(run.length > 1) posts.push(run); run = [] }
    for(const st of stations)
    {
        if(st.lantern) { run.push({ x: st.lantern.x, z: st.lantern.z, lantern: true }); continue }
        const p = fencePoint(st.s)
        if(beachBlocked(p) || Math.abs(st.s - gapAt) < 1.3) { endRun(); continue }
        run.push({ x: p.x, z: p.z })
    }
    endRun()
    for(const r of posts) fences.push({ kind: 'beach', posts: r })

    // stepping stones from the end of the road across the sand to the water,
    // past the chai shack and between the umbrellas: try a few headings, keep the longest
    {
        const end = along(main, main.length)
        const out = { x: end.x / Math.hypot(end.x, end.z), z: end.z / Math.hypot(end.x, end.z) }
        let best = []
        for(const turn of [ -0.35, -0.2, -0.5, 0, 0.2 ])
        {
            const dx = out.x * Math.cos(turn) - out.z * Math.sin(turn)
            const dz = out.x * Math.sin(turn) + out.z * Math.cos(turn)
            const trail = []
            stoneTrail(trail, end.x + dx * (edge + 0.9), end.z + dz * (edge + 0.9), dx, dz, {
                seed: 41, max: 12,
                stop: (x, z) => coastDistance(x, z) < 1.6 || clearOf(umbrellas, x, z, 1.3) || clearOf(towers, x, z, 2) || clearOf(trees, x, z, 0.7) || clearOf(lanterns, x, z, 0.5) ||
                    blockedBySite(x, z, 0.2) || pathEdgeDistance(x, z) < 0.25
            })
            if(trail.length > best.length) best = trail
        }
        stones.push(...best)
    }

    // --- around the chai shack: short lanterns at its sides and by the stool
    {
        const fx = Math.sin(chai.yaw)
        const fz = Math.cos(chai.yaw)
        const spots = [ [ -3.0, 0.4 ], [ 3.0, 0.4 ], [ 3.1, 3.4 ], [ -2.6, -1.9 ] ]
        for(const [ u, v ] of spots)
        {
            const x = chai.x + fz * u + fx * v
            const z = chai.z - fx * u + fz * v
            if(Math.hypot(x - chai.stool.x, z - chai.stool.z) < 1.3) continue
            if(Math.hypot(x - chai.sign.x, z - chai.sign.z) < 1.6) continue
            if(coastDistance(x, z) < 0.8 || roadEdgeDistance(x, z) < 0.4) continue
            if(clearOf(umbrellas, x, z, 1.2) || clearOf(trees, x, z, 0.8)) continue
            lanterns.push({ x, z, yaw: chai.yaw, kind: 'short' })
        }
    }

    // --- stones from the end of the boardwalk up to the lighthouse door
    {
        const end = boardwalk.points[boardwalk.points.length - 1]
        const dx = lighthouse.x - end.x
        const dz = lighthouse.z - end.z
        const len = Math.hypot(dx, dz)
        stoneTrail(stones, end.x + dx / len * (bwHalf + 0.5), end.z + dz / len * (bwHalf + 0.5), dx, dz, {
            seed: 7, max: 6, wobble: 0.12,
            stop: (x, z) => Math.hypot(x - lighthouse.x, z - lighthouse.z) < 2.75
        })
    }

    // --- rope fence on both sides of the boardwalk
    for(const side of [ 1, -1 ])
    {
        let r = []
        for(let s = 3.2; s < boardwalk.length - 0.6; s += 1.9)
        {
            const p = along(boardwalk, s, side * (bwHalf + 0.3))
            const bad = coastDistance(p.x, p.z) < 0.5 || clearOf(lanterns, p.x, p.z, 0.7) || clearOf(stones, p.x, p.z, 0.6) ||
                layout.sites.some((site) => Math.hypot(p.x - site.x, p.z - site.z) < siteRadius(site) + 0.8) ||
                roadEdgeDistance(p.x, p.z) < 0.15 || layout.paths.some((o) => o !== boardwalk && o.nearest(p.x, p.z).distance < o.edge + 0.2)
            if(bad) { if(r.length > 1) fences.push({ kind: 'rope', posts: r }); r = []; continue }
            r.push({ x: p.x, z: p.z })
        }
        if(r.length > 1) fences.push({ kind: 'rope', posts: r })
    }

    // --- stepping stones from the sidewalk to every project's front door
    for(const site of layout.sites)
    {
        if(!site.contentId || !site.sign || site.kind === 'cinema' || site.kind === 'trophies' || site.kind === 'chai') continue
        const fx = Math.sin(site.yaw)
        const fz = Math.cos(site.yaw)
        const u = site.w * 0.27
        const v = site.d / 2 + 1.0
        stoneTrail(stones, site.x + fz * u + fx * v, site.z - fx * u + fz * v, fx, fz, {
            seed: site.x * 13 | 0, max: 5, step: 0.72, wobble: 0.1,
            stop: (x, z) => pathEdgeDistance(x, z) < 0.2 || Math.hypot(x - site.sign.x, z - site.sign.z) < 1.2
        })
    }

    // --- white picket fences in front of the low houses along the roads (gap at the door)
    for(const f of fillers)
    {
        if(f.floors > 2) continue
        const fx = Math.sin(f.yaw)
        const fz = Math.cos(f.yaw)
        const v = f.d / 2 + 0.55
        // only houses that front onto a sidewalk
        const front = { x: f.x + fx * (f.d / 2 + 1.6), z: f.z + fz * (f.d / 2 + 1.6) }
        if(pathEdgeDistance(front.x, front.z) > 0.6) continue
        const door = f.w * 0.27
        for(const [ a, b ] of [ [ -f.w / 2 + 0.2, door - 0.95 ], [ door + 0.95, f.w / 2 - 0.2 ] ])
        {
            const n = Math.max(1, Math.round((b - a) / 1.3))
            let r = []
            for(let i = 0; i <= n; i++)
            {
                const u = a + (b - a) * i / n
                const x = f.x + fz * u + fx * v
                const z = f.z - fx * u + fz * v
                const bad = pathEdgeDistance(x, z) < 0.1 || coastDistance(x, z) < 1 || blockedBySite(x, z, 0.2) ||
                    clearOf(lamps, x, z, 0.5) || clearOf(streetPalms, x, z, 0.6) || clearOf(trees, x, z, 0.6) ||
                    inFiller(fillers.filter((o) => o !== f), x, z, 0.3)
                if(bad) { if(r.length > 1) fences.push({ kind: 'picket', posts: r }); r = []; continue }
                r.push({ x, z })
            }
            if(r.length > 1) fences.push({ kind: 'picket', posts: r })
        }
    }

    // --- flower beds along the outer edge of the sidewalks
    const borders = []
    {
        const random = mulberry32(808)
        const fencePosts = fences.flatMap((fe) => fe.posts)
        for(const path of layout.paths)
        {
            if(path.kind !== 'road') continue
            for(const side of [ 1, -1 ])
            {
                let bed = 0
                for(let s = 0.5; s < path.length; s += 0.55)
                {
                    // beds a few metres long with gaps between them
                    const on = noise(s * 0.11 + side * 31 + path.length, 3.7) > -0.05
                    if(!on) { bed++; continue }
                    const p = along(path, s, side * (edge + 0.5 + (random() - 0.5) * 0.14))
                    const phi = Math.atan2(p.z, p.x)
                    if(coastDistance(p.x, p.z) < beachWidth(phi) + 0.6) continue
                    if(pathEdgeDistance(p.x, p.z) < 0.4) continue
                    if(blockedBySite(p.x, p.z, 0.2)) continue
                    if(inFiller(fillers, p.x, p.z, 0.25)) continue
                    if(clearOf(lamps, p.x, p.z, 0.6) || clearOf(streetPalms, p.x, p.z, 0.55) || clearOf(trees, p.x, p.z, 0.6)) continue
                    if(clearOf(stones, p.x, p.z, 0.6) || clearOf(lanterns, p.x, p.z, 0.6) || clearOf(fencePosts, p.x, p.z, 0.3)) continue
                    if(borders.length >= 520) break
                    borders.push({ x: p.x, z: p.z, yaw: random() * 6.28, scale: 0.95 + random() * 0.4, color: (bed * 3 + (random() < 0.25 ? 1 : 0)) % 5 })
                }
            }
        }
    }

    // --- grass tufts, thicker along the paths
    const tufts = []
    {
        const random = mulberry32(4242)
        for(let i = 0; i < 26000 && tufts.length < 1500; i++)
        {
            const x = (random() * 2 - 1) * WORLD_EXTENT
            const z = (random() * 2 - 1) * WORLD_EXTENT
            const phi = Math.atan2(z, x)
            if(coastDistance(x, z) < beachWidth(phi) + 0.4) continue
            const pd = pathEdgeDistance(x, z)
            if(pd < 0.3) continue
            if(random() > (pd < 5 ? 0.9 : 0.35)) continue
            if(blockedBySite(x, z, 0.3)) continue
            if(inFiller(fillers, x, z, 0.2)) continue
            tufts.push({ x, z, yaw: random() * 6.28, scale: 0.7 + random() * 0.6, shade: Math.floor(random() * 3) })
        }
    }

    // --- fireflies: around the chai shack, in the bushes and trees near the beach,
    // and a few along the boardwalk
    const fireflies = []
    {
        const random = mulberry32(1717)
        const add = (x, z, spread, count) =>
        {
            for(let i = 0; i < count; i++)
            {
                const a = random() * Math.PI * 2
                const r = spread * Math.sqrt(random())
                const px = x + Math.cos(a) * r
                const pz = z + Math.sin(a) * r
                if(coastDistance(px, pz) < 0) continue
                fireflies.push({ x: px, z: pz, h: 0.5 + random() * 1.9, phase: random() * 100, glow: 0.45 + 0.55 * duskAt(px, pz) })
            }
        }
        add(chai.x, chai.z, 7, 30)
        const green = [ ...bushes, ...trees ].filter((g) => duskAt(g.x, g.z) > 0.45)
        for(let i = 0; i < green.length && fireflies.length < 120; i += 2) add(green[i].x, green[i].z, 1.8, 2)
        for(let s = 3; s < boardwalk.length; s += 4) { const p = along(boardwalk, s); add(p.x, p.z, 2.6, 2) }
    }

    return { lanterns, fences, stones, borders, tufts, fireflies }
}

export function buildScatter()
{
    const lamps = placeLamps()
    const fillers = placeFillers()
    const streetPalms = placeStreetPalms(lamps, fillers)
    const trees = placeTrees(lamps, fillers)
    const decor = placeDecor(trees, fillers)
    const boats = placeBoats()
    const beach = placeBeach(trees)
    const parkedCars = placeParkedCars()
    const details = placeDetails({ lamps, fillers, streetPalms, trees, ...decor, ...beach })
    return { lamps, fillers, streetPalms, trees, boats, ...decor, ...beach, parkedCars, ...details, loop: trafficLoop() }
}

export const scatter = buildScatter()
