// Runways: a straight strip of tarmac, its points and its start, and the clear
// ground in front of it. Pure data, so the terrain, the scatter, the check script
// and the map all read the same runway.

// The clear ground in front of an airstrip: nothing grows or stands in it. It runs
// along the strip, `half` to either side, `near` behind the start and `far` past the
// end, so a plane has room to roll out and climb away.
export const CLEAR = { half: 11, near: 20, far: 45 }

// a runway through `mid`, along the unit direction `t`, `length` long and `width` wide
export function makeRunway(mid, t, length, width, steps = 14)
{
    const points = []
    for(let i = 0; i <= steps; i++)
    {
        const s = -length / 2 + (length * i) / steps
        points.push({ x: mid.x + t.x * s, z: mid.z + t.z * s })
    }
    const a = points[0]
    const b = points[1]
    return {
        points,
        width,
        length,
        mid: { x: mid.x, z: mid.z },
        t: { x: t.x, z: t.z },
        // the plane starts at the near end, pointing down the strip
        start: { x: a.x, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) },
        end: points[points.length - 1]
    }
}

// the clear ground in front of a runway, as a segment with its half-width
export function clearZone(runway)
{
    const { mid, t, length } = runway
    const half = length / 2
    const at = (s) => ({ x: mid.x + t.x * s, z: mid.z + t.z * s })
    const a = at(-half - CLEAR.near)
    const b = at(half + CLEAR.far)
    return { ax: a.x, az: a.z, bx: b.x, bz: b.z, half: CLEAR.half }
}

// distance from a point to a segment
export function distanceToSegment(seg, x, z)
{
    const dx = seg.bx - seg.ax
    const dz = seg.bz - seg.az
    const len2 = dx * dx + dz * dz || 1
    const t = Math.min(1, Math.max(0, ((x - seg.ax) * dx + (z - seg.az) * dz) / len2))
    return Math.hypot(seg.ax + dx * t - x, seg.az + dz * t - z)
}
