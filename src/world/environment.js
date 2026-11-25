import * as THREE from 'three'
import { BAY_ANGLE } from './layout.js'
import { neonMaterial, glowMaterial, NEON_BOOST } from './neon.js'
import { seasonUniforms } from './seasonal.js'
import { createRain, createSnow, createBolt } from './weather.js'

// Time of day, seasons and weather, all running on their own.
//
// A day lasts a few minutes, and the hours around sunrise and sunset pass more
// slowly so dawn and dusk can linger. The sun is placed in the sky above
// wherever you are (the planet is tiny, so a single sun would set half an hour
// earlier on one side of the island than the other); it rises over the far
// side of the island and sets over the sunset bay. A new day brings the next
// season, and the weather changes every minute or two, picked to suit it.

export const DAY_SECONDS = 480
export const SEASONS = [ 'spring', 'summer', 'autumn', 'winter' ]
export const WEATHERS = [ 'clear', 'cloudy', 'rain', 'storm', 'snow', 'fog' ]
export const TIMES = { dawn: 0.245, day: 0.42, dusk: 0.718, night: 0.0 }

const color = (hex) => new THREE.Color(hex)

// one look per part of the day
const PALETTES = {
    night: {
        zenith: color('#070B24'), mid: color('#121A44'), horizon: color('#263064'), glow: color('#3C4C96'), ground: color('#0C1024'),
        fog: color('#18203F'), hemiSky: color('#5A70C0'), hemiGround: color('#2A2442'), hemi: 0.85, light: color('#A8BCFF'), sun: 0.5,
        exposure: 1.0, bloom: 1.0, lights: 1, stars: 1, cloudLit: color('#3A4370'), cloudShade: color('#161B36')
    },
    twilight: {
        zenith: color('#1B2464'), mid: color('#4E4A98'), horizon: color('#C87BA6'), glow: color('#F08676'), ground: color('#3A2E58'),
        fog: color('#6A5A92'), hemiSky: color('#9086D2'), hemiGround: color('#6A4A72'), hemi: 1.05, light: color('#FF9C82'), sun: 0.7,
        exposure: 1.02, bloom: 0.9, lights: 0.85, stars: 0.35, cloudLit: color('#E89AAE'), cloudShade: color('#4E3F7A')
    },
    // dawn: soft pastels
    dawn: {
        zenith: color('#5D76CA'), mid: color('#EFAFCB'), horizon: color('#FFE1BA'), glow: color('#FFB28A'), ground: color('#F6C6A8'),
        fog: color('#F2C9BC'), hemiSky: color('#D8CEF4'), hemiGround: color('#F4C8A6'), hemi: 1.55, light: color('#FFD9B4'), sun: 2.2,
        exposure: 1.04, bloom: 0.62, lights: 0.4, stars: 0, cloudLit: color('#FFE6E0'), cloudShade: color('#D6A9C6')
    },
    // dusk: the city's signature sunset
    dusk: {
        zenith: color('#4A4FB0'), mid: color('#E58AB8'), horizon: color('#FFC287'), glow: color('#FF7A4D'), ground: color('#F4A783'),
        fog: color('#F4A08A'), hemiSky: color('#CDB8F2'), hemiGround: color('#F2B08A'), hemi: 1.6, light: color('#FFC9A0'), sun: 2.5,
        exposure: 1.04, bloom: 0.7, lights: 0.55, stars: 0, cloudLit: color('#FFD9C2'), cloudShade: color('#C98AA8')
    },
    day: {
        zenith: color('#3C7AD4'), mid: color('#84BBEA'), horizon: color('#D8EBFA'), glow: color('#FFF1D4'), ground: color('#E2D8C6'),
        fog: color('#CBE0F0'), hemiSky: color('#CFE2FA'), hemiGround: color('#E2CDB0'), hemi: 1.2, light: color('#FFF1DE'), sun: 2.5,
        exposure: 0.94, bloom: 0.5, lights: 0.12, stars: 0, cloudLit: color('#FFFFFF'), cloudShade: color('#C7D4E6')
    }
}
const KEYS = Object.keys(PALETTES.night)
const WINTER_ZENITH = color('#7393C4')
const WINTER_HORIZON = color('#EEF2F8')
const WINTER_FOG = color('#E3E8F0')
const AUTUMN_HORIZON = color('#FFD7A0')

function blend(a, b, t, out = {})
{
    for(const k of KEYS)
    {
        if(a[k] instanceof THREE.Color) (out[k] = out[k] || new THREE.Color()).copy(a[k]).lerp(b[k], t)
        else out[k] = a[k] + (b[k] - a[k]) * t
    }
    return out
}

const smooth = (a, b, x) =>
{
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

// how the weather changes the look
const WEATHER_LOOK = {
    clear: { overcast: 0, dark: 1, cloud: 0.34, wet: 0, rain: 0, snow: 0, haze: 0 },
    cloudy: { overcast: 0.6, dark: 0.92, cloud: 0.72, wet: 0, rain: 0, snow: 0, haze: 0.15 },
    rain: { overcast: 0.85, dark: 0.78, cloud: 0.95, wet: 1, rain: 0.75, snow: 0, haze: 0.35 },
    storm: { overcast: 1, dark: 0.5, cloud: 1, wet: 1, rain: 1, snow: 0, haze: 0.45 },
    snow: { overcast: 0.8, dark: 1.02, cloud: 0.9, wet: 0, rain: 0, snow: 1, haze: 0.45 },
    fog: { overcast: 0.55, dark: 0.95, cloud: 0.6, wet: 0.3, rain: 0, snow: 0, haze: 1 }
}

// how likely each weather is in each season
const WEATHER_ODDS = {
    spring: { clear: 0.45, cloudy: 0.2, rain: 0.25, storm: 0.1 },
    summer: { clear: 0.5, cloudy: 0.15, rain: 0.15, storm: 0.2 },
    autumn: { clear: 0.35, cloudy: 0.25, rain: 0.2, fog: 0.15, storm: 0.05 },
    winter: { clear: 0.3, cloudy: 0.2, snow: 0.4, fog: 0.1 }
}

function seasonFromDate(date = new Date())
{
    const m = date.getMonth()
    return m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3
}

export class Environment
{
    constructor({ scene, renderer, lights, sky, fog, bloom, ambience, details, params = new URLSearchParams() })
    {
        this.scene = scene
        this.renderer = renderer
        this.lights = lights
        this.sky = sky
        this.fog = fog
        this.bloom = bloom
        this.ambience = ambience
        this.details = details

        // start late in the afternoon, so the first thing you see is the golden hour
        this.t = 0.71
        this.timeAuto = true
        this.season = seasonFromDate()
        this.seasonAuto = true
        this.seasonWeights = SEASONS.map((_, i) => (i === this.season ? 1 : 0))
        this.weather = 'clear'
        this.weatherAuto = true
        this.weatherTimer = 95
        this.weatherWeights = Object.fromEntries(WEATHERS.map((w) => [ w, w === 'clear' ? 1 : 0 ]))

        // ?time=0.8&season=winter&weather=snow pins any of them
        if(params.has('time')) this.setTime(params.get('time'))
        if(params.has('season')) this.setSeason(params.get('season'), true)
        if(params.has('weather')) this.setWeather(params.get('weather'), true)

        this.look = {}
        this.flash = 0
        this.nextStrike = 4
        this.thunderAt = []
        this.fogNear = 60
        this.fogFar = 210

        this.rain = createRain()
        this.snow = createSnow()
        this.bolt = createBolt()
        scene.add(this.rain, this.snow, this.bolt)

        this.up = new THREE.Vector3()
        this.bay = new THREE.Vector3()
        this.side = new THREE.Vector3()
        this.sunDir = new THREE.Vector3()
        this.moonDir = new THREE.Vector3()
        this.lightDir = new THREE.Vector3()
        this._v = new THREE.Vector3()
        this.skipBlend = true
    }

    // show the weather meshes while shaders compile, so rain starting later doesn't stutter
    prepareCompile(on)
    {
        this.rain.visible = this.snow.visible = this.bolt.visible = on
    }

    // ---------------------------------------------------------------- controls
    setTime(value)
    {
        if(value === 'auto') { this.timeAuto = true; return }
        const t = typeof value === 'string' && TIMES[value] !== undefined ? TIMES[value] : parseFloat(value)
        if(Number.isFinite(t))
        {
            this.t = ((t % 1) + 1) % 1
            this.timeAuto = false
        }
    }

    setSeason(value, instant = false)
    {
        if(value === 'auto') { this.seasonAuto = true; return }
        const i = SEASONS.indexOf(value)
        if(i < 0) return
        this.season = i
        this.seasonAuto = false
        if(instant) this.seasonWeights = SEASONS.map((_, k) => (k === i ? 1 : 0))
        this.fixWeatherForSeason()
    }

    setWeather(value, instant = false)
    {
        if(value === 'auto') { this.weatherAuto = true; this.weatherTimer = 60; return }
        if(!WEATHERS.includes(value)) return
        this.weather = value
        this.weatherAuto = false
        if(instant) for(const w of WEATHERS) this.weatherWeights[w] = w === value ? 1 : 0
    }

    // snow only falls in winter; rain turns to snow when it gets cold
    fixWeatherForSeason()
    {
        const winter = SEASONS[this.season] === 'winter'
        if(winter && (this.weather === 'rain' || this.weather === 'storm') && this.weatherAuto) this.weather = 'snow'
        if(!winter && this.weather === 'snow' && this.weatherAuto) this.weather = 'rain'
    }

    pickWeather()
    {
        const odds = WEATHER_ODDS[SEASONS[this.season]]
        let r = Math.random()
        for(const [ w, p ] of Object.entries(odds))
        {
            r -= p
            if(r <= 0) return w
        }
        return 'clear'
    }

    get state()
    {
        return {
            time: this.timeAuto ? 'auto' : Object.entries(TIMES).find(([ , v ]) => Math.abs(v - this.t) < 0.002)?.[0] || 'custom',
            season: this.seasonAuto ? 'auto' : SEASONS[this.season],
            weather: this.weatherAuto ? 'auto' : this.weather,
            clock: this.clock,
            label: this.label
        }
    }

    get clock()
    {
        const minutes = Math.floor(this.t * 24 * 60)
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
    }

    get label()
    {
        const season = SEASONS[this.season]
        const part = this.daylight > 0.2 ? (this.t < 0.5 ? 'morning' : this.t < 0.68 ? 'afternoon' : 'evening') : this.daylight > -0.12 ? (this.t < 0.5 ? 'dawn' : 'dusk') : 'night'
        const weather = this.weatherWeights[this.weather] > 0.5 ? this.weather : 'clear'
        const words = { clear: '', cloudy: 'Cloudy', rain: 'Rain', storm: 'Thunderstorm', snow: 'Snow', fog: 'Fog' }
        return [ `${season[0].toUpperCase()}${season.slice(1)} ${part}`, this.clock, words[weather] ].filter(Boolean).join(' · ')
    }

    // ---------------------------------------------------------------- frame
    // a slower clock around sunrise and sunset, a quicker one in the dead of night
    rate(t)
    {
        const bump = (c, w) =>
        {
            const d = ((t - c + 1.5) % 1 - 0.5) / w
            return Math.exp(-d * d)
        }
        return 1 - 0.74 * bump(0.25, 0.055) - 0.74 * bump(0.745, 0.06) + 0.6 * bump(0.0, 0.1)
    }

    update(dt, focus, { camera, space = 0, time = 0 } = {})
    {
        // ---- the clock, and a new season with each new day
        if(this.timeAuto)
        {
            const before = this.t
            this.t = (this.t + dt * this.rate(this.t) / DAY_SECONDS) % 1
            if(before < 0.2 && this.t >= 0.2 && this.seasonAuto)
            {
                this.season = (this.season + 1) % 4
                this.fixWeatherForSeason()
            }
        }
        const k = this.skipBlend ? 1 : Math.min(1, dt / 14)
        this.seasonWeights = this.seasonWeights.map((w, i) => w + ((i === this.season ? 1 : 0) - w) * k)
        const [ spring, , autumn, winter ] = this.seasonWeights

        // ---- the weather
        if(this.weatherAuto)
        {
            this.weatherTimer -= dt
            if(this.weatherTimer <= 0)
            {
                this.weather = this.pickWeather()
                this.weatherTimer = 70 + Math.random() * 60
            }
        }
        const kw = this.skipBlend ? 1 : Math.min(1, dt / 9)
        for(const w of WEATHERS) this.weatherWeights[w] += ((w === this.weather ? 1 : 0) - this.weatherWeights[w]) * kw
        const sky = {}
        for(const key of Object.keys(WEATHER_LOOK.clear))
        {
            sky[key] = 0
            for(const w of WEATHERS) sky[key] += WEATHER_LOOK[w][key] * this.weatherWeights[w]
        }
        this.skipBlend = false

        // ---- the sun and moon, placed in the sky over where we are
        const up = this.up.copy(focus).normalize()
        this.bay.set(Math.cos(BAY_ANGLE), 0, Math.sin(BAY_ANGLE))
        this.bay.addScaledVector(up, -this.bay.dot(up)).normalize()
        this.side.crossVectors(up, this.bay).normalize()
        const theta = Math.PI * 2 * (0.75 - this.t)
        const arc = (angle, out, lean) => out.copy(this.bay).multiplyScalar(Math.cos(angle))
            .add(this._v.copy(up).multiplyScalar(0.93).addScaledVector(this.side, lean).multiplyScalar(Math.sin(angle))).normalize()
        arc(theta, this.sunDir, 0.36)
        arc(theta + Math.PI, this.moonDir, -0.5)
        const s = this.daylight = this.sunDir.dot(up)
        const rising = this.t < 0.5

        // ---- the look for this time of day
        const P = PALETTES
        const gold = rising ? P.dawn : P.dusk
        let look
        if(s < -0.3) look = blend(P.night, P.night, 0, this.look)
        else if(s < -0.09) look = blend(P.night, P.twilight, smooth(-0.3, -0.09, s), this.look)
        else if(s < 0.03) look = blend(P.twilight, gold, smooth(-0.09, 0.03, s), this.look)
        else if(s < 0.24) look = blend(gold, gold, 0, this.look)
        else look = blend(gold, P.day, smooth(0.24, 0.52, s), this.look)

        // winter days are cooler and whiter, autumn a little warmer
        const daytime = smooth(0.0, 0.3, s)
        look.zenith.lerp(WINTER_ZENITH, winter * daytime * 0.35)
        look.horizon.lerp(WINTER_HORIZON, winter * daytime * 0.3)
        look.fog.lerp(WINTER_FOG, winter * daytime * 0.35)
        look.horizon.lerp(AUTUMN_HORIZON, autumn * daytime * 0.15)

        // weather: grey it over, dim the sun
        const grey = (c, amount, dark) =>
        {
            const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15
            c.lerp(this._grey.setRGB(l * 1.02, l * 1.04, l * 1.1), amount)
            c.multiplyScalar(dark)
        }
        this._grey = this._grey || new THREE.Color()
        const o = sky.overcast
        for(const key of [ 'zenith', 'mid', 'horizon', 'glow', 'ground', 'fog', 'hemiSky', 'hemiGround', 'cloudLit', 'cloudShade' ]) grey(look[key], o * 0.75, 1 - (1 - sky.dark) * (key === 'fog' ? 0.6 : 1))
        look.sun *= 1 - o * 0.8
        look.hemi *= 1 - o * 0.12 + sky.snow * 0.1

        // ---- lightning
        if(this.weatherWeights.storm > 0.6)
        {
            this.nextStrike -= dt
            if(this.nextStrike <= 0)
            {
                this.strike = 0
                this.nextStrike = 4 + Math.random() * 9
                this.bolt.userData.strike(focus, up, this.bay, this.side)
                this.thunderAt.push({ at: 0.7 + Math.random() * 1.8, power: 0.6 + Math.random() * 0.4 })
            }
        }
        if(this.strike !== undefined)
        {
            this.strike += dt
            const x = this.strike
            // a bright flash that flickers twice and fades
            this.flash = (x < 0.06 ? x / 0.06 : Math.exp(-(x - 0.06) * 9)) + (x > 0.14 && x < 0.32 ? 0.6 * Math.exp(-(x - 0.14) * 12) : 0)
            this.bolt.visible = x < 0.24 && x % 0.08 < 0.06
            if(x > 1.2) { this.strike = undefined; this.flash = 0; this.bolt.visible = false }
        }
        for(const th of this.thunderAt) th.at -= dt
        while(this.thunderAt.length && this.thunderAt[0].at <= 0)
        {
            const th = this.thunderAt.shift()
            this.ambience?.thunder?.(th.power)
        }

        // ---- apply: lights
        const nightLight = s < -0.06
        this.lightDir.copy(nightLight ? this.moonDir : this.sunDir)
        // keep the light just above the horizon so shadows never come from below
        if(this.lightDir.dot(up) < 0.08) this.lightDir.addScaledVector(up, 0.08 - this.lightDir.dot(up)).normalize()
        const handover = nightLight ? smooth(-0.06, -0.16, s) : smooth(-0.06, 0.04, s)
        this.lights.sun.color.copy(look.light)
        this.lights.sun.intensity = look.sun * handover
        this.lights.hemi.color.copy(look.hemiSky)
        this.lights.hemi.groundColor.copy(look.hemiGround)
        this.lights.hemi.intensity = look.hemi + this.flash * 2.2
        this.lights.direction.copy(this.lightDir)

        // ---- sky
        const u = this.sky.userData.uniforms
        u.uSun.value.copy(this.sunDir)
        u.uMoon.value.copy(this.moonDir)
        for(const key of [ 'zenith', 'mid', 'horizon', 'glow', 'ground' ]) u['u' + key[0].toUpperCase() + key.slice(1)].value.copy(look[key])
        u.uNight.value = look.stars
        u.uSunDisc.value = 1 - o
        u.uCloud.value = sky.cloud
        u.uCloudLit.value.copy(look.cloudLit)
        u.uCloudShade.value.copy(look.cloudShade)
        u.uFlash.value = this.flash
        u.uTime.value = time

        // ---- fog, exposure, glow
        this.fog.color.copy(look.fog)
        this.fogNear = Math.max(5, 60 * (1 - 0.55 * Math.min(1, sky.rain + sky.snow) - 0.9 * this.weatherWeights.fog))
        this.fogFar = Math.max(48, 210 * (1 - 0.4 * sky.rain - 0.35 * sky.snow - 0.72 * this.weatherWeights.fog))
        this.renderer.toneMappingExposure = look.exposure + this.flash * 0.25
        if(this.bloom) this.bloom.strength = look.bloom
        const lightsOn = Math.max(look.lights, o * 0.55)
        this.lightsOn = lightsOn
        neonMaterial.color.setScalar(NEON_BOOST * (0.78 + 0.32 * lightsOn))
        glowMaterial.color.setScalar(0.22 + 0.88 * lightsOn)
        const pools = this.details?.userData.poolMaterial
        if(pools) pools.color.setScalar(0.15 + 1.25 * lightsOn)
        const fireflies = this.details?.userData.fireflies
        if(fireflies) fireflies.material.uniforms.uVisible.value = smooth(0.35, 0.9, lightsOn) * (1 - winter) * (1 - sky.rain) * (1 - sky.snow)

        // ---- seasons in the materials
        seasonUniforms.uAutumn.value = autumn
        seasonUniforms.uSpring.value = spring
        seasonUniforms.uSnow.value = winter
        seasonUniforms.uWet.value = sky.wet

        // ---- rain and snow around us (not from orbit)
        const near = 1 - space
        for(const [ mesh, amount ] of [ [ this.rain, sky.rain * near ], [ this.snow, sky.snow * near ] ])
        {
            mesh.visible = amount > 0.01
            if(!mesh.visible) continue
            const pu = mesh.material.uniforms
            pu.uCenter.value.copy(focus)
            pu.uUp.value.copy(up)
            pu.uT.value.copy(this.bay)
            pu.uB.value.copy(this.side)
            pu.uTime.value = time
            pu.uAmount.value = amount
            if(pu.uWind) pu.uWind.value.copy(this.side).multiplyScalar(2 + sky.rain * 3)
            if(pu.uScale && camera) pu.uScale.value = this.renderer.getDrawingBufferSize(this._size || (this._size = new THREE.Vector2())).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
        }

        // ---- sounds
        this.ambience?.setWeather?.({ rain: sky.rain * near, wind: (sky.snow + sky.rain * 0.5 + this.weatherWeights.storm * 0.5) * near })
        this.ambience?.setNature?.({
            birds: smooth(-0.02, 0.2, s) * (1 - smooth(0.5, 0.8, s) * 0.5) * (1 - o) * (1 - winter) * near,
            crickets: smooth(-0.05, -0.2, s) * (1 - winter) * (1 - sky.rain) * near
        })
    }
}
