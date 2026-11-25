import * as THREE from 'three'

// Neon: unlit and brighter than white, so the bloom pass makes it glow.

export const NEON_BOOST = 2.4

export const neonMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
neonMaterial.color.setScalar(NEON_BOOST)

// lit windows and lantern glass: the brightness is baked into the vertex colours
export const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })

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

// A neon sign on a clear acrylic panel, hung on two chains: script lettering,
// an underline swoosh and a little spark in a second colour, and a soft glow
// thrown on the wall behind it. The group's origin is the centre of the panel;
// the chains reach `chain` metres up, and the wall is `wallGap` metres behind.
export function hangingNeon(text, { color = '#FF4FB0', accent = '#4E63FF', width = 4, height = 1, chain = 0.35, wallGap = 0.16 } = {})
{
    const group = new THREE.Group()
    const pxPerM = 256
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(2048, Math.round(width * pxPerM))
    canvas.height = Math.min(1024, Math.round(height * pxPerM))
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const pad = H * 0.06

    // the acrylic: smoked dark so the tubes stand out on a bright wall, with
    // edges catching the light
    const radius = H * 0.12
    const panel = new Path2D()
    panel.roundRect(pad, pad, W - pad * 2, H - pad * 2, radius)
    ctx.fillStyle = 'rgba(18, 11, 34, 0.93)'
    ctx.fill(panel)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)'
    ctx.lineWidth = Math.max(2, H * 0.012)
    ctx.stroke(panel)
    // two little holes for the chains
    for(const x of [ W * 0.06, W * 0.94 ])
    {
        ctx.beginPath()
        ctx.arc(x, pad * 2.2, H * 0.018, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.stroke()
    }

    // a neon tube: wide soft glow, the coloured tube, a hot white core
    const tube = (draw, tint, size) =>
    {
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.shadowColor = tint
        ctx.shadowBlur = size * 1.6
        ctx.strokeStyle = tint
        ctx.fillStyle = tint
        ctx.lineWidth = size * 0.3
        draw('glow')
        draw('glow')
        ctx.shadowBlur = size * 0.4
        ctx.lineWidth = size * 0.2
        draw('tube')
        ctx.shadowBlur = 0
        ctx.strokeStyle = 'rgba(255, 240, 250, 0.9)'
        ctx.fillStyle = 'rgba(255, 228, 244, 0.42)'
        ctx.lineWidth = size * 0.06
        draw('core')
    }

    // lettering, as large as the panel allows
    let size = H * 0.5
    ctx.font = `${size}px ${SCRIPT}`
    while(ctx.measureText(text).width > W * 0.78 && size > 10)
    {
        size -= 2
        ctx.font = `${size}px ${SCRIPT}`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const textWidth = ctx.measureText(text).width
    const cx = W * 0.52
    const cy = H * 0.45
    tube((pass) =>
    {
        if(pass === 'glow') ctx.strokeText(text, cx, cy)
        ctx.fillText(text, cx, cy)
    }, color, size * 0.16)

    // underline swoosh, rising at the end, and a spark by the first letter
    const left = cx - textWidth / 2
    const right = cx + textWidth / 2
    const line = H * 0.8
    tube(() =>
    {
        ctx.beginPath()
        ctx.moveTo(left + size * 0.15, line)
        ctx.lineTo(right - size * 0.25, line)
        ctx.quadraticCurveTo(right + size * 0.1, line, right + size * 0.12, line - size * 0.3)
        ctx.stroke()
        for(const [ a, l ] of [ [ -2.5, 0.28 ], [ -1.95, 0.32 ], [ -1.35, 0.26 ] ])
        {
            const ox = left - size * 0.08
            const oy = cy - size * 0.42
            ctx.beginPath()
            ctx.moveTo(ox + Math.cos(a) * size * 0.12, oy + Math.sin(a) * size * 0.12)
            ctx.lineTo(ox + Math.cos(a) * size * (0.12 + l), oy + Math.sin(a) * size * (0.12 + l))
            ctx.stroke()
        }
    }, accent, size * 0.11)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false })
    material.color.setScalar(NEON_BOOST * 0.68)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    sign.renderOrder = 3
    group.add(sign)

    // the panel's thickness, seen from the side
    const edge = new THREE.Mesh(
        new THREE.BoxGeometry(width - height * 0.12, height - height * 0.12, 0.025),
        new THREE.MeshBasicMaterial({ color: '#DDEBFF', transparent: true, opacity: 0.08, depthWrite: false })
    )
    edge.position.z = -0.02
    group.add(edge)

    // chains up to the hooks
    const chainMaterial = new THREE.MeshStandardMaterial({ color: '#8E8E96', roughness: 0.5, metalness: 0.6 })
    for(const x of [ -width * 0.44, width * 0.44 ])
    {
        const links = Math.max(3, Math.round(chain / 0.045))
        for(let i = 0; i < links; i++)
        {
            const link = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 8), chainMaterial)
            link.position.set(x, height / 2 - height * 0.08 + (i + 0.5) * chain / links, -0.01)
            link.rotation.y = i % 2 ? Math.PI / 2 : 0
            link.scale.y = 1.4
            group.add(link)
        }
    }

    // the glow the neon throws on the wall behind
    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = glowCanvas.height = 128
    const g = glowCanvas.getContext('2d')
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gradient
    g.fillRect(0, 0, 128, 128)
    const glowTexture = new THREE.CanvasTexture(glowCanvas)
    glowTexture.colorSpace = THREE.SRGBColorSpace
    const wallGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 1.45, height * 2.3),
        new THREE.MeshBasicMaterial({
            map: glowTexture, color: new THREE.Color(color).multiplyScalar(0.55), transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
        })
    )
    wallGlow.position.z = -wallGap + 0.004
    wallGlow.renderOrder = 2
    group.add(wallGlow)

    group.userData.hookY = height / 2 - height * 0.08 + chain
    group.userData.chainX = width * 0.44
    return group
}
