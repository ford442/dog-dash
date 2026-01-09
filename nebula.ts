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
    step,
    fract,
    pow,
    length
} from 'three/tsl';

/**
 * Creates a TSL material for a nebula cloud puff.
 * Features:
 * - Procedural noise for gaseous texture.
 * - Pulsing opacity/brightness.
 * - Soft edges.
 */
function createNebulaMaterial(baseColorHex: number, secondaryColorHex: number, opacity: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: opacity,
        side: THREE.FrontSide, // Sprites face camera usually, or billboards
        depthWrite: false, // Soft particles
        blending: THREE.AdditiveBlending // Glow effect
    });

    const uTime = time;
    const uPulseSpeed = uniform(0.5);

    // --- Fragment Shader ---
    const vUv = uv();

    // 1. Soft Circular Shape (Billboard style usually, but here applied to Sphere geometry)
    // If using SphereGeometry, we don't need manual circle discard, but we want soft edges.
    // Let's use noise to erode the edges.

    // Position-based noise (3D)
    // We use local position to keep noise attached to the object, but animate it.
    const pos = positionLocal.mul(0.5); // Scale noise

    // Simple 3D noise approximation
    const noise1 = sin(pos.x.add(uTime.mul(0.2))).mul(cos(pos.y.add(uTime.mul(0.3))));
    const noise2 = cos(pos.z.add(uTime.mul(0.1))).mul(sin(pos.x.mul(2.0)));
    const combinedNoise = noise1.add(noise2).mul(0.5).add(0.5); // 0..1

    // Radial gradient from center (assuming Sphere centered at 0)
    // For a sphere of radius 1, len is 0..1
    const dist = length(pos.mul(2.0)); // 0 at center, 1 at edge
    const core = float(1.0).sub(dist); // 1 at center, 0 at edge
    const softCore = core.pow(2.0); // Soft falloff

    // Combine noise and core
    const density = softCore.mul(combinedNoise.add(0.5)); // Boost density slightly

    // 2. Color Shift
    const col1 = color(new THREE.Color(baseColorHex));
    const col2 = color(new THREE.Color(secondaryColorHex));

    // Pulse between colors
    const pulse = sin(uTime.mul(uPulseSpeed)).add(1.0).mul(0.5); // 0..1
    const finalColor = mix(col1, col2, pulse.mul(combinedNoise));

    mat.colorNode = vec4(finalColor, density.mul(opacity));

    return mat;
}

/**
 * Creates a TSL material for energy particles (sparkles).
 */
function createEnergyParticleMaterial(colorHex: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const uTime = time;

    // Blink/Sparkle based on time and random phase (simulated by position)
    const pos = positionLocal;
    // Using position as random seed
    const phase = pos.x.mul(10.0).add(pos.y.mul(20.0)).add(pos.z.mul(30.0));

    const sparkle = sin(uTime.mul(5.0).add(phase)).add(1.0).mul(0.5); // 0..1
    const sharpSparkle = pow(sparkle, 4.0); // Sharp flashes

    const baseColor = color(new THREE.Color(colorHex));

    mat.colorNode = vec4(baseColor, sharpSparkle);

    return mat;
}

export class NebulaCloudLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    depth: number;
    baseZ: number;

    // Instance Data
    positions: Float32Array;
    velocities: Float32Array; // Drift velocity per cloud

    constructor(
        scene: THREE.Scene,
        config: {
            count: number,
            color1: number,
            color2: number,
            opacity: number,
            sizeMin: number,
            sizeMax: number,
            z: number,
            zRange: number,
            width: number,
            height: number
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.depth = config.zRange;
        this.baseZ = config.z;

        // Geometry: Low poly sphere is fine for soft clouds
        const geo = new THREE.SphereGeometry(1, 8, 8);
        const mat = createNebulaMaterial(config.color1, config.color2, config.opacity);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false; // Always update
        this.mesh.renderOrder = -1; // Render behind everything (background)

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count * 3);

        for (let i = 0; i < this.count; i++) {
            // Random Position
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.height;
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            // Random Drift Velocity (slow)
            // Clouds drift in different directions
            this.velocities[i*3] = (Math.random() - 0.5) * 2.0; // X drift
            this.velocities[i*3+1] = (Math.random() - 0.5) * 0.5; // Y drift
            this.velocities[i*3+2] = 0; // Z drift (usually 0 to keep layers intact)

            this.dummy.position.set(x, y, z);

            // Random Scale
            const s = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
            this.dummy.scale.set(s * 1.5, s, s); // Slightly wider

            // Random Rotation
            this.dummy.rotation.z = Math.random() * Math.PI;

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number) {
        const margin = 50;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // Apply drift
            this.positions[idx] += this.velocities[idx] * delta;
            this.positions[idx+1] += this.velocities[idx+1] * delta;

            let x = this.positions[idx];
            let y = this.positions[idx+1];
            let z = this.positions[idx+2];

            // Wrap X (Infinite Scroll)
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            // Wrap Y (Drift return)
            if (y > 40) { y = -40; this.positions[idx+1] = y; needsUpdate = true; }
            if (y < -40) { y = 40; this.positions[idx+1] = y; needsUpdate = true; }

            if (needsUpdate || true) { // Always update for smooth drift
                this.mesh.getMatrixAt(i, this.dummy.matrix);
                const p = new THREE.Vector3();
                const q = new THREE.Quaternion();
                const s = new THREE.Vector3();
                this.dummy.matrix.decompose(p, q, s);

                this.dummy.position.set(x, y, z);
                this.dummy.rotation.z += delta * 0.05; // Slow rotate
                this.dummy.scale.copy(s);
                this.dummy.quaternion.copy(q);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

export class EnergyParticleLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;
    positions: Float32Array;

    constructor(scene: THREE.Scene, count: number, z: number, width: number) {
        this.count = count;
        this.width = width;
        this.baseZ = z;

        const geo = new THREE.OctahedronGeometry(0.2, 0);
        const mat = createEnergyParticleMaterial(0x88ffff);

        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(count * 3);

        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * width;
            const y = (Math.random() - 0.5) * 30;
            const z = this.baseZ + (Math.random() - 0.5) * 10;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.setScalar(0.5 + Math.random());
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];

            // Slow float
            x += delta * 0.5; // Particles float forward slightly?

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            this.positions[idx] = x;

            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
            this.dummy.rotation.y += delta;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) this.mesh.instanceMatrix.needsUpdate = true;
    }
}

export class NebulaSystem {
    scene: THREE.Scene;
    active: boolean = false;
    layers: (NebulaCloudLayer | EnergyParticleLayer)[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    initLayers() {
        // 1. Far Background (Purple/Pink, Large, Slow)
        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 20,
            color1: 0x4b0082, // Indigo
            color2: 0x8a2be2, // BlueViolet
            opacity: 0.4,
            sizeMin: 20,
            sizeMax: 40,
            z: -60,
            zRange: 20,
            width: 300,
            height: 60
        }));

        // 2. Mid Background (Cyan/Blue, Transparent)
        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 15,
            color1: 0x00008b, // DarkBlue
            color2: 0x00ced1, // DarkTurquoise
            opacity: 0.3,
            sizeMin: 15,
            sizeMax: 25,
            z: -40,
            zRange: 15,
            width: 250,
            height: 50
        }));

        // 3. Foreground Mist (Pink, sparse, faster drift)
        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 10,
            color1: 0xff1493, // DeepPink
            color2: 0xff69b4, // HotPink
            opacity: 0.15,
            sizeMin: 10,
            sizeMax: 20,
            z: -20,
            zRange: 10,
            width: 200,
            height: 40
        }));

        // 4. Energy Particles
        this.layers.push(new EnergyParticleLayer(this.scene, 50, -30, 200));

        this.deactivate(); // Start hidden
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.layers.forEach(l => l.mesh.visible = true);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layers.forEach(l => l.mesh.visible = false);
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(delta, cameraX));
    }
}
