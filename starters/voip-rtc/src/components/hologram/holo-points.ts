import * as THREE from "three";
import type { ViewDrawContext } from "../scene/view-registry.js";
import { FACE_CONTROL_KEYS } from "./face/controls.js";
import { HoloFigure, type HoloFrame, type HoloUniformMap } from "./holo-figure.js";
import { HOLO_FRAGMENT_SHADER, HOLO_VERTEX_SHADER } from "./holo-shaders.js";
import { getSharedFaceGeometry } from "./shared-geometry.js";

/** Three.js incarnation of the hologram lattice. The 30k-point geometry
    is built once and shared by every view; each view owns its own
    uniforms (mood/level/expression are per-instance). */

let sharedGeometry: THREE.BufferGeometry | null = null;

export function getSharedHoloGeometry(): THREE.BufferGeometry {
  if (!sharedGeometry) {
    const face = getSharedFaceGeometry();
    sharedGeometry = new THREE.BufferGeometry();
    sharedGeometry.setAttribute("position", new THREE.BufferAttribute(face.positions, 3));
    sharedGeometry.setAttribute("aAux", new THREE.BufferAttribute(face.aux, 4));
    sharedGeometry.setAttribute("aAux2", new THREE.BufferAttribute(face.aux2, 4));
    sharedGeometry.setAttribute("aScale", new THREE.BufferAttribute(face.scale, 1));
    sharedGeometry.setAttribute("aBrow", new THREE.BufferAttribute(face.brow, 1));
  }
  return sharedGeometry;
}

export function createHoloUniforms(): HoloUniformMap {
  return {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uGlitch: { value: 0 },
    uEcho: { value: 0 },
    uMood: { value: 0 },
    uPresence: { value: 1 },
    uGaze: { value: new THREE.Vector2(0, 0) },
    uMirror: { value: 0 },
    uCtrl: { value: new Float32Array(FACE_CONTROL_KEYS.length) },
  };
}

/** A pass material shares every dynamic uniform OBJECT with its siblings
    but owns uMirror/uEcho — so the RTC trio can render mirror/echo/main
    as three Points in one scene while a single HoloFigure.update drives
    them all. Legacy blend was gl.blendFunc(ONE, ONE) on premultiplied
    output — CustomBlending reproduces it exactly (AdditiveBlending would
    give SRC_ALPHA/ONE and brighten everything twice). */
export function createHoloPassMaterial(
  uniforms: HoloUniformMap,
  pass: { mirror: number; echo: number },
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: HOLO_VERTEX_SHADER,
    fragmentShader: HOLO_FRAGMENT_SHADER,
    uniforms: {
      ...(uniforms as unknown as Record<string, THREE.IUniform>),
      uMirror: { value: pass.mirror },
      uEcho: { value: pass.echo },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
}

export interface HoloViewHandle {
  draw(context: ViewDrawContext, frame: HoloFrame): void;
  dispose(): void;
}

export function createHoloView(seed?: number): HoloViewHandle {
  const uniforms = createHoloUniforms();
  const material = createHoloPassMaterial(uniforms, { mirror: 0, echo: 0 });
  const passUniforms = material.uniforms; /* own uMirror/uEcho live here */
  const points = new THREE.Points(getSharedHoloGeometry(), material);
  points.frustumCulled = false; /* gl_Position is computed in the shader */
  const scene = new THREE.Scene();
  scene.add(points);
  /* the shader emits clip space directly; any camera satisfies three */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const figure = new HoloFigure(seed);

  return {
    draw(context, frame) {
      figure.update(frame, uniforms, context.size);
      const renderer = context.renderer;
      /* the reflection is drawn first so the figure reads above it */
      if (frame.mirror) {
        passUniforms.uMirror.value = 1;
        passUniforms.uEcho.value = 0;
        renderer.render(scene, camera);
      }
      passUniforms.uMirror.value = 0;
      passUniforms.uEcho.value = 1;
      renderer.render(scene, camera);
      passUniforms.uEcho.value = 0;
      renderer.render(scene, camera);
    },
    dispose() {
      material.dispose(); /* geometry is shared — never disposed here */
    },
  };
}
