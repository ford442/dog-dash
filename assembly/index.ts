// Memory management for asteroid data
// We use a global buffer to store the asteroid data (x, y, radius)
// This prevents overwriting the stack or other globals at offset 0

// Current pointer to the asteroid data buffer
let asteroidsPtr: usize = 0;
// Current capacity of the buffer (in number of asteroids)
let asteroidsCapacity: i32 = 0;

// Current pointer to the spore cloud data buffer (x, y, z, radius)
let sporeCloudsPtr: usize = 0;
let sporeCloudsCapacity: i32 = 0;

// Allocates space for a given number of asteroids.
// Returns the pointer/offset to the beginning of the buffer.
export function allocAsteroids(count: i32): usize {
  // 3 floats per asteroid * 4 bytes = 12 bytes
  const requiredBytes = count * 12;

  // If we need more space than currently allocated, resize
  if (count > asteroidsCapacity) {
    if (asteroidsCapacity == 0) {
       // Initial allocation
       asteroidsPtr = heap.alloc(requiredBytes);
    } else {
       // Reallocate (might move the pointer)
       asteroidsPtr = heap.realloc(asteroidsPtr, requiredBytes);
    }
    asteroidsCapacity = count;
  }
  return asteroidsPtr;
}

// Allocates space for a given number of Spore Clouds.
// Returns the pointer/offset to the beginning of the buffer.
export function allocSporeClouds(count: i32): usize {
  // 4 floats per cloud (x, y, z, radius) * 4 bytes = 16 bytes
  const requiredBytes = count * 16;

  if (count > sporeCloudsCapacity) {
    if (sporeCloudsCapacity == 0) {
       sporeCloudsPtr = heap.alloc(requiredBytes);
    } else {
       sporeCloudsPtr = heap.realloc(sporeCloudsPtr, requiredBytes);
    }
    sporeCloudsCapacity = count;
  }
  return sporeCloudsPtr;
}

// Checks for collision between a player circle and a list of circular objects (Asteroids).
// Returns the index of the collided object, or -1 if no collision found.
export function checkCollision(playerX: f32, playerY: f32, playerRadius: f32, objectCount: i32): i32 {
  // If no objects or no memory allocated, return no collision
  if (objectCount == 0 || asteroidsPtr == 0) {
    return -1;
  }

  let ptr = asteroidsPtr;

  for (let i = 0; i < objectCount; i++) {
    // Data is stored as sets of 3 floats: [x, y, radius]
    let objX = load<f32>(ptr);
    let objY = load<f32>(ptr + 4);
    let objR = load<f32>(ptr + 8);

    // Calculate distance squared (more efficient than square root)
    let dx = playerX - objX;
    let dy = playerY - objY;
    let distSq = dx * dx + dy * dy;

    // Check collision
    let radii = playerRadius + objR;
    if (distSq < radii * radii) {
      return i; // Collision detected! Return the index.
    }

    // Move to next object
    ptr += 12;
  }
  return -1; // No collision
}

// Checks for collision with Spore Clouds in 3D (Spherical collision)
// Used for "Collecting" or entering clouds
export function checkSporeCollision(playerX: f32, playerY: f32, playerZ: f32, playerRadius: f32, objectCount: i32): i32 {
  if (objectCount == 0 || sporeCloudsPtr == 0) {
    return -1;
  }

  let ptr = sporeCloudsPtr;

  for (let i = 0; i < objectCount; i++) {
    // Data is stored as sets of 4 floats: [x, y, z, radius]
    let objX = load<f32>(ptr);
    let objY = load<f32>(ptr + 4);
    let objZ = load<f32>(ptr + 8);
    let objR = load<f32>(ptr + 12);

    let dx = playerX - objX;
    let dy = playerY - objY;
    let dz = playerZ - objZ;
    let distSq = dx * dx + dy * dy + dz * dz;

    let radii = playerRadius + objR;
    if (distSq < radii * radii) {
      return i; // Collision detected
    }

    ptr += 16;
  }
  return -1;
}
