import * as THREE from 'three'
import { mapToDir, surfacePoint, frameQuaternion } from '../core/geo.js'

// What a mission looks like in the world. The current step hands over its marks, and each mark
// has a type that is drawn here:
//   beam  { x, z, alt }                          a tall glowing column with a pad, to land on
//   ring  { x, z, yaw, alt, radius, state }      a gate standing upright, facing along `yaw`;
//                                                state is 'next', 'ahead' or 'passed'
// A new kind of mark is one more entry in DRAW.

const GREEN = 0x7CFFB2
const YELLOW = 0xFFE45E
const CYAN = 0x2DE2E6
const BEAM_HEIGHT = 120
const RING_BASE = 9 // the torus is built this big and scaled to the mark's radius

function glow(color, opacity)
{
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
}

const Z = new THREE.Vector3(0, 0, 1)
const Y = new THREE.Vector3(0, 1, 0)

export function createMissionView(scene)
{
    const group = new THREE.Group()
    group.name = 'missions'
    group.visible = false
    scene.add(group)

    const ringGeometry = new THREE.TorusGeometry(RING_BASE, 0.7, 10, 40)
    const up = new THREE.Vector3()
    const p = new THREE.Vector3()
    // what is on show now, by key, so nothing is rebuilt while the marks are the same
    let key = ''
    let shown = []

    const DRAW = {
        beam(mark)
        {
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, BEAM_HEIGHT, 20, 1, true), glow(GREEN, 0.22))
            const pad = new THREE.Mesh(new THREE.RingGeometry(7, 9.5, 48), glow(GREEN, 0.9))
            const padInner = new THREE.Mesh(new THREE.CircleGeometry(7, 48), glow(GREEN, 0.18))
            mapToDir(mark.x, mark.z, up)
            for(const m of [ pad, padInner ]) m.quaternion.setFromUnitVectors(Z, up)
            pad.position.copy(surfacePoint(mark.x, mark.z, mark.alt + 0.4, p))
            padInner.position.copy(p)
            beam.quaternion.setFromUnitVectors(Y, up)
            beam.position.copy(surfacePoint(mark.x, mark.z, mark.alt + BEAM_HEIGHT / 2, p))
            const g = new THREE.Group()
            g.add(beam, pad, padInner)
            return g
        },
        ring(mark)
        {
            const m = new THREE.Mesh(ringGeometry, glow(CYAN, 0.8))
            surfacePoint(mark.x, mark.z, mark.alt, m.position)
            m.quaternion.copy(frameQuaternion(mark.x, mark.z, mark.yaw))
            m.userData.base = mark.radius / RING_BASE
            m.scale.setScalar(m.userData.base)
            return m
        }
    }

    // the state of a ring changes its colour and glow, not its shape
    function restyle(object, mark)
    {
        if(mark.type !== 'ring') return
        const color = mark.state === 'next' ? YELLOW : mark.state === 'passed' ? GREEN : CYAN
        object.material.color.setHex(color)
        object.material.opacity = mark.state === 'next' ? 1 : mark.state === 'passed' ? 0.25 : 0.55
        // the next one pulses, so it can be seen from far off
        object.scale.setScalar(object.userData.base * (mark.state === 'next' ? 1 + Math.sin(performance.now() / 180) * 0.06 : 1))
    }

    function clear()
    {
        for(const { object } of shown)
        {
            group.remove(object)
            object.traverse((o) =>
            {
                if(o.geometry && o.geometry !== ringGeometry) o.geometry.dispose()
                o.material?.dispose()
            })
        }
        shown = []
    }

    // marks: the current step's marks, or null for none
    function update(marks)
    {
        group.visible = !!marks && marks.length > 0
        if(!group.visible) { if(key) { clear(); key = '' } return }
        // the shape of the marks: types and places (the states are not part of it)
        const next = marks.map((m) => `${m.type}:${m.x.toFixed(1)},${m.z.toFixed(1)},${m.alt.toFixed(1)}`).join('|')
        if(next !== key)
        {
            clear()
            key = next
            for(const mark of marks)
            {
                const object = DRAW[mark.type](mark)
                group.add(object)
                shown.push({ object, mark })
            }
        }
        marks.forEach((mark, i) => restyle(shown[i].object, mark))
    }

    return { group, update }
}
