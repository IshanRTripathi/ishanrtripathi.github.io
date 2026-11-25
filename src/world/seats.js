import { layout, ROAD_HALF, SIDEWALK, BAY_ANGLE, coastRadius } from './layout.js'
import { mainCoastDistance, pathEdgeDistance, placementDistance } from './terrain.js'

// Where people can sit. Two kinds:
//  - bench: on the verge beside the main road, on the walkers' side, facing the road. A walker
//    turns off the sidewalk at `f` (a fraction along the main road) to sit on it.
//  - beach: on the sand at the sunset bay, facing the sea. Walkers reach these from the road's end.
// The seats are placed after the houses and before the trees and decor, so nothing grows on them.

// walkers keep to the middle of the sidewalk, on the +1 side of the road
export const WALK_OFFSET = ROAD_HALF + SIDEWALK * 0.5
export const BENCH = { length: 1.6, depth: 0.5, seat: 0.44 }

const BENCH_OFFSET = ROAD_HALF + SIDEWALK + 0.8

function nearAny(list, x, z, margin)
{
    return list.some((o) => Math.hypot(x - o.x, z - o.z) < Math.hypot(o.w, o.d) / 2 + margin)
}

export function placeSeats(lamps, fillers)
{
    const main = layout.paths[0]
    const seats = []

    // benches on the verge, facing the road: skipped where a house, a lamp or a path is too close.
    // Up to four, spread along the road.
    const benchAt = []
    for(let f = 0.04; f <= 0.96 && benchAt.length < 4; f += 0.03)
    {
        if(benchAt.some((g) => Math.abs(g - f) < 0.14)) continue
        const p = main.at(f)
        const nx = -p.tz
        const nz = p.tx
        const x = p.x + nx * BENCH_OFFSET
        const z = p.z + nz * BENCH_OFFSET
        if(nearAny(fillers, x, z, 1.6)) continue
        if(lamps.some((l) => Math.hypot(x - l.x, z - l.z) < 2.6)) continue
        // not in front of Ishan's place, the trophies or the parked props
        if(layout.sites.some((s) => Math.hypot(x - s.x, z - s.z) < 7)) continue
        if(layout.props.some((q) => Math.hypot(x - q.x, z - q.z) < 3)) continue
        if(mainCoastDistance(x, z) < 4 || pathEdgeDistance(x, z) < 0.35 || placementDistance(x, z) < 0.35) continue
        // the bench's front faces the road, so a person on it looks back at the road
        benchAt.push(f)
        seats.push({ kind: 'bench', id: `bench-${seats.length}`, x, z, yaw: Math.atan2(-nx, -nz), f, busy: false })
    }

    // two benches on the sand at the sunset bay, close to where the road ends, facing the sea
    const sand = []
    for(let k = -30; k <= 30; k++)
    {
        const phi = BAY_ANGLE + k * 0.02
        const r = coastRadius(phi) - 4.2
        const x = Math.cos(phi) * r
        const z = Math.sin(phi) * r
        if(mainCoastDistance(x, z) < 3.2 || pathEdgeDistance(x, z) < 1.2 || nearAny(fillers, x, z, 1.2)) continue
        sand.push({ phi, x, z })
    }
    sand.sort((a, b) => Math.abs(a.phi - BAY_ANGLE) - Math.abs(b.phi - BAY_ANGLE))
    const picked = []
    for(const c of sand) if(picked.every((q) => Math.abs(q.phi - c.phi) > 0.15)) { picked.push(c); if(picked.length === 2) break }
    for(const c of picked)
        seats.push({ kind: 'beach', id: `beach-${seats.length}`, x: c.x, z: c.z, yaw: Math.atan2(Math.cos(c.phi), Math.sin(c.phi)), f: 1, busy: false })

    return seats
}
