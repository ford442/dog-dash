import * as THREE from 'three';
import {
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
    normalView
} from 'three/tsl';

/**
 * Creates a TSL material for the waterfall.
 * Features:
 * - Vertical scrolling UVs (water flow)
 * - Horizontal UV offset based on camera position (parallax/infinite scrolling)
 * - Vertex displacement for curvature
 * - Foam/Color variation
 */
function createWaterMaterial(baseColorHex: number, opacity: number, speed: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        transparent: true,
        opacity: opacity,
        roughness: 0.1,
        metalness: 0.8,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const uSpeed = uniform(speed);
    const uCameraX = uniform(0.0); // Updated every frame
    const uParallaxFactor = uniform(0.1); // How fast texture scrolls horizontally

    // --- Vertex Shader: Curve & Wiggle ---
    const pos = positionLocal;

    // Wiggle (X axis)
    const wiggle = sin(pos.y.mul(0.5).add(uTime)).mul(0.5);

    // Curve (Z axis recedes at top)
    // Assuming Y ranges from -Height/2 to +Height/2
    const curveAmount = float(0.01);
    const zOffset = pos.y.mul(pos.y).mul(curveAmount).negate(); // -y^2 * k

    mat.positionNode = vec3(pos.x.add(wiggle), pos.y, pos.z.add(zOffset));

    // --- Fragment Shader: Flowing Texture ---
    const vUv = uv();

    // Scroll UVs vertically (Flow)
    const scrollY = uTime.mul(uSpeed);

    // Scroll UVs horizontally (Parallax)
    // We add cameraX * factor to UV.x
    // Note: If we move Right (+X), we want texture to move Left (UV increases? or decreases?)
    // Usually UV mapping: 0..1. If we shift UV +offset, texture moves Left.
    const scrollX = uCameraX.mul(uParallaxFactor);

    const flowUv = vec2(vUv.x.add(scrollX), vUv.y.add(scrollY));

    // Sample simulated noise
    const noise1 = sin(flowUv.y.mul(20.0).add(flowUv.x.mul(10.0)));
    
    // CORRECTION HERE: Changed .minus() to .sub()
    const noise2 = cos(flowUv.y.mul(15.0).sub(flowUv.x.mul(5.0))); 
    
    const combinedNoise = noise1.add(noise2).mul(0.5); // Range -1 to 1

    // Mix Base Color with lighter "Foam"
    const baseColor = color(new THREE.Color(baseColorHex));
    const foamColor = color(0xffffff);

    // Foam appears at peaks of noise
    const foamFactor = combinedNoise.add(1.0).mul(0.5); // 0 to 1

    // Basic color output
    mat.colorNode = vec4(mix(baseColor, foamColor, foamFactor.mul(0.3)), float(opacity));

    // Emission for glowing water
    mat.emissiveNode = baseColor.mul(0.5);

    // Store uniforms on userData so we can update them
    mat.userData.uCameraX = uCameraX;
    mat.userData.uParallaxFactor = uParallaxFactor;

    return mat;
}

/**
 * Creates a TSL material for rising bubbles.
 */
function createBubbleMaterial() {
    const mat = new MeshStandardNodeMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.6,
        roughness: 0.0,
        metalness: 0.1,
    });

    const uTime = time;

    // --- Vertex Shader: Wobble ---
    const pos = positionLocal;

    // Simple wobble based on position and time
    const wobbleX = sin(pos.y.mul(5.0).add(uTime.mul(3.0))).mul(0.1);
    const wobbleY = cos(pos.x.mul(5.0).add(uTime.mul(2.0))).mul(0.1);

    mat.positionNode = pos.add(vec3(wobbleX, wobbleY, 0.0));

    // --- Fragment Shader: Bubble Rim ---
    const nView = normalView;
    // Edge glow (Fresnel)
    const rim = float(1.0).sub(nView.z.abs());
    const glow = rim.pow(3.0);

    const bubbleColor = color(0x88ccff);
    const centerColor = color(0xffffff);

    // Mix based on rim
    const finalColor = mix(centerColor, bubbleColor, rim);

    // Output color with opacity based on rim (more opaque at edges)
    mat.colorNode = vec4(finalColor, glow.add(0.2)); // Minimum opacity 0.2
    mat.emissiveNode = bubbleColor.mul(glow);

    return mat;
}

export class WaterfallLayer {
    mesh: THREE.Mesh;
    speed: number;
    width: number;
    height: number;
    parallaxFactor: number;

    constructor(scene: THREE.Scene, config: {
        width: number,
        height: number,
        z: number,
        color: number,
        opacity: number,
        speed: number,
        parallaxFactor: number // How much texture slides vs camera move
    }) {
        this.width = config.width;
        this.height = config.height;
        this.speed = config.speed;
        this.parallaxFactor = config.parallaxFactor;

        const geo = new THREE.PlaneGeometry(this.width, this.height, 32, 32);
        const mat = createWaterMaterial(config.color, config.opacity, config.speed);

        // Initialize parallax factor uniform
        if (mat.userData.uParallaxFactor) {
            mat.userData.uParallaxFactor.value = this.parallaxFactor;
        }

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.z = config.z;
        this.mesh.visible = false;

        scene.add(this.mesh);
    }

    update(cameraX: number) {
        // Keep the mesh centered on the camera so it never runs out
        this.mesh.position.x = cameraX;

        // Update the shader uniform to shift texture
        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uCameraX) {
            mat.userData.uCameraX.value = cameraX;
        }
    }
}

export class BubbleLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    height: number;
    depth: number;
    baseZ: number;

    positions: Float32Array;
    speeds: Float32Array;
    scales: Float32Array;

    constructor(scene: THREE.Scene, config: {
        count: number,
        width: number,
        height: number,
        z: number,
        zRange: number
    }) {
        this.count = config.count;
        this.width = config.width;
        this.height = config.height;
        this.baseZ = config.z;
        this.depth = config.zRange;

        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = createBubbleMaterial();

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.renderOrder = 1; // Render after water
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.speeds = new Float32Array(this.count);
        this.scales = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * this.height;
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            // Random upward speed
            this.speeds[i] = 2.0 + Math.random() * 3.0;

            this.dummy.position.set(x, y, z);
            const s = 0.5 + Math.random() * 1.0;
            this.scales[i] = s;
            this.dummy.scale.setScalar(s);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        const topY = this.height / 2;
        const bottomY = -this.height / 2;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // Rise
            this.positions[idx+1] += this.speeds[i] * delta;

            let x = this.positions[idx];
            let y = this.positions[idx+1];

            // Wrap Y
            if (y > topY) {
                y = bottomY;
                this.positions[idx+1] = y;
                // Randomize X slightly on respawn
                x = cameraX + (Math.random() - 0.5) * this.width;
                this.positions[idx] = x;
            }

            // Wrap X (Infinite Scroll)
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
            }

            // Always update for smooth rising
            this.dummy.position.set(x, y, this.positions[idx+2]);
            this.dummy.scale.setScalar(this.scales[i]);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

export class WaterfallSystem {
    scene: THREE.Scene;
    layers: WaterfallLayer[] = [];
    bubbles!: BubbleLayer;
    active: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    initLayers() {
        // Layer 1: Background (Distant)
        // Moves slowly (low parallax factor)
        this.layers.push(new WaterfallLayer(this.scene, {
            width: 300,
            height: 100,
            z: -40,
            color: 0x002244,
            opacity: 0.9,
            speed: 0.2,
            parallaxFactor: 0.02 // Texture moves 2% of camera speed
        }));

        // Layer 2: Midground
        this.layers.push(new WaterfallLayer(this.scene, {
            width: 300,
            height: 80,
            z: -20,
            color: 0x0066aa,
            opacity: 0.6,
            speed: 0.5,
            parallaxFactor: 0.05
        }));

        // Layer 3: Foreground (Spray)
        // Moves fast (high parallax)
        this.layers.push(new WaterfallLayer(this.scene, {
            width: 300,
            height: 60,
            z: 10,
            color: 0x88ccff,
            opacity: 0.3,
            speed: 0.8,
            parallaxFactor: 0.1
        }));

        // Bubbles Layer
        this.bubbles = new BubbleLayer(this.scene, {
            count: 100,
            width: 150,
            height: 60,
            z: -10, // In midground
            zRange: 20
        });
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.layers.forEach(l => l.mesh.visible = true);
        this.bubbles.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layers.forEach(l => l.mesh.visible = false);
        this.bubbles.mesh.visible = false;
    }

    update(cameraX: number, delta: number = 0.016) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(cameraX));
        this.bubbles.update(delta, cameraX);
    }
}
