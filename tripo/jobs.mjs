// Every model the Tripo helper can make for the island (scripts/tripo.mjs).
// Edit the prompts freely. Anything in [square brackets] must be filled in
// before that job will run.

// One style line ends every image prompt, so all models look like one world.
export const STYLE = 'stylized low-poly 3D game asset in a sunny Konkan-coast Indian seaside town, clean chunky faceted shapes with crisp edges and simplified details, soft matte clay-like materials, warm palette of laterite red, whitewash, turmeric yellow and sea green lit by late-afternoon golden light, three-quarter view from the front-left, camera slightly above, the whole subject visible with generous margin, isolated on a plain pure white background, no ground plane, no cast shadow, no people, absolutely no text, no letters, no numbers, no logos, no signage writing'

const ARCHITECTURE = 'Konkan coastal architecture, smooth lime-plastered walls, a laterite stone plinth, wooden window shutters, a flat roof with a stepped parapet.'

// Tripo model versions (see developers.tripo3d.ai/en/docs/models-and-versions)
export const MODELS = {
    image: 'seedream_v5', // image-to-image and text-to-image
    textImage: 'seedream_v4',
    mesh: 'v3.1-20260211', // H3.1
    // The v1.0 rig is the one with sit and wave presets. Switch to
    // 'v3.0-20260909' for a better humanoid rig with idle/walk/run only.
    rig: 'v1.0-20240301'
}

const building = (id, prompt, fit) => ({
    id,
    fit, // [width, height, depth] in metres; the model is scaled to fit inside
    steps: [
        { type: 'text_to_image', prompt: `${prompt} ${ARCHITECTURE} ${STYLE}` },
        { type: 'review' },
        // buildings need the detailed geometry or their edges come out soft
        { type: 'image_to_model', texture_quality: 'standard', geometry_quality: 'detailed' }
    ]
})

const prop = (id, prompt, fit) => ({
    id,
    fit,
    steps: [
        { type: 'text_to_image', prompt: `${prompt} ${STYLE}` },
        { type: 'review' },
        { type: 'image_to_model', texture_quality: 'standard', geometry_quality: 'standard' }
    ]
})

export const JOBS = [
    {
        id: 'character',
        fit: [ 1.2, 1.78, 1.2 ],
        // put your photos here (not committed): a clear headshot and a full-body shot
        photos: [ 'tripo/photos/headshot.jpg', 'tripo/photos/fullbody.jpg' ],
        steps: [
            {
                type: 'image_to_image',
                prompt: 'A stylized low-poly 3D video-game character with simplified faceted shapes and realistic body proportions of the [young Indian man] from image[1]: same face, [hair, beard, glasses: describe yours]. He wears the outfit from image[2]: [describe the outfit, shoes and any accessories]. Full body from head to shoes visible with margin, standing straight facing the camera in a relaxed A-pose, arms held slightly away from the body, legs slightly apart, neutral friendly expression, soft matte materials, flat colors, even studio lighting, plain pure white background, no ground shadow, no text, no logos'
            },
            { type: 'review' },
            { type: 'image_to_model', texture_quality: 'detailed', geometry_quality: 'standard' },
            { type: 'rig_check' },
            { type: 'rig', rig_type: 'biped', spec: 'tripo' },
            {
                type: 'retarget',
                // name in the game: Tripo preset
                animations: {
                    idle: 'preset:biped:idle',
                    walk: 'preset:biped:walk',
                    run: 'preset:biped:run',
                    wave: 'preset:biped:wave_goodbye_01',
                    sit: 'preset:biped:sit'
                }
            }
        ]
    },

    building('studio', 'A small single-storey whitewashed cottage used as a software developer\'s studio: a sloping terracotta Mangalore-tile hip roof, a front veranda with four white pillars on a laterite plinth, a sea-green front door and window shutters, potted plants on the veranda, a small satellite dish on the roof.', [ 8, 7, 9 ]),

    building('tiffin', 'A two-storey canteen for a college food-delivery app: mint-green walls with white trim, a giant oversized stainless-steel three-tier tiffin carrier with a carry handle sitting on the flat roof, a red-and-white striped awning over a wide serving window, a wooden bench by the door, potted plants on the upper balcony.', [ 8.5, 11, 7 ]),

    building('calculator', 'A two-storey hardware shop for a calculator app used by cement sheet businesses: turmeric-yellow walls with white trim, a giant oversized pocket calculator with chunky cream and orange buttons leaning back on the flat roof, a sea-green and cream striped awning, a neat stack of grey corrugated cement roofing sheets by the shop front.', [ 8.5, 11, 7 ]),

    building('clock', 'A two-storey office for a task-scheduling app: sky-blue walls with white trim, a giant oversized red twin-bell alarm clock standing on the flat roof, a red front door, a small red post box by the entrance, ochre window shutters, a balcony with white railings.', [ 8.5, 11, 7 ]),

    building('phone', 'A two-storey village school for a face-recognition attendance app: soft lilac walls with white trim, a giant oversized smartphone standing upright on the flat roof showing a simple smiling face framed by yellow scan corners, a navy-and-white striped awning, a bicycle rack by the door.', [ 8.5, 11, 7 ]),

    building('arcade', 'A two-storey games arcade for a tic-tac-toe game: soft pink walls with cream trim, a giant oversized wooden tic-tac-toe board standing upright on the flat roof with chunky red X pieces and blue O pieces, a yellow-and-red striped awning, a blue arcade cabinet by the door.', [ 8.5, 11, 7 ]),

    prop('trophies', 'A town-square monument: a whitewashed stone plinth on a laterite base carrying a giant golden trophy cup with two handles and, beside it, a silver medal hanging from a red-and-blue ribbon on a small wooden stand.', [ 4.6, 5.5, 3.4 ]),

    prop('chai', 'A small wooden roadside chai stall on a beach: a turmeric-yellow counter, a blue-and-white striped tarp roof, an aluminium tea kettle and small tea glasses on the counter, colourful snack packets hanging in a row, a wooden bench in front, a giant oversized terracotta clay chai cup with a wisp of steam sitting on the roof.', [ 4.8, 5, 4 ]),

    prop('lighthouse', 'A short coastal lighthouse with red and white bands on a rocky stone base, a black iron gallery railing, a glowing yellow lamp room and a red conical roof.', [ 5, 15, 5 ]),

    prop('scooter', 'A classic 1960s motor scooter with a long flat seat, round headlight and chrome side mirror, painted soft mint green with a cream seat, parked upright.', [ 0.8, 1.15, 1.9 ])
]
