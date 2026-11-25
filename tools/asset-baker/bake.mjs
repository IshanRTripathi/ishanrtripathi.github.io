#!/usr/bin/env node
// Rebuilds the CC0 models in public/models from the original packs:
// downloads them from OpenGameArt, converts and recolours them in a headless
// browser (conv.js), compresses them (scripts/optimize-models.mjs) and writes
// public/models/manifest.json.
//
//   npm install --no-save playwright && npx playwright install chromium
//   node tools/asset-baker/bake.mjs
//
// Edit RECIPE below to swap a model, a colour or a size.

import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { unzipSync } from '../../node_modules/three/examples/jsm/libs/fflate.module.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const CACHE = path.join(HERE, '.cache')
const MODELS = path.join(ROOT, 'public/models')
const OGA = 'https://opengameart.org/sites/default/files/'

// All CC0 (public domain). Credits in public/models/CREDITS.md.
const PACKS = {
    carkit: 'kenney_car-kit_3.1.zip', // Kenney, Car Kit
    chars: 'ultimate_animated_character_pack_by_quaternius.zip', // Quaternius, Ultimate Animated Character Pack
    nature: 'ultimate_nature_pack_by_quaternius_1.zip', // Quaternius, Ultimate Nature Pack
    ships: 'Ships%20by%20%40Quaternius.zip' // Quaternius, Ships
}

const CAR = 'carkit/Models/GLB format/'
const NATURE = 'nature/Ultimate Nature Pack - Jun 2019/OBJ/'
const red = 0.02
const green = 0.42
const blue = 0.62
const paint = (hue, to, baseL = 0.55) => [ { hue, range: hue === green ? 0.08 : 0.06, to, baseL } ]

const RECIPE = {
    character: {
        type: 'character',
        src: 'chars/Ultimate Animated Character Pack - Nov 2019/FBX/Casual_Male.fbx',
        colors: { Skin: '#B07B56', Face: '#2A211D', Hair: '#231A17', Shirt: '#5EC4B6', Pants: '#E9D9BC', Belt: '#3A2A20' },
        keep: [ 'Idle', 'Walk', 'SitDown', 'StandUp', 'Victory' ],
        manifest: { kind: 'character', fit: [ 1.2, 1.75, 1.2 ], yaw: 0, walkStride: 1.9, runStride: 3.2 },
        ratio: 1
    },
    'car-player': { src: CAR + 'sedan-sports.glb', repaint: paint(red, '#F2709E', 0.58), fit: [ 1.9, 1.6, 4.3 ], manifest: { id: 'car', kind: 'vehicle', fit: [ 1.9, 1.6, 4.3 ], yaw: 0, hideRider: true } },
    'traffic-1': { src: CAR + 'sedan-sports.glb', repaint: paint(red, '#74DDC0', 0.58), fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'traffic' } },
    'traffic-2': { src: CAR + 'hatchback-sports.glb', repaint: paint(green, '#F4F1EC', 0.5), fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'traffic' } },
    'traffic-3': { src: CAR + 'taxi.glb', fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'traffic' } },
    'traffic-4': { src: CAR + 'police.glb', fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'traffic' } },
    'traffic-5': { src: CAR + 'van.glb', repaint: paint(blue, '#8EC9F0'), fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'traffic' } },
    'traffic-6': { src: CAR + 'suv.glb', repaint: paint(green, '#FFB38A', 0.5), fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'traffic' } },
    'parked-1': { src: CAR + 'sedan.glb', repaint: paint(red, '#FFE27A', 0.58), fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'parked' } },
    'parked-2': { src: CAR + 'suv-luxury.glb', fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'parked' } },
    'parked-3': { src: CAR + 'hatchback-sports.glb', repaint: paint(green, '#C4A8F0', 0.5), fit: [ 1.9, 1.6, 4.3 ], manifest: { kind: 'parked' } },
    'palm-curved': { src: NATURE + 'PalmTree_1.obj', linear: true, leaves: { sat: 0.18, lift: 0.14 }, height: 1, manifest: { kind: 'instanced', target: 'palm', height: 7.6 }, ratio: 0.25, error: 0.02 },
    'palm-straight': { src: NATURE + 'PalmTree_3.obj', linear: true, leaves: { sat: 0.18, lift: 0.14 }, height: 1, manifest: { kind: 'instanced', target: 'royal', height: 8.4 }, ratio: 0.25, error: 0.02 },
    cruise: { src: 'ships/Ships by @Quaternius/OBJ/CruiseShip.obj', linear: true, height: 1, manifest: { kind: 'scenery', length: 46 } },
    // the people on the road: the same rig as the character, with each clothing part kept as its own
    // material, so a season's outfit is set in the game by colour. Skin, hair and shoes stay as they are.
    'npc-female': {
        type: 'character',
        src: 'chars/Ultimate Animated Character Pack - Nov 2019/FBX/Casual_Female.fbx',
        parts: true,
        colors: { Skin: '#B07B56', Face: '#2A211D', Hair: '#3B2A22', Shirt: '#F4B6C2', Pants: '#F3E6C9', Belt: '#3A2A20' },
        keep: [ 'Idle', 'Walk', 'SitDown', 'StandUp' ],
        manifest: { kind: 'npc', fit: [ 1.2, 1.7, 1.2 ], yaw: 0, walkStride: 1.9 },
        ratio: 1
    },
    'npc-male': {
        type: 'character',
        src: 'chars/Ultimate Animated Character Pack - Nov 2019/FBX/Casual_Male.fbx',
        parts: true,
        colors: { Skin: '#B07B56', Face: '#2A211D', Hair: '#231A17', Shirt: '#9ED5A6', Pants: '#B69D74', Belt: '#3A2A20' },
        keep: [ 'Idle', 'Walk', 'SitDown', 'StandUp' ],
        manifest: { kind: 'npc', fit: [ 1.2, 1.75, 1.2 ], yaw: 0, walkStride: 1.9 },
        ratio: 1
    }
}

// ONLY=npc-female,npc-male bakes just those entries and keeps the rest of the manifest as it was
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const WANTED = (name) => !ONLY || ONLY.includes(name)

// ------------------------------------------------------------------ download + unzip
async function fetchPacks()
{
    for(const [ name, file ] of Object.entries(PACKS))
    {
        if(ONLY && name !== 'chars') continue
        const dir = path.join(CACHE, name)
        if(fs.existsSync(dir)) continue
        console.log('downloading', decodeURIComponent(file))
        const response = await fetch(OGA + file)
        if(!response.ok) throw new Error(`Download failed (${response.status}): ${file}`)
        const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
        for(const [ entry, data ] of Object.entries(files))
        {
            if(entry.endsWith('/')) continue
            const target = path.resolve(dir, entry)
            if(!target.startsWith(dir + path.sep)) continue // ignore entries that escape the folder
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, data)
        }
    }
}

// ------------------------------------------------------------------ local server for the converter page
function serve()
{
    const three = path.join(ROOT, 'node_modules/three')
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.mtl': 'text/plain', '.obj': 'text/plain' }
    const server = http.createServer((req, res) =>
    {
        const url = decodeURIComponent(req.url.split('?')[0])
        const [ root, rel ] = url.startsWith('/three/') ? [ three, url.slice(7) ] : url.startsWith('/dl/') ? [ CACHE, url.slice(4) ] : [ HERE, url === '/' ? 'index.html' : url.slice(1) ]
        const file = path.resolve(root, rel)
        if(!file.startsWith(root)) { res.writeHead(403); return res.end() }
        fs.readFile(file, (err, data) =>
        {
            if(err) { res.writeHead(404); return res.end() }
            res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' })
            res.end(data)
        })
    })
    return new Promise((resolve) => server.listen(0, () => resolve(server)))
}

// ------------------------------------------------------------------ main
async function main()
{
    let playwright
    try { playwright = await import('playwright') }
    catch
    {
        // a global install is only visible to require()
        try { playwright = createRequire(import.meta.url)('playwright') }
        catch { throw new Error('Needs Playwright: npm install --no-save playwright && npx playwright install chromium') }
    }

    await fetchPacks()
    const server = await serve()
    const browser = await playwright.chromium.launch()
    const page = await browser.newPage()
    await page.goto(`http://localhost:${server.address().port}/`)
    await page.waitForFunction(() => window.__ready)

    const manifest = []
    fs.mkdirSync(MODELS, { recursive: true })
    for(const [ name, r ] of Object.entries(RECIPE))
    {
        if(!WANTED(name)) continue
        console.log('baking', name)
        const glb = await page.evaluate(async ({ r }) =>
        {
            if(r.type === 'character') return (await window.conv.character('/dl/' + r.src, { colors: r.colors, keep: r.keep, parts: !!r.parts })).glb
            return (await window.conv.bakeStatic('/dl/' + r.src, r)).glb
        }, { r })
        fs.writeFileSync(path.join(MODELS, name + '.glb'), Buffer.from(glb, 'base64'))
        manifest.push({ id: name, file: name + '.glb', ...r.manifest })
    }
    await browser.close()
    server.close()

    // compress: fresh originals, per-model simplification
    for(const [ name, r ] of Object.entries(RECIPE))
    {
        if(!WANTED(name)) continue
        fs.rmSync(path.join(ROOT, 'tripo/originals', name + '.glb'), { force: true })
        execFileSync('node', [ path.join(ROOT, 'scripts/optimize-models.mjs'), name, '--ratio', String(r.ratio ?? 1), '--error', String(r.error ?? 0.002) ], { stdio: 'inherit' })
    }

    // a partial bake keeps the entries it did not touch
    const previous = ONLY && fs.existsSync(path.join(MODELS, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(MODELS, 'manifest.json'), 'utf8')).models : []
    const kept = previous.filter((m) => !manifest.some((b) => b.id === m.id))
    const json = { models: ONLY ? [ ...kept, ...manifest ] : manifest }
    fs.writeFileSync(path.join(MODELS, 'manifest.json'), JSON.stringify(json, null, 2) + '\n')
    console.log(`wrote ${manifest.length} models and public/models/manifest.json`)
}

main().catch((error) =>
{
    console.error(error.message)
    process.exit(1)
})
