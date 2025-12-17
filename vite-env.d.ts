/// <reference types="vite/client" />

declare module 'three/examples/jsm/capabilities/WebGPU.js' {
  const WebGPU: {
    isAvailable: () => boolean;
    getErrorMessage: () => HTMLElement;
  };
  export default WebGPU;
}

declare module 'three/webgpu' {
    export * from 'three';
    import { WebGLRenderer, WebGLRendererParameters, MeshStandardMaterial, PointsMaterial, MeshBasicMaterial } from 'three';

    // Minimal mock for WebGPURenderer as it's not in standard @types/three yet or might differ
    export class WebGPURenderer extends WebGLRenderer {
        constructor(parameters?: WebGLRendererParameters);
    }

    // Node materials (often just extended versions or using node logic)
    export class MeshBasicNodeMaterial extends MeshBasicMaterial {
        colorNode?: any;
        positionNode?: any;
    }

    export class PointsNodeMaterial extends PointsMaterial {
        colorNode?: any;
        positionNode?: any;
        sizeNode?: any;
    }

    export class MeshStandardNodeMaterial extends MeshStandardMaterial {
        colorNode?: any;
        positionNode?: any;
        emissiveNode?: any;
        roughnessNode?: any;
        metalnessNode?: any;
    }
}
