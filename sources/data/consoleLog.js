import * as THREE from 'three/webgpu'

const text = `
ooooo  oooooooo8 ooooo ooooo      o      oooo   oooo 888  oooooooo8            
 888  888         888   888      888      8888o  88  888 888                   
 888   888oooooo  888ooo888     8  88     88 888o88 o88   888oooooo            
 888          888 888   888    8oooo88    88   8888              888           
o888o o88oooo888 o888o o888o o88o  o888o o88o    88      o88oooo888            
                                                                               
oooo     oooo ooooooooooo oooooooooo   oooooooo8 ooooo ooooooooooo ooooooooooo 
 88   88  88   888    88   888    888 888         888  88  888  88  888    88  
  88 888 88    888ooo8     888oooo88   888oooooo  888      888      888ooo8    
   888 888     888    oo   888    888         888 888      888      888    oo  
    8   8     o888ooo8888 o888ooo888  o88oooo888 o888o    o888o    o888ooo8888 
                                                                               

╔═ Intro ═══════════════╗
║ Thank you for visiting my portfolio, you sneaky developer!
║ If you are curious about the stack and how I built this project, here’s everything you need to know.
╚═══════════════════════╝

╔═ Socials ═══════════════╗
║ Mail           ⇒ ishanrtripathi786@gmail.com
║ X              ⇒ https://x.com/irt_tripathi
║ Youtube        ⇒ https://www.youtube.com/@ishanrtripathi
║ GitHub         ⇒ https://github.com/ishanrtripathi
║ LinkedIn       ⇒ https://www.linkedin.com/in/ishanr/
╚═══════════════════════╝

╔═ Debug ═══════════════╗
║ You can access the debug mode by adding #debug at the end of the URL and reloading.
║ Press [V] to toggle the free camera.
╚═══════════════════════╝

╔═ Three.js ════════════╗
║ Three.js is the library I’m using to render this 3D world (release: ${THREE.REVISION})
║ https://threejs.org/
║ It was created by mr.doob (https://x.com/mrdoob, https://github.com/mrdoob),
║ followed by hundreds of awesome developers,
║ one of which being Sunag (https://x.com/sea3dformat, https://github.com/sunag) who added TSL,
║ enabling the use of both WebGL and WebGPU, making this portfolio possible.
╚═══════════════════════╝

╔═ Three.js Journey ════╗
║ If you want to learn Three.js, I got you covered with this huge course.
║ https://threejs-journey.com/
║ It contains everything you need to start building awesome stuff with Three.js (and much more).
╚═══════════════════════╝

╔═ Devlogs ═════════════╗
║ I’ve been making devlogs since the very start of this portfolio
║ and you can find them on my Youtube channel.
║ https://www.youtube.com/@BrunoSimon
║ Even though the portfolio is out, I’m still working on the last videos so that the series is complete.
╚═══════════════════════╝

╔═ Source code ═════════╗
║ The code is available on GitHub under MIT license. Original Author below!
║ https://github.com/brunosimon/folio-2025
║ For security reasons, I’m not sharing the server code, but the portfolio works without it.
╚═══════════════════════╝

╔═ Musics ══════════════╗
║ The music you hear was made especially for this portfolio by the awesome Kounine (Linktree).
║ https://linktr.ee/Kounine
║ They are now under CC0 license, meaning you can do whatever you want with them!
║ Download them here.
║ https://github.com/brunosimon/folio-2025/tree/main/static/sounds/musics
╚═══════════════════════╝

╔═ Some more links ═════╗
║ Rapier (Physics library)  ⇒ https://rapier.rs/
║ Howler.js (Audio library) ⇒ https://howlerjs.com/
║ Amatic SC (Fonts)         ⇒ https://fonts.google.com/specimen/Amatic+SC
║ Nunito (Fonts).           ⇒ https://fonts.google.com/specimen/Nunito?query=Nunito
╚═══════════════════════╝
`
let finalText = ''
let finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null
for(let i = 0; i < text.length; i++)
{
    const char = text[i]

    const style = char.match(/[╔║═╗╚╝╔╝]/) ? 'pipe' : 'letter'
    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'

        finalStyles.push(stylesSet[currentStyle])
    }
    finalText += char
}

export default [finalText, ...finalStyles]
