// Verifies the island layout: nothing stands on a path or in the sea,
// buildings don't overlap, and every board is reachable from a path.
// Runs before every build (npm run build) and on its own with `npm run check`.

import { layout } from '../src/world/layout.js'
import { scatter, siteRadius } from '../src/world/scatter.js'
import { pathEdgeDistance, roadEdgeDistance, coastDistance, clearDistance, heightAt } from '../src/world/terrain.js'
import { ISLANDS, structureSpots } from '../src/world/islands.js'

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

// houses keep their distance from each other, and from the trees, bushes and rocks around them
for(let i = 0; i < scatter.fillers.length; i++)
    for(let j = i + 1; j < scatter.fillers.length; j++)
    {
        const a = scatter.fillers[i]
        const b = scatter.fillers[j]
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(a.w, a.d) / 2 - Math.hypot(b.w, b.d) / 2
        if(gap < 1.8) { fail(`two houses are only ${gap.toFixed(1)} m apart at (${a.x.toFixed(1)}, ${a.z.toFixed(1)})`); break }
    }
const clearOfHouses = (name, list, margin) =>
{
    for(const item of list)
        for(const f of scatter.fillers)
            if(Math.hypot(item.x - f.x, item.z - f.z) - Math.hypot(f.w, f.d) / 2 < margin)
            {
                fail(`${name} is ${(Math.hypot(item.x - f.x, item.z - f.z) - Math.hypot(f.w, f.d) / 2).toFixed(1)} m from a house at (${item.x.toFixed(1)}, ${item.z.toFixed(1)}), less than ${margin} m`)
                return
            }
}
clearOfHouses('tree', scatter.trees, 2.5)
clearOfHouses('bush', scatter.bushes, 1.1)
clearOfHouses('rock', scatter.rocks, 1.1)
clearOfHouses('flower', scatter.flowers, 1.1)

// the buildings you can walk into: the front door opens onto a road, is on land, and has a room behind it
const ROOM_KINDS = [ 'cinema', 'hospital', 'cafe', 'arcade', 'studio' ]
for(const site of layout.sites)
{
    if(!site.entrance) continue
    const e = site.entrance
    if(!ROOM_KINDS.includes(site.interior)) fail(`${site.id}: no room for "${site.interior}"`)
    // the café's shack stands on the sand at the end of the road, so its door may be a little further from it
    const reach = site.interior === 'cafe' ? 3.6 : 2.6
    if(pathEdgeDistance(e.x, e.z) > reach) fail(`${site.id}: its door is ${pathEdgeDistance(e.x, e.z).toFixed(1)} m from the road`)
    if(coastDistance(e.x, e.z) < 1) fail(`${site.id}: its door is at the water's edge at (${e.x.toFixed(1)}, ${e.z.toFixed(1)})`)
}

// benches and beach seats: on land, off the paths and the airstrips, clear of the houses and the trees
clearOfHouses('bench', scatter.seats, 1.1)
for(const seat of scatter.seats)
{
    if(pathEdgeDistance(seat.x, seat.z) < 0.3) fail(`${seat.id} stands on a path at (${seat.x.toFixed(1)}, ${seat.z.toFixed(1)})`)
    if(coastDistance(seat.x, seat.z) < 2.5) fail(`${seat.id} is at the water's edge at (${seat.x.toFixed(1)}, ${seat.z.toFixed(1)})`)
    if(clearDistance(seat.x, seat.z) < 0) fail(`${seat.id} stands in front of an airstrip`)
    if(scatter.trees.some((t) => Math.hypot(t.x - seat.x, t.z - seat.z) < 1.6)) fail(`${seat.id} has a tree too close to it`)
}

// the traffic loop is one unbroken circuit (a jump would send cars piling up at the join)
for(let i = 1; i < scatter.loop.length; i++)
{
    const a = scatter.loop[i - 1]
    const b = scatter.loop[i]
    if(Math.hypot(b.x - a.x, b.z - a.z) > 2) { fail(`traffic loop is broken at (${a.x.toFixed(1)}, ${a.z.toFixed(1)})`); break }
}

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

// every airstrip, the city's and each island's: flat, on dry land, with the spot you jump to on land
const strips = [ { name: 'the city airstrip', runway: layout.runway } ]
for(const island of ISLANDS) strips.push({ name: `the ${island.name} airstrip`, runway: island.runway })
for(const { name, runway } of strips)
{
    const t = runway.t
    const n = { x: -t.z, z: t.x }
    const hw = runway.width / 2
    let lo = Infinity
    let hi = -Infinity
    for(let s = -runway.length / 2; s <= runway.length / 2; s += 2)
        for(const side of [ -hw * 0.8, 0, hw * 0.8 ])
        {
            const h = heightAt(runway.mid.x + t.x * s + n.x * side, runway.mid.z + t.z * s + n.z * side)
            lo = Math.min(lo, h)
            hi = Math.max(hi, h)
        }
    if(hi - lo > 0.35) fail(`${name} is not flat (${(hi - lo).toFixed(2)} m from end to end)`)
    for(const q of runway.points)
        if(coastDistance(q.x, q.z) < 4) { fail(`${name} runs too close to the sea at (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`); break }
    // the spot the map jumps you to: beside the plane at the near end, on land
    const spot = { x: runway.start.x + n.x * 4.5, z: runway.start.z + n.z * 4.5 }
    if(coastDistance(spot.x, spot.z) < 2) fail(`the jump spot for ${name} is in the sea`)
}
for(const island of ISLANDS)
    if(!island.airstrip.fits) fail(`${island.name} has no good place for its airstrip (range ${island.airstrip.range.toFixed(2)} m, coast ${island.airstrip.coast.toFixed(2)} m)`)

// nothing stands or grows in front of an airstrip: its clear ground is kept empty, the roads and the landmarks too
const clear = (name, list) =>
{
    for(const item of list)
        if(clearDistance(item.x, item.z) < 0) { fail(`${name} in front of an airstrip at (${item.x.toFixed(1)}, ${item.z.toFixed(1)})`); return }
}
clear('tree', scatter.trees)
clear('bush', scatter.bushes)
clear('flower', scatter.flowers)
clear('rock', scatter.rocks)
clear('street light', scatter.lamps)
clear('street palm', scatter.streetPalms)
clear('beach umbrella', scatter.umbrellas)
clear('lifeguard tower', scatter.towers)
clear('lantern', scatter.lanterns)
clear('stepping stone', scatter.stones)
clear('flower bed', scatter.borders)
clear('grass tuft', scatter.tufts)
clear('firefly', scatter.fireflies)
clear('parked car', scatter.parkedCars)
clear('traffic loop', scatter.loop)
for(const f of scatter.fillers)
    for(const a of [ -1, 0, 1 ])
        for(const b of [ -1, 0, 1 ])
        {
            const x = f.x + Math.cos(f.yaw) * a * f.w / 2 + Math.sin(f.yaw) * b * f.d / 2
            const z = f.z - Math.sin(f.yaw) * a * f.w / 2 + Math.cos(f.yaw) * b * f.d / 2
            if(clearDistance(x, z) < 0) { fail(`city block in front of an airstrip at (${x.toFixed(1)}, ${z.toFixed(1)})`); break }
        }
for(const site of layout.sites)
    for(const c of corners(site))
        if(clearDistance(c.x, c.z) < 0) { fail(`${site.id} stands in front of an airstrip`); break }
for(const island of ISLANDS)
    for(const spot of structureSpots(island))
        if(clearDistance(spot.x, spot.z) < 0) fail(`${island.name}: ${spot.kind} stands in front of its airstrip`)

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
