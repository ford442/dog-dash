# Jules Code AI - Pending Features & Implementation Plan

This file outlines the remaining features and implementation tasks for `jules` (the AI-powered coding agent), focused on delivering the advanced environmental gameplay and visual systems described in `plan.md`.

Each feature below includes the goal, sub-tasks, technical notes, and priority. Use this as a developer checklist for the next sprints.

---

## High Priority (P1) — Core Gameplay & Visuals

1. Nebula Jelly-Moss (Advanced Behavior)
   - Implement membrane physics (real vertex wobble shader rather than scale).
   - Membrane: semi-permeable shader that reduces projectile velocity by 50%.
   - Weak-points: expose fractal moss "cores" as harvestable targets.
   - Add hide/stealth mechanic and shield-drain while inside.
   - Add destruction behavior: collapse + spore particle burst + reveal hidden nodes.
   - Files: `geological.js`, `shaders/jelly-moss.*`, `main.js` for interactions.
   - Notes: prototype shaders with `ShaderMaterial`, fallback poly for WebGPU.

2. Spore Clouds (Performance & Interactivity)
   - Optimize SporeCloud from per-sprite Mesh to an `InstancedMesh` (or particle pool) with GPU attributes for color/emissive and active state.
   - Add collection mechanic and vacuum-tool integration (HUD & inventory update).
   - Add chain reaction visual and audio cues; add a cooldown and scoring/reward systems.
   - Files: `geological.js` (class update), `particles.js` (new pool use), `main.js` for input handlers.

3. Solar Sails / Light Leaves (Mechanics + Shader)
   - Implement lightweight thin-film interference shader for iridescent leaf surfaces.
   - Implement wind field + solar wind item to ride sails (speed buff + visual reaction).
   - Harmful side-effects: wrap mechanic that causes temporary visuals & handling penalties.
   - Files: `foliage.js`, `shaders/solar-sail.*`, `main.js` for gameplay hooks.

4. WASM & Memory Safety
   - Add a simple allocator in AssemblyScript so JS writes into a dedicated pointer region instead of offset 0.
   - Expose an allocator in `assembly/index.ts` and adjust JS to use the pointer; guard reallocation when `memory.grow` happens.
   - Add tests covering memory bounds and collision correctness.
   - Files: `assembly/index.ts`, `main.js`, unit tests under `test/` or `verify.py` integration.

---

## Medium Priority (P2) — Hazards, Harvest & Visual Prototypes

1. Void Root Balls & Harpoons
   - Add harpoon launching on asteroid proximity; root ball reorientation when anchored.
   - Implement growing crystals as segments with telescoping animations.
   - Harvesting/loot: add "Void Gem" resource and UI counter.
   - Files: `geological.js`, `main.js`, UI updates.

2. Chroma-Shift Rocks (Shader Upgrade)
   - Convert emissive HSL lerp to a true fragment shader using world-space distances and velocity-driven vein flow textures.
   - Add weak-point state changes that alter damage/timer.
   - Files: `geological.js`, `shaders/chroma-rock.*`.

3. Fractured Geodes (Mining Mechanics)
   - Allow players to mine internal crystals; adjust EM field strength and discharge mechanic if crystals are shot too many times.
   - Add interior safe harbor gameplay and spawn points for resources.
   - Files: `geological.js`, `main.js`, `hud.js` or inventory.

4. Liquid Metal Blobs (Mirror Shader & Recombine)
   - Implement mirror/cubemap or screen-space reflection to achieve nearly perfect reflections.
   - Implement split & recombine behaviors and Containment Field logic.
   - Files: `geological.js`, `shaders/liquid-metal.*`, `main.js` (containment interaction).

---

## Lower Priority (P3) — Environmental & Level-scale Content

1. Magma Hearts: eruption cycle, gutted crust visuals, particle arcs.
2. Ice Needles: strategic hazard patches and Thermal Scanner interactions.
3. Vacuum Kelp: rope physics and multi-strand interactions; sever nodes and rare drops.
4. Star-Eater Pitchers: plasma interior, suction cones, feeding mechanic.
5. Derelict Buoys, Grav-Lenses & Data Monoliths: schema for artifacts + hacking/interaction games.
6. Fossilized Space Whales: large-scale geometry, grinding rails, barnacles for resource hooks.

---

## Technical Improvements & Performance

- Replace current particle arrays in `particles.js` with a ring buffer/pool approach to avoid `Array.shift` on large particle counts.
- Move heavy geometry to instanced meshes (`InstancedMesh`) where possible to reduce draw calls (spore clouds, kelp, repeated flora).
- Add an LRU texture cache for procedural assets to save memory when large scenes are active.
- Refactor audio hooks to a central `audioManager` for easy switching between SFX and procedural FM patches.
- Add a dev watcher to rebuild WASM automatically on AssemblyScript file changes (`watch:wasm`) and update served files for `npm run dev`.

---

## AI (Jules) Tasks and Handover

### Responsibilities for Jules (the AI code assistant)
- Implement shader prototypes and provide code and testing harnesses using `ShaderMaterial`/webgpu fallback.
- Implement WASM allocator and glue code for safe interop. Add tests for memory write and read correctness.
- Implement the ring/pool particle system conversion with `InstancedMesh` and a ring buffer for particle indices.
- Implement a prototype for at least one advanced flora (e.g. Jelly-Moss membrane + harvest mechanic) end-to-end.
- Generate test scenes and unit tests (Playwright-based `verify.py`) that automatically check seed scenes, event hooks, and expected outcomes.

### Expected Outputs from Jules
- Changes in `geological.js`, `foliage.js`, `particles.js`, `assembly/index.ts`, `main.js`, and `shaders/*` prototype files.
- Unit tests for behavior changes (chain reaction; WASM collision; particle pool stress tests).
- Example shader code and fallback paths for non-WebGPU environments.
- Short demo scenes and documentation in `README.md` about how to extend and test the features.

---

## Development Workflow & Recommendations

- Branch naming: `feature/<short-name>`, e.g. `feature/jelly-moss-wobble`, `feature/wasm-allocator`.
- Each feature PR should include demo screenshots, perf notes, and at least one Playwright-based integration test when relevant.
- Follow this priority flow: prototyping small shader & mechanic -> unit test -> integration -> performance profile -> merging.

---

## Small Milestones
1. Milestone A: Shaders & wasm allocator (2-3 days)
2. Milestone B: Void Root Ball & Solar Sail (3-5 days)
3. Milestone C: Large-scale objects & whales (5-8 days) + perf work for instancing

---

## Notes & TODOs (Action Items for Jules)
- [ ] Add `watch:wasm` script, rebuild on assembly changes during dev.
- [ ] Replace `particles.js` arrays with a ring buffer and tests for performance > 5k particles.
- [ ] Convert `SporeCloud` to instanced GPU particles.
- [ ] Implement `shaders/jelly-moss` as a `ShaderMaterial` prototype and add fallback.
- [ ] Implement WASM allocator: `allocObjects`, `freeObjects`, `getObjectPtr`—update JS memory writing to use these.
- [ ] Add `public/build/optimized.wat` copy if desired for dev debugging.

---

Use this file as a high-level roadmap to further decompose the remaining work into tickets and PRs.

If you want, I can now begin with a single step: (A) Add `watch:wasm` dev script and `predev` hook; (B) Convert `SporeCloud` to instanced spore system; or (C) Create `shaders/jelly-moss` GLSL prototype and a fallback. Choose one to start and I will implement it.
