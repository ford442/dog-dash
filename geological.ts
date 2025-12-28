import * as THREE from 'three';
import { createJellyMembraneMaterial, createJellyMossMaterial } from './shaders/jelly-moss';

/**
 * Geological & Crystalline Objects
 * Implements various space environment objects from plan.md
 */

// --- Nebula Jelly-Moss ---
export function createNebulaJellyMoss(options: any = {}) {
    const { size = 5, color = 0x44ff88 } = options;
    const group = new THREE.Group();

    // 1. Gelatinous Membrane (Shader-based)
    const membraneGeo = new THREE.SphereGeometry(size, 64, 64); // Higher poly for wobble
    const membraneMat = createJellyMembraneMaterial(0x88ffaa);
    const membrane = new THREE.Mesh(membraneGeo, membraneMat);
    group.add(membrane);

    // 2. Inner Fractal Moss (Shader-based instances)
    const mossLayers = 3;
    const cores = [];
    for (let i = 0; i < mossLayers; i++) {
        const layerSize = size * (0.3 + i * 0.2);
        const mossGeo = new THREE.IcosahedronGeometry(layerSize, 4); // More detail

        // Use custom shader material for moss
        const mossMat = createJellyMossMaterial(color);

        const moss = new THREE.Mesh(mossGeo, mossMat);
        moss.userData.rotationSpeed = (Math.random() - 0.5) * 0.5;
        moss.userData.layer = i;
        group.add(moss);
        cores.push(moss);
    }

    // Store animation data
    group.userData = {
        type: 'jellyMoss',
        pulsePhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.2 + Math.random() * 0.3,
        membrane: membrane,
        cores: cores, // Expose cores for harvesting logic
        baseSize: size,
        health: 1.0,
        isHiding: false,
        radius: size
    };

    return group;
}

// Update Nebula Jelly-Moss animation
export function updateNebulaJellyMoss(jellyMoss: THREE.Group, delta: number, time: number) {
    if (!jellyMoss.userData || jellyMoss.userData.type !== 'jellyMoss') return;

    const data = jellyMoss.userData;

    // Check if dead (health <= 0)
    if (data.health <= 0 && jellyMoss.visible) {
         // Death animation: quick shrink
         jellyMoss.scale.multiplyScalar(0.9);
         if (jellyMoss.scale.x < 0.1) {
             jellyMoss.visible = false;
             // Here we would ideally spawn a spore burst, but this is a pure update function.
             // The main loop can detect visibility change or we can handle it via an event.
         }
         return;
    }

    const pulseTime = time + data.pulsePhase;

    // Pulse animation (3s cycle)
    const pulse = Math.sin(pulseTime * (Math.PI * 2 / 3)) * 0.5 + 0.5;

    // Update membrane uniforms (Shader Node update happens automatically via time node,
    // but we can update uniforms like uPulse manually if we want game logic influence)

    // Note: With TSL, 'time' node handles animation automatically on GPU.
    // We only need to update logic-based uniforms.

    const membrane = data.membrane as THREE.Mesh;
    if (membrane && membrane.material) {
        const mat = membrane.material as THREE.Material;
        // Update pulse uniform if exposed
        if (mat.userData && mat.userData.uPulse) {
            mat.userData.uPulse.value = pulse;
        }

        // React to health (shrink wobble if damaged)
        if (mat.userData && mat.userData.uWobbleStr) {
            mat.userData.uWobbleStr.value = 0.05 * data.health;
        }

        // Stealth effect (opacity)
        if (data.isHiding) {
             // If player is hiding inside, maybe pulse faster or change color
             // The visual effect on the PLAYER is handled in main.ts
        }
    }

    // Counter-rotate moss layers
    jellyMoss.children.forEach((child, i) => {
        if (child.userData.layer !== undefined) {
            child.rotation.y += child.userData.rotationSpeed * delta;
            child.rotation.x += child.userData.rotationSpeed * 0.5 * delta;

            // Update moss pulse uniform
            const mat = (child as THREE.Mesh).material as THREE.Material;
            if (mat && mat.userData && mat.userData.uPulse) {
                mat.userData.uPulse.value = pulse;
            }
        }
    });

    // Sine-wave drifting
    const driftOffset = Math.sin(time * 0.5 + data.pulsePhase) * data.driftSpeed;
    jellyMoss.position.y += driftOffset * delta;
}

// --- Spore Clouds (InstancedMesh) ---
export class SporeCloud {
    scene: THREE.Scene;
    position: THREE.Vector3;
    sporeCount: number;
    mesh: THREE.InstancedMesh;
    active: boolean;
    dummy: THREE.Object3D;

    // Data arrays for brownian motion
    velocities: Float32Array; // x,y,z per instance
    positions: Float32Array;  // x,y,z relative to center
    reactionTimes: Float32Array; // -1 if idle, >=0 if reacting

    constructor(scene: THREE.Scene, position: THREE.Vector3, sporeCount = 1000) {
        this.scene = scene;
        this.position = position.clone();
        this.sporeCount = sporeCount;
        this.active = true;
        this.dummy = new THREE.Object3D();

        // Create InstancedMesh
        const sporeGeo = new THREE.SphereGeometry(0.05, 4, 4); // Low poly
        const sporeMat = new THREE.MeshStandardMaterial({
            color: 0x88ff88,
            emissive: 0x44ff44,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.8
        });

        this.mesh = new THREE.InstancedMesh(sporeGeo, sporeMat, sporeCount);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // We will update it
        this.mesh.position.copy(position);

        // This is key for the "collect spores" logic in main.ts if we iterate instances
        // We set userData on the mesh to reference this class instance
        this.mesh.userData = { parentCloud: this };

        // Initialize data
        this.velocities = new Float32Array(sporeCount * 3);
        this.positions = new Float32Array(sporeCount * 3);
        this.reactionTimes = new Float32Array(sporeCount).fill(-1);

        for (let i = 0; i < sporeCount; i++) {
            // Random position within cloud radius
            const radius = 5 + Math.random() * 5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            // Velocity
            this.velocities[i*3] = (Math.random() - 0.5) * 0.05;
            this.velocities[i*3+1] = (Math.random() - 0.5) * 0.05;
            this.velocities[i*3+2] = (Math.random() - 0.5) * 0.05;

            // Set initial matrix
            this.dummy.position.set(x, y, z);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.scene.add(this.mesh);
    }

    update(delta: number) {
        if (!this.active) return;

        // Note: For 1000 particles, CPU update is okay.
        // Ideally move to TSL/Vertex shader for 10k+.

        let needsUpdate = false;
        const center = new THREE.Vector3(0,0,0);

        for (let i = 0; i < this.sporeCount; i++) {
            const idx = i * 3;

            // Brownian motion
            this.velocities[idx] += (Math.random() - 0.5) * 0.01;
            this.velocities[idx+1] += (Math.random() - 0.5) * 0.01;
            this.velocities[idx+2] += (Math.random() - 0.5) * 0.01;

            // Cohesion (pull to center 0,0,0 local space)
            const distSq = this.positions[idx]**2 + this.positions[idx+1]**2 + this.positions[idx+2]**2;
            if (distSq > 0.1) {
                // Approximate normalize and pull
                const factor = 0.005 / Math.sqrt(distSq);
                this.velocities[idx] -= this.positions[idx] * factor;
                this.velocities[idx+1] -= this.positions[idx+1] * factor;
                this.velocities[idx+2] -= this.positions[idx+2] * factor;
            }

            // Damping
            this.velocities[idx] *= 0.95;
            this.velocities[idx+1] *= 0.95;
            this.velocities[idx+2] *= 0.95;

            // Update position
            this.positions[idx] += this.velocities[idx];
            this.positions[idx+1] += this.velocities[idx+1];
            this.positions[idx+2] += this.velocities[idx+2];

            // React logic (scale up and vanish)
            let scale = 1.0;
            if (this.reactionTimes[i] >= 0) {
                this.reactionTimes[i] += delta;
                const t = this.reactionTimes[i];
                if (t > 1.0) {
                    scale = 0; // Hide
                } else {
                    scale = 1.0 + t * 0.5;
                }
            }

            if (scale > 0) {
                this.dummy.position.set(this.positions[idx], this.positions[idx+1], this.positions[idx+2]);
                this.dummy.scale.setScalar(scale);
                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            } else {
                 // Zero scale matrix to hide
                 this.dummy.scale.setScalar(0);
                 this.dummy.updateMatrix();
                 this.mesh.setMatrixAt(i, this.dummy.matrix);
                 needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    triggerChainReaction(hitPointWorld: THREE.Vector3) {
        // Convert hit point to local space
        const localHit = hitPointWorld.clone().sub(this.mesh.position); // Simplified, ignores mesh rotation
        const reactionRadiusSq = 2.0 * 2.0;
        let count = 0;

        for (let i = 0; i < this.sporeCount; i++) {
            if (this.reactionTimes[i] >= 0) continue; // Already reacting

            const idx = i * 3;
            const dx = this.positions[idx] - localHit.x;
            const dy = this.positions[idx+1] - localHit.y;
            const dz = this.positions[idx+2] - localHit.z;

            if (dx*dx + dy*dy + dz*dz < reactionRadiusSq) {
                this.reactionTimes[i] = Math.sqrt(dx*dx + dy*dy + dz*dz) * 0.1; // Delay
                count++;
            }
        }
        return count;
    }

    // Helper property to access 'spores' for compatibility if needed,
    // but we changed main.ts to not iterate 'spores' array directly for raycasting.
    // Wait, main.ts DOES iterate 'cloud.spores' for raycasting!
    // We need to fix that or provide a proxy.
    // Raycaster can intersect InstancedMesh directly.

    get spores() {
        // Return mesh as an array so main.ts iteration works?
        // No, main.ts expects an array of objects to intersect.
        // We can return [this.mesh] but main.ts logic might be expecting individual meshes.
        // Let's check main.ts logic: "raycaster.intersectObjects(cloud.spores, false)"
        // If we return [this.mesh], it works, but the result 'intersect.object' will be the instanced mesh,
        // and 'intersect.instanceId' will be set.
        return [this.mesh];
    }

    cleanup() {
        this.scene.remove(this.mesh);
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) {
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(m => m.dispose());
            } else {
                this.mesh.material.dispose();
            }
        }
        this.active = false;
    }
}

// --- Chroma-Shift Rocks ---
export function createChromaShiftRock(options: any = {}) {
    const { size = 2, color = 0x8844ff } = options;
    const group = new THREE.Group();

    // Main rock body
    const rockGeo = new THREE.DodecahedronGeometry(size, 1);

    // Custom material with distance-based color shift
    const rockMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.8,
        metalness: 0.3,
        emissive: color,
        emissiveIntensity: 0.2
    });

    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.castShadow = true;

    // Add some crystal shards
    const shardCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < shardCount; i++) {
        const shardGeo = new THREE.ConeGeometry(0.2, 0.8, 6);
        const shardMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaff,
            emissive: 0x6666ff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });

        const shard = new THREE.Mesh(shardGeo, shardMat);

        // Random position on surface
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        shard.position.set(
            size * Math.sin(phi) * Math.cos(theta),
            size * Math.sin(phi) * Math.sin(theta),
            size * Math.cos(phi)
        );
        shard.lookAt(0, 0, 0);
        shard.rotateX(-Math.PI / 2);

        rock.add(shard);
    }

    group.add(rock);

    // Store animation data
    group.userData = {
        type: 'chromaRock',
        originalColor: color,
        baseEmissive: 0.2,
        rock: rock,
        timeOffset: Math.random() * 100
    };

    return group;
}

// Update chroma-shift effect based on distance
export function updateChromaRock(rock: THREE.Group, cameraPosition: THREE.Vector3, delta: number, time: number) {
    if (!rock.userData || rock.userData.type !== 'chromaRock') return;

    const distance = rock.position.distanceTo(cameraPosition);
    const maxDistance = 50;
    const normalizedDist = Math.min(distance / maxDistance, 1.0);

    // Shift hue based on distance and time
    const timeValue = time + rock.userData.timeOffset;
    const hue = (normalizedDist * 0.3 + timeValue * 0.1) % 1.0;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.5);

    const rockMesh = rock.userData.rock as THREE.Mesh;
    if (rockMesh && rockMesh.material) {
        (rockMesh.material as THREE.MeshStandardMaterial).emissive.lerp(color, 0.05);
        (rockMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + Math.sin(timeValue) * 0.1;
    }

    // Slow rotation
    rock.rotation.y += delta * 0.2;
    rock.rotation.x += delta * 0.1;
}

// --- Fractured Geodes ---
export function createFracturedGeode(options: any = {}) {
    const { size = 4, color = 0x8844ff } = options;
    const group = new THREE.Group();

    // Outer shell (fractured)
    const shellGeo = new THREE.DodecahedronGeometry(size, 0);
    const shellMat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.9,
        metalness: 0.1
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.castShadow = true;
    group.add(shell);

    // Inner crystals
    const crystalCount = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < crystalCount; i++) {
        const crystalSize = 0.3 + Math.random() * 0.7;
        const crystalGeo = new THREE.ConeGeometry(crystalSize * 0.4, crystalSize, 6);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.7,
            roughness: 0.2,
            metalness: 0.3
        });

        const crystal = new THREE.Mesh(crystalGeo, crystalMat);

        // Point inward from shell
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = size * 0.9;

        crystal.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        crystal.lookAt(0, 0, 0);
        crystal.rotateX(-Math.PI / 2);

        group.add(crystal);
    }

    // Add EM field glow
    const glowGeo = new THREE.SphereGeometry(size * 1.3, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    group.userData = {
        type: 'geode',
        glow: glow,
        baseColor: color,
        timeOffset: Math.random() * 100
    };

    return group;
}

// Update geode EM field animation
export function updateGeode(geode: THREE.Group, delta: number, time: number) {
    if (!geode.userData || geode.userData.type !== 'geode') return;

    const glow = geode.userData.glow as THREE.Mesh;
    if (glow) {
        // Pulse the EM field
        const timeValue = time + geode.userData.timeOffset;
        const pulse = Math.sin(timeValue * 2) * 0.5 + 0.5;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.1 + pulse * 0.15;
        glow.scale.setScalar(1 + pulse * 0.1);
    }

    // Slow rotation
    geode.rotation.y += delta * 0.1;
}

// --- Void Root Balls ---
export function createVoidRootBall(options: any = {}) {
    const { size = 3, color = 0x331133 } = options;
    const group = new THREE.Group();

    // Main spherical core
    const coreGeo = new THREE.IcosahedronGeometry(size, 2);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x220033,
        roughness: 0.7,
        metalness: 0.2,
        emissive: 0x440055,
        emissiveIntensity: 0.5
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.castShadow = true;
    group.add(core);

    // Root tendrils
    const rootCount = 6 + Math.floor(Math.random() * 4);
    const roots: THREE.Mesh[] = [];
    
    for (let i = 0; i < rootCount; i++) {
        const rootLength = size * (2 + Math.random() * 2);
        const segments = 8;
        const points: THREE.Vector3[] = [];
        
        // Create curved root path
        for (let j = 0; j <= segments; j++) {
            const t = j / segments;
            const angle = (i / rootCount) * Math.PI * 2 + Math.random() * 0.3;
            const curvature = Math.sin(t * Math.PI) * 0.5;
            
            points.push(new THREE.Vector3(
                Math.cos(angle) * (size + t * rootLength) + curvature,
                Math.sin(angle) * (size + t * rootLength) + curvature,
                (Math.random() - 0.5) * rootLength * 0.3
            ));
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, segments * 2, 0.1 * (1 - i / rootCount * 0.3), 6, false);
        const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x441144,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const root = new THREE.Mesh(tubeGeo, tubeMat);
        roots.push(root);
        group.add(root);
    }

    // Crystal flowers on roots
    const flowerCount = 3;
    const flowers: THREE.Mesh[] = [];
    
    for (let i = 0; i < flowerCount; i++) {
        const flowerGeo = new THREE.OctahedronGeometry(0.3, 0);
        const flowerMat = new THREE.MeshStandardMaterial({
            color: 0xaa44ff,
            emissive: 0xaa44ff,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.8
        });
        
        const flower = new THREE.Mesh(flowerGeo, flowerMat);
        
        // Position along random root
        const angle = (i / flowerCount) * Math.PI * 2;
        const radius = size * 1.5;
        flower.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            (Math.random() - 0.5) * size
        );
        
        flowers.push(flower);
        group.add(flower);
    }

    group.userData = {
        type: 'voidRootBall',
        core: core,
        roots: roots,
        flowers: flowers,
        mode: 'drift', // 'drift' or 'anchor'
        targetPlayer: null,
        detectionRadius: 20,
        anchorTime: 0,
        rotationSpeed: 0.3,
        flowerGrowth: flowers.map(() => Math.random()),
        health: 100,
        timeOffset: Math.random() * 100
    };

    return group;
}

// Update Void Root Ball behavior
export function updateVoidRootBall(
    rootBall: THREE.Group, 
    delta: number, 
    time: number,
    playerPosition?: THREE.Vector3
) {
    if (!rootBall.userData || rootBall.userData.type !== 'voidRootBall') return;

    const data = rootBall.userData;
    const timeValue = time + data.timeOffset;

    // Rotation in drift mode
    if (data.mode === 'drift') {
        rootBall.rotation.y += delta * data.rotationSpeed;
        rootBall.rotation.x += delta * data.rotationSpeed * 0.3;
    }

    // Flower growth and pulsing
    data.flowers.forEach((flower: THREE.Mesh, i: number) => {
        // Pulse animation
        const pulse = Math.sin(timeValue * 2 + i) * 0.5 + 0.5;
        const mat = flower.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.0 + pulse * 0.5;
        
        // Growth animation
        if (data.mode === 'drift' && data.flowerGrowth[i] < 1.0) {
            data.flowerGrowth[i] = Math.min(1.0, data.flowerGrowth[i] + delta * 0.1);
        }
        
        flower.scale.setScalar(data.flowerGrowth[i] * (0.8 + pulse * 0.2));
    });

    // Player detection and mode switching
    if (playerPosition) {
        const distance = rootBall.position.distanceTo(playerPosition);
        
        if (distance < data.detectionRadius && data.mode === 'drift') {
            data.mode = 'anchor';
            data.anchorTime = 0;
        }
        
        if (data.mode === 'anchor') {
            data.anchorTime += delta;
            
            // Orient toward player
            const direction = new THREE.Vector3()
                .subVectors(playerPosition, rootBall.position)
                .normalize();
            rootBall.lookAt(playerPosition);
            
            // After 30s or all flowers harvested, enter withered state
            if (data.anchorTime > 30 || data.flowers.every((f: THREE.Mesh) => !f.visible)) {
                data.mode = 'withered';
                data.core.material.emissiveIntensity = 0.1;
            }
        }
    }

    // Core pulsing
    const corePulse = Math.sin(timeValue * 1.5) * 0.5 + 0.5;
    const coreMat = data.core.material as THREE.MeshStandardMaterial;
    coreMat.emissiveIntensity = 0.3 + corePulse * 0.3;
}

// --- Vacuum Kelp ---
export function createVacuumKelp(options: any = {}) {
    const { length = 30, nodes = 6, color = 0x115533 } = options;
    const group = new THREE.Group();

    const nodeSpacing = length / nodes;
    const kelpNodes: THREE.Mesh[] = [];
    const segments: THREE.Mesh[] = [];

    // Create nodes along the kelp strand
    for (let i = 0; i < nodes; i++) {
        const nodeGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const nodeMat = new THREE.MeshStandardMaterial({
            color: 0x226644,
            emissive: 0x113322,
            emissiveIntensity: 0.3,
            roughness: 0.8
        });
        
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.y = i * nodeSpacing;
        node.userData = {
            health: 50,
            index: i,
            harvestable: Math.random() < 0.15 // 15% chance for quantum seed
        };
        
        kelpNodes.push(node);
        group.add(node);

        // Create segment between nodes
        if (i < nodes - 1) {
            const segmentGeo = new THREE.CylinderGeometry(0.3, 0.3, nodeSpacing, 6);
            const segmentMat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.9
            });
            
            const segment = new THREE.Mesh(segmentGeo, segmentMat);
            segment.position.y = i * nodeSpacing + nodeSpacing / 2;
            segments.push(segment);
            group.add(segment);
        }
    }

    // Add dangling fronds
    const frondCount = nodes * 2;
    for (let i = 0; i < frondCount; i++) {
        const attachNode = Math.floor(Math.random() * nodes);
        const frondLength = 2 + Math.random() * 3;
        
        const frondGeo = new THREE.ConeGeometry(0.2, frondLength, 4);
        const frondMat = new THREE.MeshStandardMaterial({
            color: 0x227755,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.copy(kelpNodes[attachNode].position);
        frond.position.x += (Math.random() - 0.5) * 1.5;
        frond.position.z += (Math.random() - 0.5) * 1.5;
        frond.rotation.z = Math.PI + (Math.random() - 0.5) * 0.5;
        
        group.add(frond);
    }

    group.userData = {
        type: 'vacuumKelp',
        nodes: kelpNodes,
        segments: segments,
        nodeSpacing: nodeSpacing,
        wavePhase: Math.random() * Math.PI * 2,
        waveSpeed: 0.5 + Math.random() * 0.5,
        amplitude: 1.5,
        severed: false
    };

    return group;
}

// Update Vacuum Kelp wave animation
export function updateVacuumKelp(kelp: THREE.Group, delta: number, time: number) {
    if (!kelp.userData || kelp.userData.type !== 'vacuumKelp') return;

    const data = kelp.userData;
    
    // Wave motion along the strand
    data.nodes.forEach((node: THREE.Mesh, i: number) => {
        const phase = data.wavePhase + (i / data.nodes.length) * Math.PI * 2;
        const wave = Math.sin(time * data.waveSpeed + phase);
        
        node.position.x = wave * data.amplitude * (i / data.nodes.length);
        node.position.z = Math.cos(time * data.waveSpeed * 0.7 + phase) * data.amplitude * 0.5 * (i / data.nodes.length);
        
        // Update segments to follow nodes
        if (i < data.segments.length) {
            const nextNode = data.nodes[i + 1];
            const segment = data.segments[i];
            
            segment.position.x = (node.position.x + nextNode.position.x) / 2;
            segment.position.z = (node.position.z + nextNode.position.z) / 2;
            
            // Orient segment between nodes
            const direction = new THREE.Vector3()
                .subVectors(nextNode.position, node.position)
                .normalize();
            segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        }
    });
}

// --- Ice Needles ---
export function createIceNeedleCluster(options: any = {}) {
    const { count = 20, radius = 5, color = 0xaaddff } = options;
    const group = new THREE.Group();

    const needles: THREE.Mesh[] = [];

    for (let i = 0; i < count; i++) {
        const needleLength = 2 + Math.random() * 4;
        const needleGeo = new THREE.ConeGeometry(0.1, needleLength, 6);
        const needleMat = new THREE.MeshPhysicalMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.1,
            transmission: 0.5,
            thickness: 0.5,
            ior: 1.31 // Ice refractive index
        });
        
        const needle = new THREE.Mesh(needleGeo, needleMat);
        
        // Position in hexagonal grid pattern
        const layer = Math.floor(i / 6);
        const angleInLayer = (i % 6) / 6 * Math.PI * 2;
        const layerRadius = layer * 1.5;
        
        needle.position.x = Math.cos(angleInLayer) * layerRadius;
        needle.position.z = Math.sin(angleInLayer) * layerRadius;
        needle.position.y = (Math.random() - 0.5) * 2;
        
        // Random rotation for natural look
        needle.rotation.x = (Math.random() - 0.5) * 0.5;
        needle.rotation.z = (Math.random() - 0.5) * 0.5;
        
        needle.userData = {
            health: 20,
            index: i,
            basePosition: needle.position.clone()
        };
        
        needles.push(needle);
        group.add(needle);
    }

    // Optional frost heart at center
    const frostHeartGeo = new THREE.IcosahedronGeometry(0.8, 1);
    const frostHeartMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        emissive: 0x4488ff,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.9
    });
    
    const frostHeart = new THREE.Mesh(frostHeartGeo, frostHeartMat);
    group.add(frostHeart);

    group.userData = {
        type: 'iceNeedleCluster',
        needles: needles,
        frostHeart: frostHeart,
        timeOffset: Math.random() * 100,
        shimmerPhase: Math.random() * Math.PI * 2
    };

    return group;
}

// Update Ice Needle cluster
export function updateIceNeedleCluster(cluster: THREE.Group, delta: number, time: number) {
    if (!cluster.userData || cluster.userData.type !== 'iceNeedleCluster') return;

    const data = cluster.userData;
    const timeValue = time + data.timeOffset;

    // Shimmer effect on needles
    data.needles.forEach((needle: THREE.Mesh, i: number) => {
        const shimmer = Math.sin(timeValue * 2 + i * 0.5 + data.shimmerPhase) * 0.5 + 0.5;
        const mat = needle.material as THREE.MeshPhysicalMaterial;
        mat.opacity = 0.7 + shimmer * 0.2;
        
        // Subtle sway
        const sway = Math.sin(timeValue + i * 0.3) * 0.02;
        needle.rotation.x = sway;
    });

    // Frost heart pulsing
    if (data.frostHeart) {
        const pulse = Math.sin(timeValue * 1.5) * 0.5 + 0.5;
        const mat = data.frostHeart.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.0 + pulse * 0.5;
        data.frostHeart.scale.setScalar(1.0 + pulse * 0.1);
    }
}

// --- Liquid Metal Blobs ---
export function createLiquidMetalBlob(options: any = {}) {
    const { size = 3, color = 0xcccccc } = options;
    const group = new THREE.Group();

    // Main blob body
    const blobGeo = new THREE.SphereGeometry(size, 32, 32);
    const blobMat = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 1.0,
        roughness: 0.02,
        envMapIntensity: 2.0
    });
    
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.castShadow = true;
    group.add(blob);

    group.userData = {
        type: 'liquidMetalBlob',
        blob: blob,
        size: size,
        mass: size * size,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ),
        health: 100,
        timeOffset: Math.random() * 100,
        reflectiveCoating: false,
        coatingTimer: 0
    };

    return group;
}

// Update Liquid Metal Blob
export function updateLiquidMetalBlob(blob: THREE.Group, delta: number, time: number) {
    if (!blob.userData || blob.userData.type !== 'liquidMetalBlob') return;

    const data = blob.userData;
    const timeValue = time + data.timeOffset;

    // Move based on velocity
    blob.position.add(data.velocity.clone().multiplyScalar(delta));

    // Blob wobble/morphing effect
    const blobMesh = data.blob as THREE.Mesh;
    if (blobMesh && blobMesh.geometry) {
        const positions = blobMesh.geometry.attributes.position;
        // Apply subtle deformation (would be better with vertex shader)
        const wobble = Math.sin(timeValue * 2) * 0.05;
        blobMesh.scale.x = 1.0 + wobble;
        blobMesh.scale.y = 1.0 - wobble * 0.5;
        blobMesh.scale.z = 1.0 + wobble * 0.3;
    }

    // Reflective coating effect (after merging)
    if (data.reflectiveCoating) {
        data.coatingTimer += delta;
        const mat = blobMesh.material as THREE.MeshStandardMaterial;
        
        if (data.coatingTimer < 3.0) {
            // Enhanced reflectivity during coating
            mat.roughness = 0.01;
            mat.metalness = 1.0;
        } else {
            // Return to normal
            data.reflectiveCoating = false;
            data.coatingTimer = 0;
            mat.roughness = 0.02;
        }
    }

    // Slow rotation
    blob.rotation.y += delta * 0.3;
}

// --- Magma Hearts ---
export function createMagmaHeart(options: any = {}) {
    const { size = 4, color = 0xff4400 } = options;
    const group = new THREE.Group();

    // Crust shell
    const crustGeo = new THREE.IcosahedronGeometry(size, 1);
    const crustMat = new THREE.MeshStandardMaterial({
        color: 0x331100,
        roughness: 1.0,
        metalness: 0.0,
        emissive: 0x331100,
        emissiveIntensity: 0.2
    });
    
    const crust = new THREE.Mesh(crustGeo, crustMat);
    crust.castShadow = true;
    group.add(crust);

    // Inner magma glow (visible through cracks)
    const glowGeo = new THREE.IcosahedronGeometry(size * 0.9, 2);
    const glowMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.0 // Starts hidden
    });
    
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    // Lava droplets (spawn during critical phase)
    const droplets: THREE.Mesh[] = [];

    group.userData = {
        type: 'magmaHeart',
        crust: crust,
        glow: glow,
        droplets: droplets,
        size: size,
        pressure: 0, // 0-100%
        phase: 'build', // 'build', 'critical', 'eruption', 'cooldown'
        phaseTimer: 0,
        health: 200,
        timeOffset: Math.random() * 100
    };

    return group;
}

// Update Magma Heart eruption cycle
export function updateMagmaHeart(heart: THREE.Group, delta: number, time: number) {
    if (!heart.userData || heart.userData.type !== 'magmaHeart') return;

    const data = heart.userData;
    const timeValue = time + data.timeOffset;

    data.phaseTimer += delta;

    const crustMat = data.crust.material as THREE.MeshStandardMaterial;
    const glowMat = data.glow.material as THREE.MeshStandardMaterial;

    // Build Phase (0-80% pressure)
    if (data.phase === 'build') {
        data.pressure = Math.min(80, data.pressure + delta * 5); // 16 seconds to reach 80%
        
        // Pulse intensity increases with pressure
        const pulse = Math.sin(timeValue * (1 + data.pressure / 100)) * 0.5 + 0.5;
        crustMat.emissiveIntensity = 0.2 + (data.pressure / 100) * 0.8 * pulse;
        glowMat.opacity = (data.pressure / 100) * 0.3;
        
        if (data.pressure >= 80) {
            data.phase = 'critical';
            data.phaseTimer = 0;
        }
    }
    
    // Critical Phase (80-100% pressure, 5 second warning)
    else if (data.phase === 'critical') {
        data.pressure = Math.min(100, 80 + (data.phaseTimer / 5) * 20);
        
        // Intense pulsing
        const urgentPulse = Math.sin(timeValue * 8) * 0.5 + 0.5;
        crustMat.emissiveIntensity = 1.5 + urgentPulse * 0.5;
        glowMat.opacity = 0.5 + urgentPulse * 0.3;
        
        // Spawn lava droplets
        if (Math.random() < 0.1) {
            const dropletGeo = new THREE.SphereGeometry(0.2, 8, 8);
            const dropletMat = new THREE.MeshStandardMaterial({
                color: 0xff6600,
                emissive: 0xff6600,
                emissiveIntensity: 2.0
            });
            const droplet = new THREE.Mesh(dropletGeo, dropletMat);
            
            // Random position on surface
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            droplet.position.set(
                data.size * Math.sin(phi) * Math.cos(theta),
                data.size * Math.sin(phi) * Math.sin(theta),
                data.size * Math.cos(phi)
            );
            
            data.droplets.push(droplet);
            heart.add(droplet);
        }
        
        if (data.phaseTimer >= 5) {
            data.phase = 'eruption';
            data.phaseTimer = 0;
        }
    }
    
    // Eruption Phase
    else if (data.phase === 'eruption') {
        crustMat.emissiveIntensity = 3.0;
        glowMat.opacity = 1.0;
        
        // Would spawn lava globs radially here
        // This is where the actual eruption effect would trigger
        
        if (data.phaseTimer >= 2) {
            data.phase = 'cooldown';
            data.phaseTimer = 0;
            data.pressure = 0;
            
            // Clear droplets
            data.droplets.forEach((d: THREE.Mesh) => heart.remove(d));
            data.droplets.length = 0;
        }
    }
    
    // Cooldown Phase (15 seconds)
    else if (data.phase === 'cooldown') {
        const coolProgress = data.phaseTimer / 15;
        crustMat.emissiveIntensity = 3.0 * (1 - coolProgress);
        glowMat.opacity = 1.0 * (1 - coolProgress);
        
        if (data.phaseTimer >= 15) {
            data.phase = 'build';
            data.phaseTimer = 0;
        }
    }

    // Slow rotation
    heart.rotation.y += delta * 0.2;
}
