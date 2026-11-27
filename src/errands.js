// Errands: small side missions around the islands. The logic lives here with no DOM and no
// three.js, so it can be tested in node. main.js hands update() a snapshot of the world each
// frame, and the arcade and the buildings report their own events. Progress is saved in the
// browser, and a missing or blocked localStorage only means it is kept for this visit.
//
// The snapshot `world` that update() reads:
//   player      the player (src/player/player.js): x, z, mode ('walk', 'ride', 'sit', ...), speed and vehicle
//   vehicles    world.vehicles: each with a kind, and a flight (x, z, v, onGround, crashed) for a plane
//   airstrips   world.airstrips: each with an id and a runway (mid, t, length, width)
//   landmarks   landmarksOf(ISLANDS, structureSpots): each { key, x, z }
//   boards      boardsOf(ISLANDS, signSpots): each { island, x, z }, where island is the island's id
//   lighthouses lighthousesOf(layout.sites, ISLANDS, structureSpots): each { key, x, z }
//
// The goals that follow the size of the world (how many islands, how many arcade games) are given
// to the constructor, so no errand hard-codes those counts.

const KEY = 'ishanr-errands'
const CITY = 'city'
// how close on foot or in a vehicle counts as having found a landmark or a lighthouse, in metres
const NEAR = 8
// how close on foot or in a vehicle counts as having read a notice board, in metres
const READ = 6
// a plane is parked once it has stopped rolling: under 1 metre a second, as the game calls a stop
const PARKED = 1
// a landing counts a little past the painted strip, as the wheels can overhang its edge
const STRIP_MARGIN = 2
// how often progress is written while it is changing, in seconds
const SAVE_EVERY = 2
const NONE = Object.freeze([])

function best(scores)
{
    let top = 0
    for(const id in scores) if(scores[id] > top) top = scores[id]
    return top
}

// a count of things in the world, as a goal: at least one, and a whole number
const atLeastOne = (n) => Math.max(1, Math.floor(Number(n)) || 1)

// the errands, in the order they are offered. measure(state) reads the saved state only.
// `islands` and `games` are the counts of the world's islands and arcade games, which set two goals.
export function errandList({ islands, games } = {})
{
    return [
        { id: 'hopper', title: 'Island hopper', text: 'Land a plane on three different islands.', goal: 3, unit: '', measure: (s) => s.landed.length },
        { id: 'sightseer', title: 'Sightseer', text: 'Find four landmarks out on the islands.', goal: 4, unit: '', measure: (s) => s.landmarks.length },
        { id: 'captain', title: 'Captain for an afternoon', text: 'Sail a boat for 300 metres.', goal: 300, unit: 'm', measure: (s) => Math.floor(s.sailed) },
        { id: 'roadtrip', title: 'Road trip', text: 'Drive 400 metres in a car or on the scooter.', goal: 400, unit: 'm', measure: (s) => Math.floor(s.driven) },
        { id: 'doors', title: 'Door knocker', text: 'Go inside three different buildings.', goal: 3, unit: '', measure: (s) => s.inside.length },
        { id: 'arcade', title: 'Arcade regular', text: 'Play four different games in the Game Arcade.', goal: 4, unit: '', measure: (s) => s.played.length },
        { id: 'highscore', title: 'High score', text: 'Score 50 or more in any arcade game.', goal: 50, unit: 'pts', measure: (s) => best(s.scores) },
        { id: 'postcards', title: 'Postcard collector', text: 'Read the notice boards on four different islands.', goal: 4, unit: '', measure: (s) => s.postcards.length },
        // the airstrips that were landed on, less the city's: the same set hopper counts
        { id: 'worldtour', title: 'World tour', text: 'Land a plane on every island.', goal: atLeastOne(islands), unit: '', measure: (s) => s.landed.filter((id) => id !== CITY).length },
        { id: 'lighthouse', title: 'Keep the lights on', text: 'Visit two lighthouses.', goal: 2, unit: '', measure: (s) => s.lighthouses.length },
        { id: 'seat', title: 'Take a seat', text: 'Sit down on the stool at the chai shack.', goal: 1, unit: '', measure: (s) => (s.seated ? 1 : 0) },
        // the arcade games started: the same set the arcade errand counts
        { id: 'fullarcade', title: 'Full arcade', text: 'Play every game in the Game Arcade.', goal: atLeastOne(games), unit: '', measure: (s) => s.played.length }
    ]
}

// localStorage, if the browser gives it: reading the property itself can throw when storage is blocked
function storage()
{
    try { return globalThis.localStorage ?? null }
    catch { return null }
}

function freshState()
{
    return { landed: [], landmarks: [], sailed: 0, driven: 0, inside: [], played: [], scores: {}, done: [], postcards: [], lighthouses: [], seated: false }
}

// takes what was saved, keeping only what this version of the errands can read. A save from before
// an errand existed has no record for it, so its set starts empty.
function restore(state, raw, list)
{
    if(!raw || typeof raw !== 'object') return
    const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
    const amount = (v) => (Number.isFinite(v) && v > 0 ? v : 0)
    state.landed = ids(raw.landed)
    state.landmarks = ids(raw.landmarks)
    state.sailed = amount(raw.sailed)
    state.driven = amount(raw.driven)
    state.inside = ids(raw.inside)
    state.played = ids(raw.played)
    state.scores = {}
    if(raw.scores && typeof raw.scores === 'object')
        for(const [ id, v ] of Object.entries(raw.scores)) if(amount(v)) state.scores[id] = v
    state.postcards = ids(raw.postcards)
    state.lighthouses = ids(raw.lighthouses)
    state.seated = raw.seated === true
    state.done = ids(raw.done).filter((id) => list.some((e) => e.id === id))
}

// the id of the airstrip a point is on, or null: within its length and width, plus a small margin
function stripAt(strips, x, z)
{
    for(const strip of strips)
    {
        const r = strip.runway
        const dx = x - r.mid.x
        const dz = z - r.mid.z
        const along = dx * r.t.x + dz * r.t.z
        const across = dz * r.t.x - dx * r.t.z
        if(Math.abs(along) <= r.length / 2 + STRIP_MARGIN && Math.abs(across) <= r.width / 2 + STRIP_MARGIN) return strip.id
    }
    return null
}

// the landmarks on the islands, each with a key that names it: island, kind and place
export function landmarksOf(islands, spotsOf)
{
    const out = []
    for(const island of islands)
        for(const spot of spotsOf(island))
            out.push({ key: `${island.id}:${spot.kind}:${spot.x.toFixed(0)}:${spot.z.toFixed(0)}`, x: spot.x, z: spot.z })
    return out
}

// the notice boards on the islands: each one's island id, and where it stands
export function boardsOf(islands, signsOf)
{
    const out = []
    for(const island of islands)
        for(const sign of signsOf(island))
            out.push({ island: island.id, x: sign.x, z: sign.z })
    return out
}

// the lighthouses, each with a key that names it: the city's headland one, and any lighthouse
// structure on an island (keyed the same way as a landmark)
export function lighthousesOf(sites, islands, spotsOf)
{
    const out = []
    for(const site of sites)
        if(site.kind === 'lighthouse') out.push({ key: `city:${site.id}`, x: site.x, z: site.z })
    for(const island of islands)
        for(const spot of spotsOf(island))
            if(spot.kind === 'lighthouse') out.push({ key: `${island.id}:${spot.kind}:${spot.x.toFixed(0)}:${spot.z.toFixed(0)}`, x: spot.x, z: spot.z })
    return out
}

// progress as it reads on screen: '2 of 3', '120 of 300m', '30 of 50 pts'
export function progressText(e)
{
    const unit = e.unit.length > 1 ? ` ${e.unit}` : e.unit
    return `${e.value} of ${e.goal}${unit}`
}

export class Errands
{
    // sizes: { islands, games }, the counts of the world's islands and arcade games
    constructor(sizes = {})
    {
        this.state = freshState()
        // the errands for this world, in the order they are offered
        this.list = errandList(sizes)
        // not saved: which planes are in the air right now, so a landing can be told from a parked plane
        this.flying = new WeakSet()
        this.clock = 0
        this.savedAt = 0
        this.dirty = false
        try
        {
            const raw = storage()?.getItem(KEY)
            if(raw) restore(this.state, JSON.parse(raw), this.list)
        }
        catch {}
    }

    save()
    {
        this.dirty = false
        this.savedAt = this.clock
        try { storage()?.setItem(KEY, JSON.stringify(this.state)) }
        catch {}
    }

    // every frame in the city: measure the moving things, then report any errand that has just reached its goal
    update(dt, world)
    {
        const s = this.state
        const p = world.player
        let changed = false

        // sailing and driving: the metres covered, at the speed the vehicle is going
        if(p.mode === 'ride' && p.vehicle)
        {
            const kind = p.vehicle.kind
            const metres = Math.abs(p.speed) * dt
            if(metres > 0 && kind === 'boat') { s.sailed += metres; changed = true }
            else if(metres > 0 && (kind === 'car' || kind === 'scooter')) { s.driven += metres; changed = true }
        }

        // on foot or in a vehicle, close enough to a landmark, a notice board or a lighthouse
        if(p.mode === 'walk' || p.mode === 'ride')
        {
            for(const lm of world.landmarks)
            {
                if(Math.hypot(lm.x - p.x, lm.z - p.z) <= NEAR && !s.landmarks.includes(lm.key))
                {
                    s.landmarks.push(lm.key)
                    changed = true
                }
            }
            // a notice board counts its island once: postcards holds island ids
            for(const board of world.boards)
            {
                if(Math.hypot(board.x - p.x, board.z - p.z) <= READ && !s.postcards.includes(board.island))
                {
                    s.postcards.push(board.island)
                    changed = true
                }
            }
            for(const lh of world.lighthouses)
            {
                if(Math.hypot(lh.x - p.x, lh.z - p.z) <= NEAR && !s.lighthouses.includes(lh.key))
                {
                    s.lighthouses.push(lh.key)
                    changed = true
                }
            }
        }

        // sitting down: the player's mode is 'sit' while seated on a stool
        if(p.mode === 'sit' && !s.seated) { s.seated = true; changed = true }

        // a landing: a plane that has been in the air and is now stopped on an island's strip
        for(const v of world.vehicles)
        {
            const f = v.flight
            if(v.kind !== 'plane' || !f) continue
            // a crash does not count, and the plane is put back at its own strip afterwards
            if(f.crashed > 0) { this.flying.delete(f); continue }
            if(!f.onGround) { this.flying.add(f); continue }
            if(this.flying.has(f) && Math.abs(f.v) < PARKED)
            {
                this.flying.delete(f)
                const strip = stripAt(world.airstrips, f.x, f.z)
                if(strip && strip !== CITY && !s.landed.includes(strip)) { s.landed.push(strip); changed = true }
            }
        }

        if(changed) this.dirty = true
        const completed = []
        for(const e of this.list)
        {
            if(s.done.includes(e.id) || e.measure(s) < e.goal) continue
            s.done.push(e.id)
            completed.push(e)
        }

        this.clock += dt
        if(completed.length || (this.dirty && this.clock - this.savedAt >= SAVE_EVERY)) this.save()
        return completed.length ? completed : NONE
    }

    // a building was entered: each one counts once. Returns true when it is new.
    enterSite(id)
    {
        return this.record(this.state.inside, id)
    }

    // an arcade game was started: each game counts once. Returns true when it is new.
    playedGame(id)
    {
        return this.record(this.state.played, id)
    }

    // a game ended with a score: the best score for that game is kept. Returns true when it beats the old best.
    gameOver(id, score)
    {
        const n = Math.floor(Number(score))
        if(typeof id !== 'string' || !id || !Number.isFinite(n) || n <= 0) return false
        const scores = this.state.scores
        const before = Object.prototype.hasOwnProperty.call(scores, id) ? scores[id] : 0
        if(n <= before) return false
        scores[id] = n
        this.save()
        return true
    }

    record(list, id)
    {
        if(typeof id !== 'string' || !id || list.includes(id)) return false
        list.push(id)
        this.save()
        return true
    }

    // the errand as the screen shows it: its value is capped at the goal
    entry(e)
    {
        return { id: e.id, title: e.title, text: e.text, goal: e.goal, unit: e.unit, value: Math.min(e.goal, e.measure(this.state)), done: this.state.done.includes(e.id) }
    }

    summary()
    {
        return this.list.map((e) => this.entry(e))
    }

    // the first errand not yet done, or null when they are all done
    current()
    {
        const e = this.list.find((x) => !this.state.done.includes(x.id))
        return e ? this.entry(e) : null
    }

    allDone()
    {
        return this.list.every((e) => this.state.done.includes(e.id))
    }
}
