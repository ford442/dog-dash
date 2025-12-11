import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';
import { createStars, uStarOpacity } from './stars.js';
import { 
    createSubwooferLotus, 
    createFiberOpticWillow, 
    createGlowingFlower, 
    animateFoliage,
    initGrassSystem,
    addGrassInstance
} from './foliage.js';
import { ParticleSystem } from './particles.js';
import {
    SporeCloud,
    createChromaShiftRock,
    updateChromaRock,
    createFracturedGeode,
    updateGeode,
    createNebulaJellyMoss,
    updateNebulaJellyMoss
} from './geological.js';

// --- Configuration ---
const CONFIG = {
    // Visual style (dark, atmospheric like Inside/Little Nightmares)
    colors: {
        background: 0x1a1a2e,
        ground: 0x2d2d44,
        platform: 0x3d3d5c,
        player: 0xe94560,    // Dog - warm red/orange
        accent: 0x0f3460
    },
    // Camera
    cameraDistance: 15,
    cameraHeight: 3,
    // Player physics
    player: {
        speed: 8,
        runSpeed: 14,
        thrustForce: 25, // Upward force
        gravity: 8,      // Low gravity for space
        groundFriction: 0.85,
        airFriction: 0.98 // Less drag in space
    },
    // World
    groundLevel: -50 // effectively no ground collision near 0
};

// --- Scene Setup ---
const canvas = document.querySelector('#glCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.background);
scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 80);

// Check WebGPU
if (!WebGPU.isAvailable()) {
    const warning = WebGPU.getErrorMessage();
    document.body.appendChild(warning);
    throw new Error('WebGPU not supported');
}

// --- Camera (Side-view, follows player on X axis) ---
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
// Camera positioned to the side, looking at Z=0 plane
camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
camera.lookAt(0, CONFIG.cameraHeight, 0);

// --- Renderer ---
const renderer = new WebGPURenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- Lighting (Moody, atmospheric) ---
const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
scene.add(ambientLight);

// Main directional light (from the side for dramatic shadows)
const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
mainLight.position.set(-5, 10, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
mainLight.shadow.camera.left = -30;
mainLight.shadow.camera.right = 30;
mainLight.shadow.camera.top = 20;
mainLight.shadow.camera.bottom = -10;
scene.add(mainLight);

// Rim light from behind (cinematic depth)
const rimLight = new THREE.DirectionalLight(0x4488ff, 0.3);
rimLight.position.set(5, 5, -10);
scene.add(rimLight);

// --- Materials ---
const materials = {
    ground: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.ground,
        roughness: 0.9,
        metalness: 0.1
    }),
    platform: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.platform,
        roughness: 0.7,
        metalness: 0.2
    }),
    player: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.player,
        roughness: 0.4,
        metalness: 0.1,
        emissive: CONFIG.colors.player,
        emissiveIntensity: 0.1
    }),
    background: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.accent,
        roughness: 1.0,
        metalness: 0.0
    })
};

// --- WASM Setup ---
let wasmExports = null;
let wasmMemory = null;

async function loadWasm() {
    try {
        // Fetch the compiled WASM binary
        const response = await fetch('./build/optimized.wasm');
        const buffer = await response.arrayBuffer();
        const module = await WebAssembly.instantiate(buffer, {
            env: {
                abort: () => console.log('Abort called from WASM')
            }
        });
        
        wasmExports = module.instance.exports;
        wasmMemory = new Float32Array(wasmExports.memory.buffer);
        console.log("✅ WASM Module Loaded");
    } catch (err) {
        console.error("❌ Failed to load WASM:", err);
    }
}

// Start loading immediately
loadWasm();

// =============================================================================
// PLAYER (Dog Character)
// =============================================================================
// =============================================================================
// PLAYER (Rocket Character)
// =============================================================================
function createRocket() {
    const group = new THREE.Group();

    // Materials
    const rocketMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee, // White/Silver body
        roughness: 0.3,
        metalness: 0.6
    });

    const highlightMat = new THREE.MeshStandardMaterial({
        color: 0xe94560, // Red accents
        roughness: 0.4,
        metalness: 0.2
    });

    // UPDATED: Glass is now transparent
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x88ffff, // Light Blue
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    const glowMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00, // Thruster glow
        emissive: 0xff4400,
        emissiveIntensity: 1.0
    });

    const dogMat = new THREE.MeshStandardMaterial({
        color: 0xd2b48c, // Tan/Brown doggy color
        roughness: 0.8
    });
    
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    // 1. Fuselage
    const fuselageGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.4, 16);
    const fuselage = new THREE.Mesh(fuselageGeo, rocketMat);
    fuselage.position.y = 0.7;
    fuselage.castShadow = true;
    group.add(fuselage);

    // 2. Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.35, 0.6, 16);
    const nose = new THREE.Mesh(noseGeo, highlightMat);
    nose.position.y = 1.7;
    nose.castShadow = true;
    group.add(nose);

    // 3. Fins
    const finGeo = new THREE.BoxGeometry(0.1, 0.6, 0.6);
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const finGroup = new THREE.Group();
        const fin = new THREE.Mesh(finGeo, highlightMat);
        fin.position.set(0.4, 0.3, 0);
        fin.castShadow = true;
        finGroup.rotation.y = angle;
        finGroup.add(fin);
        group.add(finGroup);
    }

    // --- NEW: THE DOG PILOT ---
    const pilotGroup = new THREE.Group();
    pilotGroup.name = 'pilotGroup';
    pilotGroup.position.set(0, 1.0, 0.15); // Centered in window, slightly back

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), dogMat);
    head.name = 'pilotHead';
    pilotGroup.add(head);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.04, 0.1, 8);
    const leftEar = new THREE.Mesh(earGeo, dogMat);
    leftEar.name = 'leftEar';
    leftEar.position.set(-0.08, 0.08, 0);
    leftEar.rotation.z = 0.5;
    leftEar.rotation.x = -0.2;
    pilotGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, dogMat);
    rightEar.name = 'rightEar';
    rightEar.position.set(0.08, 0.08, 0);
    rightEar.rotation.z = -0.5;
    rightEar.rotation.x = -0.2;
    pilotGroup.add(rightEar);

    // Eyes (Black dots)
    const eyeGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, blackMat);
    leftEye.position.set(-0.04, 0.02, 0.1);
    pilotGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, blackMat);
    rightEye.position.set(0.04, 0.02, 0.1);
    pilotGroup.add(rightEye);

    // Snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    snout.name = 'pilotSnout';
    snout.position.set(0, -0.02, 0.11);
    pilotGroup.add(snout);

    // store base transform data for animation
    pilotGroup.userData.animationOffset = Math.random() * 10;
    pilotGroup.userData.baseY = pilotGroup.position.y;
    head.userData.baseRotationY = head.rotation.y;
    leftEar.userData.baseRotationZ = leftEar.rotation.z;
    rightEar.userData.baseRotationZ = rightEar.rotation.z;

    group.add(pilotGroup);
    // ---------------------------

    // 4. Window Frame & Glass
    const windowFrameGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
    const windowFrame = new THREE.Mesh(windowFrameGeo, rocketMat);
    windowFrame.position.set(0, 1.0, 0.35);
    group.add(windowFrame);

    const windowGlassGeo = new THREE.CircleGeometry(0.15, 16);
    const windowGlass = new THREE.Mesh(windowGlassGeo, windowMat);
    windowGlass.position.set(0, 1.0, 0.35);
    group.add(windowGlass);

    // 5. Thruster & Flame
    const nozzleGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.3, 16);
    const nozzle = new THREE.Mesh(nozzleGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    nozzle.position.y = -0.15;
    group.add(nozzle);

    const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
    const flame = new THREE.Mesh(flameGeo, glowMat);
    flame.position.y = -0.5;
    flame.rotation.x = Math.PI;
    group.add(flame);
    group.userData.flame = flame;

    // Final Transforms
    group.position.set(0, 0, 0);
    group.rotation.z = -Math.PI / 2; // Point right

    const tiltGroup = new THREE.Group();
    tiltGroup.add(group);
    tiltGroup.position.set(0, 5, 0);

    return tiltGroup;
}

const player = createRocket();
scene.add(player);

// Player state
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false,
    facingRight: true,
    isRunning: false,
    autoScrollSpeed: 6, // Constant forward movement
    health: 3, // Ship can survive 3 collisions
    maxHealth: 3,
    invincible: false, // Invincibility frames after hit
    distanceToMoon: 500, // Distance to reach the moon
    hasWon: false // Track if player has won
};

// =============================================================================
// OBSTACLE SYSTEM
// =============================================================================
const obstacles = [];
const OBSTACLE_SPAWN_INTERVAL = 1.5; // seconds
let lastObstacleSpawn = 0;

function createAsteroid(x, y) {
    const size = 0.5 + Math.random() * 1.5;
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.9,
        metalness: 0.1
    });
    const asteroid = new THREE.Mesh(geo, mat);
    asteroid.position.set(x, y, 0);
    asteroid.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    asteroid.castShadow = true;
    asteroid.userData = {
        rotationSpeed: (Math.random() - 0.5) * 2,
        radius: size
    };
    scene.add(asteroid);
    obstacles.push(asteroid);
    return asteroid;
}

function updateObstacles(delta) {
    const playerX = player.position.x;
    const playerY = player.position.y; // Capture Y for WASM

    // Spawn new obstacles ahead of player
    lastObstacleSpawn += delta;
    if (lastObstacleSpawn > OBSTACLE_SPAWN_INTERVAL) {
        lastObstacleSpawn = 0;
        const spawnX = playerX + 40 + Math.random() * 20;
        const spawnY = (Math.random() - 0.5) * 15;
        createAsteroid(spawnX, spawnY);
    }

    // 1. UPDATE LOOP: Rotate and cleanup obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        
        // Rotate asteroid
        obs.rotation.x += obs.userData.rotationSpeed * delta;
        obs.rotation.y += obs.userData.rotationSpeed * delta * 0.5;

        // Remove if behind player
        if (obs.position.x < playerX - 30) {
            scene.remove(obs);
            obstacles.splice(i, 1);
        }
    }

    // 2. WASM COLLISION CHECK
    // Only run if WASM is loaded and player is vulnerable
    if (wasmExports && wasmMemory && !playerState.invincible && obstacles.length > 0) {
        
        // A. Allocate Memory for Obstacles
        // We use the new allocAsteroids function to get a safe pointer
        const ptr = wasmExports.allocAsteroids(obstacles.length);

        // Calculate the offset in the Float32Array (pointer is in bytes, divide by 4)
        // Use unsigned right shift for integer division
        const floatOffset = ptr >>> 2;

        // B. Sync Data to WASM Memory
        // We write [x, y, radius] for every asteroid into the shared memory buffer
        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            const offset = floatOffset + (i * 3); // 3 floats per object
            
            // Check to ensure we don't overflow the memory (default is usually 1 page / 64KB)
            if (offset + 2 < wasmMemory.length) {
                wasmMemory[offset] = obs.position.x;
                wasmMemory[offset + 1] = obs.position.y;
                wasmMemory[offset + 2] = obs.userData.radius;
            }
        }

        // C. Call WASM function
        // checkCollision(playerX, playerY, playerRadius, count)
        const hitIndex = wasmExports.checkCollision(playerX, playerY, 0.5, obstacles.length);

        // D. Handle Hit
        if (hitIndex !== -1) {
            const obs = obstacles[hitIndex];
            if (obs) {
                // --- NEW: Emit Explosion Particles ---
                particleSystem.emit(obs.position.clone(), 0xff5555, 15, 10.0, 1.2, 1.0);
                particleSystem.emit(obs.position.clone(), 0xaaaaaa, 10, 8.0, 0.8, 1.0);
                 // Collision! Flash red and bounce
                 obs.material.emissive = new THREE.Color(0xff0000);
                 obs.material.emissiveIntensity = 1.0;
                 setTimeout(() => {
                     if (obs.material) {
                         obs.material.emissive = new THREE.Color(0x000000);
                         obs.material.emissiveIntensity = 0;
                     }
                 }, 200);
 
                 // Reduce health
                 playerState.health--;
                 playerState.invincible = true;
                 
                 // Flash the rocket
                 const rocket = player.children[0];
                 if (rocket) {
                     rocket.children.forEach(child => {
                         if (child.material) {
                             const originalColor = child.material.color.clone();
                             child.material.color.setHex(0xff0000);
                             setTimeout(() => {
                                 if (child.material) {
                                     child.material.color.copy(originalColor);
                                 }
                             }, 200);
                         }
                     });
                 }
                 
                 // Invincibility frames (2 seconds)
                 setTimeout(() => {
                     playerState.invincible = false;
                 }, 2000);
                 
                 updateHealthDisplay();
                 
                 if (playerState.health <= 0) {
                     gameOver();
                 }

                 // Bounce player away
                 const dy = obs.position.y - playerY;
                 playerState.velocity.y += (dy > 0 ? -5 : 5);
                 playerState.velocity.x -= 3;
            }
        }
    }
}

// =============================================================================
// LEVEL GEOMETRY
// =============================================================================

// Ground (extends infinitely in X, flat in Z)
// Ground removed for space theme
// const groundGeo = new THREE.BoxGeometry(200, 2, 20);
// const ground = new THREE.Mesh(groundGeo, materials.ground);
// ground.position.set(0, -1, 0);
// ground.receiveShadow = true;
// scene.add(ground);

// Platforms array for collision detection
const platforms = [];

function createPlatform(x, y, width, height = 0.4, depth = 4) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const platform = new THREE.Mesh(geo, materials.platform);
    platform.position.set(x, y, 0);
    platform.receiveShadow = true;
    platform.castShadow = true;
    scene.add(platform);

    // Store collision box
    platforms.push({
        mesh: platform,
        minX: x - width / 2,
        maxX: x + width / 2,
        minY: y - height / 2,
        maxY: y + height / 2
    });

    return platform;
}

// Create some test platforms
createPlatform(5, 1.5, 4);
createPlatform(10, 3, 3);
createPlatform(15, 2, 5);
createPlatform(-5, 2, 4);
createPlatform(-10, 3.5, 3);
createPlatform(-15, 1, 6);

// Background elements (parallax layers for depth)
function createBackgroundLayer(zOffset, color, count) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 1.0,
        metalness: 0
    });

    for (let i = 0; i < count; i++) {
        const width = 2 + Math.random() * 6;
        const height = 3 + Math.random() * 10;
        const geo = new THREE.BoxGeometry(width, height, 1);
        const box = new THREE.Mesh(geo, mat);
        box.position.set(
            (Math.random() - 0.5) * 100,
            height / 2,
            zOffset
        );
        group.add(box);
    }

    scene.add(group);
    return group;
}

// Create parallax background layers
const bgLayer1 = createBackgroundLayer(-8, 0x15152a, 20);  // Far
const bgLayer2 = createBackgroundLayer(-5, 0x1a1a35, 15);  // Mid
const bgLayer3 = createBackgroundLayer(-3, 0x202045, 10);  // Near

// =============================================================================
// SPACE ENVIRONMENT (Stars, Galaxies, Moon)
// =============================================================================

// Add stars to the scene
const stars = createStars(3000);
scene.add(stars);
uStarOpacity.value = 0.8; // Make stars visible

// Create distant galaxies/nebulae
function createGalaxy(x, y, z, color) {
    const group = new THREE.Group();
    
    // Main nebula cloud
    const cloudGeo = new THREE.SphereGeometry(15, 16, 16);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);
    
    // Inner glow
    const glowGeo = new THREE.SphereGeometry(8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);
    
    // Bright core
    const coreGeo = new THREE.SphereGeometry(3, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);
    
    group.position.set(x, y, z);
    group.userData.rotationSpeed = (Math.random() - 0.5) * 0.02;
    return group;
}

// Create a few distant galaxies
const galaxy1 = createGalaxy(200, 30, -100, 0x8844ff);
scene.add(galaxy1);

const galaxy2 = createGalaxy(-150, -20, -120, 0x4488ff);
scene.add(galaxy2);

const galaxy3 = createGalaxy(300, 10, -90, 0xff4488);
scene.add(galaxy3);

// PARTICLE SYSTEM (engine trails & explosions)
const particleSystem = new ParticleSystem(scene);

// =============================================================================
// GEOLOGICAL OBJECTS & ANOMALIES (from plan.md)
// =============================================================================

// Spore Clouds - floating clouds of glowing spores
const sporeClouds = [];

function createSporeCloudAtPosition(x, y, z) {
    const cloud = new SporeCloud(scene, new THREE.Vector3(x, y, z), 500 + Math.floor(Math.random() * 500));
    sporeClouds.push(cloud);
    return cloud;
}

// Add some spore clouds along the path
createSporeCloudAtPosition(100, 10, -20);
createSporeCloudAtPosition(200, -5, 15);
createSporeCloudAtPosition(350, 8, -10);

// Chroma-Shift Rocks - color-shifting crystalline rocks
const chromaRocks = [];

function createChromaRockAtPosition(x, y, z) {
    const rock = createChromaShiftRock({ size: 2 + Math.random() * 2 });
    rock.position.set(x, y, z);
    scene.add(rock);
    chromaRocks.push(rock);
    return rock;
}

// Scatter some chroma rocks
for (let i = 0; i < 8; i++) {
    const x = 50 + i * 60;
    const y = (Math.random() - 0.5) * 20;
    const z = (Math.random() - 0.5) * 30;
    createChromaRockAtPosition(x, y, z);
}

// Fractured Geodes - safe harbors with EM fields
const geodes = [];

function createGeodeAtPosition(x, y, z) {
    const geode = createFracturedGeode({ size: 3 + Math.random() * 2 });
    geode.position.set(x, y, z);
    scene.add(geode);
    geodes.push(geode);
    return geode;
}

// Add geodes at strategic points
createGeodeAtPosition(150, 5, -25);
createGeodeAtPosition(300, -8, 20);
createGeodeAtPosition(450, 12, -15);

// Nebula Jelly-Moss - floating gelatinous organisms with fractal moss
const jellyMosses = [];

function createJellyMossAtPosition(x, y, z, size) {
    const jellyMoss = createNebulaJellyMoss({ size: size || 2 + Math.random() * 8 });
    jellyMoss.position.set(x, y, z);
    scene.add(jellyMoss);
    jellyMosses.push(jellyMoss);
    return jellyMoss;
}

// Add some nebula jelly-moss specimens
createJellyMossAtPosition(80, 12, -18, 4);  // Small specimen
createJellyMossAtPosition(180, -8, 22, 8);  // Medium
createJellyMossAtPosition(280, 15, -12, 15); // Large specimen
createJellyMossAtPosition(400, 5, 25, 6);   // Medium

// Store plants that live on the moon to animate them later
const moonPlants = [];

// Create the distant moon (goal)
function createMoon() {
    const group = new THREE.Group();
    
    // 1. Moon Surface (alien palette)
    const moonGeo = new THREE.SphereGeometry(8, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
        color: 0x222244, // Darker, alien purple-grey
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x111122,
        emissiveIntensity: 0.2
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.castShadow = true;
    group.add(moon);
    
    // Add some craters
    for (let i = 0; i < 8; i++) {
        const craterGeo = new THREE.SphereGeometry(0.5 + Math.random() * 1.5, 8, 8);
        const craterMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.95
        });
        const crater = new THREE.Mesh(craterGeo, craterMat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        crater.position.set(
            Math.sin(phi) * Math.cos(theta) * 7,
            Math.sin(phi) * Math.sin(theta) * 7,
            Math.cos(phi) * 7
        );
        group.add(crater);
    }
    
    // Moon glow/atmosphere
    // 2. Atmosphere
    const atmosphereGeo = new THREE.SphereGeometry(9.5, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
        color: 0x8844ff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    group.add(atmosphere);
    
    group.userData.atmosphere = atmosphere;

    // 3. Populate with Alien Plants
    const plantCount = 15;
    for (let i = 0; i < plantCount; i++) {
        let plant;
        const type = Math.random();
        if (type < 0.3) {
            plant = createSubwooferLotus({ color: 0x00ff88 });
        } else if (type < 0.6) {
            plant = createFiberOpticWillow({ color: 0xff00ff });
        } else {
            plant = createGlowingFlower({ color: 0x00ffff, intensity: 2.0 });
        }

        // Random position on the top hemisphere so plants are visible
        const phi = Math.random() * Math.PI * 0.4; // 0..PI/2 mostly
        const theta = Math.random() * Math.PI * 2;
        const r = 7.8; // Slightly embedded in surface
        plant.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
        plant.lookAt(0, 0, 0);
        plant.rotateX(-Math.PI / 2);
        group.add(plant);
        moonPlants.push(plant);
    }
    return group;
}

const moon = createMoon();
moon.position.set(500, 5, -50); // Position far ahead
scene.add(moon);

// =============================================================================
// INPUT HANDLING
// =============================================================================

// UI Elements for health and distance
function createUI() {
    // Health display
    const healthDiv = document.createElement('div');
    healthDiv.id = 'health-display';
    healthDiv.style.position = 'absolute';
    healthDiv.style.top = '20px';
    healthDiv.style.left = '20px';
    healthDiv.style.color = '#e94560';
    healthDiv.style.fontSize = '24px';
    healthDiv.style.fontWeight = 'bold';
    healthDiv.style.textShadow = '0 0 10px rgba(233, 69, 96, 0.5)';
    healthDiv.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    healthDiv.style.zIndex = '100';
    document.body.appendChild(healthDiv);
    
    // Distance display
    const distanceDiv = document.createElement('div');
    distanceDiv.id = 'distance-display';
    distanceDiv.style.position = 'absolute';
    distanceDiv.style.top = '60px';
    distanceDiv.style.left = '20px';
    distanceDiv.style.color = '#4488ff';
    distanceDiv.style.fontSize = '18px';
    distanceDiv.style.fontWeight = 'bold';
    distanceDiv.style.textShadow = '0 0 10px rgba(68, 136, 255, 0.5)';
    distanceDiv.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    distanceDiv.style.zIndex = '100';
    document.body.appendChild(distanceDiv);
    
    updateHealthDisplay();
    updateDistanceDisplay();
}

function updateHealthDisplay() {
    const healthDiv = document.getElementById('health-display');
    if (healthDiv) {
        const hearts = '❤️'.repeat(playerState.health) + '🖤'.repeat(playerState.maxHealth - playerState.health);
        healthDiv.innerHTML = `Health: ${hearts}`;
        
        // Flash red if damaged
        if (playerState.health < playerState.maxHealth) {
            healthDiv.style.animation = 'none';
            setTimeout(() => {
                healthDiv.style.animation = 'pulse 2s ease-in-out';
            }, 10);
        }
    }
}

function updateDistanceDisplay() {
    const distanceDiv = document.getElementById('distance-display');
    if (distanceDiv) {
        const distance = Math.max(0, Math.floor(playerState.distanceToMoon - player.position.x));
        distanceDiv.innerHTML = `Distance to Moon: ${distance}m`;
    }
}

function gameOver() {
    // Create game over overlay
    const gameOverDiv = document.createElement('div');
    gameOverDiv.style.position = 'absolute';
    gameOverDiv.style.top = '0';
    gameOverDiv.style.left = '0';
    gameOverDiv.style.width = '100%';
    gameOverDiv.style.height = '100%';
    gameOverDiv.style.display = 'flex';
    gameOverDiv.style.flexDirection = 'column';
    gameOverDiv.style.justifyContent = 'center';
    gameOverDiv.style.alignItems = 'center';
    gameOverDiv.style.background = 'rgba(26, 26, 46, 0.95)';
    gameOverDiv.style.zIndex = '200';
    gameOverDiv.innerHTML = `
        <h1 style="color: #e94560; font-size: 4em; margin: 0; text-shadow: 0 0 30px rgba(233, 69, 96, 0.5); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">GAME OVER</h1>
        <p style="color: #888; font-size: 1.5em; margin-top: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Your ship was destroyed!</p>
        <button onclick="location.reload()" style="margin-top: 30px; padding: 15px 40px; font-size: 1.2em; background: #e94560; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 0 4px 0 #b83650;">Retry</button>
    `;
    document.body.appendChild(gameOverDiv);
}

function gameWin() {
    // Create win overlay
    const winDiv = document.createElement('div');
    winDiv.style.position = 'absolute';
    winDiv.style.top = '0';
    winDiv.style.left = '0';
    winDiv.style.width = '100%';
    winDiv.style.height = '100%';
    winDiv.style.display = 'flex';
    winDiv.style.flexDirection = 'column';
    winDiv.style.justifyContent = 'center';
    winDiv.style.alignItems = 'center';
    winDiv.style.background = 'rgba(26, 26, 46, 0.95)';
    winDiv.style.zIndex = '200';
    winDiv.innerHTML = `
        <h1 style="color: #4488ff; font-size: 4em; margin: 0; text-shadow: 0 0 30px rgba(68, 136, 255, 0.8); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">MISSION SUCCESS!</h1>
        <p style="color: #888; font-size: 1.5em; margin-top: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">You reached the moon!</p>
        <button onclick="location.reload()" style="margin-top: 30px; padding: 15px 40px; font-size: 1.2em; background: #4488ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 0 4px 0 #3366cc;">Play Again</button>
    `;
    document.body.appendChild(winDiv);
}

const keys = {
    left: false,
    right: false,
    jump: false,
    run: false
};

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = true;
            break;
        case 'KeyW':
        case 'ArrowUp':
        case 'Space':
            keys.jump = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.run = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = false;
            break;
        case 'KeyW':
        case 'ArrowUp':
        case 'Space':
            keys.jump = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.run = false;
            break;
    }
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Click to start (hide instructions)
const instructions = document.getElementById('instructions');
instructions.addEventListener('click', () => {
    instructions.style.display = 'none';
    createUI(); // Create UI when game starts
});

// =============================================================================
// INTERACTION SYSTEM - Click to trigger spore cloud chain reactions
// =============================================================================
let gameStarted = false;

canvas.addEventListener('click', (event) => {
    if (!gameStarted) return;

    // Get mouse position in normalized device coordinates
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check intersection with spore clouds
    sporeClouds.forEach(cloud => {
        if (!cloud.active) return;

        // Check each spore in the cloud
        const intersects = raycaster.intersectObjects(cloud.spores, false);
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point;
            const triggered = cloud.triggerChainReaction(hitPoint);

            if (triggered > 0) {
                // Add explosion particles at hit point
                particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                console.log(`Chain reaction triggered! ${triggered} spores affected`);
            }
        }
    });
});

// Track when game starts
instructions.addEventListener('click', () => {
    gameStarted = true;
}, { once: true });


// =============================================================================
// PHYSICS & COLLISION
// =============================================================================
function checkPlatformCollision(x, y, radius = 0.3) {
    // Check ground
    if (y - radius <= CONFIG.groundLevel) {
        return { collided: true, groundY: CONFIG.groundLevel };
    }

    // Check platforms
    for (const platform of platforms) {
        // Simple AABB collision for standing on platforms
        if (x >= platform.minX && x <= platform.maxX) {
            // Check if player is falling onto platform
            if (y - radius <= platform.maxY && y - radius >= platform.maxY - 0.5) {
                if (playerState.velocity.y <= 0) {
                    return { collided: true, groundY: platform.maxY };
                }
            }
        }
    }

    return { collided: false, groundY: null };
}

function updatePlayer(delta) {
    // Auto-scroll (constant forward movement)
    player.position.x += playerState.autoScrollSpeed * delta;

    // Vertical movement (thrust)
    if (keys.jump) {
        playerState.velocity.y += CONFIG.player.thrustForce * delta;

        // Boost flame when thrusting
        const rocket = player.children[0];
        if (rocket && rocket.userData.flame) {
            rocket.userData.flame.scale.set(1.5, 3.0, 1.5);
        }
    }

    // Optional: Down thrust
    if (keys.left) {
        playerState.velocity.y -= CONFIG.player.thrustForce * 0.5 * delta;
    }

    // Gravity (light)
    playerState.velocity.y -= CONFIG.player.gravity * delta;

    // Cap vertical speed
    playerState.velocity.y = Math.max(Math.min(playerState.velocity.y, 12), -12);

    // Apply velocity
    player.position.y += playerState.velocity.y * delta;

    // Air friction
    playerState.velocity.y *= CONFIG.player.airFriction;

    // Thrust (Flight)
    if (keys.jump) {
        playerState.velocity.y += CONFIG.player.thrustForce * delta;
        playerState.isGrounded = false;

        // Boost flame when thrusting
        const rocket = player.children[0];
        if (rocket && rocket.userData.flame) {
            rocket.userData.flame.scale.set(1.5, 3.0, 1.5); // Big flame
        }

        // --- NEW: Emit Engine Trail ---
        const exhaustPos = player.position.clone();
        exhaustPos.x -= 0.5; // slightly behind the rocket
        exhaustPos.y -= 0.5; // at the nozzle
        particleSystem.emit(exhaustPos, 0xffaa00, 2, 5.0, 0.8, 0.2);
    }

    // Gravity
    playerState.velocity.y -= CONFIG.player.gravity * delta;

    // Apply velocity
    player.position.x += playerState.velocity.x * delta;
    player.position.y += playerState.velocity.y * delta;

    // Cap vertical speed (terminal velocity)
    playerState.velocity.y = Math.max(Math.min(playerState.velocity.y, 10), -15);

    // Collision detection
    const collision = checkPlatformCollision(player.position.x, player.position.y);
    if (collision.collided) {
        player.position.y = collision.groundY + 0.5; // Player height offset
        playerState.velocity.y = 0;
        playerState.isGrounded = true;
    } else {
        playerState.isGrounded = false;
    }

    // Animation: Pitch based on vertical velocity
    const rocket = player.children[0];
    if (rocket) {
        // Pitch up/down based on Y velocity
        const targetPitch = playerState.velocity.y * 0.03;
        player.rotation.z += (targetPitch - player.rotation.z) * 0.1;

        // Bobbing
        const hoverY = Math.sin(Date.now() * 0.003) * 0.05;
        rocket.position.y = hoverY;

        // Flame Flicker
        if (rocket.userData.flame && !keys.jump) {
            const flicker = 0.6 + Math.random() * 0.3;
            rocket.userData.flame.scale.set(flicker, flicker * 1.5, flicker);
        }
    }
}

// =============================================================================
// CAMERA FOLLOW
// =============================================================================
function updateCamera() {
    // Smooth follow player on X axis
    const targetX = player.position.x;
    const targetY = Math.max(player.position.y + 1, CONFIG.cameraHeight);

    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.05;

    // Look slightly ahead of player
    const lookAhead = playerState.facingRight ? 2 : -2;
    camera.lookAt(
        camera.position.x + lookAhead,
        camera.position.y - 1,
        0
    );

    // Update main light to follow
    mainLight.position.x = camera.position.x - 5;
    mainLight.target.position.x = camera.position.x;
}

// =============================================================================
// ANIMATION LOOP
// =============================================================================
const clock = new THREE.Clock();

function animate() {
    const delta = Math.min(clock.getDelta(), 0.1); // Cap delta
    const time = clock.getElapsedTime(); // For foliage animation and time-based motion

    updatePlayer(delta);
    updateObstacles(delta);

    // --- NEW: Update Particles (engine trails & explosions)
    particleSystem.update(delta);
    updateCamera();
    
    // --- NEW: Update Geological Objects ---
    // Update spore clouds (brownian motion)
    sporeClouds.forEach(cloud => cloud.update(delta));

    // Update chroma-shift rocks (color animation)
    chromaRocks.forEach(rock => updateChromaRock(rock, camera.position, delta, time));

    // Update geodes (EM field pulse)
    geodes.forEach(geode => updateGeode(geode, delta, time));

    // Update nebula jelly-moss (pulsing and drifting)
    jellyMosses.forEach(jellyMoss => updateNebulaJellyMoss(jellyMoss, delta, time));

    // Rotate galaxies slowly
    if (galaxy1) galaxy1.rotation.z += galaxy1.userData.rotationSpeed;
    if (galaxy2) galaxy2.rotation.z += galaxy2.userData.rotationSpeed;
    if (galaxy3) galaxy3.rotation.z += galaxy3.userData.rotationSpeed;
    
    // Rotate and pulse moon atmosphere
    if (moon && moon.userData.atmosphere) {
        moon.rotation.y += 0.002;
        const pulse = Math.sin(Date.now() * 0.001) * 0.5 + 0.5;
        moon.userData.atmosphere.material.opacity = 0.1 + pulse * 0.1;
    }

    // --- NEW: Animate Alien Moon Plants ---
    // We pass 'false' for isDay because it's space (always night!) and null for audio
    moonPlants.forEach(plant => {
        animateFoliage(plant, time, null, false);
    });

    // --- NEW: Pilot/Player Animations ---
    try {
        const rocketRoot = player.children[0];
        if (rocketRoot) {
            // Tilt rocket slightly based on vertical velocity
            const targetTilt = THREE.MathUtils.clamp(-playerState.velocity.y * 0.025, -0.35, 0.35);
            rocketRoot.rotation.x += (targetTilt - rocketRoot.rotation.x) * 0.06;

            // Animate pilot bob and ears
            const pilot = rocketRoot.getObjectByName('pilotGroup');
            if (pilot) {
                const offset = pilot.userData.animationOffset || 0;
                const baseY = pilot.userData.baseY ?? pilot.position.y;
                const bobAmp = keys.jump ? 0.05 : 0.02;
                const bob = Math.sin(time * 2 + offset) * bobAmp;
                pilot.position.y = baseY + bob;

                const head = pilot.getObjectByName('pilotHead');
                const leftEar = pilot.getObjectByName('leftEar');
                const rightEar = pilot.getObjectByName('rightEar');
                if (head) {
                    head.rotation.y = head.userData.baseRotationY + Math.sin(time * 1.5 + offset) * 0.08;
                }
                if (leftEar && rightEar) {
                    leftEar.rotation.z = leftEar.userData.baseRotationZ + Math.sin(time * 6 + offset) * 0.3 * (keys.jump ? 1.5 : 1.0);
                    rightEar.rotation.z = rightEar.userData.baseRotationZ + Math.sin(time * 6 + offset + Math.PI) * 0.3 * (keys.jump ? 1.5 : 1.0);
                }
            }
        }
    } catch (e) { /* swallow animation errors gracefully */ }
    
    // Update distance display
    updateDistanceDisplay();
    
    // Check if player reached the moon
    if (player.position.x >= playerState.distanceToMoon - 10 && !playerState.hasWon) {
        playerState.hasWon = true;
        gameWin();
    }

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// =============================================================================
// RESIZE HANDLER
// =============================================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('🚀 Space Dash - Journey to the Moon!');
console.log('Controls: SPACE to thrust up, A to dive down');
console.log('Objective: Reach the moon while surviving asteroid impacts (3 lives)');
