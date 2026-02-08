import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

class MiniPreview {
    constructor(rootEl, modelUrl, clickUrl) {
        this.rootEl = rootEl
        this.modelUrl = modelUrl
        this.clickUrl = clickUrl
        this.running = false
        this.clock = new THREE.Clock()
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
        this.camera.position.set(3.5, 3.0, 4.5)
        this.camera.lookAt(0, 0.8, 0)
        this.canvas = document.createElement('canvas')
        this.canvas.className = 'preview-canvas'
        this.canvas.style.width = '100%'
        this.canvas.style.height = '100%'
        this.canvas.style.display = 'block'
        this.canvas.style.pointerEvents = 'none'
        this.rootEl.appendChild(this.canvas)

        this.renderer = new THREE.WebGPURenderer({
            canvas: this.canvas,
            antialias: true,
            forceWebGL: true
        })
        this.renderer.setClearColor(0x000000, 0)
        this.renderer.setSize(this.rootEl.clientWidth, this.rootEl.clientHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this._initPromise = this.renderer.init()

        const ambient = new THREE.AmbientLight(0xffffff, 0.9)
        this.scene.add(ambient)
        const dir = new THREE.DirectionalLight(0xffffff, 0.6)
        dir.position.set(3, 4, 2)
        this.scene.add(dir)

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.95, 1.0, 48),
            new THREE.MeshBasicMaterial({ color: 0x8a5cf5 })
        )
        ring.rotation.x = -Math.PI * 0.5
        ring.position.y = -0.01
        this.scene.add(ring)

        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(0.95, 48),
            new THREE.MeshStandardMaterial({ color: 0x1c1733, roughness: 1 })
        )
        ground.rotation.x = -Math.PI * 0.5
        this.scene.add(ground)

        this.group = new THREE.Group()
        this.scene.add(this.group)

        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('/draco/')
        const loader = new GLTFLoader()
        loader.setDRACOLoader(dracoLoader)
        loader.load(this.modelUrl, (gltf) => {
            const root = gltf.scene
            root.scale.setScalar(0.3)
            root.position.set(0, 0, 0)
            this.group.add(root)
        })

        this.onResize = () => {
            const w = this.rootEl.clientWidth
            const h = this.rootEl.clientHeight
            this.renderer.setSize(w, h)
            this.camera.aspect = w / h
            this.camera.updateProjectionMatrix()
        }
        window.addEventListener('resize', this.onResize)

        this.rootEl.addEventListener('click', () => {
            window.location.href = this.clickUrl
        })
    }

    start() {
        if (this.running) return
        this.running = true
        const loop = () => {
            if (!this.running) return
            const t = this.clock.getElapsedTime()
            this.group.rotation.y = t * 0.25
            this.renderer.render(this.scene, this.camera)
            requestAnimationFrame(loop)
        }
        loop()
    }

    stop() {
        this.running = false
    }
}

export class WorldPreviews {
    constructor() {
        const nodes = document.querySelectorAll('.masked-inner[data-preview-world]')
        this.previews = []
        nodes.forEach((node) => {
            const model = node.dataset.previewModel
            const url = node.dataset.previewUrl
            if (model && url) {
                const preview = new MiniPreview(node, model, url)
                this.previews.push(preview)
                preview._initPromise.then(() => preview.start())
            }
        })
    }
}
