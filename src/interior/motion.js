import * as THREE from 'three'

// Motion for the people inside a room. A figure comes with Idle, Walk, SitDown and StandUp clips, and the
// Idle clip moves its hips, torso, head and arms. On top of that, the people who dance or fidget get their
// torso, head and arms turned here, in the figure's own frame (x to its left, y up, z forward), so a dancer's
// arms swing out to the side and forward whichever way the figure faces. Walkers follow a route.

const AX = new THREE.Vector3(1, 0, 0)
const AY = new THREE.Vector3(0, 1, 0)
const AZ = new THREE.Vector3(0, 0, 1)

// the bones that dancing and fidgeting turn. Each is set after its parent (the order matters)
const BONES = [ 'Hips', 'Abdomen', 'Torso', 'Head', 'ShoulderL', 'UpperArmL', 'ShoulderR', 'UpperArmR' ]

const rot = (axis, angle) => new THREE.Quaternion().setFromAxisAngle(axis, angle)

export function findBones(model)
{
    const bones = {}
    model.traverse((o) => { if(BONES.includes(o.name)) bones[o.name] = o })
    return bones
}

// a bone's orientation in the figure's frame. `done` holds the bones already turned this frame, and their
// new orientations; any other bone keeps its own local rotation
function frame(o, root, done)
{
    if(!o || o === root) return new THREE.Quaternion()
    if(done.has(o)) return done.get(o).clone()
    return frame(o.parent, root, done).multiply(o.quaternion)
}

// turn some bones (offsets, in the figure's frame) from their idle orientation, parents first
function turn(person, offsets)
{
    const root = person.model
    const idle = new Map()
    const none = new Map()
    for(const name of BONES)
    {
        const bone = person.bones[name]
        if(bone && offsets[name]) idle.set(bone, frame(bone, root, none))
    }
    const done = new Map()
    for(const name of BONES)
    {
        const bone = person.bones[name]
        const offset = offsets[name]
        if(!bone || !offset) continue
        const want = offset.clone().multiply(idle.get(bone))
        bone.quaternion.copy(frame(bone.parent, root, done).invert().multiply(want))
        done.set(bone, want)
    }
}

// a dancer: one swing a second, with the body bouncing twice a swing, in time with the beat
export function dancePose(person, time)
{
    const d = person.dance
    const e = d.energy
    const t = time * Math.PI * 2 + d.phase
    const s = Math.sin(t)
    const c = Math.cos(t)
    person.model.position.y = person.rest.y + Math.abs(s) * 0.045 * e
    const raiseL = e * (0.25 + 0.6 * (0.5 + 0.5 * s))
    const raiseR = e * (0.25 + 0.6 * (0.5 - 0.5 * s))
    const pumpL = e * 0.35 * (0.5 + 0.5 * c)
    const pumpR = e * 0.35 * (0.5 - 0.5 * c)
    turn(person, {
        Hips: rot(AZ, s * 0.05 * e),
        Abdomen: rot(AY, -s * 0.1 * e),
        Torso: rot(AY, s * 0.16 * e),
        Head: rot(AY, -s * 0.12 * e),
        UpperArmL: rot(AX, -pumpL).multiply(rot(AZ, raiseL)),
        UpperArmR: rot(AX, -pumpR).multiply(rot(AZ, -raiseR))
    })
}

// someone standing still: a little sway, and a look around now and then
export function fidgetPose(person, time)
{
    const t = time * 0.9 + person.phase
    turn(person, {
        Torso: rot(AY, Math.sin(t) * 0.05),
        Head: rot(AY, Math.sin(t * 0.55) * 0.3)
    })
}

// a walker moves along its route, and waits a moment at each end. Returns true while it is walking
export function patrol(person, dt)
{
    const w = person.walk
    if(w.wait > 0)
    {
        w.wait -= dt
        return false
    }
    const p = person.model.position
    const target = w.path[w.i]
    const dx = target.x - p.x
    const dz = target.z - p.z
    const d = Math.hypot(dx, dz)
    if(d < 0.06)
    {
        w.i = (w.i + 1) % w.path.length
        w.wait = 1.5 + Math.random() * 2.5
        return false
    }
    const step = Math.min(d, w.speed * dt)
    p.x += dx / d * step
    p.z += dz / d * step
    person.model.rotation.y = Math.atan2(dx, dz)
    return true
}

// switch the clip a person plays, blending from the last one
export function setClip(person, name, fade = 0.25)
{
    if(person.clip === name) return
    const to = person.actions[name]
    if(!to) return
    person.actions[person.clip]?.fadeOut(fade)
    to.reset().fadeIn(fade).play()
    person.clip = name
}
