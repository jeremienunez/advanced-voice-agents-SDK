import * as THREE from "three";
import { HoloFigure, type HoloFrame } from "../../../components/hologram/holo-figure.js";
import {
  createHoloPassMaterial,
  createHoloUniforms,
  getSharedHoloGeometry,
} from "../../../components/hologram/holo-points.js";
import { createProjectorCone, createStageFloor, type StageProp } from "./rtc-stage-props.js";

/** The flagship scene: floor grid and projector cone behind, then the
    hologram as three Points sharing dynamic uniforms — mirror, echo,
    main in legacy draw order — so one composer RenderPass captures
    every pass for post-processing. */
export interface RtcStageScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  update(frame: HoloFrame, size: { width: number; height: number }): void;
  dispose(): void;
}

export function createRtcStageScene(seed?: number): RtcStageScene {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const props: StageProp[] = [createStageFloor(), createProjectorCone()];
  for (const prop of props) scene.add(prop.object);

  const uniforms = createHoloUniforms();
  const figure = new HoloFigure(seed);
  const passes = [
    { pass: { mirror: 1, echo: 0 }, order: 1 },
    { pass: { mirror: 0, echo: 1 }, order: 2 },
    { pass: { mirror: 0, echo: 0 }, order: 3 },
  ].map(({ pass, order }) => {
    const material = createHoloPassMaterial(uniforms, pass);
    const points = new THREE.Points(getSharedHoloGeometry(), material);
    points.frustumCulled = false;
    points.renderOrder = order;
    scene.add(points);
    return material;
  });

  return {
    scene,
    camera,
    update(frame, size) {
      figure.update(frame, uniforms, size);
      for (const prop of props) prop.update(frame.timeMs, frame.level, size);
    },
    dispose() {
      for (const prop of props) prop.dispose();
      for (const material of passes) material.dispose();
    },
  };
}
