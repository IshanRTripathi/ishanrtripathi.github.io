import * as THREE from 'three'
import { Kit, shade, clayMaterial } from '../models/kit.js'
import { neonMaterial, neonSign, hangingNeon, glowMaterial } from './neon.js'
import { duskAt } from './layout.js'

// Procedural stand-ins for every building: pastel Art Deco with neon trim.
// Each builder returns a Group with its origin on the ground at the centre of
// its footprint, front door facing +Z. Swap any of them for a Tripo model
// through src/models/registry.js.

export const C = {
    concrete: '#E7DFD5',
    concreteDark: '#CFC5B8',
    laterite: '#C98B6B',
    white: '#FBF7F0',
    cream: '#FFF3DE',
    pink: '#F7AFC6',
    flamingo: '#F28AAE',
    mint: '#A8E6CF',
    peach: '#FFC8A2',
    sky: '#9AD0EC',
    lavender: '#C9B6E4',
    lemon: '#FFF1A8',
    coral: '#FF8C7A',
    teal: '#2FA4A0',
    seaGreen: '#3E9C8F',
    turmeric: '#F2C14E',
    tile: '#D9785E',
    wood: '#8A5A3A',
    woodLight: '#B9895E',
    glass: '#2C4F6B',
    glassLight: '#5E8FB0',
    steel: '#C8CDD2',
    steelDark: '#9AA1A8',
    ink: '#24344F',
    red: '#E0483D',
    black: '#2B2D31'
}

// neon tube colours
export const NEON = {
    pink: '#FF3EA5',
    cyan: '#2DE2E6',
    purple: '#A855F7',
    orange: '#FF8C42',
    yellow: '#FFE45E',
    green: '#6CFF8E'
}

// lit windows: warm, and brighter and more of them towards the sunset
const WINDOW_LIGHTS = [ '#FFC46B', '#FFB25A', '#FFD592', '#FF9E5E', '#FFE2B0' ].map((c) => new THREE.Color(c))

function hash(a, b, c)
{
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
    return x - Math.floor(x)
}

function windowLight(dusk, roll, boost = 0)
{
    const base = WINDOW_LIGHTS[Math.floor(roll * 97) % WINDOW_LIGHTS.length]
    return base.clone().multiplyScalar((0.7 + 1.1 * dusk + boost) * (0.85 + 0.3 * roll))
}

// A building is three kits: matte clay, glowing neon and lit windows
class Builder
{
    constructor()
    {
        this.clay = new Kit()
        this.neon = new Kit()
        this.glow = new Kit()
        this.extras = []
    }

    // neon tube from a to b ([x, y, z]), thickness t
    tube(a, b, color, t = 0.09)
    {
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const dz = b[2] - a[2]
        const len = Math.hypot(dx, dy, dz)
        const g = new THREE.BoxGeometry(t, t, len)
        g.lookAt(new THREE.Vector3(dx, dy, dz))
        this.neon.add(g, color, { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2 })
        return this
    }

    build()
    {
        const group = new THREE.Group()
        const clay = this.clay.mesh(clayMaterial)
        group.add(clay)
        if(this.neon.parts.length)
        {
            const neon = new THREE.Mesh(this.neon.geometry(), neonMaterial)
            neon.castShadow = false
            group.add(neon)
        }
        if(this.glow.parts.length) group.add(new THREE.Mesh(this.glow.geometry(), glowMaterial))
        for(const e of this.extras) group.add(e)
        group.userData.clay = clay
        return group
    }
}

// ------------------------------------------------------------------ deco pieces
function plinth(kit, w, d, color = C.concrete)
{
    // buried a little so it hides any slope under the building
    kit.box(w + 0.5, 1.9, d + 0.5, color, { y: -1.5 })
    kit.box(w + 0.8, 0.14, d + 0.8, shade(color, -0.06), { y: 0.38 })
}

function door(kit, x, z, { w = 1.4, h = 2.3, color = C.glass, frame = C.white } = {})
{
    kit.box(w + 0.35, h + 0.25, 0.14, frame, { x, y: 0.5, z })
    kit.box(w, h, 0.18, color, { x, y: 0.5, z: z + 0.02 })
    kit.box(0.08, h, 0.22, frame, { x, y: 0.5, z: z + 0.03 })
    kit.box(w + 0.9, 0.18, 0.7, C.concreteDark, { x, y: 0.32, z: z + 0.38 })
}

function awning(kit, w, y, z, colors, { depth = 1.3, tilt = 0.28 } = {})
{
    const stripes = Math.max(4, Math.round(w / 0.45))
    const sw = w / stripes
    for(let i = 0; i < stripes; i++)
        kit.box(sw, 0.06, depth, colors[i % colors.length], { x: -w / 2 + sw * (i + 0.5), y, z: z + depth / 2 * Math.cos(tilt), rx: tilt, center: true })
    for(let i = 0; i < stripes; i++)
        kit.box(sw * 0.9, 0.2, 0.05, colors[i % colors.length], { x: -w / 2 + sw * (i + 0.5), y: y - depth * Math.sin(tilt) / 2 - 0.12, z: z + depth * Math.cos(tilt) - 0.02, center: true })
}

function porthole(kit, x, y, z, ry, frame = C.white)
{
    kit.push({ x, y, z, ry })
    kit.cyl(0.42, 0.42, 0.12, 14, frame, { rx: Math.PI / 2, center: true })
    kit.cyl(0.32, 0.32, 0.16, 14, C.glass, { rx: Math.PI / 2, z: 0.02, center: true })
    kit.pop()
}

function palmPot(kit, x, y, z)
{
    kit.cyl(0.28, 0.2, 0.45, 8, C.white, { x, y, z })
    for(let i = 0; i < 5; i++)
    {
        const a = i / 5 * Math.PI * 2
        kit.box(0.12, 0.04, 0.6, '#4FA052', { x: x + Math.sin(a) * 0.22, y: y + 0.65, z: z + Math.cos(a) * 0.22, ry: a, rx: 0.5, center: true })
    }
    kit.cyl(0.05, 0.06, 0.3, 5, C.wood, { x, y: y + 0.4, z })
}

// Streamline Moderne block: rounded front corners, white eyebrows over ribbon
// windows, a central fin above a stepped parapet, neon on the edges.
function decoBlock(b, o)
{
    const { w, d, wall, trim = C.white, floors = 2, neon = NEON.pink, neon2 = NEON.cyan, dusk = 0, seed = 0 } = o
    // share of windows with the lights on
    const lit = 0.3 + 0.5 * dusk
    const kit = b.clay
    const fh = 3.0
    const r = 0.75
    plinth(kit, w, d)
    const body = floors * fh
    // main volume with the front corners rounded off
    kit.box(w - r * 2, body, d, wall, { y: 0.5 })
    kit.box(w, body, d - r, wall, { y: 0.5, z: -r / 2 })
    for(const sx of [ -1, 1 ])
        kit.cyl(r, r, body, 12, wall, { x: sx * (w / 2 - r), y: 0.5, z: d / 2 - r })

    // eyebrows wrapping the front at each floor line, and ribbon windows
    for(let f = 0; f < floors; f++)
    {
        const y = 0.5 + f * fh
        if(f > 0)
        {
            kit.box(w * 0.86, 1.1, 0.12, C.glass, { y: y + 0.85, z: d / 2 + 0.01 })
            for(let i = 1; i < 5; i++) kit.box(0.08, 1.1, 0.16, trim, { x: -w * 0.43 + w * 0.86 * i / 5, y: y + 0.85, z: d / 2 + 0.02 })
            if(b.glow)
            {
                const pane = w * 0.86 / 5
                for(let i = 0; i < 5; i++)
                {
                    const roll = hash(seed, f, i)
                    if(roll > lit) continue
                    b.glow.box(pane - 0.13, 0.98, 0.04, windowLight(dusk, hash(seed + 3, f, i)), { x: -w * 0.43 + pane * (i + 0.5), y: y + 0.91, z: d / 2 + 0.075 })
                }
            }
        }
        kit.box(w + 0.35, 0.14, 0.75, trim, { y: y + fh - 0.35, z: d / 2 + 0.2 })
        for(const sx of [ -1, 1 ]) kit.cyl(r + 0.2, r + 0.2, 0.14, 12, trim, { x: sx * (w / 2 - r), y: y + fh - 0.35, z: d / 2 - r })
    }
    const top = 0.5 + body
    // coping, stepped parapet and the fin
    kit.box(w + 0.1, 0.25, d + 0.1, trim, { y: top })
    kit.box(w * 0.5, 0.7, 0.4, wall, { y: top + 0.25, z: d / 2 - 0.2 })
    kit.box(w * 0.3, 0.6, 0.4, trim, { y: top + 0.95, z: d / 2 - 0.2 })
    kit.box(0.9, 2.6, 0.5, trim, { y: top - 0.6, z: d / 2 + 0.05 })
    // side portholes
    porthole(kit, w / 2 + 0.02, 0.5 + fh + 1.3, -d * 0.15, Math.PI / 2)
    porthole(kit, -w / 2 - 0.02, 0.5 + fh + 1.3, -d * 0.15, -Math.PI / 2)

    // neon: along the coping, up the fin, under the first eyebrow
    b.tube([ -w / 2, top + 0.27, d / 2 + 0.06 ], [ w / 2, top + 0.27, d / 2 + 0.06 ], neon)
    b.tube([ 0, top - 0.5, d / 2 + 0.32 ], [ 0, top + 1.95, d / 2 + 0.32 ], neon2, 0.11)
    b.tube([ -w / 2 - 0.1, 0.5 + fh - 0.45, d / 2 + 0.58 ], [ w / 2 + 0.1, 0.5 + fh - 0.45, d / 2 + 0.58 ], neon2, 0.07)

    // ground floor shop front
    kit.box(w * 0.42, 1.7, 0.14, trim, { x: -w * 0.18, y: 1.0, z: d / 2 })
    kit.box(w * 0.38, 1.5, 0.18, C.glassLight, { x: -w * 0.18, y: 1.1, z: d / 2 + 0.01 })
    if(b.glow && hash(seed, 9, 9) < 0.4 + 0.55 * dusk)
        b.glow.box(w * 0.38 - 0.14, 1.36, 0.03, windowLight(dusk, hash(seed, 7, 7), 0.05), { x: -w * 0.18, y: 1.17, z: d / 2 + 0.115 })
    door(kit, w * 0.27, d / 2 + 0.02, { frame: trim })
    return top
}

// ------------------------------------------------------------------ roof sculptures
// ------------------------------------------------------------------ roof sculptures
function tiffin(kit, y)
{
    // a giant steel tiffin carrier
    kit.push({ y, ry: 0.4 })
    for(let i = 0; i < 3; i++)
    {
        const ty = 0.2 + i * 1.0
        kit.cyl(1.35, 1.25, 0.88, 14, C.steel, { y: ty })
        kit.cyl(1.4, 1.4, 0.1, 14, C.steelDark, { y: ty + 0.84 })
    }
    kit.cyl(1.2, 1.38, 0.35, 14, C.steel, { y: 3.2 })
    kit.cyl(0.25, 0.25, 0.18, 8, C.steelDark, { y: 3.55 })
    // side clamps and the carry handle
    for(const sx of [ -1, 1 ])
        kit.box(0.14, 3.6, 0.3, C.steelDark, { x: sx * 1.47, y: 0.1 })
    kit.torus(1.47, 0.09, C.steelDark, { y: 3.7, rz: 0 }, 6, 16, Math.PI)
    kit.box(3.2, 0.2, 0.5, C.laterite, { y: 0 })
    kit.pop()
}

function calculator(kit, y)
{
    kit.push({ y, rx: -0.28 })
    kit.box(2.8, 3.8, 0.55, C.black, { y: 0.3 })
    kit.box(2.3, 0.85, 0.1, '#B9C9A0', { y: 3.05, z: 0.3 })
    // digits on the screen
    for(let i = 0; i < 4; i++) kit.box(0.28, 0.5, 0.05, '#3F4A33', { x: 0.65 - i * 0.42, y: 3.22, z: 0.36 })
    const keys = [ C.cream, C.cream, C.cream, '#E8833A' ]
    for(let r = 0; r < 4; r++)
        for(let c = 0; c < 4; c++)
            kit.box(0.48, 0.42, 0.16, keys[c], { x: -0.84 + c * 0.56, y: 0.55 + r * 0.58, z: 0.32 })
    kit.pop()
    kit.box(0.6, 1.0, 0.6, C.black, { y, z: -0.6 })
}

function alarmClock(kit, y)
{
    kit.push({ y: y + 2.1 })
    kit.cyl(1.7, 1.7, 0.9, 18, C.red, { rx: Math.PI / 2, center: true })
    kit.cyl(1.45, 1.45, 0.12, 18, C.white, { rx: Math.PI / 2, z: 0.46, center: true })
    // hour marks
    for(let i = 0; i < 12; i++)
    {
        const a = i / 12 * Math.PI * 2
        kit.box(0.08, i % 3 === 0 ? 0.3 : 0.16, 0.06, C.ink, { x: Math.sin(a) * 1.2, y: Math.cos(a) * 1.2, z: 0.54, rz: -a, center: true })
    }
    kit.box(0.14, 0.95, 0.06, C.ink, { y: 0.4, z: 0.58, rz: -0.9, center: true })
    kit.box(0.1, 1.25, 0.06, C.ink, { y: 0.55, z: 0.6, rz: 0.3, center: true })
    kit.sphere(0.12, C.ink, { z: 0.6 })
    // bells, hammer, legs
    for(const sx of [ -1, 1 ])
    {
        kit.sphere(0.62, C.steel, { x: sx * 1.05, y: 1.6, rz: sx * 0.6, sy: 0.75 }, 1)
        kit.box(0.14, 0.9, 0.14, C.black, { x: sx * 1.0, y: -2.1, rz: sx * 0.4 })
    }
    kit.box(0.14, 0.6, 0.14, C.steelDark, { y: 1.65 })
    kit.box(0.7, 0.14, 0.14, C.steelDark, { y: 2.22, center: true })
    kit.pop()
}

function phone(kit, y)
{
    kit.push({ y, ry: -0.25 })
    kit.box(2.3, 4.2, 0.36, C.black, { y: 0.4 })
    kit.box(2.0, 3.6, 0.06, '#9ED0E6', { y: 0.68, z: 0.2 })
    // a face on screen with scan brackets
    kit.cyl(0.62, 0.62, 0.05, 16, '#F2C9A0', { y: 2.75, z: 0.24, rx: Math.PI / 2, center: true })
    kit.box(0.12, 0.12, 0.04, C.ink, { x: -0.22, y: 2.85, z: 0.28, center: true })
    kit.box(0.12, 0.12, 0.04, C.ink, { x: 0.22, y: 2.85, z: 0.28, center: true })
    kit.box(0.4, 0.07, 0.04, C.ink, { y: 2.55, z: 0.28, center: true })
    for(const sx of [ -1, 1 ])
        for(const sy of [ -1, 1 ])
        {
            kit.box(0.45, 0.1, 0.04, C.turmeric, { x: sx * 0.75, y: 2.75 + sy * 0.95, z: 0.27, center: true })
            kit.box(0.1, 0.45, 0.04, C.turmeric, { x: sx * 0.95, y: 2.75 + sy * 0.75, z: 0.27, center: true })
        }
    // a "present" tick
    kit.box(0.9, 0.5, 0.04, C.seaGreen, { y: 1.15, z: 0.24, center: true })
    kit.box(0.5, 0.06, 0.03, C.white, { x: 0.07, y: 1.15, z: 0.27, rz: 0.7, center: true })
    kit.box(0.28, 0.06, 0.03, C.white, { x: -0.18, y: 1.08, z: 0.27, rz: -0.8, center: true })
    kit.pop()
    kit.box(0.5, 0.9, 0.5, C.black, { y, z: -0.5 })
}

function ticTacToe(kit, y)
{
    kit.push({ y })
    const s = 3.8
    // frame and grid
    kit.box(s + 0.3, 0.3, 0.3, C.woodLight, { y: 0 })
    kit.box(s + 0.3, 0.3, 0.3, C.woodLight, { y: s })
    kit.box(0.3, s + 0.3, 0.3, C.woodLight, { x: -s / 2, y: 0 })
    kit.box(0.3, s + 0.3, 0.3, C.woodLight, { x: s / 2, y: 0 })
    kit.box(s, s, 0.12, C.cream, { y: 0.15, z: -0.08 })
    for(const t of [ -1, 1 ])
    {
        kit.box(0.14, s - 0.2, 0.2, C.ink, { x: t * s / 6, y: 0.25 })
        kit.box(s - 0.2, 0.14, 0.2, C.ink, { y: s / 2 + t * s / 6 })
    }
    const cell = (cx, cy) => ({ x: cx * s / 3, y: s / 2 + cy * s / 3 })
    const X = [ [ -1, 1 ], [ 0, 0 ], [ 1, -1 ] ]
    const O = [ [ 1, 1 ], [ -1, -1 ], [ 0, 1 ] ]
    for(const [ cx, cy ] of X)
    {
        const p = cell(cx, cy)
        kit.box(1.0, 0.22, 0.25, C.red, { ...p, z: 0.18, rz: 0.785, center: true })
        kit.box(1.0, 0.22, 0.25, C.red, { ...p, z: 0.18, rz: -0.785, center: true })
    }
    for(const [ cx, cy ] of O)
    {
        const p = cell(cx, cy)
        kit.torus(0.4, 0.12, '#3B6FB6', { ...p, z: 0.18 }, 6, 14)
    }
    kit.pop()
}

function kulhad(kit, y)
{
    // a giant clay chai cup with steam
    kit.push({ y })
    kit.cyl(1.0, 0.7, 1.7, 12, C.tile, {})
    kit.cyl(0.92, 0.92, 0.06, 12, '#C98B4B', { y: 1.66 })
    kit.cyl(1.05, 1.0, 0.16, 12, shade(C.tile, 0.08), { y: 1.6 })
    kit.sphere(0.3, C.white, { x: 0.1, y: 2.3, s: 1 })
    kit.sphere(0.24, C.white, { x: -0.2, y: 2.75 })
    kit.sphere(0.18, C.white, { x: 0.05, y: 3.1 })
    kit.pop()
}


// ------------------------------------------------------------------ buildings
function project(kind, { wall, neon, neon2, awningColors, sculpture, sculptureY = 0, sign, extra }, o = {})
{
    const b = new Builder()
    const top = decoBlock(b, { w: 8, d: 6.4, wall, neon, neon2, dusk: o.dusk || 0, seed: kind.length * 7.3 + kind.charCodeAt(0) })
    if(awningColors) awning(b.clay, 3.2, 3.05, 3.25, awningColors, { depth: 1.2 })
    if(extra) extra(b.clay, b)
    sculpture(b.clay, top + 0.25 + sculptureY)
    // the name in neon above the shop front
    if(sign)
    {
        const s = neonSign(sign, { color: neon, width: 4.6, height: 0.9 })
        s.position.set(-0.4, 3.75, 3.36)
        b.extras.push(s)
    }
    return b.build()
}

const builders = {
    // the Game Arcade: a lavender hall with a joystick on the roof and a neon sign
    arcade: (o) => project('arcade', {
        wall: C.lavender, neon: NEON.cyan, neon2: NEON.pink, awningColors: [ C.flamingo, C.white ],
        sculpture: (k, y) =>
        {
            // a big arcade joystick on the roof
            k.cyl(0.1, 0.12, 1.1, 8, C.black, { y })
            k.box(0.5, 0.12, 0.5, C.steelDark, { y: y + 1.0 })
            k.sphere(0.24, NEON.pink, { y: y + 1.35 }, 1)
            k.cyl(0.6, 0.6, 0.12, 12, C.teal, { y: y - 0.02 })
        },
        sign: o.sign || 'Game Arcade',
        extra: (k) =>
        {
            // a row of bright cabinets in the window
            for(let i = 0; i < 4; i++) k.box(0.7, 1.7, 0.5, i % 2 ? C.teal : C.flamingo, { x: -3.2 + i * 0.95, y: 0.5, z: 3.3 })
        }
    }, o),
    tiffin: (o) => project('tiffin', {
        wall: C.mint, neon: NEON.pink, neon2: NEON.yellow, awningColors: [ C.flamingo, C.white ],
        sculpture: tiffin, sign: o.sign,
        extra: (k) =>
        {
            // diner stools at the window
            for(let i = 0; i < 3; i++) k.cyl(0.25, 0.25, 0.1, 10, C.red, { x: -3.2 + i * 0.9, y: 1.0, z: 4.0 })
            for(let i = 0; i < 3; i++) k.cyl(0.05, 0.05, 0.6, 5, C.steel, { x: -3.2 + i * 0.9, y: 0.4, z: 4.0 })
        }
    }, o),
    calculator: (o) => project('calculator', {
        wall: C.peach, neon: NEON.cyan, neon2: NEON.pink, awningColors: [ C.teal, C.cream ],
        sculpture: calculator, sign: o.sign,
        extra: (k) =>
        {
            for(let i = 0; i < 6; i++) k.box(2.4, 0.1, 1.2, i % 2 ? '#B9B6AE' : '#A8A59D', { x: 2.6, y: 0.5 + i * 0.11, z: 4.5, ry: 0.2 })
        }
    }, o),
    clock: (o) => project('clock', {
        wall: C.sky, neon: NEON.orange, neon2: NEON.pink,
        sculpture: alarmClock, sign: o.sign,
        extra: (k) => palmPot(k, -3.3, 0.5, 3.9)
    }, o),
    phone: (o) => project('phone', {
        wall: C.lavender, neon: NEON.cyan, neon2: NEON.yellow, awningColors: [ C.ink, C.white ],
        sculpture: phone, sign: o.sign,
        extra: (k) => { for(let i = 0; i < 3; i++) k.torus(0.35, 0.05, C.ink, { x: 2.3 + i * 0.5, y: 0.85, z: 4.4, ry: Math.PI / 2 }, 4, 10) }
    }, o),
    arcade: (o) => project('arcade', {
        wall: C.pink, neon: NEON.purple, neon2: NEON.cyan, awningColors: [ C.lemon, C.flamingo ],
        sculpture: ticTacToe, sculptureY: 0.4, sign: o.sign,
        extra: (k, b) =>
        {
            k.box(0.9, 1.8, 0.8, '#3B6FB6', { x: -3.1, y: 0.5, z: 4.0 })
            b.neon.box(0.7, 0.5, 0.05, NEON.cyan, { x: -3.1, y: 1.6, z: 4.42 })
        }
    }, o),

    // Ishan's place: a white deco villa with a curved corner and a sun deck,
    // and his name in neon hanging over the door
    studio: () =>
    {
        const b = new Builder()
        const k = b.clay
        const w = 7
        const d = 6
        const H = 4.2 // ground floor, tall enough for the sign over the door
        const top = 0.5 + H
        plinth(k, w, d)
        k.box(w - 1.4, H, d, C.white, { y: 0.5 })
        k.box(w, H, d - 1.4, C.white, { y: 0.5, z: -0.7 })
        k.cyl(1.4, 1.4, H, 16, C.white, { x: w / 2 - 1.4, y: 0.5, z: d / 2 - 1.4 })
        k.box(1.4, H, 1.4, C.white, { x: -w / 2 + 0.7, y: 0.5, z: d / 2 - 0.7 })
        // teal band, flat roof with a deck and rail
        k.box(w + 0.1, 0.35, d + 0.1, C.teal, { y: top - 0.2 })
        k.cyl(1.47, 1.47, 0.35, 16, C.teal, { x: w / 2 - 1.4, y: top - 0.2, z: d / 2 - 1.4 })
        k.box(w * 0.55, 2.2, d * 0.55, C.white, { x: -w * 0.18, y: top + 0.15, z: -d * 0.18 })
        k.box(w * 0.6, 0.18, d * 0.6, C.teal, { x: -w * 0.18, y: top + 2.35, z: -d * 0.18 })
        for(let i = 0; i <= 8; i++) k.box(0.05, 0.6, 0.05, C.white, { x: 0.3 + i * 0.35, y: top + 0.15, z: d / 2 - 0.05 })
        k.box(3.0, 0.06, 0.06, C.white, { x: 1.7, y: top + 0.75, z: d / 2 - 0.05 })
        // glass block window on the curve, door, portholes
        k.box(0.12, 2.4, 1.2, C.glassLight, { x: w / 2 + 0.01, y: 1.0, z: -0.8 })
        door(k, -0.6, d / 2 + 0.02, { color: C.teal, frame: C.white })
        porthole(k, -2.3, 2.2, d / 2 + 0.02, 0)
        porthole(k, -w / 2 - 0.02, 2.2, -0.5, -Math.PI / 2)
        palmPot(k, -2.4, 0.5, d / 2 + 0.7)
        palmPot(k, 1.3, 0.5, d / 2 + 0.9)
        b.tube([ -w / 2, top + 0.1, d / 2 + 0.07 ], [ w / 2 - 1.4, top + 0.1, d / 2 + 0.07 ], NEON.cyan, 0.06)

        // the name sign hangs from two hooks under the band, centred on the front wall
        const gap = 0.16
        const sign = hangingNeon('Ishan R Tripathi', { color: '#FF4FB0', accent: '#4E63FF', width: 4.0, height: 0.95, chain: 0.42, wallGap: gap })
        const signX = -0.7
        const hookY = top - 0.2
        sign.position.set(signX, hookY - sign.userData.hookY, d / 2 + gap)
        b.extras.push(sign)
        for(const x of [ signX - sign.userData.chainX, signX + sign.userData.chainX ])
            k.box(0.04, 0.04, gap + 0.02, C.steelDark, { x, y: hookY - 0.04, z: d / 2 + gap / 2 })
        return b.build()
    },

    trophies: () =>
    {
        const b = new Builder()
        const k = b.clay
        k.box(3.2, 1.5, 2.4, C.white, { y: -0.8 })
        k.box(3.5, 0.2, 2.7, C.flamingo, { y: 0.7 })
        k.box(2.6, 0.6, 1.8, C.mint, { y: -0.4, z: 0.01 })
        k.push({ x: -0.55, y: 0.9 })
        k.box(1.2, 0.35, 1.2, C.ink, {})
        k.cyl(0.55, 0.7, 0.3, 10, '#D9A52B', { y: 0.35 })
        k.cyl(0.14, 0.2, 0.9, 8, '#E3B23C', { y: 0.65 })
        k.cyl(0.95, 0.35, 1.5, 12, '#EFBF45', { y: 1.5 })
        k.cyl(1.0, 0.95, 0.12, 12, '#D9A52B', { y: 2.95 })
        k.torus(0.42, 0.09, '#E3B23C', { x: 0.98, y: 2.3 }, 5, 10, Math.PI)
        k.torus(0.42, 0.09, '#E3B23C', { x: -0.98, y: 2.3, rz: Math.PI }, 5, 10, Math.PI)
        k.pop()
        k.push({ x: 1.05, y: 0.9 })
        k.box(0.14, 1.7, 0.14, C.wood, { x: -0.4 })
        k.box(0.14, 1.7, 0.14, C.wood, { x: 0.4 })
        k.box(0.95, 0.12, 0.14, C.wood, { y: 1.7 })
        k.box(0.16, 0.8, 0.04, '#3B6FB6', { x: -0.12, y: 1.0, rz: -0.25 })
        k.box(0.16, 0.8, 0.04, C.red, { x: 0.12, y: 1.0, rz: 0.25 })
        k.cyl(0.38, 0.38, 0.1, 14, '#CFD5DC', { y: 0.72, rx: Math.PI / 2, center: true })
        k.cyl(0.26, 0.26, 0.12, 14, '#B5BDC6', { y: 0.72, rx: Math.PI / 2, center: true })
        k.pop()
        b.tube([ -1.75, 0.82, 1.38 ], [ 1.75, 0.82, 1.38 ], NEON.yellow, 0.07)
        return b.build()
    },

    // beach shack at the end of the road, still serving chai
    chai: () =>
    {
        const b = new Builder()
        const k = b.clay
        k.box(4.2, 0.2, 2.6, C.woodLight, { y: 0 })
        for(const [ x, z ] of [ [ -2, -1.2 ], [ 2, -1.2 ], [ -2, 1.2 ], [ 2, 1.2 ] ])
            k.box(0.16, 2.7, 0.16, C.woodLight, { x, y: 0, z })
        k.box(4.2, 1.1, 0.16, C.mint, { y: 0.2, z: 1.2 })
        for(let i = 0; i < 6; i++) k.box(0.06, 1.1, 0.18, C.white, { x: -1.75 + i * 0.7, y: 0.2, z: 1.21 })
        k.box(4.4, 0.14, 0.7, C.woodLight, { y: 1.3, z: 1.1 })
        k.box(4.2, 1.5, 0.12, C.woodLight, { y: 0.2, z: -1.2 })
        // thatch roof
        k.cone(3.4, 1.4, 6, '#D9B26B', { y: 2.7, ry: Math.PI / 6, sz: 0.75 })
        k.cone(3.2, 1.3, 6, '#C99E58', { y: 2.75, ry: Math.PI / 6 + 0.3, sz: 0.72 })
        // kettle, glasses, jars, snack packets
        k.cyl(0.3, 0.38, 0.5, 10, C.steel, { x: -1.2, y: 1.44, z: 1.0 })
        k.cyl(0.08, 0.08, 0.4, 6, C.steel, { x: -0.8, y: 1.7, z: 1.0, rz: -1.0 })
        for(let i = 0; i < 5; i++) k.cyl(0.09, 0.07, 0.22, 7, '#F4E1C1', { x: -0.2 + i * 0.25, y: 1.44, z: 1.25 })
        for(let i = 0; i < 3; i++) k.cyl(0.22, 0.22, 0.45, 8, '#D8EEF2', { x: 1.0 + i * 0.45, y: 1.44, z: 0.95 })
        const packets = [ C.red, C.turmeric, '#3B6FB6', C.teal, C.flamingo ]
        for(let i = 0; i < 7; i++) k.box(0.28, 0.4, 0.06, packets[i % packets.length], { x: -1.8 + i * 0.6, y: 2.2, z: 1.25 })
        kulhad(k, 3.55)
        k.box(2.2, 0.12, 0.5, C.woodLight, { x: 0.3, y: 0.55, z: 2.6 })
        k.box(0.12, 0.55, 0.45, C.woodLight, { x: -0.6, y: 0, z: 2.6 })
        k.box(0.12, 0.55, 0.45, C.woodLight, { x: 1.2, y: 0, z: 2.6 })
        // string lights along the front
        for(let i = 0; i < 9; i++) b.neon.sphere(0.07, i % 2 ? NEON.yellow : NEON.orange, { x: -2 + i * 0.5, y: 2.62 - Math.sin(i / 8 * Math.PI) * 0.18, z: 1.3 })
        const s = neonSign('Chai', { color: NEON.cyan, width: 1.8, height: 0.75, script: true })
        s.position.set(0, 2.05, 1.32)
        b.extras.push(s)
        return b.build()
    },

    stool: () =>
    {
        const b = new Builder()
        b.clay.cyl(0.32, 0.32, 0.1, 10, C.flamingo, { y: 0.52 })
        for(let i = 0; i < 3; i++)
        {
            const a = i / 3 * Math.PI * 2
            b.clay.box(0.07, 0.56, 0.07, C.steel, { x: Math.cos(a) * 0.2, z: Math.sin(a) * 0.2, rx: Math.sin(a) * 0.15, rz: -Math.cos(a) * 0.15 })
        }
        return b.build()
    },

    lighthouse: () =>
    {
        const b = new Builder()
        const k = b.clay
        k.cyl(2.3, 2.6, 1.4, 10, '#B8AFA4', { y: -0.9 })
        k.cyl(1.25, 1.7, 10.2, 12, C.white, { y: 0.5 })
        const top = 10.7
        k.cyl(1.5, 1.35, 0.25, 12, C.black, { y: top })
        for(let i = 0; i < 12; i++)
        {
            const a = i / 12 * Math.PI * 2
            k.box(0.06, 0.6, 0.06, C.black, { x: Math.cos(a) * 1.4, y: top + 0.25, z: Math.sin(a) * 1.4 })
        }
        k.cone(1.05, 1.1, 10, C.black, { y: top + 1.55 })
        door(k, 0, 1.65, { w: 0.9, h: 1.8, color: C.teal })
        for(let i = 0; i < 3; i++) k.box(0.4, 0.7, 0.12, C.glass, { y: 3 + i * 2.4, z: 1.55 - i * 0.07 })
        b.neon.cyl(0.8, 0.8, 1.3, 10, NEON.yellow, { y: top + 0.25 })
        return b.build()
    },

    // the hospital: a white clinic with a teal band under the roof, a red cross over the door and a neon sign
    hospital: () =>
    {
        const b = new Builder()
        const k = b.clay
        const w = 9
        const d = 7
        plinth(k, w, d)
        k.box(w, 7.2, d, C.white, { y: 0.5 })
        k.box(w + 0.2, 0.4, d + 0.2, C.seaGreen, { y: 4.2 })
        k.box(w + 0.2, 0.3, d + 0.2, C.white, { y: 8.1 })
        for(const x of [ -3, 0, 3 ])
            for(const y of [ 2.0, 5.6 ])
                if(!(x === 0 && y === 2.0)) k.box(1.5, 1.2, 0.16, C.glass, { x, y, z: d / 2 + 0.02 })
        door(k, 0, d / 2 + 0.02, { w: 1.6, h: 2.3 })
        // the red cross, high on the front
        k.box(0.5, 1.6, 0.16, C.red, { y: 6.9, z: d / 2 + 0.06 })
        k.box(1.6, 0.5, 0.16, C.red, { y: 6.9, z: d / 2 + 0.06 })
        const sign = neonSign('Clinic', { color: NEON.cyan, width: 3.0, height: 0.7, panel: true })
        sign.position.set(0, 3.4, d / 2 + 0.3)
        b.extras.push(sign)
        return b.build()
    },

    // the cinema: a vertical blade sign, a marquee over the doors, and a
    // big poster frame on the facade for the career timeline
    cinema: (o) =>
    {
        const b = new Builder()
        const k = b.clay
        const w = 11
        const d = 7.2
        plinth(k, w, d)
        k.box(w, 7.5, d, C.cream, { y: 0.5 })
        k.box(w + 0.2, 0.3, d + 0.2, C.flamingo, { y: 8.0 })
        // stepped crown
        k.box(w * 0.6, 1.0, d * 0.6, C.cream, { y: 8.3 })
        k.box(w * 0.3, 0.9, d * 0.4, C.flamingo, { y: 9.3 })
        // vertical stripes on the facade
        for(const x of [ -4.6, 4.6 ]) k.box(0.6, 7.6, 0.3, C.flamingo, { x, y: 0.5, z: d / 2 + 0.1 })
        // entrance and marquee canopy
        for(const x of [ -1.6, 0, 1.6 ]) door(k, x, d / 2 + 0.02, { w: 1.2, h: 2.3 })
        k.box(7.2, 0.5, 2.2, C.flamingo, { y: 3.2, z: d / 2 + 1.1 })
        k.box(7.4, 0.12, 2.4, C.white, { y: 3.15, z: d / 2 + 1.1 })
        // blade sign frame
        k.box(1.5, 7.8, 0.5, C.flamingo, { x: 3.6, y: 4.0, z: d / 2 + 0.65 })
        for(let i = 0; i < 14; i++) b.neon.sphere(0.06, NEON.yellow, { x: -3.55 + i * 0.546, y: 3.08, z: d / 2 + 2.25 })
        b.tube([ -w / 2, 8.33, d / 2 + 0.12 ], [ w / 2, 8.33, d / 2 + 0.12 ], NEON.cyan, 0.08)

        const blade = neonSign('ISHAN', { color: NEON.pink, width: 1.1, height: 6.6, vertical: true })
        blade.position.set(3.6, 7.3, d / 2 + 0.92)
        const marquee = neonSign(o.marquee || 'Now showing', { color: NEON.yellow, width: 6.6, height: 0.42, panel: true })
        marquee.position.set(0, 3.45, d / 2 + 2.22)
        b.extras.push(blade, marquee)
        b.posterAnchor = { x: -1.2, y: 5.7, z: d / 2 + 0.03 }
        const group = b.build()
        group.userData.posterAnchor = b.posterAnchor
        return group
    },

    // the Gilded Lily: a wine-red club with warm lights in its windows, a gold marquee over the door, a tall
    // pink blade on the corner and a gold beacon on the roof
    club: () =>
    {
        const b = new Builder()
        const k = b.clay
        const w = 9
        const d = 7
        const wine = '#4A1A30'
        const top = 8.6
        plinth(k, w, d, C.black)
        k.box(w, top - 0.5, d, wine, { y: 0.5 })
        // a dark cap on the roof, a smaller block on it, and a gold beacon on top
        k.box(w + 0.2, 0.3, d + 0.2, C.black, { y: top })
        k.box(w * 0.5, 1.2, d * 0.5, wine, { y: top + 0.3 })
        k.box(w * 0.24, 0.8, d * 0.3, C.black, { y: top + 1.5 })
        b.neon.sphere(0.35, NEON.yellow, { y: top + 2.65 })
        // two lit windows with a warm glow, and the door in the middle
        for(const x of [ -2.55, 2.55 ]) b.glow.box(1.2, 2.6, 0.1, '#FFB347', { x, y: 3.6, z: d / 2 + 0.06 })
        door(k, 0, d / 2 + 0.02, { w: 1.6, h: 2.3, color: '#1B0A14', frame: C.black })
        // the canopy over the door, with a gold line along its front edge
        k.box(4.6, 0.4, 2.0, C.black, { y: 3.0, z: d / 2 + 0.9 })
        b.tube([ -2.3, 2.95, d / 2 + 1.95 ], [ 2.3, 2.95, d / 2 + 1.95 ], NEON.yellow, 0.08)
        // a pink band under the roof and a gold line along the top of the front
        b.tube([ -w / 2, 6.9, d / 2 + 0.12 ], [ w / 2, 6.9, d / 2 + 0.12 ], NEON.pink, 0.07)
        b.tube([ -w / 2, top + 0.2, d / 2 + 0.12 ], [ w / 2, top + 0.2, d / 2 + 0.12 ], NEON.yellow, 0.08)
        // the marquee above the door, and the tall pink blade on the corner
        const name = neonSign('The Gilded Lily', { color: NEON.yellow, width: 4.6, height: 0.9, script: true })
        name.position.set(0, 4.3, d / 2 + 0.25)
        k.box(1.3, 5.2, 0.4, C.black, { x: 3.7, y: 2.6, z: d / 2 + 0.45 })
        const blade = neonSign('Open late', { color: NEON.pink, width: 1.0, height: 5.0, vertical: true })
        blade.position.set(3.7, 5.2, d / 2 + 0.75)
        b.extras.push(name, blade)
        return b.build()
    }
}

export function createBuilding(kind, options = {})
{
    const fn = builders[kind]
    if(!fn) throw new Error('Unknown building kind ' + kind)
    return fn(options)
}

// ------------------------------------------------------------------ city filler
// Hotels and apartment blocks that make the island read as a city.
// All of them merge into one clay mesh and one neon mesh.
const FILLER_WALLS = [ C.pink, C.mint, C.peach, C.sky, C.lavender, C.lemon, C.white, C.cream ]
const FILLER_NEON = [ NEON.pink, NEON.cyan, NEON.purple, NEON.orange ]

export function createFillers(list, placeMatrix)
{
    const clay = new Kit()
    const neon = new Kit()
    const glow = new Kit()
    const b = { clay, neon, glow, extras: [], tube: Builder.prototype.tube }
    list.forEach((f) =>
    {
        const m = placeMatrix(f)
        clay.stack.push(m)
        neon.stack.push(m)
        glow.stack.push(m)
        const evening = { dusk: duskAt(f.x, f.z), seed: f.variant * 3.7 + f.x }
        const wall = FILLER_WALLS[f.variant % FILLER_WALLS.length]
        const tint = FILLER_NEON[f.variant % FILLER_NEON.length]
        if(f.floors >= 3)
        {
            // hotel: taller, with balconies stacked up the front
            decoBlock(b, { w: f.w, d: f.d, wall, floors: f.floors, neon: tint, neon2: FILLER_NEON[(f.variant + 1) % 4], ...evening })
            for(let i = 1; i < f.floors; i++)
                clay.box(f.w * 0.35, 0.12, 0.8, C.white, { x: f.w * 0.25, y: 0.5 + i * 3.0, z: f.d / 2 + 0.4 })
        }
        else
        {
            decoBlock(b, { w: f.w, d: f.d, wall, floors: f.floors, neon: tint, neon2: tint, ...evening })
            awning(clay, f.w * 0.5, 3.05, f.d / 2 + 0.05, [ wall === C.white ? C.teal : C.white, shade(wall, -0.12) ], { depth: 1.0 })
        }
        clay.stack.pop()
        neon.stack.pop()
        glow.stack.pop()
    })
    const group = new THREE.Group()
    if(clay.parts.length) group.add(clay.mesh(clayMaterial))
    if(neon.parts.length)
    {
        const n = new THREE.Mesh(neon.geometry(), neonMaterial)
        group.add(n)
    }
    if(glow.parts.length) group.add(new THREE.Mesh(glow.geometry(), glowMaterial))
    return group
}
