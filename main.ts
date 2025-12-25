import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createStars, uStarOpacity } from './stars';
import { 
    createSubwooferLotus, 
    createFiberOpticWillow, 
    createGlowingFlower, 
    createStarDustFern,
    createNebulaRose,
    createFloweringTree,
    createShrub,
    createFloatingOrb,
    createVine,
    animateFoliage,
    createSolarSail,
    updateSolarSail
} from './foliage';
import { ParticleSystem } from './particles';
import {
    SporeCloud,
    createChromaShiftRock,
    updateChromaRock,
    createFracturedGeode,
    updateGeode,
    createNebulaJellyMoss,
    updateNebulaJellyMoss,
    createVoidRootBall,
    updateVoidRootBall,
    createVacuumKelp,
    updateVacuumKelp,
    createIceNeedleCluster,
    updateIceNeedleCluster,
    createLiquidMetalBlob,
    updateLiquidMetalBlob,
    createMagmaHeart,
    updateMagmaHeart
} from './geological';

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
const canvas = document.querySelector('#glCanvas') as HTMLCanvasElement;
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
let wasmExports: any = null;
let wasmMemory: Float32Array | null = null;

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
        wasmMemory = new Float32Array((wasmExports.memory as WebAssembly.Memory).buffer);
        console.log("✅ WASM Module Loaded");
    } catch (err) {
        console.error("❌ Failed to load WASM:", err);
    }
}

// Start loading immediately
loadWasm();

// =============================================================================
// PLAYER (Rocket Character) - GLB Model Integration
// =============================================================================
let player = null;
const gltfLoader = new GLTFLoader();
// Load the rocket GLB model
gltfLoader.load(
    'rocket.glb',
    (gltf) => {
        const rocketModel = gltf.scene;
        
        // Enable shadows for all meshes in the model
        rocketModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                // Don't set receiveShadow to avoid self-shadowing artifacts
            }
        });
        
        // Create a container group for the model
        const group = new THREE.Group();
        group.add(rocketModel);
        
        // Scale the model to match the previous rocket size (~2 units tall)
        const box = new THREE.Box3().setFromObject(rocketModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        const targetSize = 2.0;
        const scale = targetSize / maxDimension;
        rocketModel.scale.setScalar(scale);
        
        // Center the model
        box.setFromObject(rocketModel);
        const center = box.getCenter(new THREE.Vector3());
        rocketModel.position.sub(center);
        
        // ROTATE HORIZONTAL: Nose points RIGHT (+X direction)
        group.rotation.z = -Math.PI / 2;
        
        // Add a flame effect to the thruster (procedural, like before)
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff4400,
            emissiveIntensity: 1.0
        });
        const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
        const flame = new THREE.Mesh(flameGeo, glowMat);
        flame.position.y = -0.5;
        flame.rotation.x = Math.PI;
        group.add(flame);
        group.userData.flame = flame;
        
        // Container for pitch animation
        const tiltGroup = new THREE.Group();
        tiltGroup.add(group);
        tiltGroup.position.set(0, 5, 0); // Start higher in space
        
        // Set as the player
        player = tiltGroup;
        scene.add(player);
        
        console.log('🚀 Rocket GLB model loaded successfully!');
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('Error loading rocket GLB model:', error);
        // Fallback: create a simple placeholder if model fails to load
        const group = new THREE.Group();
        
        const geometry = new THREE.ConeGeometry(0.5, 2, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xe94560 });
        const placeholder = new THREE.Mesh(geometry, material);
        placeholder.rotation.x = Math.PI;
        placeholder.castShadow = true;
        group.add(placeholder);
        
        // Add flame effect (same as GLB version)
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff4400,
            emissiveIntensity: 1.0
        });
        const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
        const flame = new THREE.Mesh(flameGeo, glowMat);
        flame.position.y = -0.5;
        flame.rotation.x = Math.PI;
        group.add(flame);
        group.userData.flame = flame;
        
        const tiltGroup = new THREE.Group();
        tiltGroup.add(group);
        tiltGroup.position.set(0, 5, 0);
        
        player = tiltGroup;
        scene.add(player);
        
        console.warn('Using placeholder rocket due to loading error');
    }
);

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
    hasWon: false, // Track if player has won
    level: 1 // Current level
};

// =============================================================================
// LEVEL MANAGER
// =============================================================================
type LevelConfig = {
    name: string;
    distance: number;
    asteroidRate: number;
    foliageDensity: {
        fern?: number;
        rose?: number;
        lotus?: number;
        glowingFlower?: number;
        tree?: number;
        floweringTree?: number;
        shrub?: number;
        vine?: number;
        orb?: number;
        mushroom?: number;
        cloud?: number;
        // Geological objects from plan.md
        voidRootBall?: number;
        vacuumKelp?: number;
        iceNeedle?: number;
        liquidMetal?: number;
        magmaHeart?: number;
    };
    speed: number;
    bgColor: number;
    // New tunnel-related properties
    levelType?: 'open' | 'tunnel' | 'organic_tunnel';
    tunnelHeight?: number;
    obstacleInterval?: number;
    fogDensity?: number;
};

// =============================================================================
// INDUSTRIAL TUNNEL GEOMETRY (Level 4: The Rusty Gauntlet)
// =============================================================================

// Obstacle spawn probability constants
const PISTON_SPAWN_CHANCE = 0.4;
const BLAST_DOOR_SPAWN_CHANCE = 0.6;

// Fog configuration defaults
const DEFAULT_FOG_FAR = 80;
const DEFAULT_FOG_NEAR = 20;
const FOG_FAR_DENSITY_FACTOR = 5;
const FOG_NEAR_DENSITY_FACTOR = 3;

// Track industrial sections and pistons for updates
const industrialSections: THREE.Group[] = [];
const pistons: THREE.Group[] = [];
const blastDoors: THREE.Group[] = [];
const whaleRibSections: THREE.Group[] = [];
const barnacles: THREE.Mesh[] = [];

/**
 * Creates an industrial tunnel section with floor/ceiling plates
 * Based on plan.md Section V: Industrial Megastructures
 */
function createIndustrialSection(xPos: number): THREE.Group {
    const group = new THREE.Group();
    const sectionLength = 20; // 20m sections
    const tunnelHeight = 15; // Vertical clearance

    // Rusted metal material (as per plan.md: roughness 0.9, metallic 0.8)
    const rustedMetalMat = new THREE.MeshStandardMaterial({
        color: 0x664422,
        roughness: 0.9,
        metalness: 0.8
    });

    // Glowing orange seams material (emission 3.0)
    const seamMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 3.0
    });

    // Floor plate
    const floorGeo = new THREE.BoxGeometry(sectionLength, 0.5, 10);
    const floor = new THREE.Mesh(floorGeo, rustedMetalMat);
    floor.position.set(0, -tunnelHeight / 2, 0);
    floor.receiveShadow = true;
    group.add(floor);

    // Ceiling plate
    const ceiling = new THREE.Mesh(floorGeo, rustedMetalMat);
    ceiling.position.set(0, tunnelHeight / 2, 0);
    ceiling.receiveShadow = true;
    group.add(ceiling);

    // Add glowing seams along floor edges
    const seamGeo = new THREE.BoxGeometry(sectionLength, 0.1, 0.1);
    for (let z of [-4.5, 4.5]) {
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.position.set(0, -tunnelHeight / 2 + 0.3, z);
        group.add(seam);
    }

    // Randomly spawn obstacles: Piston or Blast Door
    const obstacleChance = Math.random();
    if (obstacleChance < PISTON_SPAWN_CHANCE) {
        // Spawn a Piston
        const piston = createPiston(0, tunnelHeight);
        group.add(piston);
        pistons.push(piston);
    } else if (obstacleChance < BLAST_DOOR_SPAWN_CHANCE) {
        // Spawn a Blast Door
        const door = createBlastDoor(sectionLength / 2, tunnelHeight);
        group.add(door);
        blastDoors.push(door);
    }

    // Add some wall details
    const wallPanelGeo = new THREE.BoxGeometry(0.2, tunnelHeight * 0.8, 8);
    for (let i = 0; i < 3; i++) {
        const panel = new THREE.Mesh(wallPanelGeo, rustedMetalMat);
        panel.position.set(-sectionLength / 2 + i * sectionLength / 3, 0, -5);
        group.add(panel);
    }

    group.position.x = xPos;
    group.userData = {
        type: 'industrialSection',
        sectionLength: sectionLength
    };

    scene.add(group);
    industrialSections.push(group);
    return group;
}

/**
 * Creates a Piston obstacle - animated vertical crusher
 * Simple: 2m diameter, 3m stroke, 2s cycle
 */
function createPiston(xOffset: number, tunnelHeight: number): THREE.Group {
    const group = new THREE.Group();

    // Piston base (ceiling mount)
    const baseGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16);
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.7,
        metalness: 0.9
    });
    const base = new THREE.Mesh(baseGeo, metalMat);
    base.position.y = tunnelHeight / 2 - 0.25;
    group.add(base);

    // Piston shaft
    const shaftGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 12);
    const shaft = new THREE.Mesh(shaftGeo, metalMat);
    shaft.position.y = tunnelHeight / 2 - 2.5;
    group.add(shaft);

    // Piston head (crusher plate)
    const headGeo = new THREE.CylinderGeometry(1, 1, 0.8, 16);
    const headMat = new THREE.MeshStandardMaterial({
        color: 0xcc4400,
        roughness: 0.6,
        metalness: 0.8,
        emissive: 0x331100,
        emissiveIntensity: 0.3
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = tunnelHeight / 2 - 5;
    group.add(head);

    group.position.x = xOffset;
    group.userData = {
        type: 'piston',
        baseY: tunnelHeight / 2 - 5,
        stroke: 3, // 3m stroke
        cycleSpeed: Math.PI, // 2s cycle (2*PI / cycleSpeed = 2)
        phase: Math.random() * Math.PI * 2,
        head: head,
        shaft: shaft
    };

    return group;
}

/**
 * Creates a Blast Door - requires shooting to open (simplified version)
 */
function createBlastDoor(xOffset: number, tunnelHeight: number): THREE.Group {
    const group = new THREE.Group();

    // Door frame
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.8,
        metalness: 0.7
    });

    // Top frame
    const topFrameGeo = new THREE.BoxGeometry(1, 1, 8);
    const topFrame = new THREE.Mesh(topFrameGeo, frameMat);
    topFrame.position.set(0, tunnelHeight / 2 - 0.5, 0);
    group.add(topFrame);

    // Door panels (close from top and bottom)
    const doorMat = new THREE.MeshStandardMaterial({
        color: 0x663333,
        roughness: 0.9,
        metalness: 0.6,
        emissive: 0x220000,
        emissiveIntensity: 0.2
    });

    const doorGeo = new THREE.BoxGeometry(0.5, tunnelHeight / 2 - 1, 6);
    const topDoor = new THREE.Mesh(doorGeo, doorMat);
    topDoor.position.set(0, tunnelHeight / 4, 0);
    group.add(topDoor);

    const bottomDoor = new THREE.Mesh(doorGeo, doorMat);
    bottomDoor.position.set(0, -tunnelHeight / 4, 0);
    group.add(bottomDoor);

    // Warning light
    const lightGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2.0
    });
    const warningLight = new THREE.Mesh(lightGeo, lightMat);
    warningLight.position.set(0, tunnelHeight / 2 - 1.5, 4);
    group.add(warningLight);

    group.position.x = xOffset;
    group.userData = {
        type: 'blastDoor',
        isOpen: false,
        openProgress: 0,
        topDoor: topDoor,
        bottomDoor: bottomDoor,
        warningLight: warningLight,
        tunnelHeight: tunnelHeight
    };

    return group;
}

// =============================================================================
// SPACE WHALE GEOMETRY (Level 5: The Astral Leviathan)
// =============================================================================

/**
 * Creates a Whale Rib Section - large curved rib bones forming an organic tunnel
 * Based on plan.md Section III: Fossilized Space Whales
 */
function createWhaleRibSection(xPos: number): THREE.Group {
    const group = new THREE.Group();
    const sectionLength = 25;
    const ribHeight = 20; // 40m clearance total, but ribs arch upward

    // Bone material - aged, fossilized
    const boneMat = new THREE.MeshStandardMaterial({
        color: 0xddc8a8,
        roughness: 0.85,
        metalness: 0.05,
        emissive: 0x221100,
        emissiveIntensity: 0.1
    });

    // Create curved rib bones on both sides
    const ribCount = 3; // 3 ribs per section
    for (let i = 0; i < ribCount; i++) {
        const ribOffset = (i - 1) * (sectionLength / 3);

        // Left rib
        const leftRib = createRibBone(ribHeight, true);
        leftRib.position.set(ribOffset, 0, -8);
        leftRib.rotation.y = Math.PI / 2;
        group.add(leftRib);

        // Right rib
        const rightRib = createRibBone(ribHeight, false);
        rightRib.position.set(ribOffset, 0, 8);
        rightRib.rotation.y = -Math.PI / 2;
        group.add(rightRib);
    }

    // Add barnacles to surfaces
    const barnacleCount = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < barnacleCount; i++) {
        const barnacle = createBarnacle();
        barnacle.position.set(
            (Math.random() - 0.5) * sectionLength,
            (Math.random() - 0.5) * ribHeight * 0.8,
            (Math.random() > 0.5 ? -7 : 7) + (Math.random() - 0.5) * 2
        );
        group.add(barnacle);
        barnacles.push(barnacle);
    }

    // Spine/vertebrae along the bottom
    const spineGeo = new THREE.CylinderGeometry(1.5, 1.5, sectionLength, 12);
    const spine = new THREE.Mesh(spineGeo, boneMat);
    spine.rotation.z = Math.PI / 2;
    spine.position.y = -ribHeight / 2;
    group.add(spine);

    group.position.x = xPos;
    group.userData = {
        type: 'whaleRibSection',
        sectionLength: sectionLength
    };

    scene.add(group);
    whaleRibSections.push(group);
    return group;
}

/**
 * Creates a single curved rib bone
 */
function createRibBone(height: number, isLeft: boolean): THREE.Group {
    const group = new THREE.Group();

    const boneMat = new THREE.MeshStandardMaterial({
        color: 0xddc8a8,
        roughness: 0.85,
        metalness: 0.05
    });

    // Create curved rib using tube geometry
    const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, -height / 2, 0),
        new THREE.Vector3(isLeft ? 3 : -3, 0, 0),
        new THREE.Vector3(0, height / 2, 0)
    );

    const ribGeo = new THREE.TubeGeometry(curve, 20, 0.8, 8, false);
    const rib = new THREE.Mesh(ribGeo, boneMat);
    rib.castShadow = true;
    group.add(rib);

    // Add some bony protrusions
    const protrusionCount = 3;
    for (let i = 0; i < protrusionCount; i++) {
        const t = (i + 1) / (protrusionCount + 1);
        const point = curve.getPoint(t);
        
        const protrusionGeo = new THREE.ConeGeometry(0.3, 1.5, 6);
        const protrusion = new THREE.Mesh(protrusionGeo, boneMat);
        protrusion.position.copy(point);
        protrusion.position.z += (isLeft ? -0.5 : 0.5);
        protrusion.rotation.x = isLeft ? -Math.PI / 4 : Math.PI / 4;
        group.add(protrusion);
    }

    return group;
}

/**
 * Creates a Barnacle - harvestable object containing Memory Fragments
 */
function createBarnacle(): THREE.Mesh {
    const size = 0.3 + Math.random() * 0.5;
    const barnacleGeo = new THREE.DodecahedronGeometry(size, 0);
    const barnacleMat = new THREE.MeshStandardMaterial({
        color: 0x556677,
        roughness: 0.95,
        metalness: 0.1,
        emissive: 0x223344,
        emissiveIntensity: 0.2
    });
    
    const barnacle = new THREE.Mesh(barnacleGeo, barnacleMat);
    barnacle.castShadow = true;
    barnacle.userData = {
        type: 'barnacle',
        hasMemoryFragment: Math.random() < 0.3, // 30% chance
        collected: false
    };

    return barnacle;
}

/**
 * Updates pistons with sin-wave animation
 */
function updatePistons(time: number) {
    pistons.forEach(piston => {
        if (!piston.userData || piston.userData.type !== 'piston') return;

        const data = piston.userData;
        const phase = time * data.cycleSpeed + data.phase;
        const offset = Math.sin(phase) * data.stroke;

        // Update head position
        if (data.head) {
            data.head.position.y = data.baseY + offset;
        }

        // Update shaft to stretch
        if (data.shaft) {
            const shaftLength = 4 + offset;
            data.shaft.scale.y = shaftLength / 4;
            data.shaft.position.y = data.baseY + offset / 2 + 2.5;
        }
    });
}

/**
 * Updates blast doors (simple pulsing warning light for now)
 */
function updateBlastDoors(time: number) {
    blastDoors.forEach(door => {
        if (!door.userData || door.userData.type !== 'blastDoor') return;

        const data = door.userData;
        
        // Pulse warning light
        if (data.warningLight) {
            const pulse = Math.sin(time * 4) * 0.5 + 0.5;
            const mat = data.warningLight.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = 1.0 + pulse * 2.0;
        }
    });
}

class LevelManager {
    currentLevel: number;
    config: { [key: number]: LevelConfig };
    levelObjects: THREE.Object3D[];

    constructor() {
        this.currentLevel = 1;
        this.config = {
            1: {
                name: "The Neon Garden",
                distance: 500,
                asteroidRate: 3.0, // Slow spawn
                foliageDensity: {
                    fern: 50,
                    rose: 30,
                    lotus: 10,
                    glowingFlower: 40,
                    tree: 50,
                    floweringTree: 40,
                    shrub: 40,
                    vine: 15,
                    orb: 25,
                    mushroom: 30,
                    cloud: 25,
                    // Geological objects - sparse in first level
                    voidRootBall: 3,
                    vacuumKelp: 5,
                    iceNeedle: 8,
                    liquidMetal: 4,
                    magmaHeart: 2
                },
                speed: 6,
                bgColor: 0x1a1a2e,
                levelType: 'open'
            },
            2: {
                name: "The Asteroid Belt",
                distance: 1200, // Start + 700
                asteroidRate: 0.8, // Fast spawn
                foliageDensity: {
                    fern: 10,
                    rose: 5,
                    lotus: 5,
                    glowingFlower: 10,
                    tree: 10,
                    floweringTree: 5,
                    shrub: 10,
                    vine: 5,
                    orb: 10,
                    mushroom: 10,
                    cloud: 10,
                    // More geological threats in asteroid belt
                    voidRootBall: 8,
                    vacuumKelp: 3,
                    iceNeedle: 15,
                    liquidMetal: 10,
                    magmaHeart: 5
                },
                speed: 8,
                bgColor: 0x2d1a1a, // Reddish
                levelType: 'open'
            },
            3: {
                name: "The Deep Void",
                distance: 2200, // Start + 1700
                asteroidRate: 1.2, // Medium but fast rocks?
                foliageDensity: {
                    fern: 5,
                    rose: 0,
                    lotus: 20, // Alien
                    glowingFlower: 5,
                    tree: 5,
                    floweringTree: 0,
                    shrub: 5,
                    vine: 20, // Creepy
                    orb: 50, // Many orbs
                    mushroom: 5,
                    cloud: 40, // Foggy
                    // Deep void has most dangerous geological objects
                    voidRootBall: 12,
                    vacuumKelp: 15,
                    iceNeedle: 10,
                    liquidMetal: 8,
                    magmaHeart: 8
                },
                speed: 10,
                bgColor: 0x000000, // Pitch black
                levelType: 'open'
            },
            4: {
                name: "The Rusty Gauntlet",
                distance: 3200, // Start after Deep Void
                asteroidRate: 2.0, // Fewer asteroids in tunnels
                foliageDensity: {
                    // Minimal foliage in industrial environment
                    fern: 0,
                    rose: 0,
                    lotus: 0,
                    glowingFlower: 5,
                    tree: 0,
                    floweringTree: 0,
                    shrub: 0,
                    vine: 0,
                    orb: 15,
                    mushroom: 0,
                    cloud: 5,
                    // Industrial hazards
                    voidRootBall: 0,
                    vacuumKelp: 0,
                    iceNeedle: 0,
                    liquidMetal: 5,
                    magmaHeart: 3
                },
                speed: 12,
                bgColor: 0x1a1008, // Dark orange-brown industrial
                levelType: 'tunnel',
                tunnelHeight: 15,
                obstacleInterval: 20 // Spawn structural section every 20m
            },
            5: {
                name: "The Astral Leviathan",
                distance: 4200, // Final level
                asteroidRate: 2.5, // Very few asteroids inside whale
                foliageDensity: {
                    // Organic growth in whale
                    fern: 5,
                    rose: 0,
                    lotus: 15,
                    glowingFlower: 20,
                    tree: 0,
                    floweringTree: 0,
                    shrub: 0,
                    vine: 10,
                    orb: 30, // Ghostly orbs
                    mushroom: 8,
                    cloud: 15, // Memory fog
                    // Organic hazards
                    voidRootBall: 5,
                    vacuumKelp: 8,
                    iceNeedle: 0,
                    liquidMetal: 0,
                    magmaHeart: 0
                },
                speed: 10,
                bgColor: 0x0a0810, // Deep purple-blue organic
                levelType: 'organic_tunnel',
                tunnelHeight: 20,
                obstacleInterval: 25, // Spawn rib section every 25m
                fogDensity: 0.08 // Dense Memory Fog
            }
        };

        // Track planted objects to cleanup
        this.levelObjects = [];
    }

    startLevel(levelIndex: number) {
        this.currentLevel = levelIndex;
        const cfg = this.config[levelIndex];
        if (!cfg) return;

        console.log(`Starting Level ${levelIndex}: ${cfg.name}`);

        // Update Game State
        playerState.autoScrollSpeed = cfg.speed;
        playerState.distanceToMoon = cfg.distance;
        scene.background = new THREE.Color(cfg.bgColor);
        if (scene.fog) {
            scene.fog.color = new THREE.Color(cfg.bgColor);
            // Apply custom fog density for Memory Fog effect (Level 5)
            if (scene.fog instanceof THREE.Fog) {
                if (cfg.fogDensity) {
                    // Adjust fog near/far based on density (higher density = closer fog)
                    scene.fog.far = DEFAULT_FOG_FAR * (1 - cfg.fogDensity * FOG_FAR_DENSITY_FACTOR);
                    scene.fog.near = DEFAULT_FOG_NEAR * (1 - cfg.fogDensity * FOG_NEAR_DENSITY_FACTOR);
                } else {
                    // Reset to default fog
                    scene.fog.far = DEFAULT_FOG_FAR;
                    scene.fog.near = DEFAULT_FOG_NEAR;
                }
            }
        }

        // Update UI
        const levelDiv = document.getElementById('level-display');
        if (levelDiv) levelDiv.innerHTML = `Level ${levelIndex}: ${cfg.name}`;

        // Clear previous level objects that are behind (optional, but good for perf)
        // actually we just keep scrolling, but we need to spawn new density ahead

        // Populate new zone ahead of player
        this.populateZone(player.position.x + 50, player.position.x + 600, cfg);
    }

    populateZone(startX: number, endX: number, config: LevelConfig) {
        const width = endX - startX;
        const density = config.foliageDensity;
        const levelType = config.levelType || 'open';

        // For tunnel levels, spawn structural sections at fixed intervals
        if (levelType === 'tunnel') {
            const interval = config.obstacleInterval || 20;
            const sectionCount = Math.floor(width / interval);
            
            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                createIndustrialSection(xPos);
            }
            
            // Spawn minimal foliage inside tunnel bounds (constrained Y range)
            const tunnelHeight = config.tunnelHeight || 15;
            const yRange: [number, number] = [-tunnelHeight / 2 + 2, tunnelHeight / 2 - 2];
            
            this.spawnOpenFoliage(startX, width, density, yRange);
            return;
        }
        
        if (levelType === 'organic_tunnel') {
            const interval = config.obstacleInterval || 25;
            const sectionCount = Math.floor(width / interval);
            
            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                createWhaleRibSection(xPos);
            }
            
            // Spawn organic foliage inside whale bounds
            const tunnelHeight = config.tunnelHeight || 20;
            const yRange: [number, number] = [-tunnelHeight / 2 + 3, tunnelHeight / 2 - 3];
            
            this.spawnOpenFoliage(startX, width, density, yRange);
            return;
        }

        // Default 'open' level type - use existing random scatter logic
        this.spawnOpenFoliage(startX, width, density);
    }

    // Helper method to spawn foliage with open scatter logic
    spawnOpenFoliage(startX: number, width: number, density: LevelConfig['foliageDensity'], yRange: [number, number] = [-20, 20]) {
        // Helper to spawn
        const spawn = (count: number, creatorFn: () => THREE.Object3D, customYRange = yRange, zRange: [number, number] = [-30, 0]) => {
            for (let i = 0; i < count; i++) {
                const x = startX + Math.random() * width;
                const y = customYRange[0] + Math.random() * (customYRange[1] - customYRange[0]);
                const z = zRange[0] + Math.random() * (zRange[1] - zRange[0]);

                const obj = creatorFn();
                obj.position.set(x, y, z);

                // Random scale
                const s = 0.8 + Math.random() * 0.5;
                obj.scale.set(s, s, s);

                scene.add(obj);
                this.levelObjects.push(obj);

                // Add to moonPlants for animation update loop
                moonPlants.push(obj);
            }
        };

        // Spawn all types
        if (density.fern) spawn(density.fern, () => createStarDustFern({ color: 0x8A2BE2 }));
        if (density.rose) spawn(density.rose, () => createNebulaRose({ color: 0xFF1493 }));
        if (density.lotus) spawn(density.lotus, () => createSubwooferLotus({ color: 0x00ff88 }));
        if (density.glowingFlower) spawn(density.glowingFlower, () => createGlowingFlower({ color: 0x00ffff, intensity: 2.0 }));

        // Standard foliage (trees at lower positions)
        const treeYRange: [number, number] = [Math.max(yRange[0], -20), Math.min(yRange[1], -5)];
        if (density.tree) spawn(density.tree, () => createFloweringTree({ color: 0x44ffaa }), treeYRange);
        if (density.floweringTree) spawn(density.floweringTree, () => createFloweringTree({ color: 0xffaa44 }), treeYRange);

        // Floating items
        if (density.orb) spawn(density.orb, () => createFloatingOrb({ color: 0x88ccff }), yRange);

        // Add clouds manually because they need the specific class wrapper
        if (density.cloud) {
            for(let i=0; i<density.cloud; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -40 + Math.random() * 30;
                createSporeCloudAtPosition(x, y, z);
            }
        }

        // Geological objects from plan.md
        if (density.voidRootBall) {
            for(let i=0; i<density.voidRootBall; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createVoidRootBallAtPosition(x, y, z);
            }
        }

        if (density.vacuumKelp) {
            for(let i=0; i<density.vacuumKelp; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * 15;
                const z = -35 + Math.random() * 25;
                createVacuumKelpAtPosition(x, y, z);
            }
        }

        if (density.iceNeedle) {
            for(let i=0; i<density.iceNeedle; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createIceNeedleClusterAtPosition(x, y, z);
            }
        }

        if (density.liquidMetal) {
            for(let i=0; i<density.liquidMetal; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createLiquidMetalBlobAtPosition(x, y, z);
            }
        }

        if (density.magmaHeart) {
            for(let i=0; i<density.magmaHeart; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createMagmaHeartAtPosition(x, y, z);
            }
        }
    }

    checkProgress(playerX: number) {
        // Transition logic
        if (this.currentLevel === 1 && playerX > 500) {
            this.startLevel(2);
        } else if (this.currentLevel === 2 && playerX > 1200) {
            this.startLevel(3);
        } else if (this.currentLevel === 3 && playerX > 2200) {
            this.startLevel(4);
        } else if (this.currentLevel === 4 && playerX > 3200) {
            this.startLevel(5);
        }
    }
}

const levelManager = new LevelManager();

// =============================================================================
// OBSTACLE SYSTEM
// =============================================================================
const obstacles: THREE.Mesh[] = [];
let OBSTACLE_SPAWN_INTERVAL = 1.5; // seconds
let lastObstacleSpawn = 0;

function createAsteroid(x: number, y: number) {
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

function updateObstacles(delta: number) {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
    const playerX = player.position.x;
    const playerY = player.position.y; // Capture Y for WASM

    // Adjust spawn rate based on level
    const currentCfg = levelManager.config[levelManager.currentLevel];
    if (currentCfg) {
        OBSTACLE_SPAWN_INTERVAL = currentCfg.asteroidRate;
    }

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

    // C. Update WASM Memory & Call Collision Check
    if (wasmExports && obstacles.length > 0) {
        // 1. Allocate space (returns pointer to existing or new buffer)
        const ptr = wasmExports.allocAsteroids(obstacles.length);

        // 2. Update view if memory grew or changed (simple check)
        // Note: In a real high-perf scenario we'd cache the view and only update if buffer.byteLength changed
        // But here we need to be safe.
        if (!wasmMemory || wasmMemory.buffer !== wasmExports.memory.buffer) {
            wasmMemory = new Float32Array(wasmExports.memory.buffer);
        }

        // 3. Write data to WASM memory
        // Ptr is in bytes, Float32Array uses index (bytes / 4)
        const startIdx = ptr >>> 2;
        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            const offset = startIdx + (i * 3);
            wasmMemory[offset] = obs.position.x;
            wasmMemory[offset + 1] = obs.position.y;
            wasmMemory[offset + 2] = obs.userData.radius || 1.0;
        }

        // 4. Check collision
        // checkCollision(playerX, playerY, playerRadius, count)
        const hitIndex = wasmExports.checkCollision(playerX, playerY, 0.5, obstacles.length);

        // D. Handle Hit
        if (hitIndex !== -1) {
            handleCollision(hitIndex);
        }
    }
}

function handleCollision(hitIndex: number) {
    const obs = obstacles[hitIndex];
    if (obs) {
        // Capture player Y for bounce calculation
        const playerY = player ? player.position.y : 0;

        // --- NEW: Emit Explosion Particles ---
        particleSystem.emit(obs.position.clone(), 0xff5555, 15, 10.0, 1.2, 1.0);
        particleSystem.emit(obs.position.clone(), 0xaaaaaa, 10, 8.0, 0.8, 1.0);
        // Collision! Flash red and bounce
        (obs.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xff0000);
        (obs.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0;
        setTimeout(() => {
            if (obs.material) {
                (obs.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
                     (obs.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
                 }
             }, 200);

             // Reduce health
             playerState.health--;
             playerState.invincible = true;

             // Flash the rocket
             const rocket = player.children[0];
             if (rocket) {
                 rocket.children.forEach((child: any) => {
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

// =============================================================================
// LEVEL GEOMETRY & BACKGROUND
// =============================================================================

// Background elements (parallax layers for depth)
function createBackgroundLayer(zOffset: number, color: number, count: number) {
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
function createGalaxy(x: number, y: number, z: number, color: number) {
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
const sporeClouds: SporeCloud[] = [];

function createSporeCloudAtPosition(x: number, y: number, z: number) {
    const cloud = new SporeCloud(scene, new THREE.Vector3(x, y, z), 500 + Math.floor(Math.random() * 500));
    sporeClouds.push(cloud);
    return cloud;
}

// Chroma-Shift Rocks - color-shifting crystalline rocks
const chromaRocks: THREE.Group[] = [];

function createChromaRockAtPosition(x: number, y: number, z: number) {
    const rock = createChromaShiftRock({ size: 2 + Math.random() * 2 });
    rock.position.set(x, y, z);
    scene.add(rock);
    chromaRocks.push(rock);
    return rock;
}

// Fractured Geodes - safe harbors with EM fields
const geodes: THREE.Group[] = [];

function createGeodeAtPosition(x: number, y: number, z: number) {
    const geode = createFracturedGeode({ size: 3 + Math.random() * 2 });
    geode.position.set(x, y, z);
    scene.add(geode);
    geodes.push(geode);
    return geode;
}

// Nebula Jelly-Moss - floating gelatinous organisms with fractal moss
const jellyMosses: THREE.Group[] = [];

function createJellyMossAtPosition(x: number, y: number, z: number, size?: number) {
    const jellyMoss = createNebulaJellyMoss({ size: size || 2 + Math.random() * 8 });
    jellyMoss.position.set(x, y, z);
    scene.add(jellyMoss);
    jellyMosses.push(jellyMoss);
    return jellyMoss;
}

// Solar Sails / Light Leaves - thin-film iridescent organisms catching solar wind
const solarSails: THREE.Group[] = [];

function createSolarSailAtPosition(x: number, y: number, z: number) {
    const solarSail = createSolarSail({ 
        leafCount: 6 + Math.floor(Math.random() * 6),
        leafLength: 8 + Math.random() * 8
    });
    solarSail.position.set(x, y, z);
    scene.add(solarSail);
    solarSails.push(solarSail);
    return solarSail;
}

// Void Root Balls - active threats with grapple mechanics
const voidRootBalls: THREE.Group[] = [];

function createVoidRootBallAtPosition(x: number, y: number, z: number) {
    const rootBall = createVoidRootBall({ size: 2 + Math.random() * 2 });
    rootBall.position.set(x, y, z);
    scene.add(rootBall);
    voidRootBalls.push(rootBall);
    return rootBall;
}

// Vacuum Kelp - energy-draining tunnel obstacles
const vacuumKelps: THREE.Group[] = [];

function createVacuumKelpAtPosition(x: number, y: number, z: number) {
    const kelp = createVacuumKelp({ length: 20 + Math.random() * 20, nodes: 5 + Math.floor(Math.random() * 4) });
    kelp.position.set(x, y, z);
    scene.add(kelp);
    vacuumKelps.push(kelp);
    return kelp;
}

// Ice Needle Clusters - super-bleed and thermal dynamics
const iceNeedleClusters: THREE.Group[] = [];

function createIceNeedleClusterAtPosition(x: number, y: number, z: number) {
    const cluster = createIceNeedleCluster({ count: 15 + Math.floor(Math.random() * 15) });
    cluster.position.set(x, y, z);
    scene.add(cluster);
    iceNeedleClusters.push(cluster);
    return cluster;
}

// Liquid Metal Blobs - splitting and recombination
const liquidMetalBlobs: THREE.Group[] = [];

function createLiquidMetalBlobAtPosition(x: number, y: number, z: number) {
    const blob = createLiquidMetalBlob({ size: 2 + Math.random() * 3 });
    blob.position.set(x, y, z);
    scene.add(blob);
    liquidMetalBlobs.push(blob);
    return blob;
}

// Magma Hearts - eruption cycle mechanics
const magmaHearts: THREE.Group[] = [];

function createMagmaHeartAtPosition(x: number, y: number, z: number) {
    const heart = createMagmaHeart({ size: 3 + Math.random() * 2 });
    heart.position.set(x, y, z);
    scene.add(heart);
    magmaHearts.push(heart);
    return heart;
}

// Store plants that live on the moon to animate them later
const moonPlants: THREE.Object3D[] = [];

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
    // Level Display (New)
    const levelDiv = document.createElement('div');
    levelDiv.id = 'level-display';
    levelDiv.style.position = 'absolute';
    levelDiv.style.top = '20px';
    levelDiv.style.right = '20px'; // Top right
    levelDiv.style.color = '#ffcc00';
    levelDiv.style.fontSize = '30px';
    levelDiv.style.fontWeight = 'bold';
    levelDiv.style.textShadow = '0 0 10px rgba(255, 204, 0, 0.5)';
    levelDiv.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    levelDiv.style.zIndex = '100';
    document.body.appendChild(levelDiv);

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

    // Start Level 1
    levelManager.startLevel(1);
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
    if (distanceDiv && player) {
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

function onKeyDown(event: KeyboardEvent) {
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

function onKeyUp(event: KeyboardEvent) {
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
if (instructions) {
    instructions.addEventListener('click', () => {
        instructions.style.display = 'none';
        createUI(); // Create UI when game starts
    });
}

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
        // Note: For InstancedMesh, intersectObjects returns the mesh with instanceId
        const intersects = raycaster.intersectObjects(cloud.spores, false);
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point;

            // InstancedMesh hit?
            if (intersects[0].instanceId !== undefined) {
                 // Pass the hit point to trigger local reaction
                 const triggered = cloud.triggerChainReaction(hitPoint);
                 if (triggered > 0) {
                    particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                 }
            } else {
                 // Fallback for non-instanced (if any remain)
                 const triggered = cloud.triggerChainReaction(hitPoint);
                 if (triggered > 0) {
                    particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                 }
            }
        }
    });
});

// Track when game starts
if (instructions) {
    instructions.addEventListener('click', () => {
        gameStarted = true;
    }, { once: true });
}

// =============================================================================
// PHYSICS & COLLISION
// =============================================================================
function checkPlatformCollision(x: number, y: number, radius = 0.3) {
    // Check ground
    if (y - radius <= CONFIG.groundLevel) {
        return { collided: true, groundY: CONFIG.groundLevel };
    }

    // Note: platforms are defined inside collision logic normally or as a global
    // But since they were not defined in the provided main.js, we assume only ground collision
    // or we'd need to extract platform logic if it existed.
    // The previous main.js referenced `platforms` but didn't define it in the snippet provided.
    // I will assume for now we only check ground or if platforms are missing, ignore.

    // Check platforms
    // for (const platform of platforms) { ... } // platforms undefined in source snippet

    return { collided: false, groundY: null };
}

function updatePlayer(delta: number) {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
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
    if (collision.collided && collision.groundY !== null) {
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

    // Level Checking
    levelManager.checkProgress(player.position.x);
}

// =============================================================================
// CAMERA FOLLOW
// =============================================================================
function updateCamera() {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
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
    jellyMosses.forEach(jellyMoss => {
        updateNebulaJellyMoss(jellyMoss, delta, time);

        // --- NEW: Jelly Moss Interaction (Stealth & Shield) ---
        if (player && jellyMoss.visible && jellyMoss.userData.radius) {
            const dist = player.position.distanceTo(jellyMoss.position);
            const radius = jellyMoss.userData.radius;

            // Player inside membrane?
            if (dist < radius) {
                // Apply Stealth Effect
                if (!jellyMoss.userData.isHiding) {
                    jellyMoss.userData.isHiding = true;
                    // Visual feedback: Make player transparent
                    const rocket = player.children[0];
                    if (rocket) {
                         rocket.traverse((child: any) => {
                             if (child.isMesh && child.material) {
                                 // Store original opacity/transparent state if not already
                                 if (child.userData.originalOpacity === undefined) {
                                     child.userData.originalOpacity = child.material.opacity;
                                     child.userData.originalTransparent = child.material.transparent;
                                 }
                                 child.material.transparent = true;
                                 child.material.opacity = 0.4;
                             }
                         });
                    }
                }

                // Shield Leech simulation
                const normDist = dist / radius;
                // Leech rate inversely proportional to distance (closer = more damage)
                const leechIntensity = THREE.MathUtils.lerp(1.0, 0.0, normDist);

                // Apply subtle visual damage effect (red tint pulse)
                if (Math.random() < 0.05 * leechIntensity) {
                    const rocket = player.children[0];
                    if (rocket) {
                        rocket.traverse((child: any) => {
                            if (child.isMesh && child.material && child.material.emissive) {
                                const oldEmissive = child.material.emissive.getHex();
                                child.material.emissive.setHex(0xff0000);
                                setTimeout(() => {
                                    if(child.material) child.material.emissive.setHex(oldEmissive);
                                }, 100);
                            }
                        });
                    }
                }

            } else {
                // Exit Stealth
                if (jellyMoss.userData.isHiding) {
                    jellyMoss.userData.isHiding = false;
                    const rocket = player.children[0];
                    if (rocket) {
                         rocket.traverse((child: any) => {
                             if (child.isMesh && child.material) {
                                 // Restore original
                                 if (child.userData.originalOpacity !== undefined) {
                                     child.material.opacity = child.userData.originalOpacity;
                                     child.material.transparent = child.userData.originalTransparent;
                                 } else {
                                     child.material.opacity = 1.0;
                                     child.material.transparent = false;
                                 }
                             }
                         });
                    }
                }
            }
        }
    });

    // Update solar sails (iridescent rippling, unfold near player)
    solarSails.forEach(solarSail => updateSolarSail(solarSail, delta, time, player.position));

    // Update new geological objects from plan.md
    voidRootBalls.forEach(rootBall => updateVoidRootBall(rootBall, delta, time, player.position));
    vacuumKelps.forEach(kelp => updateVacuumKelp(kelp, delta, time));
    iceNeedleClusters.forEach(cluster => updateIceNeedleCluster(cluster, delta, time));
    liquidMetalBlobs.forEach(blob => updateLiquidMetalBlob(blob, delta, time));
    magmaHearts.forEach(heart => updateMagmaHeart(heart, delta, time));

    // Update industrial obstacles (Level 4)
    updatePistons(time);
    updateBlastDoors(time);

    // Rotate galaxies slowly
    if (galaxy1) galaxy1.rotation.z += galaxy1.userData.rotationSpeed;
    if (galaxy2) galaxy2.rotation.z += galaxy2.userData.rotationSpeed;
    if (galaxy3) galaxy3.rotation.z += galaxy3.userData.rotationSpeed;
    
    // Rotate and pulse moon atmosphere
    if (moon && moon.userData.atmosphere) {
        moon.rotation.y += 0.002;
        const pulse = Math.sin(Date.now() * 0.001) * 0.5 + 0.5;
        (moon.userData.atmosphere.material as THREE.MeshBasicMaterial).opacity = 0.1 + pulse * 0.1;
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
    if (player && player.position.x >= playerState.distanceToMoon - 10 && !playerState.hasWon) {
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
