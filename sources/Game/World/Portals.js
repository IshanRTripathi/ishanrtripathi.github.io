import * as THREE from 'three/webgpu'
import { Fn, atan, PI2, positionGeometry, uniform, vec4 } from 'three/tsl'
import { Game } from '../Game.js'
import gsap from 'gsap'

// Configuration for portal placement and visuals.
// Tweak these values to change where the portals appear and how they look.
const PORTALS_CONFIG = {
    // Distance straight ahead from the spawn/camera where portals sit (meters)
    baseDistance: -6,
    // Horizontal spacing between left/center/right portals (meters)
    spacing: 2.2,
    // Y position of the portal group (kept at ground level)
    groundY: 0.2,
    // Small vertical offset to prevent z-fighting between ring and ground
    ringOffsetY: 0.002,
    // Continuous rotation speed of the whole portal group (radians per second)
    rotateSpeed: 0.25,
    // Draw order so the ring appears above the ground and model above the ring
    orders: { ring: 7, ground: 6, model: 8 }
}

export class Portals
{
    constructor()
    {
        this.game = Game.getInstance()
        const center = this.game.respawns.getDefault().position.clone()
        this.loader = this.game.resourcesLoader.getLoader('gltf')
        this.items = []

        // Compute orientation from current camera to place portals visibly in front
        const forward = new THREE.Vector3()
        this.game.view.camera.getWorldDirection(forward)
        forward.y = 0
        forward.normalize()
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
        const baseDistance = PORTALS_CONFIG.baseDistance
        const spacing = PORTALS_CONFIG.spacing

        const configs = [
            {
                model: '/externals/drysland/models/ship.glb',
                url: '/externals/drysland/index.html',
                position: center.clone().add(forward.clone().multiplyScalar(baseDistance)).add(right.clone().multiplyScalar(-spacing)),
                scale: 0.28
            },
            {
                model: '/externals/hook-a-fish/models/fish.glb',
                url: '/externals/hook-a-fish/index.html',
                position: center.clone().add(forward.clone().multiplyScalar(baseDistance)),
                scale: 0.35
            },
            {
                model: '/externals/elemental-serenity/models/tent.glb',
                url: '/externals/elemental-serenity/index.html',
                position: center.clone().add(forward.clone().multiplyScalar(baseDistance)).add(right.clone().multiplyScalar(spacing)),
                scale: 0.30
            }
        ]

        for(const cfg of configs)
        {
            const pos = cfg.position
            const group = new THREE.Group()
            group.position.copy(pos)
            group.position.y = PORTALS_CONFIG.groundY
            this.game.scene.add(group)

            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.95, 1.0, 48),
                new THREE.MeshBasicNodeMaterial()
            )
            ring.rotation.x = - Math.PI * 0.5
            ring.position.y = PORTALS_CONFIG.ringOffsetY
            ring.renderOrder = PORTALS_CONFIG.orders.ring

            const intensity = uniform(1)
            const progress = uniform(0)
            ring.material.outputNode = Fn(() =>
            {
                const angle = atan(positionGeometry.y, positionGeometry.x)
                const angleProgress = angle.div(PI2).add(0.5).oneMinus()
                progress.lessThan(angleProgress).discard()
                return vec4(this.game.reveal.color.mul(this.game.reveal.intensity).mul(intensity), 1)
            })()
            group.add(ring)

            const ground = new THREE.Mesh(
                new THREE.CircleGeometry(0.95, 48),
                new THREE.MeshLambertNodeMaterial()
            )
            ground.rotation.x = - Math.PI * 0.5
            ground.renderOrder = PORTALS_CONFIG.orders.ground
            group.add(ground)

            this.loader.load(
                cfg.model,
                (gltf) =>
                {
                    const root = gltf.scene
                    root.scale.setScalar(cfg.scale)
                    root.position.y = PORTALS_CONFIG.groundY
                    root.renderOrder = PORTALS_CONFIG.orders.model
                    group.add(root)
                }
            )

            const rotate = () =>
            {
                group.rotation.y += this.game.ticker.delta * PORTALS_CONFIG.rotateSpeed
            }
            this.game.ticker.events.on('tick', rotate, 9)

            const intersect = this.game.rayCursor.addIntersect({
                active: true,
                shape: new THREE.Sphere(group.position.clone(), 0.9),
                onEnter: () =>
                {
                    gsap.to(intensity, { value: 1.5, duration: 0.3, overwrite: true })
                    gsap.to(progress, { value: 1, duration: 0.8, ease: 'power2.out', overwrite: true })
                },
                onLeave: () =>
                {
                    gsap.to(intensity, { value: 1, duration: 0.3, overwrite: true })
                    gsap.to(progress, { value: 0, duration: 0.8, ease: 'power2.in', overwrite: true })
                },
                onClick: () =>
                {
                    window.location.href = cfg.url
                }
            })

            this.items.push({ group, intersect })
        }
    }
}
