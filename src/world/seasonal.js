// Seasons in the materials: one set of uniforms shared by every lit surface.
// Snow settles on whatever faces the sky, leaves turn in autumn, trees blossom
// in spring, and everything darkens a little when it is wet.

export const seasonUniforms = {
    uSnow: { value: 0 },
    uAutumn: { value: 0 },
    uSpring: { value: 0 },
    uWet: { value: 0 }
}

// options: foliage (0..1) how much the greens change colour with the seasons,
// snow (0..1) how much snow settles, ground: grass turns to straw instead of red
export function seasonalShader(shader, { foliage = 0, snow = 1, ground = false } = {})
{
    Object.assign(shader.uniforms, seasonUniforms)
    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
            varying vec3 vSeasonWorld;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
            #ifdef USE_INSTANCING
                vSeasonWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
            #else
                vSeasonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
            #endif`)
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
            uniform float uSnow;
            uniform float uAutumn;
            uniform float uSpring;
            uniform float uWet;
            varying vec3 vSeasonWorld;
            float seasonHash(vec3 p)
            {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }
            float seasonNoise(vec3 x)
            {
                vec3 i = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix(seasonHash(i), seasonHash(i + vec3(1, 0, 0)), f.x), mix(seasonHash(i + vec3(0, 1, 0)), seasonHash(i + vec3(1, 1, 0)), f.x), f.y),
                           mix(mix(seasonHash(i + vec3(0, 0, 1)), seasonHash(i + vec3(1, 0, 1)), f.x), mix(seasonHash(i + vec3(0, 1, 1)), seasonHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
            }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            {
                vec3 worldNormal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
                vec3 skyward = normalize(vSeasonWorld);
                float facing = dot(worldNormal, skyward);
                float snowPatch = seasonNoise(vSeasonWorld * 0.9);
                vec3 base = diffuseColor.rgb;
                float green = clamp((base.g - max(base.r, base.b)) * 5.0, 0.0, 1.0);
                ${foliage > 0 ? `
                float leaves = green * ${foliage.toFixed(2)};
                ${ground ? `
                // grass goes to straw in autumn
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.55, 0.22) * (0.8 + snowPatch * 0.4), leaves * uAutumn * 0.7);
                ` : `
                // leaves turn orange, red and gold, a different mix on each tree
                float pick = seasonHash(floor(vSeasonWorld * 0.35));
                vec3 fall = pick < 0.33 ? vec3(0.86, 0.36, 0.1) : pick < 0.66 ? vec3(0.78, 0.2, 0.12) : vec3(0.92, 0.66, 0.16);
                float shade = dot(base, vec3(0.3, 0.55, 0.15)) * 1.6;
                diffuseColor.rgb = mix(diffuseColor.rgb, fall * (0.55 + shade * 0.6), leaves * uAutumn);
                // spring: blossom on the tops of the canopies
                float bloom = leaves * uSpring * smoothstep(-0.2, 0.5, facing) * smoothstep(0.3, 0.62, snowPatch + pick * 0.3);
                diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.97, 0.5, 0.7), vec3(1.0, 0.78, 0.88), pick), bloom);
                `}
                ` : ''}
                // snow on everything that faces the sky
                float settle = smoothstep(0.32, 0.72, facing + (snowPatch - 0.5) * 0.35) * uSnow * ${snow.toFixed(2)};
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), settle);
                // wet surfaces darken
                diffuseColor.rgb *= 1.0 - uWet * 0.2 * (1.0 - settle);
            }`)
}

// Patch a material so it follows the seasons, keeping any onBeforeCompile it has
export function makeSeasonal(material, options = {})
{
    const previous = material.onBeforeCompile
    const key = `seasonal-${options.key || ''}-${options.foliage || 0}-${options.snow ?? 1}-${options.ground ? 1 : 0}`
    material.onBeforeCompile = (shader, renderer) =>
    {
        if(previous) previous(shader, renderer)
        seasonalShader(shader, options)
    }
    material.customProgramCacheKey = () => key
    material.needsUpdate = true
    return material
}
