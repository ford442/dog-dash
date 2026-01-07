import * as THREE from 'three';

/**
 * Manages a single layer of parallax asteroids using InstancedMesh.
 */
export class AsteroidLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    depth: number;
    baseZ: number;

    // Instance Data
    positions: Float32Array;
    rotations: Float32Array;
    rotationSpeeds: Float32Array;

    constructor(
        scene: THREE.Scene,
        config: {
            count: number,
            color: number,
            sizeMin: number,
            sizeMax: number,
            z: number,
            zRange: number,
            width: number,
            opacity?: number
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;
        this.depth = config.zRange;

        // Geometry: Icosahedron for jagged rock look
        const geometry = new THREE.IcosahedronGeometry(1, 0);

        // Material: Standard for lighting + optional transparency
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
            transparent: (config.opacity !== undefined && config.opacity < 1.0),
            opacity: config.opacity ?? 1.0
        });

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Don't frustrate player with background collisions (handled by main.ts logic anyway)
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.rotations = new Float32Array(this.count * 3); // Euler angles
        this.rotationSpeeds = new Float32Array(this.count * 3); // Speed per axis

        for (let i = 0; i < this.count; i++) {
            // Random Position
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 40; // Vertical spread
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            // Random Rotation
            const rx = Math.random() * Math.PI * 2;
            const ry = Math.random() * Math.PI * 2;
            const rz = Math.random() * Math.PI * 2;

            this.rotations[i * 3] = rx;
            this.rotations[i * 3 + 1] = ry;
            this.rotations[i * 3 + 2] = rz;

            // Random Rotation Speed
            this.rotationSpeeds[i * 3] = (Math.random() - 0.5) * 1.0;
            this.rotationSpeeds[i * 3 + 1] = (Math.random() - 0.5) * 1.0;
            this.rotationSpeeds[i * 3 + 2] = (Math.random() - 0.5) * 1.0;

            // Setup instance
            this.dummy.position.set(x, y, z);
            this.dummy.rotation.set(rx, ry, rz);

            const scale = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
            this.dummy.scale.setScalar(scale);

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

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // 1. Rotation Animation
            this.rotations[idx] += this.rotationSpeeds[idx] * delta;
            this.rotations[idx+1] += this.rotationSpeeds[idx+1] * delta;
            this.rotations[idx+2] += this.rotationSpeeds[idx+2] * delta;

            // 2. Parallax / Infinite Scroll Logic
            let x = this.positions[idx];

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                // Randomize Y/Z slightly on wrap to break patterns?
                // keeping it stable for now to avoid popping
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            // Update Instance
            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
            this.dummy.rotation.set(
                this.rotations[idx],
                this.rotations[idx+1],
                this.rotations[idx+2]
            );

            // Re-apply scale (we need to extract it or store it, but since we don't change scale,
            // we can just re-use the current matrix scale? No, setMatrixAt overwrites.
            // We didn't store scale. Let's assume uniform scale or retrieve it.
            // Better: get current matrix, decompose, update pos/rot, recompose.
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.dummy.matrix.decompose(p, q, s); // Get current scale

            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
            this.dummy.rotation.set(
                this.rotations[idx],
                this.rotations[idx+1],
                this.rotations[idx+2]
            );
            this.dummy.scale.copy(s);
            this.dummy.updateMatrix();

            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true; // Always update due to rotation
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

export class AsteroidFieldSystem {
    scene: THREE.Scene;
    layers: AsteroidLayer[] = [];
    active: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    initLayers() {
        // Layer 1: Foreground (Close, Large, Darker/Threatening)
        // Passes In Front of Player sometimes? Player Z=0.
        // Z range 5 to 15.
        this.layers.push(new AsteroidLayer(this.scene, {
            count: 15,
            color: 0x333333, // Dark grey
            sizeMin: 1.5,
            sizeMax: 3.0,
            z: 12, // Increased Z to avoid clipping with player at Z=0. Camera is at Z=15.
            zRange: 6,
            width: 150
        }));

        // Layer 2: Background Mid (Behind gameplay layer)
        // Z range -10 to -20
        this.layers.push(new AsteroidLayer(this.scene, {
            count: 40,
            color: 0x555566, // Slightly bluish grey
            sizeMin: 1.0,
            sizeMax: 2.0,
            z: -15,
            zRange: 10,
            width: 200
        }));

        // Layer 3: Deep Background (Small, Faint)
        // Z range -30 to -50
        this.layers.push(new AsteroidLayer(this.scene, {
            count: 80,
            color: 0x222233, // Very dark, atmospheric
            sizeMin: 0.5,
            sizeMax: 1.2,
            z: -40,
            zRange: 10,
            width: 300,
            opacity: 0.8
        }));

        // Start hidden
        this.setVisible(false);
    }

    setVisible(visible: boolean) {
        this.layers.forEach(l => {
            l.mesh.visible = visible;
            // Force frustum culling update just in case, though handled in loop
        });
        this.active = visible;
    }

    activate() {
        if (this.active) return;
        this.setVisible(true);
    }

    deactivate() {
        if (!this.active) return;
        this.setVisible(false);
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(delta, cameraX));
    }
}
