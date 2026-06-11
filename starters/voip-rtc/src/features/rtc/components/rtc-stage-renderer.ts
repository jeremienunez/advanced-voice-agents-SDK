import * as THREE from "three";

/** Dedicated renderer for the RTC hero canvas. Returns null when WebGL
    is unavailable so the orb can show its error caption, like the
    legacy renderer's onFailure path. */
export function createRtcStageRenderer(
  canvas: HTMLCanvasElement,
): THREE.WebGLRenderer | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    return renderer;
  } catch {
    return null;
  }
}

/** Keeps the drawing buffer matched to the element's CSS size. */
export function syncRendererSize(renderer: THREE.WebGLRenderer): void {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = renderer.getPixelRatio();
  if (canvas.width !== ((width * ratio) | 0) || canvas.height !== ((height * ratio) | 0)) {
    renderer.setSize(width, height, false);
  }
}
