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
    group.position.set(0, 0, 0);

    // ROTATE HORIZONTAL: Nose points RIGHT (+X direction)
    group.rotation.z = -Math.PI / 2;

    // Container for pitch animation
    const tiltGroup = new THREE.Group();
    tiltGroup.add(group);
    tiltGroup.position.set(0, 5, 0); // Start higher in space

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
    autoScrollSpeed: 6 // Constant forward movement
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

    // Spawn new obstacles ahead of player
    lastObstacleSpawn += delta;
    if (lastObstacleSpawn > OBSTACLE_SPAWN_INTERVAL) {
        lastObstacleSpawn = 0;
        const spawnX = playerX + 40 + Math.random() * 20;
        const spawnY = (Math.random() - 0.5) * 15;
        createAsteroid(spawnX, spawnY);
    }

    // Update and check collision for each obstacle
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];

        // Rotate asteroid
        obs.rotation.x += obs.userData.rotationSpeed * delta;
        obs.rotation.y += obs.userData.rotationSpeed * delta * 0.5;

        // Remove if behind player
        if (obs.position.x < playerX - 30) {
            scene.remove(obs);
            obstacles.splice(i, 1);
            continue;
        }

        // Collision check (simple sphere)
        const dx = obs.position.x - player.position.x;
        const dy = obs.position.y - player.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = obs.userData.radius + 0.5; // player radius ~0.5

        if (dist < hitRadius) {
            // Collision! Flash red and bounce
            obs.material.emissive = new THREE.Color(0xff0000);
            obs.material.emissiveIntensity = 1.0;
            setTimeout(() => {
                if (obs.material) {
                    obs.material.emissive = new THREE.Color(0x000000);
                    obs.material.emissiveIntensity = 0;
                }
            }, 200);

            // Bounce player away
            playerState.velocity.y += (dy > 0 ? -5 : 5);
            playerState.velocity.x -= 3;
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

    updatePlayer(delta);
    updateObstacles(delta);
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

console.log('🚀 Dog Dash - Space Flyer loaded!');
console.log('Controls: SPACE/W to thrust up, A to dive down');

