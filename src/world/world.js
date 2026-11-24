import * as THREE from 'three'
import { R, frameQuaternion, frameMatrix, surfacePoint, mapToDir } from '../core/geo.js'
import { layout } from './layout.js'
import { heightAt, padHeight } from './terrain.js'
import { scatter } from './scatter.js'
import { createTerrainMesh, createPlanetCore } from './terrainMesh.js'
import { createWater } from './water.js'
import { createSky } from './sky.js'
import { createRoads } from './roads.js'
import { createForest, updateWind } from './forest.js'
import { createBuilding, createFillers } from './buildings.js'
import { createSignBoard, createCareerPoster } from './signs.js'
import { createBeach, createBoat } from './props.js'
import { Scooter } from './scooter.js'
import { Car } from './car.js'
import { Traffic } from './traffic.js'
import { Markers } from './markers.js'
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
        scene.add(createRoads())

        // city blocks, all in one mesh
        const fillers = createFillers(scatter.fillers, (f) => frameMatrix(f.x, f.z, f.yaw, heightAt(f.x, f.z) - 0.15))
        scene.add(fillers)
        for(const f of scatter.fillers)
            this.colliders.push({ type: 'box', x: f.x, z: f.z, yaw: f.yaw, hw: f.w / 2 + 0.2, hd: f.d / 2 + 0.2 })

        this.forest = createForest(scatter)
        scene.add(this.forest)
        for(const t of [ ...scatter.trees, ...scatter.streetPalms ])
            this.colliders.push({ type: 'circle', x: t.x, z: t.z, r: (t.type === 'rain' ? 0.6 : 0.35) * t.scale, thin: true })
        for(const l of scatter.lamps) this.colliders.push({ type: 'circle', x: l.x, z: l.z, r: 0.2, thin: true })
        for(const r of scatter.rocks) if(r.scale > 0.6) this.colliders.push({ type: 'circle', x: r.x, z: r.z, r: 0.35 * r.scale, thin: true })

        scene.add(createBeach(scatter))
        for(const t of scatter.towers) this.colliders.push({ type: 'box', x: t.x, z: t.z, yaw: t.yaw, hw: 1.2, hd: 1.2 })
        for(const u of scatter.umbrellas) this.colliders.push({ type: 'circle', x: u.x, z: u.z, r: 0.25, thin: true })
        for(const c of scatter.parkedCars) this.colliders.push({ type: 'box', x: c.x, z: c.z, yaw: c.yaw, hw: 0.95, hd: 2.1 })

        for(const b of scatter.boats)
        {
            const boat = createBoat(b.kind)
            place(boat, b.x, b.z, b.yaw, 0)
            boat.userData.base = boat.position.clone()
            boat.userData.baseQuaternion = boat.quaternion.clone()
            scene.add(boat)
            this.boats.push(boat)
        }

        for(const site of layout.sites) this.addSite(site)

        // vehicles you can take: the convertible and the scooter
        this.vehicles = []
        const carSpot = layout.props.find((p) => p.id === 'car')
        const car = new Car()
        this.addVehicle({ id: 'car', kind: 'car', model: car, spot: carSpot, radius: 1.0, maxSpeed: 17, reverse: 5, accel: 1.5, steer: 1.25, seat: car.seat, label: 'Drive the convertible', box: { hw: 0.95, hd: 2.15 } })
        const scooterSpot = layout.props.find((p) => p.id === 'scooter')
        const scooter = new Scooter()
        this.addVehicle({ id: 'scooter', kind: 'scooter', model: scooter, spot: scooterSpot, radius: 0.7, maxSpeed: 11, reverse: 3, accel: 2.2, steer: 1.7, seat: new THREE.Vector3(0, 0.2, -0.32), label: 'Ride the scooter', box: { hw: 0.4, hd: 1.0 } })
        this.scooter = scooter

        // traffic on the loop road
        this.traffic = new Traffic(scatter.loop, 5)
        for(const c of this.traffic.cars)
        {
            scene.add(c.mesh)
            this.colliders.push(c.collider)
        }

        this.markers = new Markers(this.interactables)
        scene.add(this.markers.group)

        this.birds = new Birds()
        scene.add(this.birds.mesh)

        this.loadModels()
    }

    addVehicle(v)
    {
        v.x = v.spot.x
        v.z = v.spot.z
        v.yaw = v.spot.yaw
        v.collider = { type: 'box', x: v.x, z: v.z, yaw: v.yaw, hw: v.box.hw, hd: v.box.hd, vehicle: v.id }
        this.colliders.push(v.collider)
        place(v.model.root, v.x, v.z, v.yaw, heightAt(v.x, v.z) + 0.05)
        this.scene.add(v.model.root)
        this.vehicles.push(v)
    }

    parkVehicle(v)
    {
        Object.assign(v.collider, { x: v.x, z: v.z, yaw: v.yaw, disabled: false })
        place(v.model.root, v.x, v.z, v.yaw, heightAt(v.x, v.z) + 0.05)
        v.model.lean.rotation.z = 0
    }

    addSite(site)
    {
        const h = padHeight(site.id)
        const content = site.contentId ? contentById[site.contentId] : null
        let object
        if(site.kind === 'cinema')
        {
            object = createBuilding('cinema', { marquee: 'Now showing: the career of Ishan R Tripathi' })
            const poster = createCareerPoster(career.stops)
            const a = object.userData.posterAnchor
            poster.position.set(a.x, a.y, a.z)
            object.add(poster)
        }
        else object = createBuilding(site.kind, { sign: content ? content.title : null })

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
        else if(site.kind === 'lighthouse')
            this.colliders.push({ type: 'circle', x: site.x, z: site.z, r: 2.5 })
        else
            this.colliders.push({ type: 'box', x: site.x, z: site.z, yaw: site.yaw, hw: site.w / 2 + 0.3, hd: site.d / 2 + 0.3 })

        if(content)
        {
            let face = null
            let markerAt = null
            if(site.sign)
            {
                const board = createSignBoard({ title: content.place, line: content.line })
                place(board, site.sign.x, site.sign.z, site.sign.yaw)
                this.scene.add(board)
                face = board.userData.face
                face.userData.contentId = content.id
                this.colliders.push({ type: 'box', x: site.sign.x, z: site.sign.z, yaw: site.sign.yaw, hw: 1.3, hd: 0.2, thin: true })
                this.cullables.push({ object: board, x: site.sign.x, z: site.sign.z, radius: 3 })
                // the marker stands in front of the board
                markerAt = { x: site.sign.x + Math.sin(site.sign.yaw) * 1.7, z: site.sign.z + Math.cos(site.sign.yaw) * 1.7 }
            }
            const at = site.sign ?? site
            this.interactables.push({ id: site.id, content, x: at.x, z: at.z, radius: 3.4, face, siteObject: object, markerAt })
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
                // keep the stand-in's signs (neon names, posters), hide its building
                if(parent.userData.clay) parent.userData.clay.visible = false
                parent.children.forEach((c) => { if(c.material === parent.userData.clay?.material) c.visible = false })
                parent.add(object)
            }
            const vehicle = this.vehicles.find((v) => v.id === id)
            if(vehicle)
            {
                vehicle.model.lean.children.forEach((c) => { c.visible = false })
                if(vehicle.model.wheels) vehicle.model.wheels.forEach((w) => { w.visible = false })
                if(vehicle.model.steer) vehicle.model.steer.visible = false
                vehicle.model.lean.add(object)
            }
        }
    }

    update(time, dt, camera, obstacles = [])
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

        this.traffic.update(dt, obstacles)
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
