import * as THREE from 'three'

// Generated models (from the Tripo pipeline in scripts/tripo.mjs) replace the
// procedural stand-ins. public/models/manifest.json lists what exists:
//   { "models": [ { "id": "tiffin", "file": "tiffin.glb", "fit": [8.5, 11, 7], "yaw": 0 } ] }
// `id` matches a building kind (tiffin, calculator, clock, phone, arcade, studio,
// trophies, chai, lighthouse), "scooter" or "character".
// `fit` is the box [width, height, depth] in metres the model is scaled to fit in.
// `yaw` turns models that come in facing the wrong way (radians, e.g. 3.1416).
// The character can list extra animation files: "clips": { "walk": "character-walk.glb" }.

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

    // every non-character model that exists
    async loadAvailable()
    {
        const entries = (await this.entries()).filter((e) => e.id !== 'character')
        const out = []
        for(const entry of entries)
        {
            try
            {
                const { object } = await this.load(entry)
                out.push({ id: entry.id, object })
            }
            catch(error)
            {
                console.warn('Could not load model', entry.file, error)
            }
        }
        return out
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
