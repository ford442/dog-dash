import * as THREE from 'three';
import {
    MeshBasicNodeMaterial,
    MeshStandardNodeMaterial
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
    length,
    smoothstep,
    dot,
    fract,
    max
} from 'three/tsl';

// --- TSL Noise Functions ---

const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();

    // Four corners
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));

    // Smooth interpolation curve
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

const fbm = (v: any) => {
    let total = float(0.0);
    let amplitude = float(0.5);
    let frequency = float(1.0);

    // 3 Octaves
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    return total;
};

/**
 * Creates a TSL material for cloud sprites (billboards).
 * Features:
 * - Procedural shape (Soft circle + Noise erosion)
 * - Billowing animation (Time-based noise offset)
 * - Internal lighting/shading simulation via noise density
 * - Lightning flash support
 */
function createCloudSpriteMaterial(baseColorHex: number, opacity: number, detail: number = 1.0) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: opacity,
        side: THREE.FrontSide, // Sprites face camera
        depthWrite: false, // Soft blending
        blending: THREE.NormalBlending // Standard alpha blending
    });

    const uTime = time;
    const uBillowSpeed = uniform(0.2);
    const uFlash = uniform(0.0);
    const uDetail = uniform(detail);

    // --- Fragment Shader ---
    const vUv = uv();

    // Center UVs to -0.5 to 0.5 for radial calculations
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0); // 0 at center, 1 at edge

    // 1. Base Shape (Soft Circle)
    const core = float(1.0).sub(dist); // 1 at center, 0 at edge
    const softShape = smoothstep(0.0, 0.2, core); // Soft edge fade

    // 2. Procedural Noise (Texture)
    // Scale UVs for noise
    const noiseUv = vUv.mul(3.0).mul(uDetail);

    // Animate noise for billowing effect
    // We scroll the noise domain slightly and evolve z-slice (if 3d) or just offset
    const scroll = vec2(uTime.mul(uBillowSpeed).mul(0.5), uTime.mul(uBillowSpeed).mul(0.2));
    const noiseVal = fbm(noiseUv.add(scroll));

    // 3. Erode shape with noise
    // Combine shape and noise.
    // Edges get more eroded. Center stays denser.
    const density = softShape.mul(noiseVal.add(0.2));

    // Sharpen alpha slightly to define puff
    const alpha = smoothstep(0.1, 0.6, density).mul(opacity);

    // 4. Color & Lighting
    const baseColor = color(new THREE.Color(baseColorHex));

    // internal shadows: darker where noise is low (crevices)
    const shadowFactor = noiseVal.mul(0.5).add(0.5);
    const finalColor = baseColor.mul(shadowFactor);

    // 5. Lightning Flash
    // Flash adds white emissive boost
    const flashColor = color(0xffffff);
    const flashedColor = mix(finalColor, flashColor, uFlash);

    mat.colorNode = vec4(flashedColor, alpha);

    // Store uniforms
    mat.userData.uFlash = uFlash;

    return mat;
}

export class CloudLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    windSpeed: number; // Independent speed
    width: number;

    // Instance data
    positions: Float32Array;
    scales: Float32Array;

    constructor(
        scene: THREE.Scene,
        config: {
            count: number,
            z: number,
            zRange: number,
            color: number,
            opacity: number,
            scaleMin: number,
            scaleMax: number,
            windSpeed: number, // Speed relative to world (crawling)
            width: number,
            detail?: number
        }
    ) {
        this.count = config.count;
        this.windSpeed = config.windSpeed;
        this.width = config.width;

        // Use PlaneGeometry for Sprites
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = createCloudSpriteMaterial(config.color, config.opacity, config.detail || 1.0);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false; // Infinite scroll
        this.mesh.renderOrder = config.z < 0 ? -2 : 2; // Background vs Foreground ordering

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.scales = new Float32Array(this.count);

        // Initial Layout
        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * config.width;
            const y = (Math.random() - 0.5) * 30; // Spread vertically
            const z = config.z + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.scales[i] = s;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.set(s * 1.5, s, 1.0); // Wider clouds
            this.dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.2); // Slight tilt

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number) {
        // Parallax & Scrolling Logic
        // We want clouds to "crawl" (windSpeed) AND parallax.
        // Actually, if we move them by windSpeed * delta, they move in world space.
        // The camera movement naturally creates parallax.

        const margin = 30;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // 1. Apply Wind
            this.positions[idx] += this.windSpeed * delta;

            let x = this.positions[idx];

            // 2. Wrap around camera
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                // Optional: Randomize Y slightly on respawn to vary pattern?
                // this.positions[idx+1] = (Math.random() - 0.5) * 30;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            if (needsUpdate || this.windSpeed !== 0) {
                // Update matrix
                const y = this.positions[idx+1];
                const z = this.positions[idx+2];
                const s = this.scales[i];

                this.dummy.position.set(x, y, z);
                this.dummy.scale.set(s * 1.5, s, 1.0);
                // Keep rotation? We didn't store it, assuming static small tilt is fine or reset it.
                // Let's keep it simple and reset tilt to random deterministic if needed,
                // but here we just zero it or keep previous if we read it back.
                // Optim: Just set it.
                this.dummy.rotation.set(0, 0, 0);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    flash(intensity: number) {
        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uFlash) {
            mat.userData.uFlash.value = intensity;
        }
    }
}

export class CloudSystem {
    scene: THREE.Scene;
    layers: CloudLayer[] = [];
    lightningTimer: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    initLayers() {
        // "Thunder Force IV" Style - 5 Layers

        // Layer 1: Deep Background (Slowest, Faint, Huge)
        // Crawls slowly to the left (negative speed)
        this.layers.push(new CloudLayer(this.scene, {
            count: 25,
            z: -80,
            zRange: 20,
            color: 0x0a0a20, // Very dark blue
            opacity: 0.9,
            scaleMin: 40,
            scaleMax: 60,
            windSpeed: -2.0, // Crawl
            width: 400,
            detail: 0.5
        }));

        // Layer 2: Background (Dark, slightly faster)
        this.layers.push(new CloudLayer(this.scene, {
            count: 30,
            z: -50,
            zRange: 15,
            color: 0x151530,
            opacity: 0.8,
            scaleMin: 30,
            scaleMax: 45,
            windSpeed: -3.0,
            width: 350,
            detail: 0.8
        }));

        // Layer 3: Mid-Ground (Main cloud layer, semi-transparent)
        this.layers.push(new CloudLayer(this.scene, {
            count: 40,
            z: -25,
            zRange: 10,
            color: 0x2a2a50,
            opacity: 0.6,
            scaleMin: 20,
            scaleMax: 30,
            windSpeed: -5.0,
            width: 300,
            detail: 1.0
        }));

        // Layer 4: Near-Mid (Lighter, faster)
        this.layers.push(new CloudLayer(this.scene, {
            count: 20,
            z: -10,
            zRange: 5,
            color: 0x444477,
            opacity: 0.4,
            scaleMin: 15,
            scaleMax: 20,
            windSpeed: -8.0,
            width: 250,
            detail: 1.5
        }));

        // Layer 5: Foreground (Passes in front/very close, fast, transparent, detailed)
        // Z > 0 (Player is at 0)
        this.layers.push(new CloudLayer(this.scene, {
            count: 10,
            z: 8,
            zRange: 4,
            color: 0x666699,
            opacity: 0.2,
            scaleMin: 8,
            scaleMax: 12,
            windSpeed: -15.0, // Whoosh
            width: 200,
            detail: 2.0
        }));
    }

    update(delta: number, cameraX: number, playerSpeed: number) {
        this.layers.forEach(layer => layer.update(delta, cameraX));

        // Lightning Logic
        this.lightningTimer -= delta;
        if (this.lightningTimer <= 0) {
            this.triggerLightning();
            this.lightningTimer = 3 + Math.random() * 8; // Frequent storms
        }

        // Update flash decay
        this.layers.forEach(layer => {
            const mat = layer.mesh.material as any;
            if (mat.userData && mat.userData.uFlash) {
                const current = mat.userData.uFlash.value;
                if (current > 0.01) {
                    mat.userData.uFlash.value = current * 0.85;
                } else {
                    mat.userData.uFlash.value = 0;
                }
            }
        });
    }

    triggerLightning() {
        // Flash deep layers more often
        const layerIdx = Math.floor(Math.random() * 3); // 0, 1, or 2
        const layer = this.layers[layerIdx];
        const intensity = 0.6 + Math.random() * 0.4;

        layer.flash(intensity);

        // Chain reaction (flash nearby layers)
        if (Math.random() > 0.5 && layerIdx < this.layers.length - 1) {
            setTimeout(() => this.layers[layerIdx + 1].flash(intensity * 0.5), 100);
        }
    }
}
