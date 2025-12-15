# dog_dash

Dog Dash - A 3D world exploration game.

## Features

- **WebGPU rendering** - Modern GPU API for high-performance 3D graphics
- **Smooth, glossy graphics** - Rounded organic shapes with specular highlights
- **First-person controls** - Explore the world with keyboard and mouse
- **Animated elements** - Dynamic environment with clouds and effects
- **3D perspective** - Proper depth rendering with WebGPU
- **npm buildable** - Modern build system with Vite
- **Alien Flora & Geological Objects** - Inspired by the design document (plan.md):
  - **Nebula Jelly-Moss** - Floating gelatinous organisms with pulsing fractal moss cores
  - **Spore Clouds** - Interactive clouds with chain reaction mechanics (click to trigger!)
  - **Chroma-Shift Rocks** - Color-shifting crystalline rocks that change hue with distance
  - **Fractured Geodes** - Crystalline safe harbors with pulsing EM fields

## How to Run

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

### Production Build

Build the project for production:
```bash
npm run build
```

The built files will be in the `dist/` directory. You can preview the production build with:
```bash
npm run preview
```

### Requirements

- Node.js 16+ and npm
- A modern browser with WebGPU support (Chrome 113+, Edge 113+, or other browsers with WebGPU enabled)

## Controls

- **Space** - Thrust up (jump/fly)
- **A** - Dive down
- **Mouse Click** - Trigger spore cloud chain reactions
- **Mouse** - Look around

## Gameplay

Navigate your rocket through space, avoiding asteroids while exploring the alien environment:

- **Survival** - Your ship can survive 3 asteroid collisions before destruction
- **Journey** - Reach the distant moon to win
- **Exploration** - Discover alien flora and geological objects:
  - Click on **Spore Clouds** to trigger beautiful chain reactions
  - Navigate around **Nebula Jelly-Moss** - gelatinous organisms that pulse and drift
  - Observe **Chroma-Shift Rocks** that change color as you approach
  - Find **Fractured Geodes** with their pulsing electromagnetic fields

## Technical Details

- Built with Three.js and WebGPU renderer
- Modern WebGPU API for next-generation graphics
- Vite build system for fast development and optimized production builds
