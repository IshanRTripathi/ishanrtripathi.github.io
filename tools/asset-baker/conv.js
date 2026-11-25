import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true })
renderer.setSize(900, 600, false)
renderer.toneMapping = THREE.NeutralToneMapping

async function load(url)
{
    const ext = url.split('.').pop().toLowerCase()
    if(ext === 'glb' || ext === 'gltf')
    {
        const g = await new GLTFLoader().loadAsync(url)
        return { object: g.scene, animations: g.animations }
    }
    if(ext === 'fbx')
    {
        const o = await new FBXLoader().loadAsync(url)
        return { object: o, animations: o.animations || [] }
    }
    if(ext === 'obj')
    {
        const mtlUrl = url.replace(/\.obj$/i, '.mtl')
        const loader = new OBJLoader()
        try
        {
            const mtl = await new MTLLoader().setPath(mtlUrl.slice(0, mtlUrl.lastIndexOf('/') + 1)).loadAsync(mtlUrl.slice(mtlUrl.lastIndexOf('/') + 1))
            mtl.preload()
            loader.setMaterials(mtl)
        }
        catch {}
        return { object: await loader.loadAsync(url), animations: [] }
    }
    throw new Error('unknown format ' + ext)
}

function pixelsOf(texture)
{
    if(texture.userData.pixels) return texture.userData.pixels
    const img = texture.image
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    texture.userData.pixels = { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
    return texture.userData.pixels
}

const _c = new THREE.Color()
const _p = new THREE.Color()
function colorDistance(c, hex)
{
    _p.set(hex)
    return Math.abs(c.r - _p.r) + Math.abs(c.g - _p.g) + Math.abs(c.b - _p.b)
}
function sample(texture, u, v, out)
{
    const p = pixelsOf(texture)
    u = ((u % 1) + 1) % 1
    v = ((v % 1) + 1) % 1
    const x = Math.min(p.w - 1, Math.floor(u * p.w))
    const y = Math.min(p.h - 1, Math.floor((texture.flipY ? 1 - v : v) * p.h))
    const i = (y * p.w + x) * 4
    return out.setRGB(p.data[i] / 255, p.data[i + 1] / 255, p.data[i + 2] / 255, THREE.SRGBColorSpace)
}

// Merge every mesh into one non-indexed geometry with a flat colour per face,
// taken from the material colour or the texture under the face's centre.
function bake(object, { fit = null, height = null, yaw = 0, skip = [], linear = false, lift = 0, sat = 0, paint = null, repaint = null, leaves = null } = {})
{
    object.updateMatrixWorld(true)
    const parts = []
    object.traverse((child) =>
    {
        if(!child.isMesh || skip.some((s) => child.name.toLowerCase().includes(s))) return
        let g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
        const groups = g.groups.length ? g.groups : [ { start: 0, count: g.attributes.position.count, materialIndex: 0 } ]
        const materials = Array.isArray(child.material) ? child.material : [ child.material ]
        g.applyMatrix4(child.matrixWorld)
        const count = g.attributes.position.count
        const colors = new Float32Array(count * 3)
        const uv = g.attributes.uv
        const vc = g.attributes.color
        for(const group of groups)
        {
            const mat = materials[group.materialIndex] || materials[0]
            for(let f = group.start; f < Math.min(count, group.start + group.count); f += 3)
            {
                if(mat.map && uv)
                {
                    const u = (uv.getX(f) + uv.getX(f + 1) + uv.getX(f + 2)) / 3
                    const v = (uv.getY(f) + uv.getY(f + 1) + uv.getY(f + 2)) / 3
                    sample(mat.map, u, v, _c)
                    if(mat.color) _c.multiply(mat.color)
                }
                else _c.copy(mat.color || new THREE.Color(1, 1, 1))
                // some exporters write linear colours where sRGB is expected
                if(linear) _c.convertLinearToSRGB()
                if(lift || sat) _c.offsetHSL(0, sat, lift)
                if(paint) for(const [ from, to, tol ] of paint) if(colorDistance(_c, from) < (tol || 0.08)) _c.set(to)
                // repaint by hue: { hue, range, to } keeps each face's shading but swaps the paint
                if(repaint || leaves)
                {
                    const hsl = {}
                    _c.getHSL(hsl)
                    for(const r of repaint || [])
                    {
                        const d = Math.abs(((hsl.h - r.hue + 1.5) % 1) - 0.5)
                        if(d < r.range && hsl.s > (r.minSat ?? 0.3))
                        {
                            const t = new THREE.Color(r.to).getHSL({})
                            _c.setHSL(t.h, t.s, Math.min(0.95, Math.max(0.05, t.l + (hsl.l - (r.baseL ?? 0.5)) * 0.8)))
                            break
                        }
                    }
                    // brighten greens (leaves) without touching trunks
                    if(leaves && hsl.h > 0.18 && hsl.h < 0.45) _c.offsetHSL(leaves.hue || 0, leaves.sat || 0, leaves.lift || 0)
                }
                for(let k = 0; k < 3; k++)
                {
                    let r = _c.r, gg = _c.g, b = _c.b
                    if(vc) { r *= vc.getX(f + k); gg *= vc.getY(f + k); b *= vc.getZ(f + k) }
                    colors[(f + k) * 3] = r
                    colors[(f + k) * 3 + 1] = gg
                    colors[(f + k) * 3 + 2] = b
                }
            }
        }
        const clean = new THREE.BufferGeometry()
        clean.setAttribute('position', g.attributes.position.clone())
        clean.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        parts.push(clean)
    })
    const merged = mergeGeometries(parts, false)
    merged.rotateY(yaw)
    merged.computeBoundingBox()
    const box = merged.boundingBox
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    merged.translate(-center.x, -box.min.y, -center.z)
    let scale = 1
    if(fit) scale = Math.min(fit[0] / size.x, fit[1] / size.y, fit[2] / size.z)
    else if(height) scale = height / size.y
    merged.scale(scale, scale, scale)
    merged.computeBoundingBox()
    return merged
}

async function toGLB(object, animations = [])
{
    const result = await new GLTFExporter().parseAsync(object, { binary: true, animations })
    let binary = ''
    const bytes = new Uint8Array(result)
    for(let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(binary)
}

function preview(object, { clip = null, time = 0.4, animations = [], dir = [ 1, 0.6, 1.3 ] } = {})
{
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#9a9aa6')
    scene.add(new THREE.HemisphereLight('#ffffff', '#887766', 2))
    const sun = new THREE.DirectionalLight('#ffffff', 2.5)
    sun.position.set(3, 6, 4)
    scene.add(sun)
    scene.add(object)
    if(clip)
    {
        const mixer = new THREE.AnimationMixer(object)
        const c = animations.find((a) => a.name === clip)
        if(c) { mixer.clipAction(c).play(); mixer.update(time) }
    }
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3()).length()
    const center = box.getCenter(new THREE.Vector3())
    const camera = new THREE.PerspectiveCamera(35, 1.5, size / 100, size * 10)
    camera.position.copy(center).add(new THREE.Vector3(...dir).normalize().multiplyScalar(size * 1.25))
    camera.lookAt(center)
    renderer.render(scene, camera)
    scene.remove(object)
    return renderer.domElement.toDataURL('image/png')
}

window.conv = {
    async palette(url, opts = {})
    {
        const { object } = await load(url)
        const g = bake(object, opts)
        const col = g.attributes.color
        const counts = new Map()
        for(let i = 0; i < col.count; i += 3)
        {
            const hex = '#' + new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString()
            counts.set(hex, (counts.get(hex) || 0) + 1)
        }
        return [ ...counts.entries() ].sort((a, b) => b[1] - a[1]).slice(0, 40)
    },

    async inspect(url)
    {
        const { object, animations } = await load(url)
        const materials = new Map()
        let meshes = 0
        let triangles = 0
        let skinned = false
        object.traverse((c) =>
        {
            if(!c.isMesh) return
            meshes++
            if(c.isSkinnedMesh) skinned = true
            const g = c.geometry
            triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
            for(const m of [ c.material ].flat()) materials.set(m.name, { color: m.color ? '#' + m.color.getHexString() : null, map: !!m.map, type: m.type })
        })
        const box = new THREE.Box3().setFromObject(object)
        const size = box.getSize(new THREE.Vector3())
        return { meshes, triangles, skinned, size: size.toArray().map((v) => +v.toFixed(2)), materials: Object.fromEntries(materials), animations: animations.map((a) => `${a.name} (${a.duration.toFixed(2)}s)`) }
    },

    async look(url, opts = {})
    {
        const { object, animations } = await load(url)
        return preview(object, { ...opts, animations })
    },

    // static model -> one vertex-coloured mesh
    async bakeStatic(url, opts = {})
    {
        const { object } = await load(url)
        const geometry = bake(object, opts)
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }))
        mesh.name = opts.name || 'model'
        const glb = await toGLB(mesh)
        const shot = preview(mesh.clone(), { dir: opts.dir })
        const tris = geometry.attributes.position.count / 3
        return { glb, shot, triangles: tris, size: geometry.boundingBox.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) }
    },

    // rigged character: recolour materials by name, clean up clip names
    async character(url, { colors = {}, keep = null } = {})
    {
        const { object, animations } = await load(url)
        // one skinned mesh, one material: each part's colour goes into the vertices
        object.traverse((c) =>
        {
            if(!c.isMesh) return
            const mats = Array.isArray(c.material) ? c.material : [ c.material ]
            const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry
            const count = g.attributes.position.count
            const col = new Float32Array(count * 3)
            const groups = g.groups.length ? g.groups : [ { start: 0, count, materialIndex: 0 } ]
            const tmp = new THREE.Color()
            for(const group of groups)
            {
                const m = mats[group.materialIndex] || mats[0]
                tmp.set(colors[m.name] || ('#' + m.color.getHexString()))
                for(let i = group.start; i < Math.min(count, group.start + group.count); i++)
                {
                    col[i * 3] = tmp.r
                    col[i * 3 + 1] = tmp.g
                    col[i * 3 + 2] = tmp.b
                }
            }
            g.setAttribute('color', new THREE.BufferAttribute(col, 3))
            g.clearGroups()
            c.geometry = g
            // the FBX loader drops weights beyond four per vertex; make the rest add up to one
            if(c.isSkinnedMesh) c.normalizeSkinWeights()
            c.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, name: 'Character' })
        })
        const clips = animations.map((a) => { const c = a.clone(); c.name = a.name.split('|').pop(); return c }).filter((c) => !keep || keep.includes(c.name))
        const glb = await toGLB(object, clips)
        const shots = {}
        for(const name of [ 'Idle', 'Walk', 'Wave' ]) if(clips.find((c) => c.name === name)) shots[name] = preview(object, { clip: name, animations: clips, time: 0.35, dir: [ 0.4, 0.25, 1 ] })
        return { glb, shots, clips: clips.map((c) => c.name) }
    }
}
window.__ready = true
