import * as THREE from 'three';

const _dummy = new THREE.Object3D();

export class ParticleSystem {
    constructor(scene, maxParticles = 1000) {
        this.maxParticles = maxParticles;
        this.count = 0;
        
        // Arrays to store particle state
        this.positions = [];     // Vector3
        this.velocities = [];    // Vector3
        this.lifetimes = [];     // float (current life)
        this.maxLifetimes = [];  // float (total life)
        this.colors = [];        // Color
        this.sizes = [];         // float

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

    emit(pos, colorHex, count = 1, speed = 1.0, size = 1.0, spread = 0.5) {
        for (let i = 0; i < count; i++) {
            // Recycle or create new data objects
            if (this.positions.length >= this.maxParticles) {
                // If full, replace the oldest one (shift)
                this.positions.shift();
                this.velocities.shift();
                this.lifetimes.shift();
                this.maxLifetimes.shift();
                this.colors.shift();
                this.sizes.shift();
            }

            // Position
            const p = pos.clone();
            // Random jitter
            p.x += (Math.random() - 0.5) * spread;
            p.y += (Math.random() - 0.5) * spread;
            p.z += (Math.random() - 0.5) * spread;
            this.positions.push(p);

            // Velocity (Random direction)
            const v = new THREE.Vector3(
                (Math.random() - 0.5), 
                (Math.random() - 0.5), 
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5));
            this.velocities.push(v);

            // Color
            const c = new THREE.Color(colorHex);
            this.colors.push(c);

            // Life & Size
            const life = 0.5 + Math.random() * 0.5;
            this.lifetimes.push(life);
            this.maxLifetimes.push(life);
            this.sizes.push(size * (0.8 + Math.random() * 0.4));
        }
    }

    update(delta) {
        let activeCount = 0;

        for (let i = this.positions.length - 1; i >= 0; i--) {
            // Update life
            this.lifetimes[i] -= delta;

            if (this.lifetimes[i] <= 0) {
                // Remove dead particles
                this.positions.splice(i, 1);
                this.velocities.splice(i, 1);
                this.lifetimes.splice(i, 1);
                this.maxLifetimes.splice(i, 1);
                this.colors.splice(i, 1);
                this.sizes.splice(i, 1);
                continue;
            }

            // Update Physics
            this.positions[i].addScaledVector(this.velocities[i], delta);
            // Gravity (optional, looks good for debris)
            this.velocities[i].y -= 2.0 * delta; 

            // Update Instance Matrix
            _dummy.position.copy(this.positions[i]);
            
            // Shrink as they die
            const scale = this.sizes[i] * (this.lifetimes[i] / this.maxLifetimes[i]);
            _dummy.scale.setScalar(scale);
            
            _dummy.rotation.x += delta * 2; // Spin
            _dummy.rotation.z += delta * 2;
            
            _dummy.updateMatrix();

            // Set Matrix
            this.mesh.setMatrixAt(i, _dummy.matrix);
            
            // Set Color
            this.mesh.setColorAt(i, this.colors[i]);
            
            activeCount++;
        }

        this.mesh.count = activeCount;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}
