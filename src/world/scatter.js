// Deterministic placement of trees and small props. Pure data, so the check
// script can verify that nothing ends up on a path, in the sea or in a building.

import { mulberry32, createNoise2D } from '../core/noise.js'
import { layout, ROAD_HALF, SIDEWALK, BAY_ANGLE, coastRadius, beachWidth } from './layout.js'
import { pathEdgeDistance, roadEdgeDistance, coastDistance } from './terrain.js'

const noise = createNoise2D(77)

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
    for(let i = 0; i < 9000 && fillers.length < 46; i++)
    {
        const x = (random() * 2 - 1) * 66
        const z = (random() * 2 - 1) * 66
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
    for(let i = 0; i < 90000 && trees.length < 420; i++)
    {
        const x = (random() * 2 - 1) * 70
        const z = (random() * 2 - 1) * 70
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
    for(let i = 0; i < 14000; i++)
    {
        const x = (random() * 2 - 1) * 70
        const z = (random() * 2 - 1) * 70
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
        if(roll < 0.12 && bushes.length < 260)
        {
            if(trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 1.4)) continue
            bushes.push({ x, z, yaw: random() * 6.28, scale: 0.6 + random() * 0.7 })
        }
        else if(roll < 0.5 && pd < 4 && flowers.length < 700)
        {
            flowers.push({ x, z, yaw: random() * 6.28, scale: 0.7 + random() * 0.6, color: Math.floor(random() * 4) })
        }
        else if(roll < 0.53 && rocks.length < 120)
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
    return { lamps, fillers, streetPalms, trees, boats, ...decor, ...beach, parkedCars, loop: trafficLoop() }
}

export const scatter = buildScatter()
