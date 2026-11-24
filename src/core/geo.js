import * as THREE from 'three'

// The world is laid out on a flat 2D "map" (x, z in metres) and wrapped onto a
// small planet with an azimuthal equidistant projection centred on the north pole.
// Distances measured from the island centre are exact; sideways distances shrink
// a little towards the coast, which nobody notices on foot.

export const R = 70 // sea level radius

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _m = new THREE.Matrix4()

export function mapToDir(x, z, out = new THREE.Vector3())
{
    const r = Math.hypot(x, z)
    if(r < 1e-9) return out.set(0, 1, 0)
    const th = r / R
    const s = Math.sin(th) / r
    return out.set(x * s, Math.cos(th), z * s)
}

export function dirToMap(d, out = { x: 0, z: 0 })
{
    const len = d.length()
    const y = Math.min(1, Math.max(-1, d.y / len))
    const th = Math.acos(y)
    const h = Math.hypot(d.x, d.z)
    if(h < 1e-9) { out.x = 0; out.z = 0; return out }
    const r = th * R
    out.x = d.x / h * r
    out.z = d.z / h * r
    return out
}

export function surfacePoint(x, z, height, out = new THREE.Vector3())
{
    return mapToDir(x, z, out).multiplyScalar(R + height)
}

// 3D tangent of a map direction (dx, dz) at map point (x, z)
export function mapTangent(x, z, dx, dz, out = new THREE.Vector3())
{
    const e = 0.02
    mapToDir(x + dx * e, z + dz * e, _a)
    mapToDir(x - dx * e, z - dz * e, _b)
    out.subVectors(_a, _b)
    mapToDir(x, z, _up)
    out.addScaledVector(_up, -out.dot(_up)).normalize()
    return out
}

// yaw = 0 faces map +z, yaw = PI/2 faces map +x
export function yawToMapDir(yaw)
{
    return { x: Math.sin(yaw), z: Math.cos(yaw) }
}

export function mapDirToYaw(dx, dz)
{
    return Math.atan2(dx, dz)
}

// Orientation for an object standing at (x, z) and facing `yaw` (object +Z forward, +Y up)
export function frameQuaternion(x, z, yaw, out = new THREE.Quaternion())
{
    mapToDir(x, z, _up)
    mapTangent(x, z, Math.sin(yaw), Math.cos(yaw), _fwd)
    _right.crossVectors(_up, _fwd).normalize()
    _m.makeBasis(_right, _up, _fwd)
    return out.setFromRotationMatrix(_m)
}

export function frameMatrix(x, z, yaw, height, scale = 1, out = new THREE.Matrix4())
{
    mapToDir(x, z, _up)
    mapTangent(x, z, Math.sin(yaw), Math.cos(yaw), _fwd)
    _right.crossVectors(_up, _fwd).normalize()
    out.makeBasis(_right.multiplyScalar(scale), _up.clone().multiplyScalar(scale), _fwd.multiplyScalar(scale))
    const p = mapToDir(x, z, _a).multiplyScalar(R + height)
    out.setPosition(p)
    return out
}
