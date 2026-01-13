import * as THREE from 'three';
import {
    MeshStandardNodeMaterial
} from 'three/webgpu';
import {
    time,
    positionLocal,
    normalLocal,
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
    texture,
    normalMap
} from 'three/tsl';

// --- GEOLOGICAL OBJECTS ---

// 1. CHROMA-SHIFT ROCK (Color shifting crystalline structures)
export function createChromaShiftRock(config: { size: number }) {
    const geo = new THREE.DodecahedronGeometry(config.size, 1);

    // TSL Material for color shifting
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.2,
        metalness: 0.8,
    });
    
    // Animate color based on time and position
    const uTime = time;
    const pos = positionLocal;
    
    // Iridescence logic
    const angle = sin(uTime.add(pos.x).add(pos.y));
    const col1 = color(0xff00ff); // Magenta
    const col2 = color(0x00ffff); // Cyan

    mat.colorNode = mix(col1, col2, angle.add(1.0).mul(0.5)); // mix based on sine wave

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function updateChromaRock(mesh: THREE.Mesh, cameraPos: THREE.Vector3, delta: number, timeVal: number) {
    // Slight rotation
    mesh.rotation.x += delta * 0.1;
    mesh.rotation.y += delta * 0.15;
}


// 2. FRACTURED GEODE (Safe harbors with EM fields)
export function createFracturedGeode(config: { size: number }) {
    const group = new THREE.Group();
    
    // Outer Shell (Dark rock)
    const shellGeo = new THREE.IcosahedronGeometry(config.size, 1);
    // Cut open the geode? (Simplified: just a dark rock for now with a glowing core inside sticking out)
    // Better: Boolean operation is hard. Let's make a shell of rock chunks.

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const shell = new THREE.Mesh(shellGeo, rockMat);
    group.add(shell);

    // Inner Core (Glowing Crystal)
    const coreGeo = new THREE.OctahedronGeometry(config.size * 0.6, 0);
    const coreMat = new MeshStandardNodeMaterial({
        emissive: new THREE.Color(0x8844ff),
        roughness: 0.2,
        metalness: 0.5
    });

    // Pulse effect
    const uTime = time;
    const pulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // 0 to 1
    const baseEmit = color(0x8844ff);
    coreMat.emissiveNode = baseEmit.mul(pulse.add(0.5)); // vary intensity

    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // EM Field (Transparent Sphere)
    const fieldGeo = new THREE.SphereGeometry(config.size * 2.5, 32, 32);
    const fieldMat = new THREE.MeshBasicMaterial({
        color: 0x8844ff,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    group.add(field);

    group.userData.isGeode = true;
    group.userData.fieldRadius = config.size * 2.5;

    return group;
}

export function updateGeode(group: THREE.Group, delta: number, timeVal: number) {
    // Rotate core differently than shell
    const core = group.children[1];
    if (core) {
        core.rotation.y -= delta * 0.5;
        core.rotation.z += delta * 0.2;
    }

    // Pulse field opacity
    const field = group.children[2] as THREE.Mesh;
    if (field) {
        (field.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(timeVal * 2) * 0.05;
        field.rotation.y += delta * 0.1;
    }
}


// 3. NEBULA JELLY-MOSS (Advanced Behavior)
export function createNebulaJellyMoss(config: { size: number }) {
    // High-res geometry for vertex shader displacement (Optimized from 128)
    const geo = new THREE.SphereGeometry(config.size, 48, 48);
    
    // TSL Material for Membrane with Vertex Wobble
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x00ff88,
        transmission: 0.9,
        opacity: 1.0,
        metalness: 0.0,
        roughness: 0.1,
        ior: 1.5,
        thickness: 2.0,
        side: THREE.DoubleSide
    });
    
    // Vertex Wobble Logic (TSL)
    const uTime = time;
    const pos = positionLocal;
    const norm = normalLocal;

    // Organic noise-like movement using combined sine waves
    const freq = float(1.5);
    const speed = float(2.0);
    const amp = float(config.size * 0.15); // 15% surface wobble

    const wobbleX = sin(pos.y.mul(freq).add(uTime.mul(speed)));
    const wobbleY = sin(pos.z.mul(freq).add(uTime.mul(speed.mul(1.1))));
    const wobbleZ = sin(pos.x.mul(freq).add(uTime.mul(speed.mul(0.9))));
    const wobble = wobbleX.add(wobbleY).add(wobbleZ);

    // Displace vertices along normal
    const newPos = pos.add(norm.mul(wobble.mul(amp)));
    mat.positionNode = newPos;

    // Pulsing Emissive Rim
    const pulse = sin(uTime.mul(3.0)).add(1.0).mul(0.5);
    mat.emissiveNode = color(0x00ff88).mul(pulse.mul(0.5));

    const mesh = new THREE.Mesh(geo, mat);
    
    // Internal "Fractal Moss" Cores (Weak points)
    const coreGroup = new THREE.Group();
    const coreCount = 5 + Math.floor(Math.random() * 5);
    const coreGeo = new THREE.IcosahedronGeometry(config.size * 0.15, 0);
    const coreMat = new MeshStandardNodeMaterial({
        color: 0xff2266, // Pinkish red contrast
        emissive: 0x550022,
        roughness: 0.8
    });

    // Core pulse animation
    coreMat.emissiveNode = color(0xff2266).mul(sin(uTime.mul(5.0)).add(1.0).mul(0.5));

    for(let i=0; i<coreCount; i++) {
        const core = new THREE.Mesh(coreGeo, coreMat);
        // Distribute randomly inside
        const r = config.size * 0.6 * Math.cbrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        core.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        core.userData = { isWeakPoint: true };
        coreGroup.add(core);
    }
    mesh.add(coreGroup);

    mesh.userData = {
        type: 'nebulaJellyMoss',
        radius: config.size,
        health: 10,
        maxHealth: 10,
        isHiding: false
    };

    return mesh;
}

export function updateNebulaJellyMoss(mesh: THREE.Mesh, delta: number, timeVal: number) {
    // Slow drift rotation of the entire organism
    mesh.rotation.x += delta * 0.05;
    mesh.rotation.z += delta * 0.03;
    
    // Rotate internal core structure
    if (mesh.children[0]) {
        mesh.children[0].rotation.y -= delta * 0.2;
        mesh.children[0].rotation.x += delta * 0.1;
    }
}


// 4. VOID ROOT BALLS (Dense tangles of roots)
export function createVoidRootBall(config: { size: number }) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1.0 }); // Dark brown
    
    // Create many torus knots to simulate tangled roots
    const count = 5;
    for (let i = 0; i < count; i++) {
        const geo = new THREE.TorusKnotGeometry(config.size * 0.6, config.size * 0.1, 64, 8, 2, 3);
        const mesh = new THREE.Mesh(geo, material);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
    }
    
    group.userData = {
        type: 'voidRootBall',
        grappleRange: config.size * 3.0
    };

    return group;
}

export function updateVoidRootBall(group: THREE.Group, delta: number, timeVal: number, playerPos: THREE.Vector3) {
    // Slow rotation
    group.rotation.x += delta * 0.1;
    group.rotation.y += delta * 0.05;

    // Grapple Logic (Visual only for now)
    // If player is close, maybe extend a "root" towards them?
    const dist = group.position.distanceTo(playerPos);
    if (dist < group.userData.grappleRange) {
        // Look at player?
        // group.lookAt(playerPos); // Might be too abrupt
    }
}


// 5. VACUUM KELP (Swaying energy-draining stalks)
export function createVacuumKelp(config: { length: number, nodes: number }) {
    // Chain of objects or a skinned mesh.
    // Simplified: A series of capsules.
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        emissive: 0x002288,
        emissiveIntensity: 0.5,
        roughness: 0.4
    });

    const nodeHeight = config.length / config.nodes;
    const geo = new THREE.CapsuleGeometry(0.5, nodeHeight - 0.5, 4, 8);

    for (let i = 0; i < config.nodes; i++) {
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.y = i * nodeHeight;
        // Store initial rotation for animation
        mesh.userData.idx = i;
        mesh.userData.baseY = mesh.position.y;
        group.add(mesh);
    }

    group.userData = {
        type: 'vacuumKelp',
        nodes: config.nodes
    };

    return group;
}

export function updateVacuumKelp(group: THREE.Group, delta: number, timeVal: number) {
    // Sway animation
    const swaySpeed = 2.0;
    const swayAmp = 0.2;
    
    group.children.forEach((child, i) => {
        // Each node sways with phase offset
        const angle = Math.sin(timeVal * swaySpeed + i * 0.5) * swayAmp * (i + 1) * 0.1; // More sway at top
        child.position.x = Math.sin(angle) * (i * 2); // Simple displacement
        child.rotation.z = angle;
    });
}


// 6. ICE NEEDLE CLUSTERS (Shatter on impact)
export function createIceNeedleCluster(config: { count: number }) {
    const group = new THREE.Group();
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xaaddff,
        transmission: 0.8,
        opacity: 0.9,
        metalness: 0.1,
        roughness: 0.0,
        ior: 1.31 // Ice
    });

    const geo = new THREE.ConeGeometry(0.2, 4, 6);

    for (let i = 0; i < config.count; i++) {
        const mesh = new THREE.Mesh(geo, material);
        // Radiate outwards
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        mesh.position.set(0, 0, 0); // Center
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        
        // Offset slightly from center
        mesh.translateY(1.5);
        
        group.add(mesh);
    }
    
    return group;
}

export function updateIceNeedleCluster(group: THREE.Group, delta: number, timeVal: number) {
    // Slowly rotate
    group.rotation.y += delta * 0.05;
    group.rotation.z += delta * 0.02;
}


// 7. LIQUID METAL BLOBS (Splitting/Recombining)
export function createLiquidMetalBlob(config: { size: number }) {
    // Metaballs are hard in standard Three.js without marching cubes.
    // Approximation: A group of spheres that move near each other.
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        metalness: 1.0,
        roughness: 0.0,
        envMapIntensity: 1.0
    });
    
    const mainGeo = new THREE.SphereGeometry(config.size, 32, 32);
    const main = new THREE.Mesh(mainGeo, material);
    group.add(main);

    // Satellites
    const count = 3;
    for (let i = 0; i < count; i++) {
        const s = config.size * (0.3 + Math.random() * 0.4);
        const sat = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 16), material);
        sat.userData = {
            orbitSpeed: 1 + Math.random(),
            orbitRadius: config.size * 1.5,
            phase: Math.random() * Math.PI * 2,
            axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize()
        };
        group.add(sat);
    }

    return group;
}

export function updateLiquidMetalBlob(group: THREE.Group, delta: number, timeVal: number) {
    // Animate satellites orbiting smoothly
    for (let i = 1; i < group.children.length; i++) {
        const sat = group.children[i];
        const d = sat.userData;
        const angle = timeVal * d.orbitSpeed + d.phase;
        
        // Circular orbit logic (simplified)
        // Rotate a vector
        const pos = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar(d.orbitRadius);
        pos.applyAxisAngle(d.axis, angle * 0.1); // Precession

        sat.position.copy(pos);

        // "Goopy" scaling when moving fast?
        // kept simple for now
    }
}


// 8. MAGMA HEARTS (Pulsing, erupting)
export function createMagmaHeart(config: { size: number }) {
    const geo = new THREE.SphereGeometry(config.size, 32, 32);
    const mat = new MeshStandardNodeMaterial({
        color: 0x220000,
        roughness: 0.9,
    });
    
    // Lava cracks (Emissive)
    const uTime = time;
    const pos = positionLocal;
    
    // Noise-based cracks
    const noise = sin(pos.x.mul(5.0).add(uTime)).mul(sin(pos.y.mul(5.0))).add(sin(pos.z.mul(5.0)));
    const crack = noise.greaterThan(0.5); // Threshold
    
    const lavaColor = color(0xff3300);
    const rockColor = color(0x000000); // No emission
    
    mat.emissiveNode = mix(rockColor, lavaColor, noise.max(0.0).mul(2.0)); // Glow based on noise
    
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
}

export function updateMagmaHeart(mesh: THREE.Mesh, delta: number, timeVal: number) {
    // Pulse scale for heartbeat
    const beat = Math.sin(timeVal * 5.0); // Fast beat
    // Sharp beat:
    const scale = 1.0 + Math.pow(Math.max(0, beat), 4.0) * 0.1;
    mesh.scale.setScalar(scale);

    mesh.rotation.y += delta * 0.1;
}


// --- EXISTING SPORE CLOUD ---
class SporeData {
    position: THREE.Vector3; // Relative to cloud center
    velocity: THREE.Vector3;
    center: THREE.Vector3; // Cloud center reference
    mesh: THREE.Object3D; // Dummy for matrix updates

    constructor(position: THREE.Vector3, center: THREE.Vector3, dummy: THREE.Object3D) {
        this.position = position;
        this.center = center;
        this.dummy = dummy;
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
        );
        this.mesh = new THREE.Object3D();
        this.mesh.position.copy(center).add(position);
    }

    update(delta: number) {
        // Browninan motion
        this.position.add(this.velocity);

        // Containment (Soft bounce)
        // If too far from center (0,0,0 relative), steer back
        // But here position is relative.
        
        // Simple box bound for efficiency
        if (Math.random() < 0.05) this.velocity.add(new THREE.Vector3((Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01));
        
        this.velocity.multiplyScalar(0.995); // Low friction
        const limit = 4.0;
        this.position.x = Math.max(-limit, Math.min(limit, this.position.x + this.velocity.x));
        this.position.y = Math.max(-limit, Math.min(limit, this.position.y + this.velocity.y));
        this.position.z = Math.max(-limit, Math.min(limit, this.position.z + this.velocity.z));

        // Update mesh position
        this.mesh.position.copy(this.center).add(this.position);
    }
}

export class SporeCloud {
    scene: THREE.Scene;
    spores: THREE.InstancedMesh;
    active: boolean = true;
    dummy: THREE.Object3D;
    sporeData: SporeData[];
    position: THREE.Vector3; // Center of cloud

    constructor(scene: THREE.Scene, position: THREE.Vector3, count: number) {
        this.scene = scene;
        this.position = position;
        this.sporeData = [];
        this.dummy = new THREE.Object3D();

        // Create geometry and material for spores
        const geometry = new THREE.SphereGeometry(0.1, 4, 4);
        const material = new THREE.MeshBasicMaterial({ color: 0x88ff88 });

        this.spores = new THREE.InstancedMesh(geometry, material, count);
        this.spores.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Will update every frame
        // Restore userData linkage for hit detection in main.ts
        // main.ts expects to find the cloud instance via the mesh
        this.spores.userData = { parentCloud: this };
        this.scene.add(this.spores);

        // Initialize spores
        for (let i = 0; i < count; i++) {
            // Random position within cloud radius
            const r = 5 * Math.cbrt(Math.random()); // Cube root for uniform distribution in sphere
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            const pos = new THREE.Vector3(x, y, z);
            this.sporeData.push(new SporeData(pos, this.position, this.dummy));
        }
    }

    update(delta: number) {
        if (!this.active) return;

        // Update each spore
        for (let i = 0; i < this.sporeData.length; i++) {
            this.sporeData[i].update(delta);
            this.sporeData[i].mesh.updateMatrix();
            this.spores.setMatrixAt(i, this.sporeData[i].mesh.matrix);
        }
        this.spores.instanceMatrix.needsUpdate = true;
    }

    triggerChainReaction(hitPoint: THREE.Vector3) {
        // Find spores near hit point and activate/explode them
        // For simplicity, just return number of affected spores
        let count = 0;
        const reactionRadius = 2.0;
        
        // This is a simplified check. In a real system, we'd use a spatial index.
        // We'll just check distance to cloud center for now as a proxy or verify against all spores (slow).
        // Since we have the hit point relative to world, and spore positions are relative to cloud center...
        // Wait, SporeData.position is relative offset.
        // We need to convert hitPoint to local space.
        const localHit = hitPoint.clone().sub(this.position);

        for(const spore of this.sporeData) {
            if (spore.position.distanceTo(localHit) < reactionRadius) {
                // "Explode" - push away
                const dir = spore.position.clone().sub(localHit).normalize();
                spore.velocity.add(dir.multiplyScalar(0.5));
                count++;
            }
        }
        return count;
    }
}
