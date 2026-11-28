// Everything a visitor reads lives in this file. Edit freely: the world places
// one building per project, in this order, along the road from Ishan's place to the beach.

export const person = {
    name: 'Ishan R Tripathi',
    shortName: 'Ishan',
    role: 'Software engineer',
    intro: 'An open-world island game with my portfolio built in. Walk, sprint and jump around the city, drive, fly a plane or a helicopter, sail, race and take missions from your phone. My projects, career and trophies live on the city island: step into a glowing marker to read one, and find me at the chai shack on the beach.',
    about: 'Software engineer specialising in backend development with Java, Spring Boot and Postgres, with experience in financial services, e-commerce and logistics. I like building products from scratch, design discussions included. Google Agentic AI Hackathon winner and Math Olympiad silver medallist.'
}

export const links = [
    { label: 'Email', href: 'mailto:ishanrtripathi786@gmail.com', text: 'ishanrtripathi786@gmail.com' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ishanr/', text: 'linkedin.com/in/ishanr' },
    { label: 'GitHub', href: 'https://github.com/ishanrtripathi', text: 'github.com/ishanrtripathi' },
    { label: 'X', href: 'https://x.com/irt_tripathi', text: '@irt_tripathi' },
    { label: 'YouTube', href: 'https://www.youtube.com/@ishanrtripathi', text: '@ishanrtripathi' }
]

// `building` picks the procedural stand-in model (see src/world/buildings.js).
// `stamp` is the project's accent colour.
export const projects = [
    {
        id: 'lunchbox',
        title: 'LunchBox',
        place: 'LunchBox Diner',
        line: 'Daily food delivery for students and college faculty',
        body: 'An app for students and college faculty to get their daily food delivered.',
        role: 'Developer',
        stack: [ 'Android' ],
        url: 'https://github.com/LunchBoxAndroid/LUNCHBOX',
        building: 'tiffin',
        stamp: '#1E7B78'
    },
    {
        id: 'jcpsk',
        title: 'JCPSK Calculator',
        place: 'JCPSK Hardware',
        line: 'Calculations for cement sheet businesses, almost 500 downloads',
        body: 'Cement sheet businesses repeat the same long, error-prone calculations for every order. This Android app does them for you, and it reached almost 500 downloads on the Play Store.',
        role: 'Developer',
        stack: [ 'Android', 'Java', 'SQL' ],
        url: 'https://play.google.com/store/apps/details?id=com.ishanrtripathi.jcpskcalculator',
        building: 'calculator',
        stamp: '#C8372D'
    },
    {
        id: 'task-scheduler',
        title: 'Task Scheduler',
        place: 'Task Scheduler HQ',
        line: 'A REST API for planning and tracking work, like JIRA',
        body: 'A REST API based application for planning and tracking tasks, similar to JIRA.',
        role: 'Backend developer',
        stack: [ 'Node.js', 'Express', 'MongoDB', 'REST' ],
        url: 'https://github.com/IshanRTripathi/TaskScheduler',
        building: 'clock',
        stamp: '#3B5BA9'
    },
    {
        id: 'mypresence',
        title: 'myPresense',
        place: 'myPresense School',
        line: 'Face detection on Android, over a phone-to-phone mesh',
        body: 'An Android app built on the Google Nearby API and Amazon Rekognition. I handled image capture for face detection with Rekognition and the CameraKit API.',
        role: 'Android developer',
        stack: [ 'Android', 'Java', 'Google Nearby', 'Amazon Rekognition', 'Graphs' ],
        url: 'https://github.com/nSpider/NearbyConnectionMeshNetwork',
        building: 'phone',
        stamp: '#7A4FA0'
    },
    {
        id: 'tictactoe',
        title: 'Tic-Tac-Toe Advanced',
        place: 'Tic-Tac-Toe Arcade',
        line: 'Tic-tac-toe with a few twisted rules, made in Unity',
        body: 'Tic-tac-toe with some twisted rules, built in Unity with C#. You can play it in the browser.',
        role: 'Game developer',
        stack: [ 'Unity', 'C#' ],
        url: 'https://ishanrtripathi.github.io/Tic-Tac-Toe-Advanced/',
        building: 'arcade',
        stamp: '#D9822B'
    }
]

export const achievements = {
    id: 'achievements',
    title: 'Trophies',
    place: 'Trophy Plaza',
    line: 'Google Agentic AI Hackathon winner, Math Olympiad silver',
    body: 'Two things I am proud of: winning the Google Agentic AI Hackathon, and a silver medal at the Math Olympiad.',
    items: [
        { title: 'Google Agentic AI Hackathon', detail: 'Winner' },
        { title: 'Math Olympiad', detail: 'Silver medal' }
    ],
    stamp: '#B8860B'
}

// Newest first. Shown on the poster outside the cinema.
export const career = {
    id: 'career',
    title: 'Career',
    place: 'The Ishan Cinema',
    line: 'Now showing: every stop so far, from internships to today',
    stops: [
        { place: 'IG Group', role: 'Developer', when: '2023 to now', note: 'Java, Spring Boot, microservices', url: 'https://www.iggroup.com/' },
        { place: 'Falabella', role: 'Engineer', when: '2021 to 2023', note: 'Java, Spring Boot, microservices', url: 'https://www.falabella.com/' },
        { place: 'Morgan Stanley (via Wiley)', role: 'Java developer', when: '2020 to 2021', note: 'Java, DevOps, Python, shell', url: 'https://www.morganstanley.com/' },
        { place: 'OpenText', role: 'Software engineering intern', when: '2020', note: 'Java, OpenAPI, REST', url: 'https://www.opentext.com/' },
        { place: 'HighRadius', role: 'Full stack intern', when: '2019', note: 'Java, ExtJS, Python, machine learning, React', url: 'https://www.highradius.com/' },
        { place: 'KIIT University', role: 'B.Tech, computer science', when: '2016 to 2020', note: 'Bhubaneswar', url: 'https://kiit.ac.in/' }
    ],
    stamp: '#2F6B3B'
}

// Models from free CC0 packs (see public/models/CREDITS.md)
export const credits = [
    { what: 'Character, palm trees and cruise ship', who: 'Quaternius', href: 'https://quaternius.com' },
    { what: 'Cars', who: 'Kenney', href: 'https://kenney.nl' }
]

// the Game Arcade hall: not a project, but a stop you walk into
export const arcade = {
    id: 'arcade',
    kind: 'arcade',
    title: 'Game Arcade',
    place: 'Game Arcade',
    line: 'Pick a game and play. Your best scores stay on this device.'
}

export const contact = {
    id: 'contact',
    title: 'Chai?',
    place: 'Chai Shack',
    line: 'Pull up a stool and watch the sunset. Here is how to reach me.',
    body: 'Thanks for walking all the way here. If you want to build something together, hire me, or just talk shop, write to me.',
    stamp: '#8B5A2B'
}
