import * as THREE from 'three'
import { R, frameQuaternion, frameMatrix, surfacePoint, mapToDir } from '../core/geo.js'
import { layout } from './layout.js'
import { heightAt, padHeight, clearDistance } from './terrain.js'
import { scatter } from './scatter.js'
import { createTerrainMesh, createPlanetCore } from './terrainMesh.js'
import { createWater } from './water.js'
import { createSky } from './sky.js'
import { createRoads } from './roads.js'
import { createForest, updateWind } from './forest.js'
import { createBuilding, createFillers } from './buildings.js'
import { createSignBoard, createCareerPoster } from './signs.js'
import { createBeach, createBoat, createCarMesh } from './props.js'
import { Scooter } from './scooter.js'
import { Car } from './car.js'
import { Traffic } from './traffic.js'
import { Markers } from './markers.js'
import { Birds } from './birds.js'
import { createDetails, updateDetails } from './details.js'
import { buildAirstrip, animateAirstrip, airstripUniforms } from './airstrip.js'
import { ISLANDS, islandCoastRadius } from './islands.js'
import { buildPlane } from './plane.js'
import { buildIslandStructures } from './islandBuildings.js'
import { Flight } from '../player/flight.js'
import { projects, achievements, career, contact, arcade } from '../content.js'
import { registry, sized } from '../models/registry.js'
import { clayMaterial } from '../models/kit.js'
import { BAY_ANGLE, coastRadius, duskAt } from './layout.js'

const contentById = Object.fromEntries([ ...projects, achievements, career, contact, arcade ].map((c) => [ c.id, c ]))

// Any car body you can get into and drive: no moving parts, just a slight roll
class ShellCar
{
    constructor(mesh)
    {
        this.root = new THREE.Group()
        this.lean = new THREE.Group()
        this.root.add(this.lean)
        mesh.position.set(0, 0, 0)
        mesh.quaternion.identity()
        this.lean.add(mesh)
        this.seat = new THREE.Vector3(0.42, 0.2, -0.45)
    }

    update(dt, speed, steer, lean)
    {
        this.lean.rotation.z += (lean - this.lean.rotation.z) * Math.min(1, dt * 6)
    }
}

const CAR_HANDLING = { kind: 'car', radius: 1.0, maxSpeed: 15, reverse: 5, accel: 1.4, steer: 1.2, label: 'Drive this car', box: { hw: 0.95, hd: 2.15 }, hideRider: true }

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
        this.vehicles = [] // everything you can get into
        this.airstrips = [] // { id, name, runway, group }: the city's and each island's
        this.night = 0 // 0 (day) .. 1 (night): the runway lights brighten as it gets dark

        this.sky = createSky()
        scene.add(this.sky)
        scene.add(createPlanetCore())
        this.terrain = createTerrainMesh()
        scene.add(this.terrain)
        this.water = createWater()
        scene.add(this.water)
        scene.add(createRoads())

        // city blocks, all in one mesh
        // city blocks, one merged mesh per 48 m cell, so the camera can skip the far ones
        const blockCells = new Map()
        for(const f of scatter.fillers)
        {
            const key = Math.floor(f.x / 48) + ',' + Math.floor(f.z / 48)
            if(!blockCells.has(key)) blockCells.set(key, [])
            blockCells.get(key).push(f)
        }
        this.blocks = []
        for(const cell of blockCells.values())
        {
            const group = createFillers(cell, (f) => frameMatrix(f.x, f.z, f.yaw, heightAt(f.x, f.z) - 0.15))
            this.blocks.push(group)
            scene.add(group)
        }
        for(const f of scatter.fillers)
            this.colliders.push({ type: 'box', x: f.x, z: f.z, yaw: f.yaw, hw: f.w / 2 + 0.2, hd: f.d / 2 + 0.2 })

        this.forest = createForest(scatter)
        scene.add(this.forest)
        // the islands' landmarks: the hut, the cabin, the oasis and the tent
        const landmarks = buildIslandStructures()
        this.landmarks = landmarks.group
        scene.add(landmarks.group)
        this.colliders.push(...landmarks.colliders)
        for(const t of [ ...scatter.trees, ...scatter.streetPalms ])
            this.colliders.push({ type: 'circle', x: t.x, z: t.z, r: (t.type === 'rain' ? 0.6 : 0.35) * t.scale, thin: true })
        for(const l of scatter.lamps) this.colliders.push({ type: 'circle', x: l.x, z: l.z, r: 0.2, thin: true })
        for(const r of scatter.rocks) if(r.scale > 0.6) this.colliders.push({ type: 'circle', x: r.x, z: r.z, r: 0.35 * r.scale, thin: true })

        // lanterns, fences, stepping stones, flower beds, grass and fireflies
        this.details = createDetails(scatter, this.colliders)
        scene.add(this.details)

        scene.add(createBeach(scatter))
        for(const t of scatter.towers) this.colliders.push({ type: 'box', x: t.x, z: t.z, yaw: t.yaw, hw: 1.2, hd: 1.2 })
        for(const u of scatter.umbrellas) this.colliders.push({ type: 'circle', x: u.x, z: u.z, r: 0.25, thin: true })
        // the cars parked by the beach can be driven too
        this.parked = scatter.parkedCars.map((c, i) =>
        {
            const mesh = createCarMesh(c.paint + 2)
            const model = new ShellCar(mesh)
            this.addVehicle({ ...CAR_HANDLING, id: `parked-${i}`, model, spot: c, seat: model.seat, box: { hw: 0.95, hd: 2.1 } })
            return mesh
        })

        // the boats out on the sea: you can sail any of them
        for(const b of scatter.boats) this.addBoat(b.kind, b.x, b.z, b.yaw)

        for(const site of layout.sites) this.addSite(site)

        // the convertible and the scooter
        const carSpot = layout.props.find((p) => p.id === 'car')
        const car = new Car()
        this.addVehicle({ id: 'car', kind: 'car', model: car, spot: carSpot, radius: 1.0, maxSpeed: 17, reverse: 5, accel: 1.5, steer: 1.25, seat: car.seat, label: 'Drive the car', box: { hw: 0.95, hd: 2.15 } })
        const scooterSpot = layout.props.find((p) => p.id === 'scooter')
        const scooter = new Scooter()
        this.addVehicle({ id: 'scooter', kind: 'scooter', model: scooter, spot: scooterSpot, radius: 0.7, maxSpeed: 11, reverse: 3, accel: 2.2, steer: 1.7, seat: new THREE.Vector3(0, 0.2, -0.32), label: 'Ride the scooter', box: { hw: 0.4, hd: 1.0 } })
        this.scooter = scooter

        // the airstrips: the city's, and one on each island. Each has a plane parked at its
        // near end, ready to fly, and boats moored offshore of the islands
        const strips = [ { id: 'city', name: 'City airstrip', runway: layout.runway } ]
        for(const island of ISLANDS) strips.push({ id: island.id, name: island.name, runway: island.runway })
        this.airstrips = strips.map(({ id, name, runway }) =>
        {
            const group = buildAirstrip(runway)
            scene.add(group)
            this.cullables.push({ object: group, x: runway.mid.x, z: runway.mid.z, radius: runway.length / 2 })
            return { id, name, runway, group }
        })
        for(const strip of this.airstrips) this.addPlane(strip.id === 'city' ? 'plane' : `plane-${strip.id}`, strip.runway)
        for(const island of ISLANDS) this.moorBoats(island)

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

    // a plane parked at an airstrip's near end, facing down the strip, ready to fly
    addPlane(id, runway)
    {
        const model = buildPlane()
        const flight = new Flight(model)
        const start = runway.start
        flight.spawn = { x: start.x, z: start.z, yaw: start.yaw }
        flight.reset(start.x, start.z, start.yaw)
        const collider = { type: 'box', x: start.x, z: start.z, yaw: start.yaw, hw: 1.3, hd: 2.4, vehicle: id }
        this.colliders.push(collider)
        this.vehicles.push({
            id, kind: 'plane', model, flight, x: start.x, z: start.z, yaw: start.yaw,
            collider, radius: 2, box: { hw: 4.2, hd: 4.2 }, seat: model.seat,
            label: 'Fly the plane', hideRider: true, maxSpeed: 36, reverse: 0, accel: 1, steer: 1
        })
        this.scene.add(model.root)
        flight.apply(model.root)
    }

    // a boat you can sail: it floats on the sea, and you drive it from its deck
    addBoat(kind, x, z, yaw)
    {
        const id = `boat-${this.vehicles.length}`
        const mesh = createBoat(kind)
        const model = {
            root: mesh,
            seat: new THREE.Vector3(0, 0.5, -0.4),
            lean: { rotation: { z: 0 } },
            // the hull heels a little into a turn
            update(dt, speed, steer, lean) { this.lean.rotation.z = lean }
        }
        const collider = { type: 'box', x, z, yaw, hw: 1.6, hd: 3.2, vehicle: id }
        this.colliders.push(collider)
        const v = {
            id, kind: 'boat', model, x, z, yaw, collider, radius: 3, box: { hw: 1.6, hd: 3.2 }, seat: model.seat,
            label: kind === 'yacht' ? 'Sail the yacht' : 'Ride the speedboat', hideRider: false,
            maxSpeed: 9, reverse: 3, accel: 1.4, steer: 1.2, ridden: false
        }
        this.vehicles.push(v)
        this.scene.add(mesh)
        mesh.userData.vehicle = v
        this.boats.push(mesh)
        place(mesh, x, z, yaw, 0)
        return v
    }

    // two boats moored offshore of an island, on opposite sides, clear of its airstrip
    moorBoats(island)
    {
        const sides = [ { k: 0, kind: 'yacht' }, { k: 3, kind: 'speedboat' } ]
        for(const { k, kind } of sides)
        {
            const phi = k * Math.PI / 3 + 0.4
            const r = islandCoastRadius(island, phi) + 6.5
            const x = island.at.x + Math.cos(phi) * r
            const z = island.at.z + Math.sin(phi) * r
            if(clearDistance(x, z) < 12) continue
            this.addBoat(kind, x, z, phi + Math.PI / 2)
        }
    }

    // a traffic car close enough to get into (it stops for you if you stand in its way)
    trafficCarNear(x, z, reach = 3.4)
    {
        let best = null
        let bestD = reach
        for(const car of this.traffic.cars)
        {
            const d = Math.hypot(car.x - x, car.z - z)
            if(d < bestD && car.speed < 4) { best = car; bestD = d }
        }
        return best
    }

    // take a car out of the traffic and make it yours to drive
    takeTrafficCar(car)
    {
        const i = this.traffic.cars.indexOf(car)
        if(i < 0) return null
        this.traffic.cars.splice(i, 1)
        const model = new ShellCar(car.mesh)
        car.collider.dynamic = false
        this.takenCount = (this.takenCount || 0) + 1
        const v = { ...CAR_HANDLING, id: `taken-${this.takenCount}`, model, seat: model.seat, x: car.x, z: car.z, yaw: car.yaw, collider: car.collider }
        place(model.root, v.x, v.z, v.yaw, heightAt(v.x, v.z) + 0.05)
        this.scene.add(model.root)
        this.vehicles.push(v)
        return v
    }

    parkVehicle(v)
    {
        if(v.flight)
        {
            // the plane stays where it landed, level on its wheels
            v.flight.pitch = 0
            v.flight.bank = 0
            v.flight.apply(v.model.root)
            Object.assign(v.collider, { x: v.flight.x, z: v.flight.z, yaw: v.flight.yaw, disabled: false })
            v.x = v.flight.x
            v.z = v.flight.z
            v.yaw = v.flight.yaw
            return
        }
        Object.assign(v.collider, { x: v.x, z: v.z, yaw: v.yaw, disabled: false })
        // a boat stays on the sea, not on the seabed under it
        place(v.model.root, v.x, v.z, v.yaw, (v.kind === 'boat' ? 0 : heightAt(v.x, v.z)) + 0.05)
        v.model.lean.rotation.z = 0
    }

    addSite(site)
    {
        const h = padHeight(site.id)
        const content = site.contentId ? contentById[site.contentId] : null
        let object
        if(site.kind === 'cinema')
        {
            object = createBuilding('cinema', { marquee: 'Now showing: the career of Ishan R Tripathi', dusk: duskAt(site.x, site.z) })
            const poster = createCareerPoster(career.stops)
            const a = object.userData.posterAnchor
            poster.position.set(a.x, a.y, a.z)
            object.add(poster)
        }
        else object = createBuilding(site.kind, { sign: content ? content.title : null, dusk: duskAt(site.x, site.z) })

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
            // the arcade has no board: its marker stands at the door
            if(!site.sign && site.door) markerAt = { x: site.door.x, z: site.door.z }
            const at = site.sign ?? site
            this.interactables.push({ id: site.id, content, x: at.x, z: at.z, radius: 3.4, face, siteObject: object, markerAt })
        }
    }

    // Swap procedural stand-ins for real models when they exist
    async loadModels()
    {
        const loaded = await registry.loadAvailable()
        const CAR_FIT = { fit: [ 1.9, 1.6, 4.3 ] }
        const traffic = loaded.filter((m) => m.kind === 'traffic' && m.geometry).map((m) => sized(m.geometry, m.entry.fit ? m.entry : CAR_FIT))
        const parked = loaded.filter((m) => m.kind === 'parked' && m.geometry).map((m) => sized(m.geometry, m.entry.fit ? m.entry : CAR_FIT))
        if(traffic.length) this.traffic.cars.forEach((car, i) => { car.mesh.geometry = traffic[i % traffic.length] })
        if(parked.length) this.parked.forEach((mesh, i) => { mesh.geometry = parked[i % parked.length] })

        for(const m of loaded)
        {
            const { id, kind, entry, object } = m
            if(kind === 'instanced' && m.geometry)
            {
                // every cell's mesh of that type takes the model
                const targets = this.forest.userData.byType?.[entry.target] || []
                if(targets.length)
                {
                    const geometry = sized(m.geometry, { height: entry.height || 7 })
                    for(const target of targets)
                    {
                        target.geometry = geometry
                        target.computeBoundingSphere()
                    }
                }
            }
            else if(kind === 'scenery' && id === 'cruise' && m.geometry)
            {
                // a cruise ship anchored out beyond the bay
                const ship = new THREE.Mesh(sized(m.geometry, { length: entry.length || 40 }), clayMaterial)
                ship.castShadow = true
                const phi = BAY_ANGLE + 0.32
                const r = coastRadius(phi) + 42
                place(ship, Math.cos(phi) * r, Math.sin(phi) * r, phi + Math.PI / 2, -0.6)
                ship.userData.base = ship.position.clone()
                ship.userData.baseQuaternion = ship.quaternion.clone()
                this.scene.add(ship)
                this.boats.push(ship)
            }
            else if(kind === 'vehicle')
            {
                const vehicle = this.vehicles.find((v) => v.id === id)
                if(!vehicle) continue
                vehicle.model.lean.children.forEach((c) => { c.visible = false })
                if(vehicle.model.wheels) vehicle.model.wheels.forEach((w) => { w.visible = false })
                if(vehicle.model.steer) vehicle.model.steer.visible = false
                vehicle.model.lean.add(object)
                vehicle.hideRider = !!entry.hideRider
            }
            else if(kind === 'site')
            {
                const site = layout.sites.find((s) => s.kind === id || s.id === id)
                if(!site || !site.object) continue
                const parent = site.object
                // keep the stand-in's signs (neon names, posters), hide its building
                if(parent.userData.clay) parent.userData.clay.visible = false
                parent.add(object)
            }
        }
    }

    update(time, dt, camera, obstacles = [])
    {
        this.water.userData.uniforms.uTime.value = time
        // the airstrips: the lights run on the shared clock, the windsocks turn with the wind
        airstripUniforms.uTime.value = time
        airstripUniforms.uNight.value = this.night
        // pixels per metre at one metre away, so a light keeps its size on screen
        if(this.renderer)
        {
            const size = this.renderer.getDrawingBufferSize(this._size || (this._size = new THREE.Vector2()))
            airstripUniforms.uScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
        }
        for(const strip of this.airstrips) animateAirstrip(strip.group, time)
        // from far out, over the whole planet, the small things are too small to see: skip them
        const far = camera.position.length() > R * 1.6
        if(far !== this.farView)
        {
            this.farView = far
            for(const g of [ this.forest, this.details, this.landmarks, ...(this.blocks || []) ]) if(g) g.visible = !far
        }
        updateWind(time)
        this.sky.position.copy(camera.position)

        for(const boat of this.boats)
        {
            // a boat a visitor is sailing is placed by the player; the rest bob where they are
            const v = boat.userData.vehicle
            if(v)
            {
                if(v.ridden) continue
                place(boat, v.x, v.z, v.yaw, Math.sin(time * 1.4 + v.x) * 0.07)
                boat.rotateZ(Math.sin(time * 1.1 + v.z) * 0.05)
                boat.rotateX(Math.sin(time * 0.9 + v.x) * 0.03)
                continue
            }
            const base = boat.userData.base
            const up = base.clone().normalize()
            const bob = Math.sin(time * 1.4 + base.x) * 0.07
            boat.position.copy(base).addScaledVector(up, bob)
            boat.quaternion.copy(boat.userData.baseQuaternion)
            boat.rotateZ(Math.sin(time * 1.1 + base.z) * 0.05)
            boat.rotateX(Math.sin(time * 0.9 + base.x) * 0.03)
        }

        // traffic also stops for any car left on the road
        this.traffic.update(dt, [ ...obstacles, ...this.vehicles.filter((v) => !v.collider.disabled) ])
        this.birds.update(time, dt)
        updateDetails(this.details, time, camera, this.renderer)
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
