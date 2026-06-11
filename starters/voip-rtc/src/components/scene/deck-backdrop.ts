import * as THREE from "three";
import { createAtmosphereField } from "./atmosphere-field.js";
import { createAtmosphereVolume } from "./atmosphere-volume.js";
import type { BackdropScene } from "./backdrop-scene.js";

/** Assembles the persistent deck backdrop: volume wash below, dust
    field above, driven each frame by the eased deck state. */
export function createDeckBackdrop(): BackdropScene {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const layers = [createAtmosphereVolume(), createAtmosphereField()];
  for (const layer of layers) scene.add(layer.object);
  return {
    scene,
    camera,
    update(timeMs, deck, palette, pointer) {
      for (const layer of layers) layer.update(timeMs, deck, palette, pointer);
    },
    dispose() {
      for (const layer of layers) layer.dispose();
    },
  };
}
