// Deterministic placement of trees and small props. Pure data, so the check
// script can verify that nothing ends up on a path, in the sea or in a building.

import { mulberry32, createNoise2D } from '../core/noise.js'
import { layout, PATH_HALF_WIDTH, BAY_ANGLE, coastRadius, beachWidth } from './layout.js'
import { pathEdgeDistance, coastDistance } from './terrain.js'

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

// Lamp posts along the main path
function placeLamps()
{
    const lamps = []
    const main = layout.main
    const count = Math.floor(main.length / 11)
    for(let i = 1; i < count; i++)
    {
        const f = i / count
        const p = main.at(f)
        const side = i % 2 ? 1 : -1
        const x = p.x - p.tz * side * (PATH_HALF_WIDTH + 0.7)
        const z = p.z + p.tx * side * (PATH_HALF_WIDTH + 0.7)
        if(blockedBySite(x, z, 0.6)) continue
        if(layout.sites.some((site) => site.sign && Math.hypot(x - site.sign.x, z - site.sign.z) < 5)) continue
        if(pathEdgeDistance(x, z) < 0.35) continue
        lamps.push({ x, z, yaw: Math.atan2(p.tx, p.tz) })
    }
    return lamps
}

function placeTrees(lamps)
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
    for(let i = 0; i < 6000 && trees.length < 110; i++)
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
        if(near(x, z, 3.6)) continue
        trees.push({ type: 'palm', x, z, yaw: random() * Math.PI * 2, scale: 0.85 + random() * 0.4, lean: random() })
    }

    // forest inland, denser where the noise says so
    const inland = [ 'rain', 'mango', 'slender', 'mango' ]
    for(let i = 0; i < 90000 && trees.length < 560; i++)
    {
        const x = (random() * 2 - 1) * 56
        const z = (random() * 2 - 1) * 56
        const s = coastDistance(x, z)
        const phi = Math.atan2(z, x)
        if(s < beachWidth(phi) + 1.5) continue
        const density = noise(x * 0.045, z * 0.045) * 0.5 + 0.5
        if(random() > 0.06 + 0.94 * Math.min(1, Math.max(0, (density - 0.3) / 0.4))) continue
        const type = inland[Math.floor(random() * inland.length)]
        const canopy = type === 'rain' ? 3.6 : type === 'mango' ? 2.8 : 1.6
        if(pathEdgeDistance(x, z) < canopy + 0.6) continue
        if(blockedBySite(x, z, 4.5 + canopy)) continue
        if(near(x, z, type === 'rain' ? 4.4 : 3.0)) continue
        trees.push({ type, x, z, yaw: random() * Math.PI * 2, scale: 0.8 + random() * 0.45, lean: random() })
    }
    return trees
}

function placeDecor(trees)
{
    const random = mulberry32(99)
    const bushes = []
    const flowers = []
    const rocks = []
    for(let i = 0; i < 9000; i++)
    {
        const x = (random() * 2 - 1) * 56
        const z = (random() * 2 - 1) * 56
        const s = coastDistance(x, z)
        if(s < 0.5) continue
        const pd = pathEdgeDistance(x, z)
        if(pd < 0.6) continue
        if(blockedBySite(x, z, 0.8)) continue
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
    // fishing boats moored in the bay
    const boats = []
    for(const [ da, out ] of [ [ -0.16, 7 ], [ 0.13, 9.5 ], [ 0.3, 6.5 ] ])
    {
        const phi = BAY_ANGLE + da
        const r = coastRadius(phi) + out
        boats.push({ x: Math.cos(phi) * r, z: Math.sin(phi) * r, yaw: phi + Math.PI / 2 + da * 3 })
    }
    return boats
}

export function buildScatter()
{
    const lamps = placeLamps()
    const trees = placeTrees(lamps)
    const decor = placeDecor(trees)
    const boats = placeBoats()
    return { lamps, trees, boats, ...decor }
}

export const scatter = buildScatter()
