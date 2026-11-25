// Every model the Tripo helper can make for the island (scripts/tripo.mjs).
// Edit the prompts freely. Anything in [square brackets] must be filled in
// before that job will run.

// One style line ends every image prompt, so all models look like one world.
export const STYLE = 'stylized low-poly 3D game asset in a sun-drenched 1980s Miami-inspired beach city, clean chunky faceted shapes with crisp edges and simplified details, soft matte clay-like materials, pastel Art Deco palette of flamingo pink, mint, peach and sky blue with a few neon accents, lit by a warm pink and orange sunset, three-quarter view from the front-left, camera slightly above, the whole subject visible with generous margin, isolated on a plain pure white background, no ground plane, no cast shadow, no people, absolutely no text, no letters, no numbers, no logos, no signage writing'

const ARCHITECTURE = '1930s Miami Beach Art Deco architecture, smooth stucco walls, rounded corners, white eyebrow ledges over ribbon windows, porthole windows, a flat roof with a stepped parapet and a vertical fin, thin neon tubes along the edges.'

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

    building('studio', 'A small white two-level Art Deco villa used as a software developer\'s home: one big rounded corner, a teal band at the roof line, a rooftop sun deck with a thin white rail, a teal front door, a porthole window, potted palms by the entrance.', [ 8, 7, 7 ]),

    building('tiffin', 'A two-storey diner for a college food-delivery app: mint-green walls with white trim, a giant oversized stainless-steel three-tier tiffin carrier with a carry handle sitting on the flat roof, a pink-and-white striped awning over a wide window, red diner stools by the counter window.', [ 8.5, 11, 7 ]),

    building('calculator', 'A two-storey hardware shop for a calculator app used by cement sheet businesses: peach walls with white trim, a giant oversized pocket calculator with chunky cream and orange buttons leaning back on the flat roof, a teal and cream striped awning, a neat stack of grey corrugated cement roofing sheets by the shop front.', [ 8.5, 11, 7 ]),

    building('clock', 'A two-storey office for a task-scheduling app: sky-blue walls with white trim, a giant oversized red twin-bell alarm clock standing on the flat roof, glass front doors, a potted palm by the entrance.', [ 8.5, 11, 7 ]),

    building('phone', 'A two-storey school for a face-recognition attendance app: soft lavender walls with white trim, a giant oversized smartphone standing upright on the flat roof showing a simple smiling face framed by yellow scan corners, a navy-and-white striped awning, a bicycle rack by the door.', [ 8.5, 11, 7 ]),

    building('arcade', 'A two-storey games arcade for a tic-tac-toe game: soft pink walls with cream trim, a giant oversized wooden tic-tac-toe board standing upright on the flat roof with chunky red X pieces and blue O pieces, a yellow-and-red striped awning, a blue arcade cabinet by the door.', [ 8.5, 11, 7 ]),

    prop('trophies', 'A plaza monument: a white stone plinth with a pink band and a mint base carrying a giant golden trophy cup with two handles and, beside it, a silver medal hanging from a red-and-blue ribbon on a small wooden stand.', [ 4.6, 5.5, 3.4 ]),

    prop('chai', 'A small wooden beach shack serving chai: a mint-and-white striped counter, a straw thatch roof, string lights along the front, an aluminium tea kettle and small tea glasses on the counter, colourful snack packets hanging in a row, a wooden bench in front, a giant oversized terracotta clay chai cup with a wisp of steam on the roof.', [ 4.8, 5, 4 ]),

    prop('lighthouse', 'A short white coastal lighthouse on a rocky stone base, a black iron gallery railing, a glowing yellow lamp room and a black conical roof.', [ 5, 15, 5 ]),

    prop('scooter', 'A classic 1960s motor scooter with a long flat seat, round headlight and chrome side mirror, painted soft mint green with a cream seat, parked upright.', [ 0.8, 1.15, 1.9 ]),

    prop('car', 'An original 1980s wedge-shaped two-seat convertible sports car, long low pointed nose with closed pop-up headlights, side strakes, white paint with a pink and cyan stripe, red bucket seats, a black roll bar, chrome-free and unbranded, parked with wheels straight.', [ 1.9, 1.3, 4.3 ])
]
