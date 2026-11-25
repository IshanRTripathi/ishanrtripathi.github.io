import * as THREE from 'three'

// Real models replace the procedural stand-ins. public/models/manifest.json
// lists what exists, one entry per file:
//   { "id": "tiffin", "file": "tiffin.glb", "fit": [8.5, 11, 7], "yaw": 0 }
// `kind` says where it goes (default "site"):
//   site       a building kind (tiffin, calculator, clock, phone, arcade, studio,
//              trophies, chai, lighthouse), matched by `id`
//   vehicle    "car" or "scooter"; `hideRider` hides Ishan inside a closed car
//   character  the playable character (rigged, with animations)
//   traffic    a car body for the traffic loop (one entry per model, used in turn)
//   parked     a car body for the cars parked by the beach
//   instanced  replaces a tree type everywhere: `target` (palm, royal, rain,
//              slender), scaled to `height` metres
//   scenery    extras that only exist as models, e.g. "cruise" out in the bay
// `fit` is the box [width, height, depth] in metres the model is scaled to fit in.
// `yaw` turns models that come in facing the wrong way (radians, e.g. 3.1416).
// The character can list extra animation files: "clips": { "walk": "character-walk.glb" }.
// Single-mesh, vertex-coloured models (traffic, parked, instanced, scenery) are
// drawn with the world's own clay material, so they match the lighting.

let loaderPromise = null
async function getLoader()
{
    if(!loaderPromise)
    {
        loaderPromise = Promise.all([
            import('three/addons/loaders/GLTFLoader.js'),
            import('three/addons/libs/meshopt_decoder.module.js')
        ]).then(([ { GLTFLoader }, { MeshoptDecoder } ]) =>
        {
            const loader = new GLTFLoader()
            loader.setMeshoptDecoder(MeshoptDecoder)
            return loader
        })
    }
    return loaderPromise
}

async function readManifest()
{
    try
    {
        const response = await fetch('./models/manifest.json', { cache: 'no-cache' })
        if(!response.ok) return []
        const json = await response.json()
        return json.models || []
    }
    catch
    {
        return []
    }
}

// Scale to fit a box (or a height), stand it on y = 0, centre it, turn it.
export function normalize(scene, { fit = null, height = 1, yaw = 0 } = {})
{
    const turn = new THREE.Group()
    turn.rotation.y = yaw
    turn.add(scene)
    turn.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(turn)
    const size = box.getSize(new THREE.Vector3())
    const scale = fit
        ? Math.min(fit[0] / (size.x || 1), fit[1] / (size.y || 1), fit[2] / (size.z || 1))
        : height / (size.y || 1)
    const center = box.getCenter(new THREE.Vector3())
    const wrapper = new THREE.Group()
    wrapper.add(turn)
    turn.scale.setScalar(scale)
    turn.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    scene.traverse((child) =>
    {
        if(child.isMesh)
        {
            child.castShadow = true
            child.receiveShadow = true
        }
    })
    return wrapper
}

// The geometry of a single-mesh model, standing on y = 0 and centred
function firstGeometry(scene)
{
    let mesh = null
    scene.traverse((c) => { if(!mesh && c.isMesh && !c.isSkinnedMesh) mesh = c })
    if(!mesh) return null
    mesh.updateWorldMatrix(true, false)
    // compressed models store attributes as normalised integers, which clamp at
    // ±1 when transformed: unpack everything to plain floats first
    const g = new THREE.BufferGeometry()
    for(const [ name, attr ] of Object.entries(mesh.geometry.attributes))
    {
        const out = new Float32Array(attr.count * attr.itemSize)
        for(let i = 0; i < attr.count; i++)
            for(let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k)
        g.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize))
    }
    if(mesh.geometry.index) g.setIndex(mesh.geometry.index.clone())
    g.applyMatrix4(mesh.matrixWorld)
    g.computeBoundingBox()
    const box = g.boundingBox
    const center = box.getCenter(new THREE.Vector3())
    g.translate(-center.x, -box.min.y, -center.z)
    if(!g.attributes.color)
    {
        // plain material colour: bake it so the clay material can use it
        const c = mesh.material.color || new THREE.Color(1, 1, 1)
        const colors = new Float32Array(g.attributes.position.count * 3)
        for(let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
}

// Scale a geometry so it is `height` tall, or fits inside `fit`
export function sized(geometry, { height = null, fit = null, length = null } = {})
{
    const g = geometry.clone()
    g.computeBoundingBox()
    const size = g.boundingBox.getSize(new THREE.Vector3())
    let s = 1
    if(fit) s = Math.min(fit[0] / size.x, fit[1] / size.y, fit[2] / size.z)
    else if(length) s = length / Math.max(size.x, size.z)
    else if(height) s = height / size.y
    g.scale(s, s, s)
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
}

export const registry = {
    manifest: null,

    async entries()
    {
        if(!this.manifest) this.manifest = readManifest()
        return this.manifest
    },

    async load(entry)
    {
        const loader = await getLoader()
        const gltf = await loader.loadAsync('./models/' + entry.file)
        return { gltf, object: normalize(gltf.scene, entry) }
    },

    // every non-character model that exists, loaded in parallel
    async loadAvailable()
    {
        const entries = (await this.entries()).filter((e) => (e.kind || 'site') !== 'character' && e.id !== 'character' && e.kind !== 'npc')
        const results = await Promise.all(entries.map(async (entry) =>
        {
            try
            {
                const { gltf, object } = await this.load(entry)
                return { id: entry.id, kind: entry.kind || 'site', entry, object, geometry: firstGeometry(gltf.scene) }
            }
            catch(error)
            {
                console.warn('Could not load model', entry.file, error)
                return null
            }
        }))
        return results.filter(Boolean)
    },

    // a rigged figure for the people on the road: its model and clips, loaded once and cloned per person
    async figure(id)
    {
        const entry = (await this.entries()).find((e) => e.id === id)
        if(!entry) return null
        try
        {
            const { gltf, object } = await this.load(entry)
            return { object, animations: gltf.animations, entry }
        }
        catch(error)
        {
            console.warn('Could not load the figure', id, error)
            return null
        }
    },

    async character()
    {
        const entry = (await this.entries()).find((e) => e.id === 'character')
        if(!entry) return null
        try
        {
            const { gltf, object } = await this.load(entry)
            const animations = [ ...gltf.animations ]
            // one file per animation: take its clip and name it after the key
            const loader = await getLoader()
            for(const [ name, file ] of Object.entries(entry.clips || {}))
            {
                const clipGltf = await loader.loadAsync('./models/' + file)
                const clip = clipGltf.animations[0]
                if(clip)
                {
                    clip.name = name
                    animations.push(clip)
                }
            }
            return { object, animations, entry }
        }
        catch(error)
        {
            console.warn('Could not load the character model', error)
            return null
        }
    }
}
