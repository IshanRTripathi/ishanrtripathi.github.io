import * as THREE from 'three'
import { R, frameQuaternion, surfacePoint, mapToDir } from '../core/geo.js'
import { layout } from './layout.js'
import { heightAt, padHeight } from './terrain.js'
import { scatter } from './scatter.js'
import { createTerrainMesh, createPlanetCore } from './terrainMesh.js'
import { createWater } from './water.js'
import { createSky } from './sky.js'
import { createForest, createBoats, updateWind } from './forest.js'
import { createBuilding, createStation } from './buildings.js'
import { createSignBoard, createStationNameBoard, createDeparturesBoard } from './signs.js'
import { Scooter } from './scooter.js'
import { Birds } from './birds.js'
import { projects, achievements, career, contact } from '../content.js'
import { registry } from '../models/registry.js'

const contentById = Object.fromEntries([ ...projects, achievements, career, contact ].map((c) => [ c.id, c ]))

// Place an object at map (x, z), standing on the ground, facing yaw
export function place(object, x, z, yaw, height = heightAt(x, z))
{
    object.position.copy(surfacePoint(x, z, height))
    object.quaternion.copy(frameQuaternion(x, z, yaw))
    return object
}

export class World
{
    constructor(scene)
    {
        this.scene = scene
        this.colliders = [] // { type: 'circle', x, z, r } | { type: 'box', x, z, yaw, hw, hd }
        this.interactables = [] // { id, content, x, z, radius, face }
        this.cullables = [] // objects hidden when behind the planet's curve
        this.boats = []

        this.sky = createSky()
        scene.add(this.sky)
        scene.add(createPlanetCore())
        this.terrain = createTerrainMesh()
        scene.add(this.terrain)
        this.water = createWater()
        scene.add(this.water)

        this.forest = createForest(scatter)
        scene.add(this.forest)
        for(const t of scatter.trees)
            this.colliders.push({ type: 'circle', x: t.x, z: t.z, r: (t.type === 'rain' ? 0.6 : 0.4) * t.scale })
        for(const l of scatter.lamps) this.colliders.push({ type: 'circle', x: l.x, z: l.z, r: 0.2 })
        for(const r of scatter.rocks) if(r.scale > 0.6) this.colliders.push({ type: 'circle', x: r.x, z: r.z, r: 0.35 * r.scale })

        for(const boat of createBoats(scatter))
        {
            const b = boat.userData.boat
            place(boat, b.x, b.z, b.yaw, 0)
            boat.userData.base = boat.position.clone()
            boat.userData.baseQuaternion = boat.quaternion.clone()
            scene.add(boat)
            this.boats.push(boat)
        }

        for(const site of layout.sites) this.addSite(site)

        const scooterSpot = layout.props.find((p) => p.id === 'scooter')
        this.scooter = new Scooter()
        this.scooterState = { x: scooterSpot.x, z: scooterSpot.z, yaw: scooterSpot.yaw }
        place(this.scooter.root, scooterSpot.x, scooterSpot.z, scooterSpot.yaw)
        scene.add(this.scooter.root)

        this.birds = new Birds()
        scene.add(this.birds.mesh)

        this.loadModels()
    }

    addSite(site)
    {
        const h = padHeight(site.id)
        let object
        if(site.kind === 'station')
        {
            object = createStation()
            const group = new THREE.Group()
            group.add(object)
            const board = createDeparturesBoard(career.stops)
            board.position.set(-4.6 + 2.4, 2.35, 0.33)
            board.scale.setScalar(0.62)
            group.add(board)
            const name = createStationNameBoard()
            name.position.set(-6.9, 0.55, 3.0)
            group.add(name)
            object = group
        }
        else object = createBuilding(site.kind)

        object.userData.siteId = site.id
        place(object, site.x, site.z, site.yaw, h)
        this.scene.add(object)
        site.object = object
        this.cullables.push({ object, x: site.x, z: site.z, radius: Math.max(site.w, site.d) + site.h })

        // collider covers the footprint
        if(site.kind === 'chai')
        {
            this.colliders.push({ type: 'box', x: site.x, z: site.z, yaw: site.yaw, hw: 2.2, hd: 1.4 })
            const stool = createBuilding('stool')
            place(stool, site.stool.x, site.stool.z, site.stool.yaw)
            this.scene.add(stool)
            this.stool = site.stool
        }
        else if(site.kind === 'station')
            this.colliders.push({ type: 'box', x: site.x, z: site.z, yaw: site.yaw, hw: site.w / 2 + 3, hd: site.d / 2 + 0.3 })
        else if(site.kind === 'lighthouse')
            this.colliders.push({ type: 'circle', x: site.x, z: site.z, r: 2.5 })
        else
            this.colliders.push({ type: 'box', x: site.x, z: site.z, yaw: site.yaw, hw: site.w / 2 + 0.3, hd: site.d / 2 + 0.3 })

        if(site.contentId)
        {
            const content = contentById[site.contentId]
            let face = null
            if(site.sign)
            {
                const board = createSignBoard({ title: content.place, line: content.line, accent: content.stamp })
                place(board, site.sign.x, site.sign.z, site.sign.yaw)
                this.scene.add(board)
                face = board.userData.face
                face.userData.contentId = content.id
                this.colliders.push({ type: 'box', x: site.sign.x, z: site.sign.z, yaw: site.sign.yaw, hw: 1.3, hd: 0.2, thin: true })
                this.cullables.push({ object: board, x: site.sign.x, z: site.sign.z, radius: 3 })
            }
            const at = site.sign ?? site
            this.interactables.push({ id: site.id, content, x: at.x, z: at.z, radius: 3.4, face, siteObject: object })
        }
    }

    // Swap procedural stand-ins for generated models when they exist
    async loadModels()
    {
        const loaded = await registry.loadAvailable()
        for(const { id, object } of loaded)
        {
            const site = layout.sites.find((s) => s.kind === id || s.id === id)
            if(site && site.object)
            {
                const parent = site.object
                const old = parent.isGroup ? parent.children[0] : null
                if(site.kind === 'station' && old) { old.visible = false; parent.add(object) }
                else
                {
                    const group = new THREE.Group()
                    group.add(object)
                    place(group, site.x, site.z, site.yaw, padHeight(site.id))
                    this.scene.add(group)
                    parent.visible = false
                    site.object = group
                    const c = this.cullables.find((c) => c.object === parent)
                    if(c) c.object = group
                }
            }
            if(id === 'scooter')
            {
                this.scooter.lean.children.forEach((c) => { if(c !== this.scooter.steer) c.visible = false })
                this.scooter.steer.visible = false
                this.scooter.lean.add(object)
            }
        }
    }

    update(time, dt, camera)
    {
        this.water.userData.uniforms.uTime.value = time
        updateWind(time)
        this.sky.position.copy(camera.position)

        for(const boat of this.boats)
        {
            const base = boat.userData.base
            const up = base.clone().normalize()
            const bob = Math.sin(time * 1.4 + base.x) * 0.07
            boat.position.copy(base).addScaledVector(up, bob)
            boat.quaternion.copy(boat.userData.baseQuaternion)
            boat.rotateZ(Math.sin(time * 1.1 + base.z) * 0.05)
            boat.rotateX(Math.sin(time * 0.9 + base.x) * 0.03)
        }

        this.birds.update(time, dt)
        this.cull(camera)
    }

    // Hide things the planet itself hides, so they cost nothing to draw
    cull(camera)
    {
        const camDist = camera.position.length()
        const camDir = camera.position.clone().divideScalar(camDist)
        const horizon = Math.acos(Math.min(1, R / camDist))
        for(const c of this.cullables)
        {
            const dir = mapToDir(c.x, c.z)
            const angle = Math.acos(Math.min(1, dir.dot(camDir)))
            const margin = (c.radius + 12) / R
            c.object.visible = angle < horizon + margin
        }
    }
}
