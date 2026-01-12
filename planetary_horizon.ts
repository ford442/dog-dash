import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial,
    PointsNodeMaterial
} from 'three/webgpu';
import {
    time,
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
    smoothstep,
    dot,
    normalView,
    positionLocal,
    cameraPosition
} from 'three/tsl';

// --- TSL Noise Helpers ---

// Simple pseudo-random function
// Returns float 0..1
const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

// Value Noise 2D
// We can use a simplified version using sin waves for stability if explicit noise is hard
const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();

    // Four corners
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));

    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0))); // smoothstep curve

    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

// Fractal Brownian Motion (3 Octaves)
const fbm = (v: any) => {
    let total = float(0.0);
    let amplitude = float(0.5);
    let frequency = float(1.0);

    // Octave 1
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    // Octave 2
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    // Octave 3
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    return total;
};

/**
 * Creates a TSL material for the Planet Surface (High Detail).
 */
function createPlanetSurfaceMaterial(baseColorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.7,
        metalness: 0.2,
    });

    const uTime = time;
    const uScrollSpeed = uniform(0.015); // Slow rotation

    const vUv = uv();

    // Scroll texture horizontally to simulate planet rotation under the ship
    const scrollX = uTime.mul(uScrollSpeed);
    const p = vec2(vUv.x.add(scrollX).mul(10.0), vUv.y.mul(10.0)); // Scale UVs

    // Generate Height/Terrain Map
    const height = fbm(p); // 0..1

    // Terrain Classification
    // Ocean < 0.45
    // Land 0.45 - 0.7
    // Mountain > 0.7

    const oceanColor = color(0x051040); // Deep Blue/Black
    const coastColor = color(0x1a4080); // Lighter Blue
    const landColor = color(0x2a2a35);  // Alien Grey/Rock
    const mountainColor = color(0x555566); // Snowy/Rocky peaks

    // Mix Colors
    // 1. Ocean vs Land
    const isLand = smoothstep(0.4, 0.45, height);
    let finalColor = mix(oceanColor, landColor, isLand);

    // 2. Coastline highlight (rim of land)
    const isCoast = smoothstep(0.4, 0.45, height).sub(smoothstep(0.45, 0.5, height));
    finalColor = mix(finalColor, coastColor, isCoast.mul(0.5));

    // 3. Mountains
    const isMountain = smoothstep(0.7, 0.8, height);
    finalColor = mix(finalColor, mountainColor, isMountain);

    // Specular / Roughness Map
    // Oceans are smooth (low roughness), Land is rough
    const rough = mix(float(0.2), float(0.9), isLand);
    mat.roughnessNode = rough;

    // Output
    mat.colorNode = vec4(finalColor, 1.0);

    return mat;
}

/**
 * Creates a TSL material for the Cloud Layer.
 */
function createPlanetCloudMaterial() {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        opacity: 0.8,
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.FrontSide
    });

    const uTime = time;
    const uCloudSpeed = uniform(0.025); // Slightly faster than surface

    const vUv = uv();
    const scrollX = uTime.mul(uCloudSpeed);
    const p = vec2(vUv.x.add(scrollX).mul(8.0), vUv.y.mul(8.0));

    // Cloud Noise
    const n = fbm(p.add(vec2(23.4, 51.2))); // Offset seed

    // Threshold for clouds (only show high density)
    const density = smoothstep(0.5, 0.8, n);

    const cloudColor = color(0xaaccff);

    // Shadows? Simple approximation: darken bottom of clouds?
    // For now just white/blue clouds
    mat.colorNode = vec4(cloudColor, density.mul(0.8)); // Max opacity 0.8

    return mat;
}

/**
 * Creates a TSL material for the Atmosphere Halo.
 */
function createAtmosphereMaterial(atmosphereColorHex: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.FrontSide, // Outer shell
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const nView = normalView;
    // Edge glow (Fresnel)
    // 0 at center, 1 at edge
    const rim = float(1.0).sub(nView.z.abs());
    const glow = rim.pow(3.0);

    const atmColor = color(atmosphereColorHex);
    mat.colorNode = vec4(atmColor, glow.mul(0.8));

    return mat;
}

/**
 * Creates Deep Space Starfield points that will parallax.
 */
function createDeepSpaceStars(count: number = 1000) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const width = 1000;
    const height = 500;
    const depth = 200;

    for(let i=0; i<count; i++) {
        positions[i*3] = (Math.random() - 0.5) * width;
        positions[i*3+1] = (Math.random() - 0.5) * height; // Above and below horizon
        positions[i*3+2] = (Math.random() - 0.5) * depth - 100; // Far behind planet

        sizes[i] = Math.random() * 2.0 + 0.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new PointsNodeMaterial({
        size: 1.0,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    // Simple white stars
    mat.colorNode = vec4(1.0, 1.0, 1.0, 1.0);

    const stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false; // Always render, we handle wrapping manually
    return stars;
}

export class PlanetaryHorizonSystem {
    scene: THREE.Scene;
    active: boolean = false;

    // Components
    container: THREE.Group;
    planet: THREE.Mesh;
    clouds: THREE.Mesh;
    atmosphere: THREE.Mesh;
    bgStars: THREE.Points;

    // Parallax Config
    // Planet moves with camera X (Horizon)
    // BgStars move at 95% camera speed (creating "Deep Space" depth where they drift slowly)
    starPositions: Float32Array;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.container = new THREE.Group();
        this.scene.add(this.container);

        const radius = 400;

        // 1. Planet Surface
        const planetGeo = new THREE.SphereGeometry(radius, 128, 128); // Higher detail
        const planetMat = createPlanetSurfaceMaterial(0x2255ff);
        this.planet = new THREE.Mesh(planetGeo, planetMat);
        this.planet.position.set(0, -420, -100); // Center below, deep in background
        this.container.add(this.planet);

        // 2. Cloud Layer
        const cloudGeo = new THREE.SphereGeometry(radius * 1.01, 128, 128); // Slightly larger
        const cloudMat = createPlanetCloudMaterial();
        this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
        this.clouds.position.copy(this.planet.position);
        this.container.add(this.clouds);

        // 3. Atmosphere Halo
        const atmGeo = new THREE.SphereGeometry(radius * 1.15, 64, 64);
        const atmMat = createAtmosphereMaterial(0x4488ff);
        this.atmosphere = new THREE.Mesh(atmGeo, atmMat);
        this.atmosphere.position.copy(this.planet.position);
        this.container.add(this.atmosphere);

        // 4. Deep Space Stars
        this.bgStars = createDeepSpaceStars(2000);
        this.bgStars.position.z = -200; // Far back
        this.starPositions = (this.bgStars.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        this.container.add(this.bgStars);

        this.deactivate();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.container.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.container.visible = false;
    }

    update(cameraX: number, delta: number = 0.016) {
        if (!this.active) return;

        // 1. Planet Follows Camera Exactly (Horizon Effect)
        // This makes the planet feel massive and stationary relative to the "horizon" line
        this.planet.position.x = cameraX;
        this.clouds.position.x = cameraX;
        this.atmosphere.position.x = cameraX;

        // 2. Stars Parallax
        // Stars should move SLOWER than camera to appear far away.
        // If they move at 0.95 * cameraX, they drift backwards at 0.05 speed relative to camera.
        // But we need to wrap them so we never run out of stars.

        const parallaxFactor = 0.95;
        const starContainerX = cameraX * parallaxFactor;

        // We simulate the container moving, but since we want infinite wrapping,
        // we might keep container at 0 and update star positions?
        // Or keep container at starContainerX and wrap local positions?

        this.bgStars.position.x = starContainerX;

        // Wrapping Logic
        // The view window in "Star Space" is [cameraX - width/2, cameraX + width/2]
        // But since we moved the container to `starContainerX`, the local view window is shifted.
        // Relative Camera X inside the container:
        const relCamX = cameraX - starContainerX; // = cameraX * (1 - 0.95) = 0.05 * cameraX

        // We wrap stars around this relative position
        const width = 1000; // Match generation width
        const halfWidth = width / 2;

        const count = this.starPositions.length / 3;
        let needsUpdate = false;

        for(let i=0; i<count; i++) {
            let x = this.starPositions[i*3];

            // If star falls too far behind relative view center
            if (x < relCamX - halfWidth) {
                x += width;
                this.starPositions[i*3] = x;
                needsUpdate = true;
            }
            // If star is too far ahead (e.g. going left)
            else if (x > relCamX + halfWidth) {
                x -= width;
                this.starPositions[i*3] = x;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.bgStars.geometry.attributes.position.needsUpdate = true;
        }

        // 3. Rotation (Simulated by Shader mostly, but we can add slow mesh rotation too)
        // Rotating the mesh slightly adds 3D curvature feel at the poles
        this.planet.rotation.z += 0.005 * delta;
        this.clouds.rotation.z += 0.008 * delta; // Differential rotation
    }
}
