import * as THREE from 'three';

/**
 * Geological & Crystalline Objects
 * Implements various space environment objects from plan.md
 */

// --- Nebula Jelly-Moss ---
export function createNebulaJellyMoss(options = {}) {
    const { size = 5, color = 0x44ff88 } = options;
    const group = new THREE.Group();
    
    // Gelatinous membrane (semi-transparent sphere)
    const membraneGeo = new THREE.SphereGeometry(size, 32, 32);
    const membraneMat = new THREE.MeshStandardMaterial({
        color: 0x88ffaa,
        transparent: true,
        opacity: 0.3,
        roughness: 0.2,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const membrane = new THREE.Mesh(membraneGeo, membraneMat);
    group.add(membrane);
    
    // Inner fractal moss (layered spheres with different scales)
    const mossLayers = 3;
    for (let i = 0; i < mossLayers; i++) {
        const layerSize = size * (0.3 + i * 0.2);
        const mossGeo = new THREE.IcosahedronGeometry(layerSize, 1);
        const mossMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8 - i * 0.2,
            transparent: true,
            opacity: 0.6 - i * 0.15,
            roughness: 0.9
        });
        
        const moss = new THREE.Mesh(mossGeo, mossMat);
        moss.userData.rotationSpeed = (Math.random() - 0.5) * 0.5;
        moss.userData.layer = i;
        group.add(moss);
    }
    
    // Store animation data
    group.userData = {
        type: 'jellyMoss',
        pulsePhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.2 + Math.random() * 0.3,
        membrane: membrane,
        baseSize: size
    };
    
    return group;
}

// Update Nebula Jelly-Moss animation
export function updateNebulaJellyMoss(jellyMoss, delta, time) {
    if (!jellyMoss.userData || jellyMoss.userData.type !== 'jellyMoss') return;
    
    const data = jellyMoss.userData;
    const pulseTime = time + data.pulsePhase;
    
    // Pulse animation (3s cycle as per plan)
    const pulse = Math.sin(pulseTime * (Math.PI * 2 / 3)) * 0.5 + 0.5;
    
    // Update membrane wobble (vertex shader simulation via scale)
    const membrane = data.membrane;
    if (membrane) {
        membrane.scale.setScalar(1 + Math.sin(pulseTime * 2) * 0.05);
    }
    
    // Counter-rotate moss layers for parallax
    jellyMoss.children.forEach((child, i) => {
        if (child.userData.layer !== undefined) {
            child.rotation.y += child.userData.rotationSpeed * delta;
            child.rotation.x += child.userData.rotationSpeed * 0.5 * delta;
            
            // Pulse brightness
            if (child.material && child.material.emissive) {
                child.material.emissiveIntensity = (0.5 + pulse * 0.5) * (1 - child.userData.layer * 0.2);
            }
        }
    });
    
    // Sine-wave drifting
    const driftOffset = Math.sin(time * 0.5 + data.pulsePhase) * data.driftSpeed;
    jellyMoss.position.y += driftOffset * delta;
}

// --- Spore Clouds ---
export class SporeCloud {
    constructor(scene, position, sporeCount = 1000) {
        this.scene = scene;
        this.position = position.clone();
        this.sporeCount = sporeCount;
        this.spores = [];
        this.active = true;
        this.group = new THREE.Group();
        
        // Create spores
        const sporeGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const sporeMat = new THREE.MeshStandardMaterial({
            color: 0x88ff88,
            emissive: 0x44ff44,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < sporeCount; i++) {
            const spore = new THREE.Mesh(sporeGeo, sporeMat.clone());
            
            // Random position within cloud radius
            const radius = 5 + Math.random() * 5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            spore.position.set(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );
            
            // Store brownian motion state
            spore.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                ),
                originalPos: spore.position.clone(),
                reactionTime: -1,
                index: i
            };
            
            this.spores.push(spore);
            this.group.add(spore);
        }
        
        this.group.position.copy(position);
        scene.add(this.group);
    }
    
    update(delta) {
        if (!this.active) return;
        
        // Brownian motion with cohesive drift
        const centerOfMass = new THREE.Vector3();
        this.spores.forEach(spore => {
            centerOfMass.add(spore.position);
        });
        centerOfMass.divideScalar(this.spores.length);
        
        this.spores.forEach(spore => {
            const data = spore.userData;
            
            // Brownian motion
            data.velocity.x += (Math.random() - 0.5) * 0.01;
            data.velocity.y += (Math.random() - 0.5) * 0.01;
            data.velocity.z += (Math.random() - 0.5) * 0.01;
            
            // Cohesive drift toward center
            const toCenter = centerOfMass.clone().sub(spore.position);
            const distance = toCenter.length();
            if (distance > 0.1) {
                toCenter.normalize().multiplyScalar(0.005);
                data.velocity.add(toCenter);
            }
            
            // Damping
            data.velocity.multiplyScalar(0.95);
            
            // Update position
            spore.position.add(data.velocity);
            
            // Chain reaction animation
            if (data.reactionTime >= 0) {
                data.reactionTime += delta;
                const intensity = Math.max(0, 1 - data.reactionTime);
                spore.material.emissiveIntensity = 3.0 * intensity;
                spore.scale.setScalar(1 + intensity * 0.5);
                
                if (data.reactionTime > 1.0) {
                    spore.visible = false;
                }
            }
        });
    }
    
    triggerChainReaction(hitPosition) {
        // Find spores within reaction radius and trigger cascade
        const reactionRadius = 2.0;
        const queue = [];
        
        this.spores.forEach(spore => {
            const worldPos = spore.getWorldPosition(new THREE.Vector3());
            const distance = worldPos.distanceTo(hitPosition);
            if (distance < reactionRadius && spore.userData.reactionTime < 0) {
                spore.userData.reactionTime = distance * 0.1; // Delay based on distance
                queue.push(spore);
            }
        });
        
        return queue.length;
    }
    
    cleanup() {
        this.scene.remove(this.group);
        this.spores.forEach(spore => {
            if (spore.geometry) spore.geometry.dispose();
            if (spore.material) spore.material.dispose();
        });
        this.active = false;
    }
}

// --- Chroma-Shift Rocks ---
export function createChromaShiftRock(options = {}) {
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
export function updateChromaRock(rock, cameraPosition, delta, time) {
    if (!rock.userData || rock.userData.type !== 'chromaRock') return;
    
    const distance = rock.position.distanceTo(cameraPosition);
    const maxDistance = 50;
    const normalizedDist = Math.min(distance / maxDistance, 1.0);
    
    // Shift hue based on distance and time
    const timeValue = time + rock.userData.timeOffset;
    const hue = (normalizedDist * 0.3 + timeValue * 0.1) % 1.0;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
    
    const rockMesh = rock.userData.rock;
    if (rockMesh && rockMesh.material) {
        rockMesh.material.emissive.lerp(color, 0.05);
        rockMesh.material.emissiveIntensity = 0.2 + Math.sin(timeValue) * 0.1;
    }
    
    // Slow rotation
    rock.rotation.y += delta * 0.2;
    rock.rotation.x += delta * 0.1;
}

// --- Fractured Geodes ---
export function createFracturedGeode(options = {}) {
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
export function updateGeode(geode, delta, time) {
    if (!geode.userData || geode.userData.type !== 'geode') return;
    
    const glow = geode.userData.glow;
    if (glow) {
        // Pulse the EM field
        const timeValue = time + geode.userData.timeOffset;
        const pulse = Math.sin(timeValue * 2) * 0.5 + 0.5;
        glow.material.opacity = 0.1 + pulse * 0.15;
        glow.scale.setScalar(1 + pulse * 0.1);
    }
    
    // Slow rotation
    geode.rotation.y += delta * 0.1;
}
