import type { Camera, Scene } from "three";
import type { DeckState } from "./mode-director.js";
import type { ScenePalette } from "./scene-theme.js";

/** A backdrop implementation owns its scene/camera; the engine drives it
    with the eased deck state, live palette, and pointer parallax. */
export interface BackdropScene {
  readonly scene: Scene;
  readonly camera: Camera;
  update(
    timeMs: number,
    deck: DeckState,
    palette: ScenePalette,
    pointer: { readonly x: number; readonly y: number },
  ): void;
  dispose(): void;
}
