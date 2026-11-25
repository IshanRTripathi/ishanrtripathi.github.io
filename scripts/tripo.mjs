#!/usr/bin/env node
// Tripo helper for the island's 3D models.
//
//   npm run tripo                      dry run for every job: what it makes and what it costs
//   npm run tripo -- plan tiffin       dry run for some jobs
//   npm run tripo -- run tiffin --yes  spend credits and run them
//   npm run tripo -- approve tiffin    you looked at the image, continue to 3D next run
//   npm run tripo -- redo tiffin image forget a step (and everything after it) to make it again
//   npm run tripo -- balance           credits left
//
// The key comes from TRIPO_API_KEY (environment or .env.local), never from code.
// Nothing is spent without --yes. Finished steps are skipped. Task ids live in
// tripo/state.json, raw downloads in tripo/out/, final models in public/models/.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JOBS, MODELS } from '../tripo/jobs.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://openapi.tripo3d.ai/v3'
const STATE_FILE = path.join(ROOT, 'tripo/state.json')
const OUT_DIR = path.join(ROOT, 'tripo/out')
const MODELS_DIR = path.join(ROOT, 'public/models')
const MANIFEST = path.join(MODELS_DIR, 'manifest.json')
const FINAL = new Set([ 'success', 'failed', 'cancelled', 'banned', 'expired' ])

// ------------------------------------------------------------------ key
function readKey()
{
    if(process.env.TRIPO_API_KEY) return process.env.TRIPO_API_KEY.trim()
    for(const file of [ '.env.local', '.env' ])
    {
        const p = path.join(ROOT, file)
        if(!fs.existsSync(p)) continue
        for(const line of fs.readFileSync(p, 'utf8').split(/\r?\n/))
        {
            const m = line.match(/^\s*TRIPO_API_KEY\s*=\s*"?([^"\s]+)"?\s*$/)
            if(m) return m[1]
        }
    }
    return null
}

// ------------------------------------------------------------------ state
const loadJSON = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback)
const saveJSON = (file, data) =>
{
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}
const state = loadJSON(STATE_FILE, { jobs: {} })
const jobState = (id) => (state.jobs[id] ??= { steps: [] })
const saveState = () => saveJSON(STATE_FILE, state)

// ------------------------------------------------------------------ costs
// Credits per step (developers.tripo3d.ai/en/pricing, checked Nov 2026). 1 credit = $0.01.
function cost(step, job)
{
    switch(step.type)
    {
        case 'text_to_image': return 5
        case 'image_to_image': return 5
        case 'image_to_model':
        {
            const texture = { fast: 30, standard: 30, detailed: 40, extreme: 50 }[step.texture_quality || 'standard'] ?? 30
            return texture + (step.geometry_quality === 'detailed' ? 20 : 0)
        }
        case 'rig_check': return 0
        case 'rig': return 25
        case 'retarget': return 10 * Object.keys(step.animations).length
        default: return 0
    }
    void job
}

function describe(step, job)
{
    switch(step.type)
    {
        case 'text_to_image': return `text to image (${MODELS.textImage})`
        case 'image_to_image': return `image from your photos (${MODELS.image}, ${job.photos.length} photos)`
        case 'review': return 'stop so you can look at the image'
        case 'image_to_model': return `image to 3D (H3.1, ${step.texture_quality} texture, ${step.geometry_quality} geometry)`
        case 'rig_check': return 'check the model can be rigged'
        case 'rig': return `auto-rig as a ${step.rig_type}`
        case 'retarget': return `animations: ${Object.keys(step.animations).join(', ')}`
        default: return step.type
    }
}

// ------------------------------------------------------------------ http
async function api(key, method, url, body, isForm = false)
{
    for(let attempt = 0; attempt < 6; attempt++)
    {
        const response = await fetch(API + url, {
            method,
            headers: { Authorization: `Bearer ${key}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? (isForm ? body : JSON.stringify(body)) : undefined
        })
        if(response.status === 429)
        {
            const wait = Number(response.headers.get('retry-after') || 5)
            console.log(`  rate limited, waiting ${wait}s`)
            await sleep(wait * 1000)
            continue
        }
        const json = await response.json().catch(() => ({}))
        if(!response.ok || json.code !== 0)
            throw new Error(`Tripo ${method} ${url} failed (${response.status}, code ${json.code}): ${json.message || 'no message'}${json.suggestion ? '. ' + json.suggestion : ''}`)
        return json.data
    }
    throw new Error('Tripo kept rate limiting; try again later')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function upload(key, file)
{
    const data = fs.readFileSync(file)
    const form = new FormData()
    const type = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    form.append('file', new Blob([ data ], { type }), path.basename(file))
    const result = await api(key, 'POST', '/files', form, true)
    return result.file_token
}

async function waitFor(key, taskId)
{
    let last = -1
    for(;;)
    {
        const task = await api(key, 'GET', `/tasks/${taskId}`)
        if(task.progress !== last && task.progress !== undefined)
        {
            process.stdout.write(`\r  ${task.status} ${task.progress}%   `)
            last = task.progress
        }
        if(FINAL.has(task.status))
        {
            process.stdout.write('\n')
            if(task.status !== 'success') throw new Error(`Task ${taskId} ${task.status}: ${task.error_message || task.error_code || ''}`)
            return task
        }
        await sleep(2000)
    }
}

async function download(url, file)
{
    const response = await fetch(url)
    if(!response.ok) throw new Error(`Download failed (${response.status}) for ${file}`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    return path.relative(ROOT, file)
}

// ------------------------------------------------------------------ steps
function placeholders(job)
{
    return job.steps.flatMap((s) => (s.prompt ? s.prompt.match(/\[[A-Za-z][^\]]*\]/g) || [] : []))
}

function missingPhotos(job)
{
    return (job.photos || []).filter((p) => !fs.existsSync(path.join(ROOT, p)))
}

// index of the first step that hasn't finished, or -1
function nextStep(job)
{
    const s = jobState(job.id)
    for(let i = 0; i < job.steps.length; i++)
    {
        const done = s.steps[i]
        if(!done || !done.done) return i
    }
    return -1
}

async function runStep(key, job, i)
{
    const step = job.steps[i]
    const s = jobState(job.id)
    const previous = s.steps.slice(0, i).reverse().find((x) => x && x.taskId)
    const dir = path.join(OUT_DIR, job.id)
    const record = (data) => { s.steps[i] = { type: step.type, done: true, at: new Date().toISOString(), ...data }; saveState() }

    if(step.type === 'review')
    {
        if(s.approved) return record({})
        const image = s.steps.slice(0, i).reverse().find((x) => x && x.image)
        console.log(`  look at ${image ? image.image : 'the image'}; if it is good: npm run tripo -- approve ${job.id}`)
        return 'paused'
    }

    let taskId
    if(step.type === 'text_to_image')
        taskId = (await api(key, 'POST', '/generation/text-to-image', { prompt: step.prompt, model: MODELS.textImage })).task_id
    else if(step.type === 'image_to_image')
    {
        const tokens = []
        for(const photo of job.photos) tokens.push(await upload(key, path.join(ROOT, photo)))
        taskId = (await api(key, 'POST', '/generation/image-to-image', { prompt: step.prompt, model: MODELS.image, inputs: tokens })).task_id
    }
    else if(step.type === 'image_to_model')
    {
        // chain from the image task; if it is too old to reuse, upload the saved image
        const image = s.steps.slice(0, i).reverse().find((x) => x && x.image)
        let input = image.taskId
        if(Date.now() - new Date(image.at).getTime() > 6 * 24 * 3600 * 1000) input = await upload(key, path.join(ROOT, image.image))
        taskId = (await api(key, 'POST', '/generation/image-to-model', {
            model: MODELS.mesh, input, texture: true, pbr: true,
            texture_quality: step.texture_quality, geometry_quality: step.geometry_quality
        })).task_id
    }
    else if(step.type === 'rig_check')
        taskId = (await api(key, 'POST', '/animations/rig-check', { input: previous.taskId })).task_id
    else if(step.type === 'rig')
    {
        const model = s.steps.slice(0, i).reverse().find((x) => x && x.type === 'image_to_model')
        taskId = (await api(key, 'POST', '/animations/rig', { input: model.taskId, model: MODELS.rig, rig_type: step.rig_type, spec: step.spec, out_format: 'glb' })).task_id
    }
    else if(step.type === 'retarget')
    {
        const rig = s.steps.slice(0, i).reverse().find((x) => x && x.type === 'rig')
        const files = {}
        // one task per animation keeps file names and clips unambiguous
        for(const [ name, preset ] of Object.entries(step.animations))
        {
            console.log(`  ${name} (${preset})`)
            const id = (await api(key, 'POST', '/animations/retarget', { input: rig.taskId, animation: preset, out_format: 'glb', animate_in_place: true })).task_id
            const task = await waitFor(key, id)
            const url = task.output.model_url || (task.output.model_urls || [])[0]
            files[name] = { taskId: id, file: await download(url, path.join(dir, `anim-${name}.glb`)) }
        }
        return record({ animations: files })
    }

    console.log(`  task ${taskId}`)
    const task = await waitFor(key, taskId)
    const out = task.output || {}
    if(step.type === 'rig_check')
    {
        if(out.riggable === false) throw new Error('Tripo says this model cannot be rigged. Try another image (A-pose, arms away from the body).')
        return record({ taskId, riggable: out.riggable, rigType: out.rig_type })
    }
    if(out.generated_image_url)
    {
        const image = await download(out.generated_image_url, path.join(dir, `${i}-${step.type}.png`))
        s.approved = false
        return record({ taskId, image, credits: task.credits_consumed })
    }
    const url = out.model_url || out.pbr_model || out.model
    const model = url ? await download(url, path.join(dir, `${i}-${step.type}.glb`)) : null
    if(out.rendered_image_url) await download(out.rendered_image_url, path.join(dir, `${i}-${step.type}-preview.png`)).catch(() => {})
    return record({ taskId, model, credits: task.credits_consumed })
}

// Copy the finished model into public/models and list it in the manifest
function publish(job)
{
    const s = jobState(job.id)
    const manifest = loadJSON(MANIFEST, { models: [] })
    const old = manifest.models.find((m) => m.id === job.id)
    // a Tripo model replaces whatever filled that slot before (procedural or a CC0 pack model)
    const entry = { id: job.id, yaw: old?.yaw ?? 0 }
    entry.kind = job.id === 'character' ? 'character' : job.id === 'car' || job.id === 'scooter' ? 'vehicle' : 'site'
    if(job.id === 'car') entry.hideRider = true
    entry.fit = job.fit
    fs.mkdirSync(MODELS_DIR, { recursive: true })

    const animations = s.steps.find((x) => x && x.animations)
    const rig = s.steps.find((x) => x && x.type === 'rig' && x.model)
    const mesh = [ ...s.steps ].reverse().find((x) => x && x.model)
    const source = rig || mesh
    if(!source) return
    fs.copyFileSync(path.join(ROOT, source.model), path.join(MODELS_DIR, `${job.id}.glb`))
    entry.file = `${job.id}.glb`
    if(animations)
    {
        entry.clips = {}
        for(const [ name, a ] of Object.entries(animations.animations))
        {
            const file = `${job.id}-${name}.glb`
            fs.copyFileSync(path.join(ROOT, a.file), path.join(MODELS_DIR, file))
            entry.clips[name] = file
        }
    }
    manifest.models = manifest.models.filter((m) => m.id !== job.id).concat(entry)
    saveJSON(MANIFEST, manifest)
    console.log(`  published public/models/${entry.file}${entry.clips ? ' with ' + Object.keys(entry.clips).join(', ') : ''}`)
    console.log('  run `npm run models:optimize` to shrink it for the web')
}

// ------------------------------------------------------------------ cli
const args = process.argv.slice(2)
const command = [ 'plan', 'run', 'approve', 'redo', 'balance', 'status' ].includes(args[0]) ? args.shift() : 'plan'
const yes = args.includes('--yes')
const names = args.filter((a) => !a.startsWith('--'))
const key = readKey()

function selectJobs(list)
{
    if(!list.length) return JOBS
    const unknown = list.filter((n) => !JOBS.some((j) => j.id === n))
    if(unknown.length) throw new Error(`Unknown job: ${unknown.join(', ')}. Jobs: ${JOBS.map((j) => j.id).join(', ')}`)
    return JOBS.filter((j) => list.includes(j.id))
}

async function plan(jobs)
{
    console.log('Tripo plan (dry run, nothing is spent)\n')
    if(key)
    {
        try
        {
            const b = await api(key, 'GET', '/account/balance')
            console.log(`Balance: ${b.balance} credits${b.frozen ? ` (${b.frozen} held)` : ''}\n`)
        }
        catch(error) { console.log(`Could not read the balance: ${error.message}\n`) }
    }
    else console.log('No TRIPO_API_KEY yet. Put it in .env.local as TRIPO_API_KEY=your-key\n')

    let total = 0
    for(const job of jobs)
    {
        const from = nextStep(job)
        const blockers = [ ...placeholders(job).map((p) => `fill in ${p} in tripo/jobs.mjs`), ...missingPhotos(job).map((p) => `add the photo ${p}`) ]
        console.log(`${job.id}${from === -1 ? '  (done)' : ''}`)
        job.steps.forEach((step, i) =>
        {
            const done = from === -1 || i < from
            const c = done ? 0 : cost(step, job)
            total += c
            const mark = done ? 'done' : step.type === 'review' ? 'stop' : `${c} credits`
            console.log(`  ${String(i + 1).padStart(2)} ${describe(step, job).padEnd(58)} ${mark}`)
        })
        for(const b of blockers) console.log(`     blocked: ${b}`)
        console.log('')
    }
    console.log(`Total for what is left: ${total} credits (about $${(total / 100).toFixed(2)})`)
    console.log('Images stop for your review, so the first run only spends on images.')
    console.log(`To spend: npm run tripo -- run ${jobs.length === JOBS.length ? '<job ...>' : jobs.map((j) => j.id).join(' ')} --yes`)
}

async function run(jobs)
{
    if(!key) throw new Error('No TRIPO_API_KEY. Put it in .env.local as TRIPO_API_KEY=your-key')
    if(!yes)
    {
        await plan(jobs)
        console.log('\nNothing was spent. Add --yes to run.')
        return
    }
    for(const job of jobs)
    {
        const blockers = [ ...placeholders(job), ...missingPhotos(job) ]
        if(blockers.length) { console.log(`${job.id}: skipped, fill in ${blockers.join(', ')}`); continue }
        let i = nextStep(job)
        if(i === -1) { console.log(`${job.id}: already done`); continue }
        console.log(`${job.id}`)
        for(; i < job.steps.length; i++)
        {
            console.log(` ${i + 1}. ${describe(job.steps[i], job)}`)
            const result = await runStep(key, job, i)
            if(result === 'paused') break
        }
        if(nextStep(job) === -1) publish(job)
    }
}

async function main()
{
    const jobs = command === 'redo' ? [] : selectJobs(names)
    if(command === 'plan') return plan(jobs)
    if(command === 'run') return run(jobs)
    if(command === 'approve')
    {
        for(const job of jobs) { jobState(job.id).approved = true; console.log(`${job.id}: approved, the next run continues to 3D`) }
        return saveState()
    }
    if(command === 'redo')
    {
        // npm run tripo -- redo tiffin image|model|rig|animations
        const [ id, what = 'image' ] = names
        const job = selectJobs([ id ])[0]
        const types = { image: [ 'text_to_image', 'image_to_image' ], model: [ 'image_to_model' ], rig: [ 'rig_check', 'rig' ], animations: [ 'retarget' ] }[what]
        if(!types) throw new Error('redo takes image, model, rig or animations')
        const i = job.steps.findIndex((s) => types.includes(s.type))
        const s = jobState(id)
        s.steps = s.steps.slice(0, i)
        if(what === 'image') s.approved = false
        saveState()
        return console.log(`${id}: will make the ${what} again on the next run`)
    }
    if(command === 'balance')
    {
        if(!key) throw new Error('No TRIPO_API_KEY')
        const b = await api(key, 'GET', '/account/balance')
        return console.log(`${b.balance} credits${b.frozen ? `, ${b.frozen} held` : ''}`)
    }
    if(command === 'status')
    {
        for(const job of JOBS)
        {
            const i = nextStep(job)
            console.log(`${job.id.padEnd(12)} ${i === -1 ? 'done' : `next: ${describe(job.steps[i], job)}`}`)
        }
    }
}

main().catch((error) =>
{
    console.error('\n' + error.message)
    process.exit(1)
})
