// Verifies the island layout: nothing stands on a path or in the sea,
// buildings don't overlap, and every board is reachable from a path.
// Runs before every build (npm run build) and on its own with `npm run check`.

import { layout } from '../src/world/layout.js'
import { scatter, siteRadius } from '../src/world/scatter.js'
import { pathEdgeDistance, roadEdgeDistance, coastDistance } from '../src/world/terrain.js'

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
        if(roadEdgeDistance(site.sign.x, site.sign.z) < 0.4) fail(`${site.id}: board stands in the road`)
        const d = pathEdgeDistance(site.sign.x, site.sign.z)
        if(d > 2.5) fail(`${site.id}: board is ${d.toFixed(1)} m from the nearest sidewalk`)
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

const check = (list, name, { pathClearance = 0.5, coast = 0.5, roadOnly = false } = {}) =>
{
    let bad = 0
    for(const item of list)
    {
        if((roadOnly ? roadEdgeDistance(item.x, item.z) : pathEdgeDistance(item.x, item.z)) < pathClearance) { bad++; if(bad < 4) fail(`${name} on a path at (${item.x.toFixed(1)}, ${item.z.toFixed(1)})`) }
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
check(scatter.lamps, 'street light', { pathClearance: 0.25, roadOnly: true })
check(scatter.streetPalms, 'street palm', { pathClearance: 0.4, roadOnly: true, coast: 2 })
check(scatter.umbrellas, 'beach umbrella', { pathClearance: 0.8, coast: 0.8 })
check(scatter.towers, 'lifeguard tower', { pathClearance: 0.8, coast: 0.8 })
check(scatter.lanterns, 'lantern', { pathClearance: 0.15, roadOnly: true, coast: 0.5 })
check(scatter.stones, 'stepping stone', { pathClearance: 0.05, roadOnly: true, coast: 1.0 })
check(scatter.borders, 'flower bed', { pathClearance: 0.35 })
check(scatter.tufts, 'grass tuft', { pathClearance: 0.25 })

// fences: posts beside the paths, never across a road or into the sea
for(const fence of scatter.fences)
{
    check(fence.posts.filter((p) => !p.lantern), `${fence.kind} fence post`, { pathClearance: 0.05, coast: 0.4 })
    for(let i = 0; i < fence.posts.length - 1; i++)
    {
        const a = fence.posts[i]
        const b = fence.posts[i + 1]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        if(len > 2.6) fail(`${fence.kind} fence has a ${len.toFixed(1)} m gap between posts`)
        for(const t of [ 0.25, 0.5, 0.75 ])
        {
            const x = a.x + (b.x - a.x) * t
            const z = a.z + (b.z - a.z) * t
            if(roadEdgeDistance(x, z) < 0.05) { fail(`${fence.kind} fence crosses a road or the boardwalk at (${x.toFixed(1)}, ${z.toFixed(1)})`); break }
        }
    }
}

// city blocks: off the roads, out of the sea, clear of each other and of every site
for(const f of scatter.fillers)
{
    const fx = Math.sin(f.yaw)
    const fz = Math.cos(f.yaw)
    for(const a of [ -1, 0, 1 ])
        for(const b of [ -1, 0, 1 ])
        {
            const x = f.x + fz * a * f.w / 2 + fx * b * f.d / 2
            const z = f.z - fx * a * f.w / 2 + fz * b * f.d / 2
            if(pathEdgeDistance(x, z) < 0.3) fail(`city block on a road at (${x.toFixed(1)}, ${z.toFixed(1)})`)
            if(coastDistance(x, z) < 1) fail(`city block in the sea at (${x.toFixed(1)}, ${z.toFixed(1)})`)
        }
    for(const site of layout.sites)
        if(Math.hypot(f.x - site.x, f.z - site.z) < siteRadius(site) + Math.hypot(f.w, f.d) / 2) fail(`city block overlaps ${site.id}`)
}
for(const t of scatter.trees)
    for(const f of scatter.fillers)
        if(Math.hypot(t.x - f.x, t.z - f.z) < Math.hypot(f.w, f.d) / 2) { fail(`tree inside a city block at (${t.x.toFixed(1)}, ${t.z.toFixed(1)})`); break }

// traffic must stay on asphalt
for(const p of scatter.loop)
    if(roadEdgeDistance(p.x, p.z) > 0) { fail('traffic loop leaves the road'); break }

for(const boat of scatter.boats)
    if(coastDistance(boat.x, boat.z) > -3) fail(`boat too close to the shore at (${boat.x.toFixed(1)}, ${boat.z.toFixed(1)})`)

// the airstrip: every point on dry land, and the arcade well clear of it
for(const q of layout.runway.points)
    if(coastDistance(q.x, q.z) < 8) { fail(`runway runs too close to the sea at (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`); break }
for(const q of layout.runway.points)
    if(Math.hypot(q.x - layout.arcade.x, q.z - layout.arcade.z) < 12) { fail('the arcade is too close to the runway'); break }

const spawnPath = pathEdgeDistance(layout.spawn.x, layout.spawn.z)
if(spawnPath > 0) fail('spawn point is not on a path')

const counts = Object.entries({ 'city blocks': scatter.fillers.length, 'street palms': scatter.streetPalms.length, trees: scatter.trees.length, bushes: scatter.bushes.length, flowers: scatter.flowers.length, rocks: scatter.rocks.length, lamps: scatter.lamps.length, lanterns: scatter.lanterns.length, fences: scatter.fences.length, 'stepping stones': scatter.stones.length, 'flower bed clumps': scatter.borders.length, 'grass tufts': scatter.tufts.length, fireflies: scatter.fireflies.length })
    .map(([ k, v ]) => `${v} ${k}`).join(', ')

if(problems.length)
{
    console.error(`World check failed (${problems.length}):`)
    for(const p of problems) console.error('  - ' + p)
    process.exit(1)
}
console.log(`World check passed: ${layout.sites.length} sites, ${layout.paths.length} paths, ${counts}.`)
