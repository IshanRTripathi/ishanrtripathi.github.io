import * as THREE from 'three'
import { Kit, shade } from '../models/kit.js'

// Procedural stand-ins for every building, in one low-poly clay style.
// Each builder returns a mesh with its origin on the ground at the centre of
// its footprint, front door facing +Z. Swap any of them for a Tripo model
// through src/models/registry.js.

export const C = {
    laterite: '#A9573B',
    lateriteDark: '#8E4630',
    whitewash: '#F3ECDF',
    cream: '#F1E4C6',
    ochre: '#E2A33C',
    turmeric: '#F2C14E',
    seaGreen: '#3E9C8F',
    skyBlue: '#86BCD8',
    pink: '#E9A296',
    mint: '#A7D8C2',
    lilac: '#B9A6D6',
    tile: '#C0634A',
    tileDark: '#A8543E',
    wood: '#7C4D2C',
    woodLight: '#A8743F',
    glass: '#2F4B61',
    steel: '#C8CDD2',
    steelDark: '#9AA1A8',
    ink: '#24344F',
    red: '#D2453A',
    white: '#FBF7EE',
    black: '#2B2D31'
}

// ------------------------------------------------------------------ pieces
function plinth(kit, w, d, color = C.laterite)
{
    // buried a little so it hides any slope under the building
    kit.box(w + 0.5, 1.9, d + 0.5, color, { y: -1.5 })
    kit.box(w + 0.7, 0.12, d + 0.7, shade(color, 0.06), { y: 0.4 })
}

function windowAt(kit, x, y, z, { w = 0.9, h = 1.15, shutter = C.seaGreen, frame = C.white, ry = 0 } = {})
{
    kit.push({ x, y, z, ry })
    kit.box(w + 0.22, h + 0.22, 0.12, frame)
    kit.box(w, h, 0.16, C.glass, { y: 0.11 })
    kit.box(0.08, h, 0.2, frame, { y: 0.11 })
    kit.box(w * 0.5, h + 0.1, 0.08, shutter, { x: -w * 0.78, y: 0.06, z: 0.08, ry: 0.5 })
    kit.box(w * 0.5, h + 0.1, 0.08, shutter, { x: w * 0.78, y: 0.06, z: 0.08, ry: -0.5 })
    kit.box(w + 0.4, 0.1, 0.3, frame, { y: -0.04, z: 0.1 })
    kit.pop()
}

function door(kit, x, z, { w = 1.3, h = 2.2, color = C.wood, frame = C.white } = {})
{
    kit.box(w + 0.3, h + 0.2, 0.12, frame, { x, y: 0.5, z })
    kit.box(w, h, 0.18, color, { x, y: 0.5, z: z + 0.02 })
    kit.box(0.06, h, 0.2, shade(color, -0.08), { x, y: 0.5, z: z + 0.04 })
    // steps
    kit.box(w + 0.6, 0.25, 0.5, C.lateriteDark, { x, y: 0.25, z: z + 0.3 })
}

function awning(kit, w, y, z, colors, { depth = 1.4, tilt = 0.32 } = {})
{
    const stripes = Math.max(4, Math.round(w / 0.45))
    const sw = w / stripes
    for(let i = 0; i < stripes; i++)
    {
        kit.box(sw, 0.06, depth, colors[i % colors.length], {
            x: -w / 2 + sw * (i + 0.5), y, z: z + depth / 2 * Math.cos(tilt), rx: tilt, center: true
        })
    }
    // scalloped edge
    for(let i = 0; i < stripes; i++)
        kit.box(sw * 0.9, 0.2, 0.05, colors[i % colors.length], { x: -w / 2 + sw * (i + 0.5), y: y - depth * Math.sin(tilt) / 2 - 0.12, z: z + depth * Math.cos(tilt) - 0.02, center: true })
}

function parapet(kit, w, d, y, color, { step = true } = {})
{
    const t = 0.25
    kit.box(w, 0.55, t, color, { y, z: d / 2 - t / 2 })
    kit.box(w, 0.55, t, color, { y, z: -d / 2 + t / 2 })
    kit.box(t, 0.55, d, color, { y, x: w / 2 - t / 2 })
    kit.box(t, 0.55, d, color, { y, x: -w / 2 + t / 2 })
    if(step)
    {
        kit.box(w * 0.42, 0.45, t, color, { y: y + 0.55, z: d / 2 - t / 2 })
        kit.box(w * 0.2, 0.35, t, color, { y: y + 1.0, z: d / 2 - t / 2 })
    }
    kit.box(w - 0.1, 0.14, d - 0.1, shade(color, -0.1), { y: y - 0.02 })
}

function balcony(kit, w, y, z, rail = C.white)
{
    kit.box(w, 0.16, 1.0, C.laterite, { y, z: z + 0.5 })
    const posts = Math.round(w / 0.35)
    for(let i = 0; i <= posts; i++)
        kit.box(0.07, 0.7, 0.07, rail, { x: -w / 2 + (w / posts) * i, y: y + 0.16, z: z + 0.95 })
    kit.box(w, 0.08, 0.12, rail, { y: y + 0.86, z: z + 0.95 })
}

function pot(kit, x, y, z, leaf = '#5E9B45')
{
    kit.cyl(0.22, 0.16, 0.32, 7, C.tile, { x, y, z })
    kit.sphere(0.3, leaf, { x, y: y + 0.48, z, sy: 0.9 })
}

function hipRoof(kit, w, d, y, h, color = C.tile)
{
    // Mangalore-tile style hip roof with an overhang; the ridge runs along the longer side
    if(d > w)
    {
        kit.push({ ry: Math.PI / 2 })
        hipRoof(kit, d, w, y, h, color)
        kit.pop()
        return
    }
    const ow = w + 1.0
    const od = d + 1.0
    const g = new THREE.BufferGeometry()
    const ridge = Math.max(0.01, (ow - od) / 2)
    const v = [
        -ow / 2, 0, -od / 2, ow / 2, 0, -od / 2, ow / 2, 0, od / 2, -ow / 2, 0, od / 2,
        -ridge, h, 0, ridge, h, 0
    ]
    const idx = [ 3, 2, 5, 3, 5, 4, 1, 0, 4, 1, 4, 5, 2, 1, 5, 0, 3, 4, 0, 1, 2, 0, 2, 3 ]
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    kit.add(g, color, { y })
    // ridge cap and eave line
    kit.box(ridge * 2 + 0.3, 0.14, 0.24, shade(color, -0.12), { y: y + h - 0.04 })
    kit.box(ow + 0.05, 0.12, 0.12, shade(color, -0.15), { y: y - 0.05, z: od / 2 })
}

// A two-storey shop house used by most project buildings
function shopHouse(kit, o)
{
    const { w, d, wall, trim, shutter, awningColors, floors = 2 } = o
    const fh = 3.1
    plinth(kit, w, d)
    for(let f = 0; f < floors; f++)
    {
        const y = 0.5 + f * fh
        kit.box(w, fh, d, f === 0 ? wall : shade(wall, 0.03), { y })
        kit.box(w + 0.16, 0.18, d + 0.16, trim, { y: y + fh - 0.09 })
    }
    const top = 0.5 + floors * fh
    // ground floor: wide shop window + door
    kit.box(w * 0.42, 1.7, 0.14, trim, { x: -w * 0.2, y: 1.1, z: d / 2 })
    kit.box(w * 0.38, 1.5, 0.18, C.glass, { x: -w * 0.2, y: 1.2, z: d / 2 + 0.01 })
    door(kit, w * 0.26, d / 2 + 0.02, { color: o.doorColor || C.wood, frame: trim })
    if(awningColors) awning(kit, w * 0.9, 3.05, d / 2 + 0.05, awningColors)
    // upper floor windows + balcony
    for(let f = 1; f < floors; f++)
    {
        const y = 0.5 + f * fh + 0.9
        const n = Math.max(2, Math.floor(w / 2.4))
        for(let i = 0; i < n; i++)
            windowAt(kit, -w / 2 + (w / n) * (i + 0.5), y, d / 2 + 0.02, { shutter, frame: trim })
        if(o.balcony) balcony(kit, w * 0.62, 0.5 + f * fh, d / 2)
        if(o.balcony) pot(kit, -w * 0.2, 0.5 + f * fh + 0.16, d / 2 + 0.55)
    }
    // side windows
    windowAt(kit, w / 2 + 0.02, 0.5 + fh + 0.9, 0, { shutter, frame: trim, ry: Math.PI / 2 })
    windowAt(kit, -w / 2 - 0.02, 0.5 + fh + 0.9, 0, { shutter, frame: trim, ry: -Math.PI / 2 })
    windowAt(kit, -w / 2 - 0.02, 1.0 + 0.4, -d * 0.2, { shutter, frame: trim, ry: -Math.PI / 2 })
    parapet(kit, w, d, top, trim)
    return top
}

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
const builders = {
    tiffin()
    {
        const kit = new Kit()
        const top = shopHouse(kit, {
            w: 8, d: 6.4, wall: C.mint, trim: C.white, shutter: C.ochre, balcony: true,
            awningColors: [ C.red, C.white ], doorColor: C.seaGreen
        })
        // benches and a menu board by the door
        kit.box(1.6, 0.12, 0.45, C.woodLight, { x: -2.2, y: 0.9, z: 4.1 })
        kit.box(0.12, 0.45, 0.4, C.woodLight, { x: -2.9, y: 0.45, z: 4.1 })
        kit.box(0.12, 0.45, 0.4, C.woodLight, { x: -1.5, y: 0.45, z: 4.1 })
        tiffin(kit, top)
        return kit.mesh()
    },
    calculator()
    {
        const kit = new Kit()
        const top = shopHouse(kit, {
            w: 8, d: 6.4, wall: C.turmeric, trim: C.white, shutter: C.seaGreen, balcony: false,
            awningColors: [ C.seaGreen, C.cream ]
        })
        // stacked corrugated cement sheets outside
        for(let i = 0; i < 6; i++)
            kit.box(2.4, 0.1, 1.2, i % 2 ? '#B9B6AE' : '#A8A59D', { x: 2.6, y: 0.5 + i * 0.11, z: 4.4, ry: 0.2 })
        kit.box(0.6, 0.8, 0.6, C.wood, { x: -3.3, y: 0.5, z: 4.0 })
        calculator(kit, top)
        return kit.mesh()
    },
    clock()
    {
        const kit = new Kit()
        const top = shopHouse(kit, {
            w: 7.6, d: 6.4, wall: C.skyBlue, trim: C.white, shutter: C.ochre, balcony: true,
            doorColor: C.red
        })
        // a little letter box
        kit.box(0.5, 0.7, 0.4, C.red, { x: -3.2, y: 0.9, z: 3.5 })
        kit.cyl(0.08, 0.08, 0.9, 6, C.black, { x: -3.2, y: 0, z: 3.5 })
        alarmClock(kit, top)
        return kit.mesh()
    },
    phone()
    {
        const kit = new Kit()
        const top = shopHouse(kit, {
            w: 8, d: 6.4, wall: C.lilac, trim: C.white, shutter: C.seaGreen, balcony: true,
            awningColors: [ C.ink, C.white ]
        })
        // a bicycle-ish rack
        for(let i = 0; i < 3; i++) kit.torus(0.35, 0.05, C.ink, { x: 2.3 + i * 0.5, y: 0.85, z: 4.3, ry: Math.PI / 2 }, 4, 10)
        phone(kit, top)
        return kit.mesh()
    },
    arcade()
    {
        const kit = new Kit()
        const top = shopHouse(kit, {
            w: 8, d: 6.4, wall: C.pink, trim: C.cream, shutter: C.seaGreen, balcony: false,
            awningColors: [ C.turmeric, C.red ], doorColor: C.ink
        })
        // arcade cabinet by the door
        kit.box(0.9, 1.8, 0.8, '#3B6FB6', { x: -3.1, y: 0.5, z: 4.0 })
        kit.box(0.7, 0.5, 0.05, '#9ED0E6', { x: -3.1, y: 1.6, z: 4.42 })
        ticTacToe(kit, top + 0.4)
        return kit.mesh()
    },
    studio()
    {
        const kit = new Kit()
        const w = 7
        const d = 6
        plinth(kit, w, d)
        kit.box(w, 3.4, d, C.whitewash, { y: 0.5 })
        kit.box(w + 0.1, 0.5, d + 0.1, C.laterite, { y: 0.5 })
        // veranda with pillars
        kit.box(w + 0.4, 0.2, 2.0, C.lateriteDark, { y: 0.4, z: d / 2 + 1.0 })
        for(const x of [ -3.2, -1.1, 1.1, 3.2 ])
        {
            kit.cyl(0.16, 0.18, 2.9, 8, C.white, { x, y: 0.6, z: d / 2 + 1.7 })
            kit.box(0.45, 0.2, 0.45, C.white, { x, y: 0.5, z: d / 2 + 1.7 })
        }
        kit.box(w + 0.6, 0.18, 2.4, C.wood, { y: 3.5, z: d / 2 + 1.0 })
        kit.push({ z: 1.0 })
        hipRoof(kit, w + 0.3, d + 2.4, 3.68, 2.6)
        kit.pop()
        door(kit, 0, d / 2 + 0.02, { color: C.seaGreen, frame: C.white })
        windowAt(kit, -2.3, 2.2, d / 2 + 0.02, { shutter: C.seaGreen })
        windowAt(kit, 2.3, 2.2, d / 2 + 0.02, { shutter: C.seaGreen })
        windowAt(kit, w / 2 + 0.02, 2.2, 0, { shutter: C.seaGreen, ry: Math.PI / 2 })
        windowAt(kit, -w / 2 - 0.02, 2.2, 0, { shutter: C.seaGreen, ry: -Math.PI / 2 })
        pot(kit, -3.2, 0.5, d / 2 + 0.8)
        pot(kit, 3.2, 0.5, d / 2 + 0.8, '#6FA84B')
        // a desk lamp glow in the window and a satellite dish on the roof
        kit.cyl(0.6, 0.1, 0.3, 10, C.white, { x: 2.0, y: 5.4, z: -1.0, rx: -0.6 })
        return kit.mesh()
    },
    trophies()
    {
        const kit = new Kit()
        // plinth
        kit.box(3.2, 1.5, 2.4, C.whitewash, { y: -0.8 })
        kit.box(3.5, 0.2, 2.7, C.laterite, { y: 0.7 })
        kit.box(2.6, 0.6, 1.8, C.laterite, { y: -0.4, z: 0.01 })
        // trophy cup
        kit.push({ x: -0.55, y: 0.9 })
        kit.box(1.2, 0.35, 1.2, C.ink, {})
        kit.cyl(0.55, 0.7, 0.3, 10, '#D9A52B', { y: 0.35 })
        kit.cyl(0.14, 0.2, 0.9, 8, '#E3B23C', { y: 0.65 })
        kit.cyl(0.95, 0.35, 1.5, 12, '#EFBF45', { y: 1.5 })
        kit.cyl(1.0, 0.95, 0.12, 12, '#D9A52B', { y: 2.95 })
        kit.torus(0.42, 0.09, '#E3B23C', { x: 0.98, y: 2.3, ry: 0, rz: 0 }, 5, 10, Math.PI)
        kit.torus(0.42, 0.09, '#E3B23C', { x: -0.98, y: 2.3, rz: Math.PI }, 5, 10, Math.PI)
        kit.pop()
        // silver medal on a ribbon stand
        kit.push({ x: 1.05, y: 0.9 })
        kit.box(0.14, 1.7, 0.14, C.wood, { x: -0.4 })
        kit.box(0.14, 1.7, 0.14, C.wood, { x: 0.4 })
        kit.box(0.95, 0.12, 0.14, C.wood, { y: 1.7 })
        kit.box(0.16, 0.8, 0.04, '#3B6FB6', { x: -0.12, y: 1.0, rz: -0.25 })
        kit.box(0.16, 0.8, 0.04, C.red, { x: 0.12, y: 1.0, rz: 0.25 })
        kit.cyl(0.38, 0.38, 0.1, 14, '#CFD5DC', { y: 0.72, rx: Math.PI / 2, center: true })
        kit.cyl(0.26, 0.26, 0.12, 14, '#B5BDC6', { y: 0.72, rx: Math.PI / 2, center: true })
        kit.pop()
        return kit.mesh()
    },
    chai()
    {
        const kit = new Kit()
        // wooden stall with a striped tarp roof
        kit.box(4.2, 0.2, 2.6, C.wood, { y: 0 })
        for(const [ x, z ] of [ [ -2, -1.2 ], [ 2, -1.2 ], [ -2, 1.2 ], [ 2, 1.2 ] ])
            kit.box(0.16, 2.7, 0.16, C.wood, { x, y: 0, z })
        kit.box(4.2, 1.1, 0.16, C.turmeric, { y: 0.2, z: 1.2 })
        kit.box(4.4, 0.14, 0.7, C.woodLight, { y: 1.3, z: 1.1 })
        kit.box(4.2, 1.5, 0.12, C.woodLight, { y: 0.2, z: -1.2 })
        const tarp = [ '#2F79B8', C.white ]
        for(let i = 0; i < 8; i++)
            kit.box(0.6, 0.06, 3.6, tarp[i % 2], { x: -2.1 + i * 0.6, y: 2.95, z: 0.2, rx: -0.18, center: true })
        // kettle, glasses, jars, snack packets
        kit.cyl(0.3, 0.38, 0.5, 10, C.steel, { x: -1.2, y: 1.44, z: 1.0 })
        kit.cyl(0.08, 0.08, 0.4, 6, C.steel, { x: -0.8, y: 1.7, z: 1.0, rz: -1.0 })
        for(let i = 0; i < 5; i++) kit.cyl(0.09, 0.07, 0.22, 7, '#E8D8B8', { x: -0.2 + i * 0.25, y: 1.44, z: 1.25 })
        for(let i = 0; i < 3; i++) kit.cyl(0.22, 0.22, 0.45, 8, '#D8EEF2', { x: 1.0 + i * 0.45, y: 1.44, z: 0.95 })
        const packets = [ C.red, C.turmeric, '#3B6FB6', C.seaGreen, C.pink ]
        for(let i = 0; i < 7; i++) kit.box(0.28, 0.4, 0.06, packets[i % packets.length], { x: -1.8 + i * 0.6, y: 2.2, z: 1.25 })
        kit.box(4.2, 0.04, 0.04, C.black, { y: 2.62, z: 1.25 })
        kulhad(kit, 3.15)
        // bench
        kit.box(2.2, 0.12, 0.5, C.woodLight, { x: 0.3, y: 0.55, z: 2.6 })
        kit.box(0.12, 0.55, 0.45, C.woodLight, { x: -0.6, y: 0, z: 2.6 })
        kit.box(0.12, 0.55, 0.45, C.woodLight, { x: 1.2, y: 0, z: 2.6 })
        return kit.mesh()
    },
    stool()
    {
        const kit = new Kit()
        kit.cyl(0.32, 0.32, 0.1, 10, C.woodLight, { y: 0.52 })
        for(let i = 0; i < 3; i++)
        {
            const a = i / 3 * Math.PI * 2
            kit.box(0.07, 0.56, 0.07, C.wood, { x: Math.cos(a) * 0.2, z: Math.sin(a) * 0.2, rx: Math.sin(a) * 0.15, rz: -Math.cos(a) * 0.15 })
        }
        return kit.mesh()
    },
    lighthouse()
    {
        const kit = new Kit()
        kit.cyl(2.3, 2.6, 1.4, 10, '#8C8378', { y: -0.9 })
        const bands = 6
        for(let i = 0; i < bands; i++)
        {
            const r0 = 1.7 - i * 0.12
            kit.cyl(r0 - 0.12, r0, 1.7, 12, i % 2 ? C.red : C.white, { y: 0.5 + i * 1.7 })
        }
        const top = 0.5 + bands * 1.7
        kit.cyl(1.45, 1.3, 0.25, 12, C.black, { y: top })
        for(let i = 0; i < 12; i++)
        {
            const a = i / 12 * Math.PI * 2
            kit.box(0.06, 0.6, 0.06, C.black, { x: Math.cos(a) * 1.35, y: top + 0.25, z: Math.sin(a) * 1.35 })
        }
        kit.cyl(0.8, 0.8, 1.3, 10, '#FFE7A3', { y: top + 0.25 })
        kit.cone(1.05, 1.1, 10, C.red, { y: top + 1.55 })
        kit.sphere(0.2, C.black, { y: top + 2.75 })
        door(kit, 0, 1.6, { w: 0.9, h: 1.8, color: C.seaGreen })
        return kit.mesh()
    }
}

export function createBuilding(kind)
{
    const fn = builders[kind]
    if(!fn) throw new Error('Unknown building kind ' + kind)
    return fn()
}

// The station: platform, canopy, station house, rails and a parked train.
// Returns { mesh, boardAnchor } so the departures board can be attached.
export function createStation()
{
    const kit = new Kit()
    const L = 15
    // platform along x, front edge at +z
    kit.box(L, 1.3, 3.4, '#D8CCB4', { y: -0.75, z: 1.9 })
    kit.box(L, 0.08, 0.35, C.turmeric, { y: 0.55, z: 3.45 })
    kit.box(L, 0.08, 0.3, C.white, { y: 0.55, z: 0.4 })
    // station house at the back of the platform... rails behind it
    kit.box(6.2, 3.0, 2.6, C.cream, { x: -3.2, y: 0.55, z: -1.0 })
    kit.box(6.4, 0.5, 2.8, '#8A2F2A', { x: -3.2, y: 0.55, z: -1.0 })
    kit.box(6.5, 0.18, 2.9, '#8A2F2A', { x: -3.2, y: 3.55, z: -1.0 })
    door(kit, -1.6, 0.31, { w: 1.1, h: 2.1, color: '#8A2F2A', frame: C.white })
    windowAt(kit, -4.6, 2.0, 0.31, { shutter: '#8A2F2A', w: 0.8, h: 1.0 })
    hipRoof(kit, 6.2, 2.6, 3.7, 1.3, C.tile)
    // canopy on posts over the platform
    for(const x of [ 0.6, 3.4, 6.2 ])
    {
        kit.box(0.14, 3.3, 0.14, '#5E6B73', { x, y: 0.55, z: 2.2 })
    }
    kit.box(7.2, 0.12, 3.0, '#7E8C94', { x: 3.4, y: 3.85, z: 2.0, rx: 0.08 })
    // bench under the canopy
    kit.box(1.8, 0.1, 0.45, C.woodLight, { x: 2.0, y: 1.0, z: 1.2 })
    kit.box(1.8, 0.4, 0.08, C.woodLight, { x: 2.0, y: 1.1, z: 0.98 })
    for(const x of [ 1.2, 2.8 ]) kit.box(0.1, 0.45, 0.4, C.black, { x, y: 0.55, z: 1.2 })
    // rails behind
    const railZ = -3.7
    kit.box(L + 6, 0.35, 3.0, '#9C9182', { y: -0.2, z: railZ })
    for(let i = 0; i < 20; i++) kit.box(0.35, 0.12, 2.4, C.wood, { x: -L / 2 - 3 + 0.5 + i * 1.08, y: 0.15, z: railZ })
    kit.box(L + 6, 0.12, 0.1, C.steelDark, { y: 0.27, z: railZ - 0.75 })
    kit.box(L + 6, 0.12, 0.1, C.steelDark, { y: 0.27, z: railZ + 0.75 })
    // buffer stops
    for(const sx of [ -1, 1 ]) kit.box(0.4, 0.9, 2.0, C.red, { x: sx * (L / 2 + 3), y: 0.15, z: railZ })
    // a short blue train: engine + coach
    kit.push({ x: 2.6, y: 0.4, z: railZ })
    for(const [ x, len, color ] of [ [ -3.4, 5.4, '#2E5C8C' ], [ 2.6, 5.8, '#2E5C8C' ] ])
    {
        kit.box(len, 2.5, 2.2, color, { x, y: 0.5 })
        kit.box(len + 0.05, 0.35, 2.25, C.cream, { x, y: 1.75 })
        kit.box(len, 0.3, 2.35, '#3B3F45', { x, y: 3.0 })
        for(let i = 0; i < Math.floor(len / 1.1); i++)
        {
            kit.box(0.6, 0.55, 0.05, C.glass, { x: x - len / 2 + 0.7 + i * 1.1, y: 2.15, z: 1.12 })
        }
        for(const wx of [ -len / 2 + 1, len / 2 - 1 ])
            for(const wz of [ -0.8, 0.8 ])
                kit.cyl(0.38, 0.38, 0.2, 8, C.black, { x: x + wx, y: 0.3, z: wz, rx: Math.PI / 2, center: true })
    }
    kit.pop()
    return kit.mesh()
}
