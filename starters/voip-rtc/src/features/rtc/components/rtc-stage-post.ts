import type { Camera, Scene, WebGLRenderer } from "three";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from "postprocessing";

/** Flagship post stack, merged into a single fullscreen pass by pmndrs:
    selective-threshold bloom (additive points blow out otherwise),
    chromatic aberration, film grain, vignette. RTC-only by design. */
export interface RtcStagePost {
  render(deltaSeconds: number): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export function createRtcStagePost(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
): RtcStagePost {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: 0.5,
    luminanceThreshold: 0.45,
    luminanceSmoothing: 0.18,
    mipmapBlur: true,
    resolutionScale: 0.5,
  });
  const aberration = new ChromaticAberrationEffect();
  aberration.offset.set(0.0011, 0.0006);
  const grain = new NoiseEffect({ premultiply: true });
  grain.blendMode.opacity.value = 0.16;
  const vignette = new VignetteEffect({ offset: 0.26, darkness: 0.52 });

  composer.addPass(new EffectPass(camera, bloom, aberration, grain, vignette));

  return {
    render(deltaSeconds) {
      composer.render(deltaSeconds);
    },
    setSize(width, height) {
      composer.setSize(width, height);
    },
    dispose() {
      composer.dispose();
    },
  };
}
