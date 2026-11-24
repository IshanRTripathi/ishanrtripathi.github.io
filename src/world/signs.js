import * as THREE from 'three'
import { Kit, shade } from '../models/kit.js'
import { C } from './buildings.js'

// Painted wooden boards. The face is a canvas texture so the text stays crisp.

const DISPLAY = '"Yatra One", "Hind", sans-serif'
const BODY = '"Hind", system-ui, sans-serif'

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

export function paintBoard({ title, line, accent = C.seaGreen })
{
    const canvas = document.createElement('canvas')
    canvas.width = 768
    canvas.height = 448
    const ctx = canvas.getContext('2d')
    // cream paint over wood, a coloured stripe like a hand-painted shop sign
    ctx.fillStyle = '#F5E9CF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, canvas.width, 26)
    ctx.fillRect(0, canvas.height - 26, canvas.width, 26)
    ctx.strokeStyle = 'rgba(36, 52, 79, 0.85)'
    ctx.lineWidth = 5
    ctx.strokeRect(22, 46, canvas.width - 44, canvas.height - 92)

    ctx.fillStyle = '#24344F'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    let size = 82
    ctx.font = `${size}px ${DISPLAY}`
    while(ctx.measureText(title).width > canvas.width - 100 && size > 40)
    {
        size -= 4
        ctx.font = `${size}px ${DISPLAY}`
    }
    ctx.fillText(title, canvas.width / 2, 172)

    ctx.font = `500 34px ${BODY}`
    ctx.fillStyle = '#3A4660'
    const lines = wrap(ctx, line, canvas.width - 120).slice(0, 3)
    lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, 250 + i * 44))
    return canvasTexture(canvas)
}

export function createSignBoard({ title, line, accent })
{
    const group = new THREE.Group()
    const kit = new Kit()
    const w = 2.5
    const h = 1.46
    const y0 = 0.9
    kit.box(0.14, y0 + h + 0.15, 0.14, C.wood, { x: -w / 2 + 0.12, y: -0.4, z: -0.1 })
    kit.box(0.14, y0 + h + 0.15, 0.14, C.wood, { x: w / 2 - 0.12, y: -0.4, z: -0.1 })
    kit.box(w + 0.2, h + 0.2, 0.12, C.woodLight, { y: y0 - 0.1, z: 0 })
    kit.box(w + 0.45, 0.16, 0.3, shade(C.wood, 0.05), { y: y0 + h + 0.1, z: 0 })
    group.add(kit.mesh())

    const face = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: paintBoard({ title, line, accent }), roughness: 0.85 })
    )
    face.position.set(0, y0 + h / 2 - 0.1, 0.065)
    face.receiveShadow = true
    group.add(face)
    group.userData.face = face
    return group
}

// Yellow station name board, the way Indian railway stations do it
export function createStationNameBoard()
{
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 320
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#F4C430'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1D1D1D'
    ctx.lineWidth = 10
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28)
    ctx.fillStyle = '#1D1D1D'
    ctx.textAlign = 'center'
    ctx.font = `92px ${DISPLAY}`
    ctx.fillText('इशान जंक्शन', canvas.width / 2, 130)
    ctx.font = `600 96px ${BODY}`
    ctx.fillText('ISHAN JN.', canvas.width / 2, 258)

    const group = new THREE.Group()
    const kit = new Kit()
    kit.box(0.14, 3.2, 0.14, C.black, { x: -1.8 })
    kit.box(0.14, 3.2, 0.14, C.black, { x: 1.8 })
    group.add(kit.mesh())
    const face = new THREE.Mesh(
        new THREE.PlaneGeometry(4.0, 1.25),
        new THREE.MeshStandardMaterial({ map: canvasTexture(canvas), roughness: 0.7 })
    )
    face.position.set(0, 2.45, 0.08)
    const back = face.clone()
    back.rotation.y = Math.PI
    back.position.z = -0.08
    const plate = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.35, 0.12), new THREE.MeshStandardMaterial({ color: '#1D1D1D' }))
    plate.position.set(0, 2.45, 0)
    plate.castShadow = true
    group.add(plate, face, back)
    return group
}

// Departures board listing every career stop
export function createDeparturesBoard(stops)
{
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 640
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#16202B'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#F4C430'
    ctx.fillRect(0, 0, canvas.width, 92)
    ctx.fillStyle = '#16202B'
    ctx.font = `600 52px ${BODY}`
    ctx.textAlign = 'left'
    ctx.fillText('Departures', 36, 66)
    ctx.textAlign = 'right'
    ctx.font = `500 34px ${BODY}`
    ctx.fillText('Years', canvas.width - 36, 62)

    const rows = stops.slice(0, 6)
    rows.forEach((stop, i) =>
    {
        const y = 160 + i * 84
        ctx.fillStyle = i % 2 ? '#1B2733' : '#1F2D3A'
        ctx.fillRect(0, y - 54, canvas.width, 84)
        ctx.textAlign = 'left'
        ctx.fillStyle = '#FFC857'
        ctx.font = `600 44px ${BODY}`
        ctx.fillText(stop.place, 36, y)
        ctx.fillStyle = '#9FB3C8'
        ctx.font = `400 26px ${BODY}`
        ctx.fillText(stop.role, 38, y + 22)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#FFC857'
        ctx.font = `500 36px ${BODY}`
        ctx.fillText(stop.when, canvas.width - 36, y)
    })

    const texture = canvasTexture(canvas)
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 2.125),
        new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.6 })
    )
    return mesh
}
