import * as THREE from 'three';
import { color, mix, positionLocal, float, uniform, UniformNode, vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uStarOpacity } from './stars';

export class AtmosphereSystem {
    scene: THREE.Scene;
    skyMesh: THREE.Mesh;

    // TSL Uniforms (Hold the "Live" color objects)
    uTopColor: UniformNode<THREE.Color>;
    uBottomColor: UniformNode<THREE.Color>;

    // State for transition
    private startColorTop = new THREE.Color();
    private startColorBottom = new THREE.Color();
    private targetColorTop = new THREE.Color();
    private targetColorBottom = new THREE.Color();

    private transitionDuration: number = 0;
    private transitionTimer: number = 0;
    private isTransitioning: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Initial Colors (Deep Space - Level 1 Default)
        // Dark Blue/Black
        const initialTop = new THREE.Color(0x000000);
        const initialBottom = new THREE.Color(0x050510);

        // Create Uniforms
        this.uTopColor = uniform(initialTop);
        this.uBottomColor = uniform(initialBottom);

        // Create Mesh
        const skyGeo = new THREE.SphereGeometry(1000, 32, 15);

        // TSL Shader Logic
        // Normalize height based on LOCAL position (since sky moves with camera)
        // positionLocal for sphere 1000: y is -1000 to 1000.
        // We want 0 to 1 mix.
        // We add an offset to shift the horizon down/up.
        const offset = float(50.0);
        const exponent = float(0.8);

        // We use positionLocal.add(vec3(0, offset, 0)) to shift in local space
        const adjustedPos = positionLocal.add(vec3(0.0, offset, 0.0));
        const h = adjustedPos.normalize().y;

        // Mix factor: 0 at horizon/bottom, 1 at zenith
        const mixFactor = h.max(0.0).pow(exponent);

        const skyColor = mix(this.uBottomColor, this.uTopColor, mixFactor);

        const skyMat = new MeshBasicNodeMaterial();
        skyMat.colorNode = skyColor;
        skyMat.side = THREE.BackSide;
        skyMat.depthWrite = false; // Render as background

        this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        // Ensure it follows camera?
        // Usually skybox is centered on camera.
        // We will update position in update() or just make it huge.
        // If we move it, positionWorld changes?
        // Yes, positionWorld is absolute.

        this.scene.add(this.skyMesh);
    }

    /**
     * Start a smooth transition to new sky colors.
     * @param topHex Color at the zenith
     * @param bottomHex Color at the horizon
     * @param duration Seconds
     */
    transitionTo(topHex: number, bottomHex: number, duration: number = 2.0) {
        // Snapshot current state
        this.startColorTop.copy(this.uTopColor.value);
        this.startColorBottom.copy(this.uBottomColor.value);

        // Set targets
        this.targetColorTop.setHex(topHex);
        this.targetColorBottom.setHex(bottomHex);

        this.transitionDuration = duration;
        this.transitionTimer = 0;
        this.isTransitioning = true;
    }

    /**
     * Instantly set colors (no transition)
     */
    setColors(topHex: number, bottomHex: number) {
        this.uTopColor.value.setHex(topHex);
        this.uBottomColor.value.setHex(bottomHex);
        this.isTransitioning = false;

        // Sync fog
        if (this.scene.fog) {
            this.scene.fog.color.setHex(bottomHex);
        }
    }

    update(delta: number, cameraPosition: THREE.Vector3) {
        // Center sky on camera to avoid reaching the end
        this.skyMesh.position.copy(cameraPosition);

        if (this.isTransitioning) {
            this.transitionTimer += delta;

            // Avoid division by zero
            const t = this.transitionDuration > 0
                ? Math.min(this.transitionTimer / this.transitionDuration, 1.0)
                : 1.0;

            // Lerp Colors
            this.uTopColor.value.lerpColors(this.startColorTop, this.targetColorTop, t);
            this.uBottomColor.value.lerpColors(this.startColorBottom, this.targetColorBottom, t);

            // Update Fog to match horizon
            if (this.scene.fog) {
                 this.scene.fog.color.copy(this.uBottomColor.value);
            }

            if (t >= 1.0) {
                this.isTransitioning = false;
            }
        }

        // --- Auto-manage Star Visibility based on Sky Brightness ---
        // As the sky gets brighter (atmosphere), stars should fade out.
        const top = this.uTopColor.value;
        const brightness = (top.r + top.g + top.b) / 3.0;

        // Fade out as brightness goes from 0.0 (Space) to 0.3 (Day)
        // 0.0 -> 1.0 opacity
        // 0.3 -> 0.0 opacity
        const targetOpacity = Math.max(0, 1.0 - (brightness * 3.3));

        // Smooth update
        uStarOpacity.value += (targetOpacity - uStarOpacity.value) * delta * 2.0;
    }
}
