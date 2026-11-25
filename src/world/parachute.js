import * as THREE from 'three'

// The parachute: a striped canopy on lines to the rider's harness. It hangs from
// the harness, so it can swing and tip without the rider moving: the canopy snaps
// out as it fills and settles with a little overshoot, sways on a pendulum when you
// steer, tips forward when you brake and back when you dive, breathes and flutters
// in the air, and sags and folds when you land. The lines are redrawn every frame
// from the canopy's rim, so they stay on it.

const STRIPES = [ '#FF3EA5', '#FFF6EC' ]
const RADIUS = 1.9
const HARNESS_Y = 1.85 // where the lines meet the rider, above his feet
const CANOPY_Y = 2.55 // the canopy's base, above his feet, when it is open
const LINES = 8

const _rim = new THREE.Vector3()

export function buildParachute()
{
    const root = new THREE.Group()
    root.name = 'parachute'
    // the pivot is the harness: the whole chute swings and tips about it
    const pivot = new THREE.Group()
    pivot.position.y = HARNESS_Y
    root.add(pivot)
    const canopy = new THREE.Group()
    canopy.position.y = CANOPY_Y - HARNESS_Y
    pivot.add(canopy)

    // eight gores, alternating colours, each a slice of a dome
    const gores = 8
    for(let i = 0; i < gores; i++)
    {
        const g = new THREE.SphereGeometry(RADIUS, 10, 5, (i / gores) * Math.PI * 2, (Math.PI * 2) / gores, 0, Math.PI / 2)
        const m = new THREE.MeshStandardMaterial({ color: STRIPES[i % 2], roughness: 0.7, metalness: 0, side: THREE.DoubleSide, flatShading: true })
        const mesh = new THREE.Mesh(g, m)
        mesh.castShadow = true
        canopy.add(mesh)
    }

    // the suspension lines: from the rim of the canopy to the harness, redrawn every frame
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINES * 2 * 3), 3))
    const strings = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#FFF6EC', transparent: true, opacity: 0.85 }))
    pivot.add(strings)

    return { root, pivot, canopy, strings, time: 0 }
}

// fills with a snap past full, then settles back to it
function inflate(t)
{
    const c1 = 1.25
    const c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

// s: { open 0..1 how far the canopy has filled, sway in radians (the pendulum), pitch and
// bank in radians (forward and sideways tilt), collapse 0..1 (after a landing) }
export function updateParachute(parachute, s, dt)
{
    parachute.time += dt
    const t = parachute.time
    const open = Math.max(0.02, Math.min(1, s.open))
    const fill = Math.max(0.04, inflate(open))
    const collapse = s.collapse || 0
    // the canopy folds as it lands: narrower, lower, and less round
    const width = fill * (1 - 0.55 * collapse)
    const height = (0.35 + 0.65 * fill) * (1 - 0.6 * collapse)
    const { canopy, pivot, strings } = parachute
    // breathing and flutter, so it is never quite still
    const breathe = 1 + 0.02 * Math.sin(t * 2.1) * open
    canopy.scale.set(width * breathe, height, width * breathe)
    canopy.position.y = CANOPY_Y - HARNESS_Y - 0.5 * collapse
    // the pendulum, the forward and sideways tilt, and a small wobble on top of them
    pivot.rotation.set(
        (s.pitch || 0) + Math.sin(t * 1.7) * 0.03 * open,
        0,
        (s.bank || 0) + Math.sin(t * 1.1 + 1.3) * 0.025 * open
    )

    // the lines run from each point of the rim to the harness
    const pos = strings.geometry.attributes.position.array
    for(let i = 0; i < LINES; i++)
    {
        const a = (i / LINES) * Math.PI * 2
        _rim.set(Math.cos(a) * RADIUS * 0.98 * width * breathe, canopy.position.y, Math.sin(a) * RADIUS * 0.98 * width * breathe)
        pos.set([ _rim.x, _rim.y, _rim.z, 0, 0, 0 ], i * 6)
    }
    strings.geometry.attributes.position.needsUpdate = true
}
