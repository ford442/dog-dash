import * as THREE from 'three';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class ParticleSystem {
    maxParticles: number;
    count: number;

    // SoA (Structure of Arrays) layout for better performance
    positionX: Float32Array;
    positionY: Float32Array;
    positionZ: Float32Array;

    velocityX: Float32Array;
    velocityY: Float32Array;
    velocityZ: Float32Array;

    life: Float32Array;      // Current remaining life
    maxLife: Float32Array;   // Total lifetime

    size: Float32Array;

    colorR: Float32Array;
    colorG: Float32Array;
    colorB: Float32Array;

    mesh: THREE.InstancedMesh;

    constructor(scene: THREE.Scene, maxParticles: number = 2000) {
        this.maxParticles = maxParticles;
        this.count = 0;
        
        // Initialize Typed Arrays
        this.positionX = new Float32Array(maxParticles);
        this.positionY = new Float32Array(maxParticles);
        this.positionZ = new Float32Array(maxParticles);

        this.velocityX = new Float32Array(maxParticles);
        this.velocityY = new Float32Array(maxParticles);
        this.velocityZ = new Float32Array(maxParticles);

        this.life = new Float32Array(maxParticles);
        this.maxLife = new Float32Array(maxParticles);

        this.size = new Float32Array(maxParticles);

        this.colorR = new Float32Array(maxParticles);
        this.colorG = new Float32Array(maxParticles);
        this.colorB = new Float32Array(maxParticles);

        // Geometry: Low-poly debris/sparks
        const geometry = new THREE.DodecahedronGeometry(0.15, 0);
        
        // Material: Emissive for that "glowing plasma" look
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.5,
            emissive: 0xffffff,
            emissiveIntensity: 2.0
        });

        this.mesh = new THREE.InstancedMesh(geometry, material, maxParticles);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        // Add color attribute for individual particle colors
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles * 3), 3);
        
        scene.add(this.mesh);
    }

    emit(pos: THREE.Vector3, colorHex: number, count: number = 1, speed: number = 1.0, size: number = 1.0, spread: number = 0.5) {
        _color.setHex(colorHex);

        for (let i = 0; i < count; i++) {
            // If full, we simply overwrite the oldest/first particle (Ring buffer style)
            // BUT, with the "Swap-Remove" pattern used in update(), 'count' usually represents active particles.
            // If we are full, we can overwrite a random one or the first one.
            // For simplicity, if full, we restart at index 0 (circular) or just don't spawn.
            // Let's use a rolling index if we want to overwrite old ones, but swap-remove compacts the array.
            // So if full, we can't easily find the "oldest".
            // We'll just stop emitting if full to avoid complexity, or overwrite index 0 (which might not be oldest).

            let index = this.count;
            if (this.count >= this.maxParticles) {
                // Buffer full. Overwrite index 0?
                // In a compact array, index 0 is just *a* particle.
                // Let's just return for now to preserve performance.
                return;
            } else {
                this.count++;
            }

            // Position with jitter
            this.positionX[index] = pos.x + (Math.random() - 0.5) * spread;
            this.positionY[index] = pos.y + (Math.random() - 0.5) * spread;
            this.positionZ[index] = pos.z + (Math.random() - 0.5) * spread;

            // Velocity (Random direction)
            const vx = (Math.random() - 0.5);
            const vy = (Math.random() - 0.5);
            const vz = (Math.random() - 0.5);
            const len = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1;
            const s = speed * (0.5 + Math.random() * 0.5);

            this.velocityX[index] = (vx / len) * s;
            this.velocityY[index] = (vy / len) * s;
            this.velocityZ[index] = (vz / len) * s;

            // Color
            this.colorR[index] = _color.r;
            this.colorG[index] = _color.g;
            this.colorB[index] = _color.b;

            // Life & Size
            const life = 0.5 + Math.random() * 0.5;
            this.life[index] = life;
            this.maxLife[index] = life;
            this.size[index] = size * (0.8 + Math.random() * 0.4);
        }
    }

    update(delta: number) {
        let activeCount = 0;
        const matrix = _dummy.matrix;

        // Iterate forward. If dead, swap with last and decrement count.
        for (let i = 0; i < this.count; i++) {
            this.life[i] -= delta;

            if (this.life[i] <= 0) {
                // Particle Died. Swap with the last active particle.
                const last = this.count - 1;

                // If we are not already the last one
                if (i < last) {
                    this.positionX[i] = this.positionX[last];
                    this.positionY[i] = this.positionY[last];
                    this.positionZ[i] = this.positionZ[last];

                    this.velocityX[i] = this.velocityX[last];
                    this.velocityY[i] = this.velocityY[last];
                    this.velocityZ[i] = this.velocityZ[last];

                    this.life[i] = this.life[last];
                    this.maxLife[i] = this.maxLife[last];

                    this.size[i] = this.size[last];

                    this.colorR[i] = this.colorR[last];
                    this.colorG[i] = this.colorG[last];
                    this.colorB[i] = this.colorB[last];
                }

                this.count--;
                i--; // Re-process this index (since it now holds the swapped particle)
                continue;
            }

            // Update Physics
            this.positionX[i] += this.velocityX[i] * delta;
            this.positionY[i] += this.velocityY[i] * delta;
            this.positionZ[i] += this.velocityZ[i] * delta;

            // Gravity
            this.velocityY[i] -= 2.0 * delta;

            // Update Instance Matrix
            _dummy.position.set(this.positionX[i], this.positionY[i], this.positionZ[i]);
            
            // Scale
            const scale = this.size[i] * (this.life[i] / this.maxLife[i]);
            _dummy.scale.setScalar(scale);
            
            _dummy.rotation.x += delta * 2;
            _dummy.rotation.z += delta * 2;
            
            _dummy.updateMatrix();
            this.mesh.setMatrixAt(i, matrix);
            
            // Update Color
            _color.setRGB(this.colorR[i], this.colorG[i], this.colorB[i]);
            this.mesh.setColorAt(i, _color);
        }

        this.mesh.count = this.count;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}
