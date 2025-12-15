/**
 * Watch for changes in the assembly directory and automatically rebuild WASM.
 * Usage: node scripts/watch-wasm.js
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const assemblyDir = path.join(__dirname, '..', 'assembly');

function rebuild() {
    console.log('[watch:wasm] Rebuilding...');
    try {
        execSync('npm run build:wasm && npm run copy:wasm', { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        console.log('[watch:wasm] Done.');
    } catch (e) {
        console.error('[watch:wasm] Build failed.');
    }
}

// Initial build
rebuild();

// Watch for changes
console.log('[watch:wasm] Watching for changes in assembly/...');
fs.watch(assemblyDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.ts')) {
        console.log('[watch:wasm] Detected change in', filename);
        rebuild();
    }
});
