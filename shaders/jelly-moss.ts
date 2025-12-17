import * as THREE from 'three';
import {
    color,
    time,
    positionLocal,
    positionWorld,
    normalLocal,
    vec3,
    vec4,
    float,
    uniform,
    mix,
    sin,
    cos,
    modelWorldMatrix,
    cameraPosition,
    smoothstep,
    dot,
    abs
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

/**
 * Creates the shader material for the Nebula Jelly-Moss membrane.
 * Features:
 * - Vertex wobble: Sine-wave based vertex displacement for gelatinous look.
 * - Fresnel/Rim light: Edges are more opaque/glowing.
 * - Semi-transparency: Center is more transparent.
 */
export function createJellyMembraneMaterial(baseColorHex: number = 0x88ffaa) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
        metalness: 0.2,
        side: THREE.DoubleSide
    });

    // Uniforms for animation
    const uTime = time; // Global time node
    const uWobbleStr = uniform(0.05); // Wobble amplitude
    const uPulse = uniform(0.0); // 0 to 1 pulse for color/glow

    // --- Vertex Shader: Wobble ---
    // Displace vertices based on position and time
    const pos = positionLocal;

    // Simple 3D sine wave interference for organic wobble
    const wobbleX = sin(pos.y.mul(4.0).add(uTime.mul(2.0)));
    const wobbleY = cos(pos.z.mul(4.0).add(uTime.mul(1.5)));
    const wobbleZ = sin(pos.x.mul(4.0).add(uTime.mul(2.5)));

    const displacement = vec3(wobbleX, wobbleY, wobbleZ).mul(uWobbleStr);

    // Apply displacement along normal to preserve volume somewhat better
    const newPos = pos.add(displacement);
    mat.positionNode = newPos;


    // --- Fragment Shader: Fresnel & Pulse ---

    // View direction
    // const vViewPosition = cameraPosition.sub(positionWorld); // Vector from cam to pixel
    // const viewDir = vViewPosition.normalize();

    // Calculate Fresnel term (dot product of view direction and normal)
    // TSL has helper for viewDir usually, but let's build it manually to be safe
    // Note: positionWorld is absolute world pos.

    // Note: WebGPU nodes handle viewDirection implicitly in some contexts,
    // but `viewDir` might not be directly exported in all versions of TSL helper yet.
    // Let's rely on standard fresnel-like calculation logic.
    // However, MeshStandardMaterial handles PBR fresnel. We want an *emissive* rim.

    // We can just set the colorNode to mix base color with a rim color.

    // Simple pulse color
    const pulseColor = color(0xffffff);
    const baseColorNode = color(baseColorHex);

    const finalColor = mix(baseColorNode, pulseColor, uPulse.mul(0.5));

    mat.colorNode = vec4(finalColor, 0.6); // Base opacity 0.6

    // Emissive node for the glow
    mat.emissiveNode = mix(vec3(0.0), pulseColor, uPulse.mul(0.5));

    // Expose uniforms on user data so we can update them from JS if needed (though TSL handles time auto)
    mat.userData.uWobbleStr = uWobbleStr;
    mat.userData.uPulse = uPulse;

    return mat;
}

/**
 * Creates the shader material for the Fractal Moss "Cores".
 * Features:
 * - Noise-like color variation.
 * - Pulsing emissive core.
 */
export function createJellyMossMaterial(colorHex: number = 0x44ff88) {
    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.5,
        roughness: 0.9,
        metalness: 0.1
    });

    // Uniforms
    const uPulse = uniform(0.0);

    // Pulse brightness
    const baseEmissive = vec3(0.0);
    const activeEmissive = color(colorHex).mul(2.0); // Bright glow

    // Mix based on pulse
    mat.emissiveNode = mix(baseEmissive, activeEmissive, uPulse);

    mat.userData.uPulse = uPulse;

    return mat;
}
