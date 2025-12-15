# Game World Design Plan

This document captures the design ideas for alien flora, geological objects, artifacts, visual shaders, and system behaviors to implement in Dog Dash.

**I. Alien Flora (Space Plants)**

## Nebula Jelly-Moss

- Description:
  - Spheres range from 2m to 50m diameter. Gelatinous membrane with fractal moss inside.
  - Membrane is semi-permeable — projectiles pass through with 50% speed reduction.
  - Physical contact stretches membrane, rebounds; moss pulses on a 3s cycle, brightness indicating "health".
  - Destroyed: collapses and releases spore burst illuminating hidden paths.
- Gameplay Mechanics:
  - Hide in smaller specimens for stealth; moss leeches shield energy slowly.
  - Shooting core moss weak point yields Bioluminescent Extract crafting material.
- Visual Design:
  - Layered transparency + wobble vertex shader on membrane.
  - Fractal moss with counter-rotation for parallax effect.
- Behavior:
  - Sine-wave drifting and pulsing. When disturbed, accelerate and contract membrane 30% to become briefly invulnerable.
- Audio:
  - Subtle whale-song harmonics, pitch shifts with proximity.

## Solar Sails / Light Leaves

- Description:
  - 5-12 leaves, 10-20m long, attached to a small crystalline pod. Thin films catching solar wind.
- Gameplay Mechanics:
  - Deploy "Solar Sail" item to ride wind; overlapping provides 2x speed boost.
  - Touching unfolding leaves causes ship to be wrapped and blinded.
- Visual Design:
  - Thin-film interference shader for iridescence, rippling leaves.
- Behavior:
  - Unfold when near star/light source; if multiple overlap, they compete for light.
- Audio:
  - Gentle chime scale on unfold.

## Void Root Balls

- Description:
  - Tangled petrified roots sphere, 5-15m across, with barbs and harpoons.
- Gameplay:
  - Launch harpoon roots at nearby asteroids; anchoring begins crystal spike growth.
  - Crystal flowers harvestable for Void Gems; roots are indestructible hazards.
- Visual:
  - Parallax textures on roots, growing crystal spikes with telescoping unfold.
- Behavior:
  - Drift mode rotates slowly. Anchor mode becomes aggressive; after 30s it withers.
- Audio:
  - Deep creaks, glassy chimes during crystal growth.

## Star-Eater Pitchers

- Description:
  - Large funnel organisms with glass teeth and plasma interior. Maintain geosynchronous star orbit.
- Gameplay:
  - Mouth pulls ship (5 m/s²). Feed it scrap to overload digestion for 10s.
  - Destroying causes supernova explosion damaging within 150m radius.
- Visual/Behavior:
  - Swirling shader, teeth glinting like disco-ball, harmonic resonances across nearby pitchers.
- Audio:
  - Low drone rising to shriek on snap.

## Spore Clouds

- Description:
  - Clouds with 500-2000 independent spores with glowing cores and electromagnetic attraction.
- Gameplay:
  - Shooting triggers chain reaction; collect spores for crafting; inhalation causes HUD glitch.
- Visual:
  - Billboard sprite with glow; chain reaction wave of emissive intensity.
- Behavior:
  - Brownian motion with cohesive drift; dispersal and regroup mechanics.
- Audio:
  - Rustling, crystalline ping cascade on chain reaction.

## Vacuum Kelp

- Description:
  - Long ribbon-like strands (50-200m) creating moving tunnels. Leaves are solar panels.
- Gameplay:
  - Slows ship by 70% on contact, drains energy. Sever nodes to clear paths and harvest rare drops.
- Visual:
  - Segmented rope physics, flowing texture, node pulse.
- Behavior:
  - Phase-offset sine waves across clusters; flinch when neighbors are cut.
- Audio:
  - Deep whale-like moans.

**II. Geological & Crystalline Objects**

## Fractured Geodes

- Key features and behaviors: CRYSTAL HUM, EM FIELD, harvesting, interior safe harbor, "Storm Geodes".
- Visuals: Amethyst crystals, chromatic shards, EM arcing shader.

## Liquid Metal Blobs

- Mirror shader, split & recombine behaviors, metal creep hazards.

## Ice Needles

- Needle shards, frost refractive edges, super-bleed dmg, thermal/hot exhaust interactions.

## Magma Hearts

- Crust & lava interior, eruption cycles, particle globs & pyroclast ore.

**III. Artifacts & Anomalies**

## Derelict Buoys

- Tetrahedron beacons, morse-code pulses for coordinates, vines and data-dock mechanics.

## Grav-Lenses

- Glass spheres with embedded singularity, gravitational slingshots, shatter disaster micro-black hole.

## Data Monoliths

- Obsidian rotating slabs with glowing cyan circuitry and hacking mini-game.

## Fossilized Space Whales

- Level-scale geometry, barnacles for lore/hud, memory fog & rails to grind.

**IV. Visual / Shader-Friendly Ideas**

- Chroma-Shift Rocks: distance-driven fragment shader color shift and vulnerability reveals.
- Ghost Debris: dithering glitching shader; phase-shift mechanic.

---

Notes & Implementation Priorities:

1. Implement shader prototypes: wobble membranes (Nebula Jelly-Moss), thin-film iridescence (Solar Sails), flow maps (Magma), Fresnel for ice needles.
2. Gameplay prototypes: harvest/loot interactions (e.g., Void Gems), environmental hazards (spore clouds), solar winds for movement.
3. Asset batching & performance: instanced/multi-material systems for large fields (spore cloud, kelp) and LOD for huge whales.
4. Audio design: create lightweight FM-synthesis patches for procedural plants (whale-moss, Solar Sails chimes).

This design doc can be used to derive more concrete tasks and dev tickets.