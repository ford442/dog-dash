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
    // If we had a previous buffer, we could free it here if AS had a free(),
    // but the GC or simple allocator will handle new allocations.
    // For a simple game loop, we just allocate a new buffer.
    // Note: In standard AS with --runtime stub (default for low overhead),
    // `heap.alloc` might be needed or just `new ArrayBuffer`.
    // However, keeping it simple: let's use a static ArrayBuffer approach
    // or just let AS manage a specialized array.

    // Simplest approach for raw access: Use a global TypedArray (Float32Array)
    // and return its data pointer.
    if (asteroidsCapacity == 0) {
       // Initial allocation
       asteroidsPtr = heap.alloc(requiredBytes);
    } else {
       // Reallocate
       asteroidsPtr = heap.realloc(asteroidsPtr, requiredBytes);
    }
    asteroidsCapacity = count;
  }

  return asteroidsPtr;
}

// Checks for collision between a player circle and a list of circular objects.
// Returns the index of the collided object, or -1 if no collision found.
export function checkCollision(playerX: f32, playerY: f32, playerRadius: f32, objectCount: i32): i32 {
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
