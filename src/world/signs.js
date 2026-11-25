import * as THREE from 'three'
import { Kit } from '../models/kit.js'
import { C, NEON } from './buildings.js'
import { neonMaterial } from './neon.js'

// Lit sidewalk signs for every stop, and the cinema poster for the career.
// Faces are canvas textures so the text stays crisp.

const DISPLAY = '"Anton", "Barlow Semi Condensed", sans-serif'
const BODY = '"Barlow Semi Condensed", system-ui, sans-serif'

function wrap(ctx, text, maxWidth)
{
    const words = text.split(' ')
    const lines = []
    let line = ''
    for(const word of words)
    {
        const test = line ? line + ' ' + word : word
        if(ctx.measureText(test).width > maxWidth && line)
        {
            lines.push(line)
            line = word
        }
        else line = test
    }
    if(line) lines.push(line)
    return lines
}

function canvasTexture(canvas, anisotropy = 4)
{
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = anisotropy
    return texture
}

function sunset(ctx, x, y, w, h)
{
    const g = ctx.createLinearGradient(x, y, x + w, y)
    g.addColorStop(0, '#FF7A59')
    g.addColorStop(0.5, '#FF3EA5')
    g.addColorStop(1, '#8B5CF6')
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
}

export function paintBoard({ title, line })
{
    const canvas = document.createElement('canvas')
    canvas.width = 768
    canvas.height = 448
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.fillStyle = '#FFF7EC'
    ctx.fillRect(0, 0, W, H)
    sunset(ctx, 0, 0, W, 34)

    ctx.fillStyle = '#1E1B3A'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    let size = 104
    ctx.font = `${size}px ${DISPLAY}`
    while(ctx.measureText(title.toUpperCase()).width > W - 90 && size > 40)
    {
        size -= 4
        ctx.font = `${size}px ${DISPLAY}`
    }
    ctx.fillText(title.toUpperCase(), 44, 178)

    ctx.font = `500 38px ${BODY}`
    ctx.fillStyle = '#4A4766'
    const lines = wrap(ctx, line, W - 100).slice(0, 3)
    lines.forEach((l, i) => ctx.fillText(l, 46, 250 + i * 46))
    return canvasTexture(canvas)
}

export function createSignBoard({ title, line })
{
    const group = new THREE.Group()
    const kit = new Kit()
    const w = 2.5
    const h = 1.46
    const y0 = 1.0
    // a slim lightbox on two steel posts
    kit.box(0.1, y0 + h + 0.1, 0.1, C.steelDark, { x: -w / 2 + 0.15, y: -0.3, z: -0.12 })
    kit.box(0.1, y0 + h + 0.1, 0.1, C.steelDark, { x: w / 2 - 0.15, y: -0.3, z: -0.12 })
    kit.box(w + 0.16, h + 0.16, 0.2, C.white, { y: y0 - 0.08, z: -0.04 })
    group.add(kit.mesh())

    const neon = new Kit()
    neon.box(w + 0.2, 0.06, 0.06, NEON.pink, { y: y0 + h + 0.1, z: 0.07, center: true })
    const glow = new THREE.Mesh(neon.geometry(), neonMaterial)
    group.add(glow)

    const face = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: paintBoard({ title, line }), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.6 })
    )
    face.material.emissiveMap = face.material.map
    face.position.set(0, y0 + h / 2 - 0.08, 0.065)
    group.add(face)
    group.userData.face = face
    return group
}

// The career, as a lit poster on the cinema facade
export function createCareerPoster(stops)
{
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 768
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#2A1E5C')
    bg.addColorStop(1, '#14112B')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    sunset(ctx, 0, 0, W, 16)
    sunset(ctx, 0, H - 16, W, 16)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#FFD6EC'
    ctx.font = `500 34px ${BODY}`
    ctx.fillText('Now showing', W / 2, 74)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `92px ${DISPLAY}`
    ctx.fillText('THE CAREER', W / 2, 168)

    const rows = stops.slice(0, 6)
    rows.forEach((stop, i) =>
    {
        const y = 250 + i * 82
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'
        ctx.fillRect(48, y - 52, W - 96, 76)
        ctx.textAlign = 'left'
        ctx.fillStyle = '#FFE45E'
        ctx.font = `600 42px ${BODY}`
        ctx.fillText(stop.place, 72, y)
        ctx.fillStyle = '#C9BFF0'
        ctx.font = `400 26px ${BODY}`
        ctx.fillText(stop.role, 74, y + 22)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#2DE2E6'
        ctx.font = `500 36px ${BODY}`
        ctx.fillText(stop.when, W - 72, y)
    })

    const texture = canvasTexture(canvas)
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    material.color.setScalar(1.15)
    return new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.6), material)
}
