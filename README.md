# dog_dash

Dog Dash - A 3D world exploration game.

## Features

- **WebGPU rendering** - Modern GPU API for high-performance 3D graphics
- **Smooth, glossy graphics** - Rounded organic shapes with specular highlights
- **First-person controls** - Explore the world with keyboard and mouse
- **Animated elements** - Dynamic environment with clouds and effects
- **3D perspective** - Proper depth rendering with WebGPU
- **npm buildable** - Modern build system with Vite

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

- **Right Click** - Move forward (run)
- **A/D** - Strafe left/right
- **S** - Move backward
- **W/Space** - Jump
- **Control** - Hold to sneak
- **Mouse** - Look around

## Technical Details

- Built with Three.js and WebGPU renderer
- Modern WebGPU API for next-generation graphics
- Vite build system for fast development and optimized production builds
