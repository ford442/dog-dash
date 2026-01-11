import * as THREE from 'three';
import {
    MeshStandardNodeMaterial
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
    step,
    fract
} from 'three/tsl';

/**
 * Creates a TSL material for a conveyor belt with animated warning stripes.
 * Visuals:
 * - Scrolling diagonal stripes (black and yellow)
 * - Metallic roughness
 */
function createConveyorMaterial(speed: number) {
    const mat = new MeshStandardNodeMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.6,
        side: THREE.FrontSide
    });

    const uTime = time;
    const uSpeed = uniform(speed);

    // UVs for texture generation
    const vUv = uv();

    // animate UVs: x + time * speed
    // We want diagonal stripes.
    // stripe pattern = fract((u + v) * density + time * speed)
    const density = float(10.0);
    const patternInput = vUv.x.add(vUv.y).mul(density).add(uTime.mul(uSpeed));
    const stripe = step(0.5, fract(patternInput)); // 0 or 1

    // Colors
    const colorBase = color(0x222222); // Dark rubber/metal
    const colorStripe = color(0xffcc00); // Warning yellow

    // Emission (faint glow on yellow stripes)
    const emissiveBase = color(0x000000);
    const emissiveStripe = color(0x332200);

    mat.colorNode = vec4(mix(colorBase, colorStripe, stripe), 1.0);
    mat.emissiveNode = mix(emissiveBase, emissiveStripe, stripe);

    return mat;
}

/**
 * Creates a TSL material for energy conduits (pulsing pipes).
 * Visuals:
 * - Base dark metal pipe
 * - Glowing core that pulses with sine wave
 */
function createPulsingConduitMaterial(baseColorHex: number, glowColorHex: number, pulseSpeed: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.4,
        metalness: 0.9,
    });

    const uTime = time;
    const vUv = uv();

    // Simulate a glowing liquid/energy flowing through the pipe
    // We assume the pipe is a cylinder mapped such that V is along length or U is along length.
    // Usually cylinder U wraps around, V is height.
    // Let's assume V is along the length (vertical cylinder) or X axis if rotated.

    // Energy flow calculation
    const flow = sin(vUv.y.mul(20.0).minus(uTime.mul(pulseSpeed))).add(1.0).mul(0.5); // 0..1

    // Add some noise/variation?
    const pulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // Global pulse

    const glowColor = color(glowColorHex);
    // const baseColor = color(baseColorHex);

    // Center glow (simulating core) -> assume uv.x 0..1 wraps around.
    // If we want the pipe to look like it has a glowing core visible through slots,
    // we can use a stripe pattern on UV.x
    // stripe = step(0.8, fract(vUv.x * 4.0)) ...

    // Let's just make the whole pipe pulse for now as "energy conduit"
    mat.emissiveNode = glowColor.mul(flow).mul(pulse).mul(2.0); // Intense glow

    return mat;
}

/**
 * Creates a material for foreground silhouette structures.
 * Visuals:
 * - Dark, almost black metal
 * - High roughness (rusty/dusty)
 * - Slight rim light via metalness? Or just dark.
 */
function createForegroundMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.2,
    });
}

/**
 * Manages a layer of industrial background elements using InstancedMesh.
 */
export class IndustrialLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;

    // Instance data
    positions: Float32Array;

    constructor(
        scene: THREE.Scene,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        config: {
            count: number,
            z: number,
            zRange: number,
            width: number,
            yRange: number,
            scaleMin: number,
            scaleMax: number,
            rotationMode: 'random' | 'horizontal' | 'vertical'
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false; // Infinite scrolling logic handles visibility

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);

        for(let i=0; i<this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.yRange;
            const z = this.baseZ + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);

            // Random Scale
            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.setScalar(s);

            // Orientation
            if (config.rotationMode === 'random') {
                this.dummy.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
            } else if (config.rotationMode === 'vertical') {
                this.dummy.rotation.set(0, 0, 0);
            } else {
                // Default 'horizontal'
                this.dummy.rotation.z = Math.PI / 2;
            }

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            if (needsUpdate) {
                this.mesh.getMatrixAt(i, this.dummy.matrix);
                const p = new THREE.Vector3();
                const q = new THREE.Quaternion();
                const s = new THREE.Vector3();
                this.dummy.matrix.decompose(p, q, s);

                this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
                // No rotation update needed here as we want them static in orientation
                this.dummy.scale.copy(s);
                this.dummy.quaternion.copy(q);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

export class IndustrialBackgroundSystem {
    scene: THREE.Scene;
    layers: IndustrialLayer[] = [];
    active: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    initLayers() {
        // Layer 1: Deep Background Pipes (Dark, massive)
        // Position: Z = -40, moving parallax
        const pipeGeo = new THREE.CylinderGeometry(2, 2, 40, 16); // Long pipes
        const pipeMat = createPulsingConduitMaterial(0x111122, 0x0044ff, 2.0); // Blue pulse

        this.layers.push(new IndustrialLayer(this.scene, pipeGeo, pipeMat, {
            count: 20,
            z: -40,
            zRange: 10,
            width: 300,
            yRange: 40,
            scaleMin: 1.0,
            scaleMax: 2.0,
            rotationMode: 'horizontal'
        }));

        // Layer 2: Mid-ground Conveyor Belts / Structs
        // Position: Z = -20
        const beltGeo = new THREE.BoxGeometry(10, 1, 2); // Flat belt segments
        const beltMat = createConveyorMaterial(5.0); // Fast moving stripes

        this.layers.push(new IndustrialLayer(this.scene, beltGeo, beltMat, {
            count: 30,
            z: -20,
            zRange: 5,
            width: 200,
            yRange: 30,
            scaleMin: 1.0,
            scaleMax: 1.5,
            rotationMode: 'horizontal'
        }));

        // Layer 3: Vertical Support Ribs (Background wall details)
        // Position: Z = -12
        const ribGeo = new THREE.BoxGeometry(2, 40, 2);
        const ribMat = new THREE.MeshStandardMaterial({
            color: 0x443322,
            roughness: 0.9,
            metalness: 0.5
        });

        this.layers.push(new IndustrialLayer(this.scene, ribGeo, ribMat, {
            count: 15,
            z: -12,
            zRange: 2,
            width: 150,
            yRange: 10,
            scaleMin: 1.0,
            scaleMax: 1.0,
            rotationMode: 'vertical'
        }));

        // Layer 4: Foreground Pillars (Occlusion)
        // Position: Z = 8 (In front of player at Z=0)
        // Large, dark, imposing vertical structures
        const fgPillarGeo = new THREE.BoxGeometry(3, 50, 3);
        const fgMat = createForegroundMaterial();

        this.layers.push(new IndustrialLayer(this.scene, fgPillarGeo, fgMat, {
            count: 5, // Sparse
            z: 8,
            zRange: 2,
            width: 150,
            yRange: 10, // Centered roughly
            scaleMin: 1.0,
            scaleMax: 1.2,
            rotationMode: 'vertical'
        }));

        // Layer 5: Foreground Cables (Hanging)
        // Position: Z = 6
        const cableGeo = new THREE.CylinderGeometry(0.2, 0.2, 30, 8);
        const cableMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.8
        });

        this.layers.push(new IndustrialLayer(this.scene, cableGeo, cableMat, {
            count: 8,
            z: 6,
            zRange: 1,
            width: 120,
            yRange: 5,
            scaleMin: 0.8,
            scaleMax: 1.2,
            rotationMode: 'vertical'
        }));
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

    update(cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(cameraX));
    }
}
