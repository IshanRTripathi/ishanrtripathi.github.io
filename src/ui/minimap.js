import { layout } from '../world/layout.js'
import { scatter } from '../world/scatter.js'
import { surfaceAt, SURFACE } from '../world/terrain.js'

// Round minimap: the city drawn once into an offscreen canvas, then rotated
// with the camera every frame, with blips and a GPS route along the roads.

const EXTENT = 72 // metres from the centre to the edge of the map image
const IMAGE = 512

const COLORS = {
    [SURFACE.SEABED]: '#1C6E93', [SURFACE.WET_SAND]: '#E8D3AE', [SURFACE.SAND]: '#F4E2C4',
    [SURFACE.GRASS]: '#6FAF55', [SURFACE.PATH]: '#E6D8C6', [SURFACE.ROAD]: '#3E414D', [SURFACE.ROCK]: '#A99D90',
    [SURFACE.JUNGLE]: '#3F8A3A', [SURFACE.SNOW]: '#F4F8FC', [SURFACE.DUNE]: '#F2C77E'
}

export function drawCity(extent = EXTENT, image = IMAGE)
{
    const canvas = document.createElement('canvas')
    canvas.width = image
    canvas.height = image
    const ctx = canvas.getContext('2d')
    const px = image / (extent * 2)
    const step = 1
    for(let i = 0; i < image; i += step * 2)
        for(let j = 0; j < image; j += step * 2)
        {
            const x = (i + 1) / px - extent
            const z = (j + 1) / px - extent
            ctx.fillStyle = COLORS[surfaceAt(x, z)] || '#6FAF55'
            ctx.fillRect(i, j, 2, 2)
        }
    drawBlocks(ctx, extent, px)
    return canvas
}

// The same picture at one sample a pixel, filled in a few rows at a time so the page
// never stalls: the canvas comes back at once, sea first, and the land appears as it is
// sampled. Used by the full map, which zooms in far.
export function drawCityBands(extent, image)
{
    const canvas = document.createElement('canvas')
    canvas.width = image
    canvas.height = image
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = COLORS[SURFACE.SEABED]
    ctx.fillRect(0, 0, image, image)
    const px = image / (extent * 2)
    const rgb = {}
    for(const [ k, hex ] of Object.entries(COLORS)) rgb[k] = [ parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16) ]
    let row = 0
    const work = () =>
    {
        const t = performance.now()
        while(row < image && performance.now() - t < 12)
        {
            const strip = ctx.createImageData(image, 1)
            for(let i = 0; i < image; i++)
            {
                const c = rgb[surfaceAt((i + 0.5) / px - extent, (row + 0.5) / px - extent)] || rgb[SURFACE.GRASS]
                strip.data.set([ c[0], c[1], c[2], 255 ], i * 4)
            }
            ctx.putImageData(strip, 0, row++)
        }
        if(row < image) setTimeout(work, 0)
        else drawBlocks(ctx, extent, px)
    }
    work()
    return canvas
}

function drawBlocks(ctx, extent, px)
{
    // city blocks and sites
    const block = (x, z, w, d, yaw, fill) =>
    {
        ctx.save()
        ctx.translate((x + extent) * px, (z + extent) * px)
        ctx.rotate(-yaw)
        ctx.fillStyle = fill
        ctx.fillRect(-w / 2 * px, -d / 2 * px, w * px, d * px)
        ctx.restore()
    }
    for(const f of scatter.fillers) block(f.x, f.z, f.w, f.d, f.yaw, '#F2B5CC')
    for(const s of layout.sites) block(s.x, s.z, s.w, s.d, s.yaw, '#FFF6EC')
}

// ------------------------------------------------------------------ road graph
function buildGraph()
{
    const nodes = []
    const edges = []
    const STEP = 4
    for(const path of layout.paths)
    {
        const stride = Math.max(1, Math.round(STEP / (path.length / (path.points.length - 1))))
        let prev = -1
        for(let i = 0; i < path.points.length; i += stride)
        {
            const p = path.points[i]
            nodes.push({ x: p.x, z: p.z })
            const id = nodes.length - 1
            edges[id] = []
            if(prev >= 0) link(prev, id)
            prev = id
        }
        const last = path.points[path.points.length - 1]
        nodes.push({ x: last.x, z: last.z })
        edges[nodes.length - 1] = []
        link(prev, nodes.length - 1)
    }
    // junctions: join nodes of different paths that sit close together
    for(let a = 0; a < nodes.length; a++)
        for(let b = a + 1; b < nodes.length; b++)
            if(Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z) < 3.5 && !edges[a].some((e) => e.to === b)) link(a, b)
    function link(a, b)
    {
        const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z)
        edges[a].push({ to: b, d })
        edges[b].push({ to: a, d })
    }
    return { nodes, edges }
}

function nearestNode(graph, x, z)
{
    let best = 0
    let bestD = Infinity
    graph.nodes.forEach((n, i) =>
    {
        const d = (n.x - x) ** 2 + (n.z - z) ** 2
        if(d < bestD) { bestD = d; best = i }
    })
    return best
}

function route(graph, from, to)
{
    const dist = new Array(graph.nodes.length).fill(Infinity)
    const prev = new Array(graph.nodes.length).fill(-1)
    const done = new Array(graph.nodes.length).fill(false)
    dist[from] = 0
    for(;;)
    {
        let u = -1
        for(let i = 0; i < dist.length; i++) if(!done[i] && (u < 0 || dist[i] < dist[u])) u = i
        if(u < 0 || dist[u] === Infinity) break
        if(u === to) break
        done[u] = true
        for(const e of graph.edges[u])
            if(dist[u] + e.d < dist[e.to]) { dist[e.to] = dist[u] + e.d; prev[e.to] = u }
    }
    const out = []
    for(let n = to; n >= 0; n = prev[n]) out.unshift(graph.nodes[n])
    return { points: out, length: dist[to] }
}

export class Minimap
{
    constructor(canvas)
    {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.city = drawCity()
        this.graph = buildGraph()
        this.route = null
        this.routeKey = ''
        this.scale = 2.1 // pixels per metre at 200px
    }

    // the walking route from the player to a target, as a list of map points
    routePoints(player, target)
    {
        if(!target) return []
        const from = nearestNode(this.graph, player.x, player.z)
        const to = nearestNode(this.graph, target.x, target.z)
        return [ { x: player.x, z: player.z }, ...route(this.graph, from, to).points, { x: target.x, z: target.z } ]
    }

    // target: { x, z } or null
    update(player, cameraYaw, blips, target)
    {
        const ctx = this.ctx
        const W = this.canvas.width
        const H = this.canvas.height
        const scale = this.scale * (W / 200) * (player.mode === 'ride' ? 0.75 : 1)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, W, H)
        ctx.save()
        ctx.beginPath()
        ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.fillStyle = '#1C6E93'
        ctx.fillRect(0, 0, W, H)

        // map space -> screen: camera forward points up
        const c = Math.cos(cameraYaw)
        const s = Math.sin(cameraYaw)
        ctx.translate(W / 2, H / 2)
        ctx.scale(scale, scale)
        ctx.transform(-c, -s, s, -c, 0, 0)
        ctx.translate(-player.x, -player.z)
        ctx.drawImage(this.city, -EXTENT, -EXTENT, EXTENT * 2, EXTENT * 2)

        // GPS route to the target, recomputed when the nearest node changes. A target
        // across the sea (direct) is a straight line instead: there is no road to it
        if(target)
        {
            let points = []
            if(!target.direct)
            {
                const from = nearestNode(this.graph, player.x, player.z)
                const to = nearestNode(this.graph, target.x, target.z)
                const key = from + ':' + to
                if(key !== this.routeKey)
                {
                    this.routeKey = key
                    this.route = route(this.graph, from, to)
                }
                points = this.route.points
            }
            ctx.strokeStyle = '#FF3EA5'
            ctx.lineWidth = 3.2 / scale * 1.4
            ctx.lineJoin = 'round'
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(player.x, player.z)
            for(const p of points) ctx.lineTo(p.x, p.z)
            ctx.lineTo(target.x, target.z)
            ctx.stroke()
        }

        // blips: drawn upright, so undo the rotation around each one
        for(const b of blips)
        {
            ctx.save()
            ctx.translate(b.x, b.z)
            ctx.transform(-c, s, -s, -c, 0, 0)
            ctx.scale(1 / scale, 1 / scale)
            ctx.beginPath()
            ctx.arc(0, 0, b.size || 6, 0, Math.PI * 2)
            ctx.fillStyle = b.color
            ctx.globalAlpha = b.dim ? 0.45 : 1
            ctx.fill()
            ctx.lineWidth = 2
            ctx.strokeStyle = '#1B1535'
            ctx.stroke()
            if(b.label)
            {
                ctx.fillStyle = '#1B1535'
                ctx.font = '700 9px "Barlow Semi Condensed", sans-serif'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(b.label, 0, 0.5)
            }
            ctx.restore()
        }
        ctx.restore()

        // the player, always in the middle, pointing where they face
        ctx.save()
        ctx.translate(W / 2, H / 2)
        ctx.rotate(cameraYaw - player.yaw)
        ctx.beginPath()
        ctx.moveTo(0, -9)
        ctx.lineTo(6.5, 7)
        ctx.lineTo(0, 3.5)
        ctx.lineTo(-6.5, 7)
        ctx.closePath()
        ctx.fillStyle = '#FFF6EC'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#1B1535'
        ctx.stroke()
        ctx.restore()

        // the distance: along the road for a GPS target, straight across for a direct one
        if(target && target.direct) return Math.hypot(target.x - player.x, target.z - player.z)
        return this.route && target ? this.route.length + Math.hypot(player.x - this.route.points[0]?.x, player.z - this.route.points[0]?.z) : null
    }
}
