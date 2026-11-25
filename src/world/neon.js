import * as THREE from 'three'

// Neon: unlit and brighter than white, so the bloom pass makes it glow.

export const NEON_BOOST = 2.4

export const neonMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
neonMaterial.color.setScalar(NEON_BOOST)

const SCRIPT = '"Yellowtail", cursive'
const DISPLAY = '"Anton", "Barlow Semi Condensed", sans-serif'
const CONDENSED = '"Barlow Semi Condensed", sans-serif'

// Text drawn as glowing tubes on a transparent canvas, mapped onto a plane.
// options: color, width, height (metres), script, vertical, panel
export function neonSign(text, { color = '#FF3EA5', width = 3, height = 1, script = false, vertical = false, panel = false } = {})
{
    const pxPerM = 200
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(2048, Math.round(width * pxPerM))
    canvas.height = Math.min(2048, Math.round(height * pxPerM))
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    if(panel)
    {
        ctx.fillStyle = '#1B1730'
        ctx.fillRect(0, 0, W, H)
    }

    const drawLine = (line, x, y, size, font) =>
    {
        ctx.font = `${size}px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        // outer glow, coloured tube, hot white core
        ctx.shadowColor = color
        ctx.shadowBlur = size * 0.35
        ctx.strokeStyle = color
        ctx.lineWidth = size * 0.11
        ctx.strokeText(line, x, y)
        ctx.shadowBlur = size * 0.15
        ctx.fillStyle = color
        ctx.fillText(line, x, y)
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
        ctx.fillText(line, x, y)
    }

    if(vertical)
    {
        const letters = [ ...text ]
        const step = H / (letters.length + 0.4)
        const size = Math.min(W * 0.78, step * 0.92)
        letters.forEach((l, i) => drawLine(l, W / 2, step * (i + 0.7), size, DISPLAY))
    }
    else
    {
        const font = script ? SCRIPT : panel ? CONDENSED : DISPLAY
        let size = H * (script ? 0.72 : 0.7)
        ctx.font = `${size}px ${font}`
        while(ctx.measureText(text).width > W * 0.88 && size > 10)
        {
            size -= 2
            ctx.font = `${size}px ${font}`
        }
        drawLine(text, W / 2, H * (script ? 0.55 : 0.53), size, font)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: !panel, depthWrite: panel, toneMapped: false })
    material.color.setScalar(panel ? 1.3 : NEON_BOOST * 0.6)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    mesh.renderOrder = 3
    return mesh
}
