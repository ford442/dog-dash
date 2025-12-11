import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';

// =============================================================================
// DOG DASH - 2.5D Side-Scroller
// Inspired by Inside, Little Nightmares, Metroid Dread
// =============================================================================

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
        jumpForce: 12,
        gravity: 30,
        groundFriction: 0.85,
        airFriction: 0.95
    },
    // World
    groundLevel: 0
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

// =============================================================================
// PLAYER (Dog Character)
// =============================================================================
// =============================================================================
// PLAYER (Rocket Character)
// =============================================================================
function createRocket() {
    const group = new THREE.Group();

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

    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff, // Cyan window
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x00ffff,
        emissiveIntensity: 0.2
    });

    const glowMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00, // Thruster glow
        emissive: 0xff4400,
        emissiveIntensity: 1.0
    });

    // 1. Fuselage (Main Body)
    const fuselageGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.4, 16);
    const fuselage = new THREE.Mesh(fuselageGeo, rocketMat);
    fuselage.position.y = 0.7; // Center vertically
    fuselage.castShadow = true;
    group.add(fuselage);

    // 2. Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.35, 0.6, 16);
    const nose = new THREE.Mesh(noseGeo, highlightMat);
    nose.position.y = 1.7; // On top of fuselage (0.7 + 0.7 + 0.3)
    nose.castShadow = true;
    group.add(nose);

    // 3. Fins (3 fins at equal spacing)
    const finGeo = new THREE.BoxGeometry(0.1, 0.6, 0.6);
    // Cut the box to look like a fin? Primitives are limited, let's use thin boxes rotated
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const finGroup = new THREE.Group();

        const fin = new THREE.Mesh(finGeo, highlightMat);
        fin.position.set(0.4, 0.3, 0); // Offset from center
        fin.castShadow = true;

        finGroup.rotation.y = angle;
        finGroup.add(fin);
        group.add(finGroup);
    }

    // 4. Window (Porthole)
    const windowFrameGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
    const windowFrame = new THREE.Mesh(windowFrameGeo, rocketMat);
    windowFrame.position.set(0, 1.0, 0.35); // Front of fuselage
    group.add(windowFrame);

    const windowGlassGeo = new THREE.CircleGeometry(0.15, 16);
    const windowGlass = new THREE.Mesh(windowGlassGeo, windowMat);
    windowGlass.position.set(0, 1.0, 0.35);
    group.add(windowGlass);

    // 5. Thruster Nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.3, 16);
    const nozzle = new THREE.Mesh(nozzleGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    nozzle.position.y = -0.15;
    group.add(nozzle);

    // 6. Flame (Animated later)
    const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
    const flame = new THREE.Mesh(flameGeo, glowMat);
    flame.position.y = -0.5;
    flame.rotation.x = Math.PI;
    group.add(flame);
    group.userData.flame = flame;

    // Position player logic
    group.position.set(0, 1, 0);

    // Rotate to face right by default (Z-axis is "side")
    // Actually, in our setup Z=0 is the plane. X is left/right.
    // The rocket faces "forward" (Z+) with the window. 
    // We need to rotate it so the window faces the camera (Z+), 
    // but the movement is X.

    // Let's create a container for tilt animation
    const tiltGroup = new THREE.Group();
    tiltGroup.add(group);

    return tiltGroup;
}

const player = createPlayer();
scene.add(player);

// Player state
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false,
    facingRight: true,
    isRunning: false
};

// =============================================================================
// LEVEL GEOMETRY
// =============================================================================

// Ground (extends infinitely in X, flat in Z)
const groundGeo = new THREE.BoxGeometry(200, 2, 20);
const ground = new THREE.Mesh(groundGeo, materials.ground);
ground.position.set(0, -1, 0);
ground.receiveShadow = true;
scene.add(ground);

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
// INPUT HANDLING
// =============================================================================
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
});

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
    const speed = keys.run ? CONFIG.player.runSpeed : CONFIG.player.speed;

    // Horizontal movement
    if (keys.left) {
        playerState.velocity.x = -speed;
        playerState.facingRight = false;
    } else if (keys.right) {
        playerState.velocity.x = speed;
        playerState.facingRight = true;
    } else {
        // Apply friction
        const friction = playerState.isGrounded ? CONFIG.player.groundFriction : CONFIG.player.airFriction;
        playerState.velocity.x *= friction;
    }

    // Jump
    if (keys.jump && playerState.isGrounded) {
        playerState.velocity.y = CONFIG.player.jumpForce;
        playerState.isGrounded = false;
    }

    // Gravity
    if (!playerState.isGrounded) {
        playerState.velocity.y -= CONFIG.player.gravity * delta;
    }

    // Apply velocity
    player.position.x += playerState.velocity.x * delta;
    player.position.y += playerState.velocity.y * delta;

    // Collision detection
    const collision = checkPlatformCollision(player.position.x, player.position.y);
    if (collision.collided) {
        player.position.y = collision.groundY + 0.5; // Player height offset
        playerState.velocity.y = 0;
        playerState.isGrounded = true;
    } else {
        playerState.isGrounded = false;
    }

    // Face direction (Not scaling -1, but rotating fins/tilt)
    // We handle tilt separately.

    // Animation: Hover
    // Get the inner rocket group (child 0)
    const rocket = player.children[0];
    if (rocket) {
        // Bobbing
        const hoverY = Math.sin(Date.now() * 0.005) * 0.1;
        rocket.position.y = hoverY;

        // Tilt based on velocity
        const targetTilt = -playerState.velocity.x * 0.05; // Lean forward/back
        // Smooth tilt
        player.rotation.z += (targetTilt - player.rotation.z) * 0.1;

        // Flame Flicker
        if (rocket.userData.flame) {
            const flicker = 0.8 + Math.random() * 0.4;
            const len = 1.0 + Math.abs(playerState.velocity.y) * 0.1; // Longer flame when jumping
            rocket.userData.flame.scale.set(flicker, flicker * len, flicker);
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

    updatePlayer(delta);
    updateCamera();

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

console.log('🐕 Dog Dash - 2.5D Side-Scroller loaded!');
console.log('Controls: A/D or Arrow Keys to move, W/Space to jump, Shift to run');
