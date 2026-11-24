// Verifies the island layout: nothing stands on a path or in the sea,
// buildings don't overlap, and every board is reachable from a path.
// Runs before every build (npm run build) and on its own with `npm run check`.

import { layout } from '../src/world/layout.js'
import { scatter, siteRadius } from '../src/world/scatter.js'
import { pathEdgeDistance, coastDistance } from '../src/world/terrain.js'

const problems = []
const fail = (msg) => problems.push(msg)

// Footprint corners of a site in map space
function corners(site, inset = 0)
{
    const fx = Math.sin(site.yaw)
    const fz = Math.cos(site.yaw)
    const rx = fz
    const rz = -fx
    const out = []
    for(const a of [ -1, -0.5, 0, 0.5, 1 ])
        for(const b of [ -1, -0.5, 0, 0.5, 1 ])
        {
            const u = a * (site.w / 2 - inset)
            const v = b * (site.d / 2 - inset)
            out.push({ x: site.x + rx * u + fx * v, z: site.z + rz * u + fz * v })
        }
    return out
}

for(const site of layout.sites)
{
    for(const c of corners(site))
    {
        if(pathEdgeDistance(c.x, c.z) < 0.15) { fail(`${site.id}: footprint touches a path at (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`); break }
        const minCoast = site.kind === 'chai' || site.kind === 'lighthouse' ? 0.4 : 1.0
        if(coastDistance(c.x, c.z) < minCoast) { fail(`${site.id}: footprint is in the sea at (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`); break }
    }
    if(site.sign)
    {
        const d = pathEdgeDistance(site.sign.x, site.sign.z)
        if(d < 0.05) fail(`${site.id}: board stands on the path`)
        if(d > 2.5) fail(`${site.id}: board is ${d.toFixed(1)} m from the nearest path`)
    }
}

for(let i = 0; i < layout.sites.length; i++)
    for(let j = i + 1; j < layout.sites.length; j++)
    {
        const a = layout.sites[i]
        const b = layout.sites[j]
        const d = Math.hypot(a.x - b.x, a.z - b.z)
        if(d < siteRadius(a) + siteRadius(b) - 1.0) fail(`${a.id} and ${b.id} overlap (${d.toFixed(1)} m apart)`)
    }

const check = (list, name, { pathClearance = 0.5, coast = 0.5 } = {}) =>
{
    let bad = 0
    for(const item of list)
    {
        if(pathEdgeDistance(item.x, item.z) < pathClearance) { bad++; if(bad < 4) fail(`${name} on a path at (${item.x.toFixed(1)}, ${item.z.toFixed(1)})`) }
        else if(coastDistance(item.x, item.z) < coast) { bad++; if(bad < 4) fail(`${name} in the sea at (${item.x.toFixed(1)}, ${item.z.toFixed(1)})`) }
        else
        {
            for(const site of layout.sites)
                if(Math.hypot(item.x - site.x, item.z - site.z) < siteRadius(site) * 0.85) { bad++; if(bad < 4) fail(`${name} inside ${site.id}`); break }
        }
    }
    return bad
}

check(scatter.trees, 'tree', { pathClearance: 1.2, coast: 1.4 })
check(scatter.bushes, 'bush')
check(scatter.flowers, 'flower', { pathClearance: 0.4 })
check(scatter.rocks, 'rock', { pathClearance: 0.4, coast: 0.4 })
check(scatter.lamps, 'lamp', { pathClearance: 0.3 })

for(const boat of scatter.boats)
    if(coastDistance(boat.x, boat.z) > -3) fail(`boat too close to the shore at (${boat.x.toFixed(1)}, ${boat.z.toFixed(1)})`)

const spawnPath = pathEdgeDistance(layout.spawn.x, layout.spawn.z)
if(spawnPath > 0) fail('spawn point is not on a path')

const counts = Object.entries({ trees: scatter.trees.length, bushes: scatter.bushes.length, flowers: scatter.flowers.length, rocks: scatter.rocks.length, lamps: scatter.lamps.length })
    .map(([ k, v ]) => `${v} ${k}`).join(', ')

if(problems.length)
{
    console.error(`World check failed (${problems.length}):`)
    for(const p of problems) console.error('  - ' + p)
    process.exit(1)
}
console.log(`World check passed: ${layout.sites.length} sites, ${layout.paths.length} paths, ${counts}.`)
