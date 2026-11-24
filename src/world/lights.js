import * as THREE from 'three'
import { BAY_ANGLE, SUN_ELEVATION } from './layout.js'

// Sun above the sunset bay. Its height above the local horizon drops as you
// walk from the middle of the island towards the bay.
export const SUN_DIRECTION = new THREE.Vector3(
    Math.cos(BAY_ANGLE) * Math.cos(SUN_ELEVATION),
    Math.sin(SUN_ELEVATION),
    Math.sin(BAY_ANGLE) * Math.cos(SUN_ELEVATION)
).normalize()

export function createLights(scene)
{
    const hemi = new THREE.HemisphereLight('#D6E6F5', '#C2A27F', 1.55)
    scene.add(hemi)

    const sun = new THREE.DirectionalLight('#FFE2BC', 2.3)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -34
    sun.shadow.camera.right = 34
    sun.shadow.camera.top = 34
    sun.shadow.camera.bottom = -34
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 220
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.04
    scene.add(sun)
    scene.add(sun.target)

    const _up = new THREE.Vector3()
    return {
        hemi,
        sun,
        // keep the shadow box centred on what the camera is looking at
        update(focus)
        {
            _up.copy(focus).normalize()
            hemi.position.copy(_up)
            sun.target.position.copy(focus)
            sun.position.copy(focus).addScaledVector(SUN_DIRECTION, 110)
            sun.target.updateMatrixWorld()
        }
    }
}
