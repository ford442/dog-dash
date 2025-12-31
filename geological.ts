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

    // 1. Gelatinous Membrane (Shader-based) - higher detail
    const membraneGeo = new THREE.SphereGeometry(size, 64, 64);
    const membraneMat = createJellyMembraneMaterial(0x88ffaa);
    const membrane = new THREE.Mesh(membraneGeo, membraneMat);
    membrane.receiveShadow = true;
    group.add(membrane);

    // 2. Inner Fractal Moss (Shader-based instances) - more layers
    const mossLayers = 4;
    const cores = [];
    for (let i = 0; i < mossLayers; i++) {
        const layerSize = size * (0.25 + i * 0.18);
        const mossGeo = new THREE.IcosahedronGeometry(layerSize, 3); // Higher detail

        // Use custom shader material for moss
        const mossMat = createJellyMossMaterial(color);

        const moss = new THREE.Mesh(mossGeo, mossMat);
        moss.userData.rotationSpeed = (Math.random() - 0.5) * 0.6;
        moss.userData.layer = i;
        moss.userData.baseScale = 1.0;
        group.add(moss);
        cores.push(moss);
    }

    // 3. Add tendril-like structures extending from core
    const tendrilCount = 5;
    const tendrils = [];
    for (let i = 0; i < tendrilCount; i++) {
        const tendrilLength = size * (0.5 + Math.random() * 0.5);
        const segments = 6;
        const points: THREE.Vector3[] = [];
        
        const angle = (i / tendrilCount) * Math.PI * 2;
        const startRadius = size * 0.6;
        
        for (let j = 0; j <= segments; j++) {
            const t = j / segments;
            const curvature = Math.sin(t * Math.PI) * 0.3;
            const radius = startRadius + t * tendrilLength;
            
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius + curvature,
                Math.sin(angle) * radius + curvature,
                (Math.random() - 0.5) * tendrilLength * 0.2
            ));
        }
        
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, segments * 2, 0.12, 6, false);
        const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x66dd99,
            transparent: true,
            opacity: 0.6,
            emissive: color,
            emissiveIntensity: 0.3
        });
        
        const tendril = new THREE.Mesh(tubeGeo, tubeMat);
        tendril.userData.baseAngle = angle;
        tendril.userData.waveOffset = Math.random() * Math.PI * 2;
        tendrils.push(tendril);
        group.add(tendril);
    }

    // 4. Add bioluminescent spots
    const spotCount = 12;
    const spots = [];
    for (let i = 0; i < spotCount; i++) {
        const spotGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const spotMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.8
        });
        
        const spot = new THREE.Mesh(spotGeo, spotMat);
        
        // Random position on membrane surface
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = size * 0.95;
        
        spot.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        
        spot.userData.pulseOffset = Math.random() * Math.PI * 2;
        spots.push(spot);
        group.add(spot);
    }

    // Store animation data
    group.userData = {
        type: 'jellyMoss',
        pulsePhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.2 + Math.random() * 0.3,
        membrane: membrane,
        cores: cores,
        tendrils: tendrils,
        spots: spots,
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

    // Enhanced pulse animation (3s cycle)
    const pulse = Math.sin(pulseTime * (Math.PI * 2 / 3)) * 0.5 + 0.5;
    const fastPulse = Math.sin(pulseTime * (Math.PI * 4 / 3)) * 0.5 + 0.5;

    // Update membrane uniforms (Shader Node update happens automatically via time node,
    // but we can update uniforms like uPulse manually if we want game logic influence)

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

    // Counter-rotate moss layers with varied speeds
    jellyMoss.children.forEach((child, i) => {
        if (child.userData.layer !== undefined) {
            child.rotation.y += child.userData.rotationSpeed * delta;
            child.rotation.x += child.userData.rotationSpeed * 0.5 * delta;
            child.rotation.z += child.userData.rotationSpeed * 0.3 * delta;

            // Pulse scale
            const layerPulse = Math.sin(pulseTime + child.userData.layer * 0.5) * 0.5 + 0.5;
            child.scale.setScalar(1.0 + layerPulse * 0.08);

            // Update moss pulse uniform
            const mat = (child as THREE.Mesh).material as THREE.Material;
            if (mat && mat.userData && mat.userData.uPulse) {
                mat.userData.uPulse.value = pulse;
            }
        }
    });

    // Animate tendrils with wave motion
    if (data.tendrils) {
        data.tendrils.forEach((tendril: THREE.Mesh, i: number) => {
            const wave = Math.sin(pulseTime + tendril.userData.waveOffset) * 0.15;
            tendril.rotation.z = wave;
            
            // Pulse emissive
            const mat = tendril.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = 0.3 + fastPulse * 0.3;
        });
    }
    
    // Animate bioluminescent spots
    if (data.spots) {
        data.spots.forEach((spot: THREE.Mesh, i: number) => {
            const spotPulse = Math.sin(pulseTime * 2 + spot.userData.pulseOffset) * 0.5 + 0.5;
            const mat = spot.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = 1.5 + spotPulse * 1.0;
            spot.scale.setScalar(0.9 + spotPulse * 0.3);
        });
    }

    // Enhanced sine-wave drifting with multi-axis movement
    const driftOffset = Math.sin(time * 0.5 + data.pulsePhase) * data.driftSpeed;
    const driftOffsetZ = Math.cos(time * 0.3 + data.pulsePhase) * data.driftSpeed * 0.5;
    jellyMoss.position.y += driftOffset * delta;
    jellyMoss.position.z += driftOffsetZ * delta;
    
    // Gentle rotation
    jellyMoss.rotation.y += delta * 0.1;
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

    // Main rock body - higher detail with more subdivision
    const rockGeo = new THREE.IcosahedronGeometry(size, 2);
    
    // Add some random deformation for more organic look
    const positions = rockGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const noise = (Math.random() - 0.5) * 0.3;
        positions.setXYZ(i, x * (1 + noise), y * (1 + noise), z * (1 + noise));
    }
    rockGeo.computeVertexNormals();

    // Custom material with distance-based color shift
    const rockMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.4,
        emissive: color,
        emissiveIntensity: 0.3,
        flatShading: true // More crystalline look
    });

    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.castShadow = true;
    rock.receiveShadow = true;

    // Add crystal shards with more variety
    const shardCount = 5 + Math.floor(Math.random() * 8);
    for (let i = 0; i < shardCount; i++) {
        const shardHeight = 0.5 + Math.random() * 1.2;
        const shardRadius = 0.15 + Math.random() * 0.25;
        const shardGeo = new THREE.ConeGeometry(shardRadius, shardHeight, 6);
        const shardMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaff,
            emissive: 0x6666ff,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.85,
            roughness: 0.2,
            metalness: 0.6
        });

        const shard = new THREE.Mesh(shardGeo, shardMat);

        // Random position on surface with clustering
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = size * (0.95 + Math.random() * 0.2);
        shard.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        shard.lookAt(0, 0, 0);
        shard.rotateX(-Math.PI / 2);
        
        // Random rotation for variation
        shard.rotation.z = Math.random() * Math.PI * 2;

        rock.add(shard);
    }

    group.add(rock);

    // Add subtle glow aura
    const glowGeo = new THREE.IcosahedronGeometry(size * 1.15, 1);
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    // Store animation data
    group.userData = {
        type: 'chromaRock',
        originalColor: color,
        baseEmissive: 0.3,
        rock: rock,
        glow: glow,
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

    // Shift hue based on distance and time with more vibrant colors
    const timeValue = time + rock.userData.timeOffset;
    const hue = (normalizedDist * 0.4 + timeValue * 0.15) % 1.0;
    const color = new THREE.Color().setHSL(hue, 0.9, 0.6);

    const rockMesh = rock.userData.rock as THREE.Mesh;
    if (rockMesh && rockMesh.material) {
        (rockMesh.material as THREE.MeshStandardMaterial).emissive.lerp(color, 0.1);
        (rockMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.sin(timeValue * 2) * 0.15;
    }

    // Update glow with color and pulse
    const glowMesh = rock.userData.glow as THREE.Mesh;
    if (glowMesh && glowMesh.material) {
        (glowMesh.material as THREE.MeshBasicMaterial).color.copy(color);
        const glowPulse = Math.sin(timeValue * 3) * 0.5 + 0.5;
        (glowMesh.material as THREE.MeshBasicMaterial).opacity = 0.05 + glowPulse * 0.15;
    }

    // Multi-axis rotation for more dynamic movement
    rock.rotation.y += delta * 0.25;
    rock.rotation.x += delta * 0.15;
    rock.rotation.z += delta * 0.08;
}

// --- Fractured Geodes ---
export function createFracturedGeode(options: any = {}) {
    const { size = 4, color = 0x8844ff } = options;
    const group = new THREE.Group();

    // Outer shell (fractured) - more detailed
    const shellGeo = new THREE.IcosahedronGeometry(size, 1);
    
    // Create fracture lines by randomly displacing some vertices
    const positions = shellGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        if (Math.random() > 0.7) { // 30% of vertices displaced
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            const offset = Math.random() * 0.2;
            positions.setXYZ(i, x * (1 + offset), y * (1 + offset), z * (1 + offset));
        }
    }
    shellGeo.computeVertexNormals();
    
    const shellMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.95,
        metalness: 0.05,
        flatShading: true
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    // Inner crystals - more variety in size and arrangement
    const crystalCount = 12 + Math.floor(Math.random() * 12);
    const crystals: THREE.Mesh[] = [];
    
    for (let i = 0; i < crystalCount; i++) {
        const crystalSize = 0.4 + Math.random() * 1.0;
        const crystalGeo = new THREE.ConeGeometry(crystalSize * 0.5, crystalSize * 1.8, 6);
        
        // Vary crystal colors slightly
        const hue = (color & 0xff) / 255;
        const crystalColor = new THREE.Color().setHSL(hue, 0.8, 0.5 + Math.random() * 0.2);
        
        const crystalMat = new THREE.MeshStandardMaterial({
            color: crystalColor,
            emissive: crystalColor,
            emissiveIntensity: 1.2 + Math.random() * 0.6,
            transparent: true,
            opacity: 0.75,
            roughness: 0.15,
            metalness: 0.4
        });

        const crystal = new THREE.Mesh(crystalGeo, crystalMat);

        // Point inward from shell in clusters
        const clusterAngle = Math.floor(i / 3) * (Math.PI * 2 / 4); // 4 clusters
        const theta = clusterAngle + (Math.random() - 0.5) * 0.8;
        const phi = Math.random() * Math.PI;
        const r = size * (0.85 + Math.random() * 0.15);

        crystal.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        crystal.lookAt(0, 0, 0);
        crystal.rotateX(-Math.PI / 2);
        
        crystals.push(crystal);
        group.add(crystal);
    }

    // Add EM field glow - multiple layers for depth
    const glowLayers = [];
    for (let i = 0; i < 2; i++) {
        const glowSize = size * (1.2 + i * 0.2);
        const glowGeo = new THREE.SphereGeometry(glowSize, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.1 / (i + 1),
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glowLayers.push(glow);
        group.add(glow);
    }
    
    // Add energy arcs (simple lines that will pulse)
    const arcCount = 3;
    const arcs: THREE.Line[] = [];
    for (let i = 0; i < arcCount; i++) {
        const points: THREE.Vector3[] = [];
        const segments = 8;
        const angle = (i / arcCount) * Math.PI * 2;
        
        for (let j = 0; j <= segments; j++) {
            const t = j / segments;
            const radius = size * 1.3;
            const offset = Math.sin(t * Math.PI) * 0.5;
            points.push(new THREE.Vector3(
                Math.cos(angle + t * Math.PI * 2) * radius + offset,
                Math.sin(angle + t * Math.PI * 2) * radius + offset,
                (t - 0.5) * size * 0.5
            ));
        }
        
        const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
        const arcMat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3
        });
        const arc = new THREE.Line(arcGeo, arcMat);
        arcs.push(arc);
        group.add(arc);
    }

    group.userData = {
        type: 'geode',
        glowLayers: glowLayers,
        crystals: crystals,
        arcs: arcs,
        baseColor: color,
        timeOffset: Math.random() * 100
    };

    return group;
}

// Update geode EM field animation
export function updateGeode(geode: THREE.Group, delta: number, time: number) {
    if (!geode.userData || geode.userData.type !== 'geode') return;

    const timeValue = time + geode.userData.timeOffset;
    
    // Pulse the EM field layers with different frequencies
    if (geode.userData.glowLayers) {
        geode.userData.glowLayers.forEach((glow: THREE.Mesh, i: number) => {
            const frequency = 2 + i * 0.5;
            const pulse = Math.sin(timeValue * frequency) * 0.5 + 0.5;
            (glow.material as THREE.MeshBasicMaterial).opacity = (0.08 + pulse * 0.12) / (i + 1);
            glow.scale.setScalar(1 + pulse * 0.08);
        });
    }
    
    // Animate crystals with individual pulsing
    if (geode.userData.crystals) {
        geode.userData.crystals.forEach((crystal: THREE.Mesh, i: number) => {
            const pulse = Math.sin(timeValue * 2 + i * 0.5) * 0.5 + 0.5;
            const mat = crystal.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = 1.2 + pulse * 0.6;
        });
    }
    
    // Animate energy arcs
    if (geode.userData.arcs) {
        geode.userData.arcs.forEach((arc: THREE.Line, i: number) => {
            const arcPulse = Math.sin(timeValue * 3 + i * Math.PI * 2 / 3) * 0.5 + 0.5;
            (arc.material as THREE.LineBasicMaterial).opacity = 0.2 + arcPulse * 0.4;
            arc.rotation.z += delta * 0.3 * (i % 2 === 0 ? 1 : -1);
        });
    }

    // Slow rotation
    geode.rotation.y += delta * 0.15;
    geode.rotation.x += delta * 0.08;
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
        const needleRadius = 0.08 + Math.random() * 0.08;
        
        // Create multi-segment needle for more detail
        const segments = 3;
        const needleGroup = new THREE.Group();
        
        for (let s = 0; s < segments; s++) {
            const segmentLength = needleLength / segments;
            const segmentRadius = needleRadius * (1 - s * 0.2);
            const needleGeo = new THREE.ConeGeometry(segmentRadius, segmentLength, 8);
            const needleMat = new THREE.MeshPhysicalMaterial({
                color: color,
                transparent: true,
                opacity: 0.85,
                roughness: 0.05,
                metalness: 0.0,
                transmission: 0.6,
                thickness: 0.8,
                ior: 1.31, // Ice refractive index
                clearcoat: 1.0,
                clearcoatRoughness: 0.1
            });
            
            const segment = new THREE.Mesh(needleGeo, needleMat);
            segment.position.y = s * segmentLength + segmentLength / 2;
            needleGroup.add(segment);
        }
        
        // Position in hexagonal grid pattern with some randomness
        const layer = Math.floor(i / 6);
        const angleInLayer = (i % 6) / 6 * Math.PI * 2;
        const layerRadius = layer * 1.8 + Math.random() * 0.5;
        
        needleGroup.position.x = Math.cos(angleInLayer) * layerRadius;
        needleGroup.position.z = Math.sin(angleInLayer) * layerRadius;
        needleGroup.position.y = (Math.random() - 0.5) * 1.5;
        
        // Random rotation for natural look
        needleGroup.rotation.x = (Math.random() - 0.5) * 0.4 + Math.PI;
        needleGroup.rotation.z = (Math.random() - 0.5) * 0.4;
        
        needleGroup.userData = {
            health: 20,
            index: i,
            basePosition: needleGroup.position.clone(),
            baseRotation: needleGroup.rotation.clone()
        };
        
        needles.push(needleGroup as any);
        group.add(needleGroup);
    }

    // Enhanced frost heart at center with crystalline structure
    const frostHeartGeo = new THREE.IcosahedronGeometry(1.0, 2);
    const frostHeartMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        emissive: 0x4488ff,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.95,
        roughness: 0.2,
        metalness: 0.3
    });
    
    const frostHeart = new THREE.Mesh(frostHeartGeo, frostHeartMat);
    group.add(frostHeart);
    
    // Add crystalline glow layers around frost heart
    for (let i = 0; i < 2; i++) {
        const glowSize = 1.3 + i * 0.3;
        const glowGeo = new THREE.IcosahedronGeometry(glowSize, 1);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.1 / (i + 1),
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        frostHeart.add(glow);
    }

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

    // Enhanced shimmer effect on needles with refraction-like pulses
    data.needles.forEach((needle: any, i: number) => {
        const shimmer = Math.sin(timeValue * 2.5 + i * 0.5 + data.shimmerPhase) * 0.5 + 0.5;
        
        // Update each segment material if it's a group
        if (needle.children && needle.children.length > 0) {
            needle.children.forEach((segment: THREE.Mesh, s: number) => {
                const mat = segment.material as THREE.MeshPhysicalMaterial;
                mat.opacity = 0.8 + shimmer * 0.15;
                mat.transmission = 0.5 + shimmer * 0.2;
            });
        }
        
        // Subtle sway with varying amplitude
        const sway = Math.sin(timeValue * 1.2 + i * 0.3) * 0.03;
        const twist = Math.cos(timeValue * 0.8 + i * 0.2) * 0.02;
        needle.rotation.x = needle.userData.baseRotation.x + sway;
        needle.rotation.z = needle.userData.baseRotation.z + twist;
    });

    // Enhanced frost heart pulsing with inner glow layers
    if (data.frostHeart) {
        const pulse = Math.sin(timeValue * 2) * 0.5 + 0.5;
        const mat = data.frostHeart.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.5 + pulse * 1.0;
        data.frostHeart.scale.setScalar(1.0 + pulse * 0.15);
        data.frostHeart.rotation.y += delta * 0.5;
        data.frostHeart.rotation.x += delta * 0.3;
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

    // Enhanced crust shell with more detail
    const crustGeo = new THREE.IcosahedronGeometry(size, 2);
    
    // Add surface irregularities
    const positions = crustGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        if (Math.random() > 0.6) { // 40% of vertices get bumps
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            const bump = 1.0 + Math.random() * 0.15;
            positions.setXYZ(i, x * bump, y * bump, z * bump);
        }
    }
    crustGeo.computeVertexNormals();
    
    const crustMat = new THREE.MeshStandardMaterial({
        color: 0x2a1100,
        roughness: 1.0,
        metalness: 0.0,
        emissive: 0x331100,
        emissiveIntensity: 0.3
    });
    
    const crust = new THREE.Mesh(crustGeo, crustMat);
    crust.castShadow = true;
    crust.receiveShadow = true;
    group.add(crust);

    // Inner magma glow (visible through cracks) - multiple layers
    const glowLayers: THREE.Mesh[] = [];
    for (let i = 0; i < 2; i++) {
        const glowSize = size * (0.88 - i * 0.05);
        const glowGeo = new THREE.IcosahedronGeometry(glowSize, 2);
        const glowMat = new THREE.MeshStandardMaterial({
            color: i === 0 ? color : 0xff6600,
            emissive: i === 0 ? color : 0xff6600,
            emissiveIntensity: 2.5 - i * 0.5,
            transparent: true,
            opacity: 0.0 // Starts hidden
        });
        
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glowLayers.push(glow);
        group.add(glow);
    }
    
    // Crack lines that will appear during critical phase
    const crackLines: THREE.Line[] = [];
    for (let i = 0; i < 6; i++) {
        const points: THREE.Vector3[] = [];
        const theta = (i / 6) * Math.PI * 2;
        const segments = 8;
        
        for (let j = 0; j <= segments; j++) {
            const t = j / segments;
            const phi = (t - 0.5) * Math.PI * 0.8;
            const r = size * (1.01 + Math.sin(t * Math.PI * 2) * 0.02);
            points.push(new THREE.Vector3(
                r * Math.cos(theta) * Math.cos(phi),
                r * Math.sin(theta) * Math.cos(phi),
                r * Math.sin(phi)
            ));
        }
        
        const crackGeo = new THREE.BufferGeometry().setFromPoints(points);
        const crackMat = new THREE.LineBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.0
        });
        const crack = new THREE.Line(crackGeo, crackMat);
        crackLines.push(crack);
        group.add(crack);
    }

    // Lava droplets (spawn during critical phase)
    const droplets: THREE.Mesh[] = [];
    
    // Add heat distortion aura
    const auraGeo = new THREE.SphereGeometry(size * 1.4, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    group.add(aura);

    group.userData = {
        type: 'magmaHeart',
        crust: crust,
        glowLayers: glowLayers,
        crackLines: crackLines,
        aura: aura,
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

    // Build Phase (0-80% pressure)
    if (data.phase === 'build') {
        data.pressure = Math.min(80, data.pressure + delta * 5); // 16 seconds to reach 80%
        
        // Pulse intensity increases with pressure
        const pulse = Math.sin(timeValue * (1.5 + data.pressure / 100)) * 0.5 + 0.5;
        crustMat.emissiveIntensity = 0.3 + (data.pressure / 100) * 1.0 * pulse;
        
        // Show inner glow layers gradually
        data.glowLayers.forEach((glow: THREE.Mesh, i: number) => {
            const mat = glow.material as THREE.MeshStandardMaterial;
            mat.opacity = (data.pressure / 100) * (0.4 - i * 0.1);
            glow.rotation.y += delta * (0.5 + i * 0.3);
        });
        
        // Update aura
        const auraMat = data.aura.material as THREE.MeshBasicMaterial;
        auraMat.opacity = (data.pressure / 100) * 0.05;
        
        if (data.pressure >= 80) {
            data.phase = 'critical';
            data.phaseTimer = 0;
        }
    }
    
    // Critical Phase (80-100% pressure, 5 second warning)
    else if (data.phase === 'critical') {
        data.pressure = Math.min(100, 80 + (data.phaseTimer / 5) * 20);
        
        // Intense pulsing
        const urgentPulse = Math.sin(timeValue * 10) * 0.5 + 0.5;
        crustMat.emissiveIntensity = 2.0 + urgentPulse * 1.0;
        crustMat.emissive.setHex(0x551100 + Math.floor(urgentPulse * 0x222200));
        
        // Glow layers become more visible
        data.glowLayers.forEach((glow: THREE.Mesh, i: number) => {
            const mat = glow.material as THREE.MeshStandardMaterial;
            mat.opacity = 0.6 + urgentPulse * 0.3 - i * 0.15;
            mat.emissiveIntensity = 3.0 + urgentPulse * 1.0;
            glow.rotation.y += delta * (1.0 + i * 0.5);
        });
        
        // Show crack lines
        data.crackLines.forEach((crack: THREE.Line, i: number) => {
            const mat = crack.material as THREE.LineBasicMaterial;
            const crackPulse = Math.sin(timeValue * 8 + i) * 0.5 + 0.5;
            mat.opacity = 0.4 + crackPulse * 0.4;
        });
        
        // Enhanced aura
        const auraMat = data.aura.material as THREE.MeshBasicMaterial;
        auraMat.opacity = 0.1 + urgentPulse * 0.1;
        data.aura.scale.setScalar(1.0 + urgentPulse * 0.1);
        
        // Spawn lava droplets
        if (Math.random() < 0.15) {
            const dropletGeo = new THREE.SphereGeometry(0.15 + Math.random() * 0.15, 8, 8);
            const dropletMat = new THREE.MeshStandardMaterial({
                color: 0xff6600,
                emissive: 0xff6600,
                emissiveIntensity: 3.0
            });
            const droplet = new THREE.Mesh(dropletGeo, dropletMat);
            
            // Random position on surface
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            droplet.position.set(
                data.size * 1.05 * Math.sin(phi) * Math.cos(theta),
                data.size * 1.05 * Math.sin(phi) * Math.sin(theta),
                data.size * 1.05 * Math.cos(phi)
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
        const eruptPulse = Math.sin(timeValue * 15) * 0.5 + 0.5;
        crustMat.emissiveIntensity = 4.0 + eruptPulse;
        
        // Maximum glow
        data.glowLayers.forEach((glow: THREE.Mesh, i: number) => {
            const mat = glow.material as THREE.MeshStandardMaterial;
            mat.opacity = 1.0 - i * 0.2;
            mat.emissiveIntensity = 5.0;
        });
        
        // Maximum crack visibility
        data.crackLines.forEach((crack: THREE.Line) => {
            const mat = crack.material as THREE.LineBasicMaterial;
            mat.opacity = 1.0;
        });
        
        // Maximum aura
        const auraMat = data.aura.material as THREE.MeshBasicMaterial;
        auraMat.opacity = 0.25;
        
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
        crustMat.emissiveIntensity = 4.0 * (1 - coolProgress) + 0.3;
        
        // Fade out glow layers
        data.glowLayers.forEach((glow: THREE.Mesh, i: number) => {
            const mat = glow.material as THREE.MeshStandardMaterial;
            mat.opacity = (1.0 - i * 0.2) * (1 - coolProgress);
        });
        
        // Fade crack lines
        data.crackLines.forEach((crack: THREE.Line) => {
            const mat = crack.material as THREE.LineBasicMaterial;
            mat.opacity = 1.0 * (1 - coolProgress);
        });
        
        // Fade aura
        const auraMat = data.aura.material as THREE.MeshBasicMaterial;
        auraMat.opacity = 0.25 * (1 - coolProgress);
        
        if (data.phaseTimer >= 15) {
            data.phase = 'build';
            data.phaseTimer = 0;
        }
    }

    // Multi-axis rotation for more dynamic movement
    heart.rotation.y += delta * 0.25;
    heart.rotation.x += delta * 0.12;
}
