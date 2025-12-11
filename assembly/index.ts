// Checks for collision between a player circle and a list of circular objects.
// Returns the index of the collided object, or -1 if no collision found.
export function checkCollision(playerX: f32, playerY: f32, playerRadius: f32, objectCount: i32): i32 {
  for (let i = 0; i < objectCount; i++) {
    // We assume data is stored as sets of 3 floats: [x, y, radius]
    // 3 floats * 4 bytes/float = 12 bytes per object
    let ptr = i * 12; 
    
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
  }
  return -1; // No collision
}
