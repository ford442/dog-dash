import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    positionLocal,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    dot,
    normalView,
    viewportTopLeft,
    positionView,
    normalize,
    cameraPosition
} from 'three/tsl';

/**
 * Creates a TSL material for the planet surface.
 * Features:
 * - Scrolling texture (simulated rotation)
 * - Atmosphere glow (Fresnel)
 * - Day/Night terminal (lighting) - actually handled by StandardMaterial + Light
 */
function createPlanetMaterial(baseColorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.8,
        metalness: 0.1,
    });

    const uTime = time;
    const uScrollSpeed = uniform(0.02); // Rotation speed

    // --- Planet Surface Pattern (Procedural Noise) ---
    const vUv = uv();

    // Scroll the texture to simulate rotation
    const scrollX = uTime.mul(uScrollSpeed);
    const scrolledUv = vec2(vUv.x.add(scrollX), vUv.y);

    // Simple noise approximation
    // sin(x*f) + sin(y*f)
    const noise = sin(scrolledUv.x.mul(20.0)).add(sin(scrolledUv.y.mul(10.0)));
    const detail = sin(scrolledUv.x.mul(50.0).add(scrolledUv.y.mul(50.0))).mul(0.5);

    const terrain = noise.add(detail).mul(0.5).add(0.5); // 0 to 1

    // Mix colors based on terrain
    const oceanColor = color(0x001133);
    const landColor = color(0x225522);
    const mountainColor = color(0x554433);

    // Color Ramps
    // < 0.4 = Ocean
    // 0.4 - 0.7 = Land
    // > 0.7 = Mountain

    const isLand = terrain.greaterThan(0.4);
    const isMountain = terrain.greaterThan(0.7);

    let surfaceColor = mix(oceanColor, landColor, isLand);
    surfaceColor = mix(surfaceColor, mountainColor, isMountain);

    // Apply to color node
    mat.colorNode = vec4(surfaceColor, 1.0);

    return mat;
}

/**
 * Creates a TSL material for the Atmosphere Halo
 */
function createAtmosphereMaterial(atmosphereColorHex: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.BackSide, // Render on inside of a slightly larger sphere? Or FrontSide of outer shell?
                              // Usually BackSide of a larger sphere looks good for internal glow,
                              // but for external view, FrontSide of larger sphere with fresnel opacity.
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    // Fresnel Effect for Atmosphere
    // Opacity is high at edges, low at center
    // Dot(View, Normal)
    // View vector is needed.
    // In TSL:
    // const viewDir = normalize( cameraPosition.sub( positionWorld ) );
    // const fresnel = dot( viewDir, normalWorld );
    // Or simplified: normalView.z is often enough approximation in view space?

    // Let's try simple edge detection using normalView (which is view space normal)
    // normalView.z is 1 when facing camera, 0 when perpendicular (edge)
    // We want glow at edge (0) -> high opacity
    // glow at center (1) -> low opacity

    // This requires the normal to be updated correctly.
    // Since we are using BackSide, normals might be inverted?
    // Let's use FrontSide on a slightly larger sphere.
    mat.side = THREE.FrontSide;

    const nView = normalView; // vec3
    const rim = float(1.0).sub(nView.z.abs()); // 0 at center, 1 at edge
    const glow = rim.pow(4.0); // Sharpen the rim

    const atmColor = color(atmosphereColorHex);
    mat.colorNode = vec4(atmColor, glow);

    return mat;
}

export class PlanetaryHorizonSystem {
    scene: THREE.Scene;
    planet: THREE.Mesh;
    atmosphere: THREE.Mesh;
    active: boolean = false;

    // Config
    radius: number = 400; // Huge
    distanceY: number = -380; // Positioned so top surface is near Y=-20?
                              // Player is at Y=0. Ground is -50 effectively.
                              // If radius is 400, center at -420 puts top at -20.

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Planet Sphere
        const planetGeo = new THREE.SphereGeometry(this.radius, 64, 64);
        const planetMat = createPlanetMaterial(0x2255ff);
        this.planet = new THREE.Mesh(planetGeo, planetMat);

        // Positioned below
        this.planet.position.set(0, -420, -50);
        // Z=-50 puts it in background, parallax will handle movement if we don't attach to camera.
        // Wait, "Horizon" usually means it moves WITH the camera but rotates.
        // If it's static in world, the player will fly over it.
        // Given the scale (radius 400), flying 100 units/sec (fast) would cross it in 8 seconds.
        // We probably want it to follow the camera X but rotate.

        this.planet.visible = false;
        this.scene.add(this.planet);

        // 2. Atmosphere Shell
        const atmGeo = new THREE.SphereGeometry(this.radius * 1.05, 64, 64);
        const atmMat = createAtmosphereMaterial(0x4488ff);
        this.atmosphere = new THREE.Mesh(atmGeo, atmMat);
        this.atmosphere.position.copy(this.planet.position);
        this.atmosphere.visible = false;
        this.scene.add(this.atmosphere);
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.planet.visible = true;
        this.atmosphere.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.planet.visible = false;
        this.atmosphere.visible = false;
    }

    update(cameraX: number) {
        if (!this.active) return;

        // Follow camera X
        // This makes it an "Infinite Horizon"
        this.planet.position.x = cameraX;
        this.atmosphere.position.x = cameraX;

        // Rotate planet to simulate movement over surface
        // Player moves +X
        // Planet should rotate -Z (around Y axis? No, around Z axis would be rolling)
        // Rolling forward: Rotate -Z.
        // Wait, if I fly East (Right, +X) over a planet, the surface below moves West (-X).
        // On a sphere below me, that corresponds to rotation around the Z axis?
        // No, Z axis comes out of screen. Rotation around Z rotates the texture in the 2D plane (clock/counterclock).
        // We want rotation around Y axis? That would be turning left/right.
        // We want rotation around Z axis, effectively "rolling" the sphere?
        // Or texture scrolling?
        // The shader already handles texture scrolling (uScrollSpeed).
        // So we might just need to orient the sphere correctly.

        // Actually, TSL shader `uScrollSpeed` scrolls UVs.
        // Standard Sphere UVs wrap around Y axis (longitude).
        // So scrolling U moves texture horizontally.
        // If we rotate the sphere 90 deg so pole faces camera?
        // Let's stick to standard orientation.
        // Scrolling UV.x moves texture around the equator.
        // This looks like spinning.

        // If we want to fly "forward" over the horizon, we might want UV.y scrolling?
        // Or if we are flying "Right" across the screen, we want UV.x scrolling.
        // Yes, side scroller. We fly Right. Surface moves Left.
        // So scrolling UV.x is correct.
    }
}
