import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    positionLocal,
    sin,
    cos,
    vec3,
    mix,
    color,
    uniform,
    float,
    varying,
    vec4
} from 'three/tsl';

/**
 * Creates a TSL material for cloud puffs.
 * Features:
 * - Soft edges (approximated via transparency/fresnel)
 * - Billowing animation (vertex displacement)
 * - Color gradient
 */
function createCloudMaterial(baseColor: number, opacity: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColor,
        transparent: true,
        opacity: opacity,
        roughness: 1.0,
        metalness: 0.0,
        flatShading: false,
        side: THREE.FrontSide
    });

    const uTime = time;
    const uBillowSpeed = uniform(1.0);
    const uBillowScale = uniform(0.5);
    const uFlash = uniform(0.0); // Lightning flash intensity (0 to 1)

    // --- Vertex Shader: Billowing ---
    const pos = positionLocal;

    // Simple noise-like displacement using sines
    const noiseX = sin(pos.y.mul(2.0).add(uTime.mul(uBillowSpeed)));
    const noiseY = cos(pos.z.mul(1.5).add(uTime.mul(uBillowSpeed).mul(0.8)));
    const noiseZ = sin(pos.x.mul(2.0).add(uTime.mul(uBillowSpeed).mul(1.2)));

    const displacement = vec3(noiseX, noiseY, noiseZ).mul(uBillowScale);
    mat.positionNode = pos.add(displacement);

    // --- Fragment Shader: Lightning ---
    // Mix emissive color based on flash
    const flashColor = color(0xffffff); // White lightning
    mat.emissiveNode = mix(vec3(0.0), flashColor, uFlash);

    // Store uniforms for JS access
    mat.userData.uFlash = uFlash;

    return mat;
}

export class CloudLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    speed: number;
    width: number; // The width of the scrolling window
    startX: number; // Where clouds spawn relative to camera

    // Instance data
    positions: Float32Array; // Stored to manage wrapping logic in JS

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
            speed: number, // relative to player? No, absolute scroll speed factor.
            width: number
        }
    ) {
        this.count = config.count;
        this.speed = config.speed;
        this.width = config.width;
        this.startX = -config.width / 2; // Not used directly, we center around camera

        const geo = new THREE.SphereGeometry(1, 7, 7); // Low poly spheres
        const mat = createCloudMaterial(config.color, config.opacity);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.castShadow = false; // Clouds don't usually cast sharp shadows in this style
        this.mesh.receiveShadow = true; // But they can receive

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);

        // Initial Layout: Distribute randomly in a box
        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * config.width;
            const y = (Math.random() - 0.5) * 20; // Height variation
            const z = config.z + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);

            // Random Scale (flattened)
            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.set(s * 2, s, s * 1.5); // Wide puffs

            this.dummy.rotation.z = (Math.random() - 0.5) * 0.5;

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number, playerSpeed: number) {
        // We simulate parallax by moving clouds slower than the player.
        // Actually, in a side scroller:
        // Objects at Z=0 move at playerSpeed (relative to world 0,0)
        // Background objects should move SLOWER than playerSpeed?
        // Wait, if I move camera +X, static objects at -Z appear to move -X.
        // Perspective camera handles parallax AUTOMATICALLY for static objects.

        // However, we want "Infinite Scrolling".
        // We need to wrap objects that fall behind the camera to the front.

        // We define a "window" around cameraX: [cameraX - width/2, cameraX + width/2]
        const margin = 20; // Buffer
        const windowHalf = this.width / 2;
        const limitBack = cameraX - windowHalf - margin;
        const limitFront = cameraX + windowHalf + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;
            let x = this.positions[idx];

            // Parallax drift (optional extra movement)
            // this.positions[idx] -= this.speed * delta;
            // Actually, let them be static in world space, just wrap them.

            // Check bounds
            if (x < limitBack) {
                // Move to front
                x += this.width + margin * 2;
                this.positions[idx] = x;

                // Randomize Y and Z slightly again?
                // this.positions[idx+1] = (Math.random() - 0.5) * 20;
                // No, keep cohesive structure to avoid popping Y/Z

                needsUpdate = true;
            } else if (x > limitFront) {
                // If player moves left (rare, but possible)
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            if (needsUpdate) {
                // Update matrix for this instance only
                this.mesh.getMatrixAt(i, this.dummy.matrix);
                this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);

                this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
                this.dummy.updateMatrix();

                this.mesh.setMatrixAt(i, this.dummy.matrix);
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
        // Layer 1: Far Background (Dark, slow, dense)
        this.layers.push(new CloudLayer(this.scene, {
            count: 40,
            z: -60,
            zRange: 20,
            color: 0x0f0f20, // Dark blue/purple
            opacity: 0.8,
            scaleMin: 8,
            scaleMax: 15,
            speed: 0,
            width: 300
        }));

        // Layer 2: Mid Ground (Lighter, some transparency)
        this.layers.push(new CloudLayer(this.scene, {
            count: 30,
            z: -30,
            zRange: 10,
            color: 0x2a2a4a,
            opacity: 0.5,
            scaleMin: 5,
            scaleMax: 10,
            speed: 0,
            width: 200
        }));

        // Layer 3: Foreground (Fast, passing by, transparent)
        // Positioned closer to camera Z=15
        this.layers.push(new CloudLayer(this.scene, {
            count: 10,
            z: 5, // Between camera (15) and player (0)? Or behind player?
                  // Player is at 0. Camera at 15.
                  // Clouds at 5-10 will be in foreground.
            zRange: 5,
            color: 0x444466,
            opacity: 0.3,
            scaleMin: 2,
            scaleMax: 4,
            speed: 0,
            width: 100
        }));
    }

    update(delta: number, cameraX: number, playerSpeed: number) {
        this.layers.forEach(layer => layer.update(delta, cameraX, playerSpeed));

        // Random Lightning Logic
        this.lightningTimer -= delta;
        if (this.lightningTimer <= 0) {
            this.triggerLightning();
            this.lightningTimer = 5 + Math.random() * 10; // Every 5-15 seconds
        }

        // Update flash decay
        this.layers.forEach(layer => {
            const mat = layer.mesh.material as any;
            if (mat.userData && mat.userData.uFlash) {
                // Decay flash value
                const current = mat.userData.uFlash.value;
                if (current > 0.01) {
                    mat.userData.uFlash.value = current * 0.85; // Fast decay
                } else {
                    mat.userData.uFlash.value = 0;
                }
            }
        });
    }

    triggerLightning() {
        // Pick a random layer (usually background)
        const layerIdx = Math.floor(Math.random() * 2); // 0 or 1
        const layer = this.layers[layerIdx];

        // Intensity
        const intensity = 0.5 + Math.random() * 0.5;

        // Flash it
        layer.flash(intensity);

        // Maybe multiple flashes?
        setTimeout(() => layer.flash(intensity * 0.5), 100);
        setTimeout(() => layer.flash(intensity * 0.2), 250);
    }
}
