import './threejs-override.js'
import { Game } from './Game/Game.js'
import consoleLog from './data/consoleLog.js'
import { WorldPreviews } from './Previews/WorldPreviews.js'

window.addEventListener('error', (e) =>
{
    try
    {
        console.error('Error', e.message, `${e.filename}:${e.lineno}:${e.colno}`, e.error)
    }
    catch(_)
    {
        console.error(e)
    }
})

window.addEventListener('unhandledrejection', (e) =>
{
    console.error('Unhandled rejection', e.reason)
})

if(import.meta.env.MODE === 'development' && import.meta.env.VITE_LOG === '1')
    console.log(...consoleLog)

if(import.meta.env.VITE_GAME_PUBLIC)
    window.game = new Game()
else
    new Game()

// Lightweight 3D previews for external worlds
window.addEventListener('DOMContentLoaded', () => {
    new WorldPreviews()
})
