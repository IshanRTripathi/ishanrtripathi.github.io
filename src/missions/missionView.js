import * as THREE from 'three'
import { mapToDir, surfacePoint, frameQuaternion } from '../core/geo.js'

// What a mission looks like in the world: a glowing beam and pad over the airstrip you
// have to land on, or a row of rings to fly through. Only the active mission is shown.

const GREEN = 0x7CFFB2
const YELLOW = 0xFFE45E
const CYAN = 0x2DE2E6
const BEAM_HEIGHT = 120

function glow(color, opacity)
{
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
}

export function createMissionView(scene)
{
    const group = new THREE.Group()
    group.name = 'missions'
    group.visible = false
    scene.add(group)

    // the landing target: a tall beam with a flat pad on the strip
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, BEAM_HEIGHT, 20, 1, true), glow(GREEN, 0.22))
    const pad = new THREE.Mesh(new THREE.RingGeometry(7, 9.5, 48), glow(GREEN, 0.9))
    const padInner = new THREE.Mesh(new THREE.CircleGeometry(7, 48), glow(GREEN, 0.18))
    const landing = new THREE.Group()
    landing.add(beam, pad, padInner)
    landing.visible = false
    group.add(landing)

    // the rings of a ring race: a torus stands upright, facing along the way round
    const ringGeometry = new THREE.TorusGeometry(9, 0.7, 10, 40)
    const rings = []
    const ringGroup = new THREE.Group()
    group.add(ringGroup)

    const up = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()

    function placeLanding(x, z, alt)
    {
        mapToDir(x, z, up)
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up)
        pad.quaternion.copy(q)
        padInner.quaternion.copy(q)
        surfacePoint(x, z, alt + 0.4, p)
        pad.position.copy(p)
        padInner.position.copy(p)
        // the beam: its base at the strip, standing along the sea's normal
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
        surfacePoint(x, z, alt + BEAM_HEIGHT / 2, p)
        beam.position.copy(p)
    }

    function syncRings(list)
    {
        // the ring meshes are rebuilt only when the race changes: a new mission, or a new island
        const key = list.map((r) => `${r.x.toFixed(1)},${r.z.toFixed(1)}`).join('|')
        if(key !== ringGroup.userData.key)
        {
            ringGroup.userData.key = key
            for(const r of rings) { ringGroup.remove(r); r.material.dispose() }
            rings.length = 0
            for(const r of list)
            {
                const m = new THREE.Mesh(ringGeometry, glow(CYAN, 0.8))
                surfacePoint(r.x, r.z, r.alt, m.position)
                m.quaternion.copy(frameQuaternion(r.x, r.z, r.yaw))
                ringGroup.add(m)
                rings.push(m)
            }
        }
        list.forEach((r, i) =>
        {
            const color = r.state === 'next' ? YELLOW : r.state === 'passed' ? GREEN : CYAN
            rings[i].material.color.setHex(color)
            rings[i].material.opacity = r.state === 'next' ? 1 : r.state === 'passed' ? 0.25 : 0.55
            // the next ring pulses, so you can see it from far off
            rings[i].scale.setScalar(r.state === 'next' ? 1 + Math.sin(performance.now() / 180) * 0.06 : 1)
        })
    }

    // mission: what Missions gives back (its landing and rings), or null for none
    function update(mission)
    {
        group.visible = !!mission
        if(!mission) return
        const landingSpot = mission.landing
        if(landingSpot)
        {
            landing.visible = true
            placeLanding(landingSpot.x, landingSpot.z, landingSpot.alt)
        }
        else landing.visible = false
        ringGroup.visible = mission.rings.length > 0
        if(ringGroup.visible) syncRings(mission.rings)
    }

    return { group, update }
}
