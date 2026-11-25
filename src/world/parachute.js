import * as THREE from 'three'

// A striped parachute above the rider's head, with lines down to the shoulders.
// The canopy opens (scales up) over the first second or so of the fall.

const STRIPES = [ '#FF3EA5', '#FFF6EC' ]
const RADIUS = 1.9
const CANOPY_Y = 2.55

export function buildParachute()
{
    const group = new THREE.Group()
    group.name = 'parachute'
    const canopy = new THREE.Group()
    canopy.position.y = CANOPY_Y
    group.add(canopy)

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

    // suspension lines from the rim down to the rider
    const lines = []
    for(let i = 0; i < 8; i++)
    {
        const a = (i / 8) * Math.PI * 2
        lines.push(new THREE.Vector3(Math.cos(a) * RADIUS * 0.98, 0, Math.sin(a) * RADIUS * 0.98))
        lines.push(new THREE.Vector3(0.0, -CANOPY_Y + 1.85, 0.0))
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(lines)
    const strings = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#FFF6EC', transparent: true, opacity: 0.85 }))
    strings.position.y = CANOPY_Y
    group.add(strings)

    return { root: group, canopy, strings }
}

// open: 0..1, how far the canopy has filled
export function openParachute(parachute, open)
{
    const s = Math.max(0.05, Math.min(1, open))
    parachute.canopy.scale.set(s, 0.35 + 0.65 * s, s)
    parachute.strings.scale.set(s, 0.35 + 0.65 * s, s)
}
