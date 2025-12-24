// Memory management for asteroid data
// We use a global buffer to store the asteroid data (x, y, radius)
// This prevents overwriting the stack or other globals at offset 0

// Current pointer to the asteroid data buffer
let asteroidsPtr: usize = 0;
// Current capacity of the buffer (in number of asteroids)
let asteroidsCapacity: i32 = 0;

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

  // If count is smaller, we just reuse the existing buffer (no shrink)
  // This avoids constant reallocation jitter.

  return asteroidsPtr;
}

// Checks for collision between a player circle and a list of circular objects.
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
