#!/usr/bin/env node
// Shrinks every model in public/models for the web: welds and simplifies the
// mesh, turns textures into 1024px WebP and compresses geometry with meshopt.
// Originals are kept in public/models/originals/ (not deployed... see .gitignore).
//
//   npm run models:optimize              all models
//   npm run models:optimize -- tiffin    just one
//   --ratio 0.5                          keep this share of triangles (default 0.5, 0.8 for the character)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public/models')
const ORIGINALS = path.join(ROOT, 'tripo/originals')

let tools
try
{
    const [ core, extensions, functions, meshopt, sharp ] = await Promise.all([
        import('@gltf-transform/core'),
        import('@gltf-transform/extensions'),
        import('@gltf-transform/functions'),
        import('meshoptimizer'),
        import('sharp')
    ])
    tools = { ...core, ...extensions, ...functions, ...meshopt, sharp: sharp.default }
}
catch
{
    console.error('The model tools are optional and not installed. Run: npm install --include=optional')
    process.exit(1)
}

const args = process.argv.slice(2)
const ratioArg = args.indexOf('--ratio')
const ratio = ratioArg >= 0 ? Number(args[ratioArg + 1]) : null
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--ratio')

const { NodeIO, ALL_EXTENSIONS, MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } = tools
await Promise.all([ MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready ])
const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.glb')).filter((f) => !only.length || only.some((o) => f.startsWith(o)))
if(!files.length) console.log('No models in public/models yet. Make some with `npm run tripo`.')

for(const file of files)
{
    const input = path.join(DIR, file)
    const original = path.join(ORIGINALS, file)
    fs.mkdirSync(ORIGINALS, { recursive: true })
    // always start from the original, so running this twice doesn't degrade a model
    if(!fs.existsSync(original)) fs.copyFileSync(input, original)
    const before = fs.statSync(original).size
    const document = await io.read(original)
    const animated = document.getRoot().listAnimations().length > 0 || document.getRoot().listSkins().length > 0
    const keep = ratio ?? (file.startsWith('character') ? 0.8 : 0.5)
    await document.transform(
        tools.dedup(),
        tools.prune(),
        tools.weld(),
        tools.simplify({ simplifier: MeshoptSimplifier, ratio: keep, error: 0.002, lockBorder: false }),
        tools.textureCompress({ encoder: tools.sharp, targetFormat: 'webp', resize: [ 1024, 1024 ] }),
        ...(animated ? [ tools.resample() ] : []),
        tools.prune(),
        tools.meshopt({ encoder: MeshoptEncoder, level: 'medium' })
    )
    await io.write(input, document)
    const after = fs.statSync(input).size
    console.log(`${file.padEnd(28)} ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB`)
}
