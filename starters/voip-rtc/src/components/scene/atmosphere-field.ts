import * as THREE from "three";
import type { DeckState } from "./mode-director.js";
import type { ScenePalette } from "./scene-theme.js";

/** Drifting dust field for the deck backdrop: additive points in NDC
    space, depth-parallaxed toward the pointer, tinted by the live
    palette and pulled toward the mode anchor. */

const FIELD_VERTEX = `
attribute float aSeed;
uniform float uTime, uEnergy, uDrift, uDark;
uniform vec2 uPointer, uAnchor, uRes;
varying float vAlpha;
void main(){
  /* deterministic per-point home position from the seed */
  vec3 home = vec3(
    fract(aSeed*127.1)*2.-1.,
    fract(aSeed*311.7)*2.-1.,
    fract(aSeed*74.7));            /* z 0..1 = depth layer */
  /* slow drift, wrapped inside the box */
  vec2 drift = vec2(
    fract(home.x*.5+.5 + uTime*.004*uDrift*(.3+home.z)),
    fract(home.y*.5+.5 + uTime*.0027*uDrift*(.3+fract(aSeed*43.7))));
  vec2 pos = drift*2.-1.;
  /* pointer parallax: deep layers move less */
  pos += uPointer * (home.z - .5) * .05;
  float aspect = uRes.x / uRes.y;
  /* anchor pull on brightness, not position: the deck glows where the
     mode wants the eye */
  vec2 anchorNdc = vec2(uAnchor.x*2.-1., 1.-uAnchor.y*2.);
  float near = exp(-length((pos-anchorNdc)*vec2(aspect,1.))*1.6);
  float tw = .75 + .25*sin(uTime*(.4+home.z) + aSeed*40.);
  vAlpha = (0.05 + .5*near) * uEnergy * tw * mix(.5, 1., uDark);
  gl_Position = vec4(pos, 0., 1.);
  gl_PointSize = (1.0 + 2.2*home.z) * (1. + near);
}`;

const FIELD_FRAGMENT = `
uniform vec3 uTint;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord-.5);
  float a = smoothstep(.5,.05,d)*vAlpha;
  gl_FragColor = vec4(uTint*a, a);
}`;

export interface AtmosphereLayer {
  readonly object: THREE.Object3D;
  update(timeMs: number, deck: DeckState, palette: ScenePalette, pointer: { x: number; y: number }): void;
  dispose(): void;
}

export function createAtmosphereField(): AtmosphereLayer {
  const count = matchMediaSafe("(max-width: 760px)") ? 900 : 2400;
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = ((i + 1) * 0.61803398875) % 1;
  const geometry = new THREE.BufferGeometry();
  /* position is unused by the shader but three needs it for draw count */
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uDrift: { value: 0 },
    uDark: { value: 1 },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uAnchor: { value: new THREE.Vector2(0.5, 0.5) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTint: { value: new THREE.Vector3(0.3, 0.76, 1) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: FIELD_VERTEX,
    fragmentShader: FIELD_FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    object: points,
    update(timeMs, deck, palette, pointer) {
      uniforms.uTime.value = timeMs * 0.001;
      uniforms.uEnergy.value = deck.energy;
      uniforms.uDrift.value = deck.drift;
      uniforms.uDark.value = palette.dark ? 1 : 0;
      uniforms.uPointer.value.set(pointer.x, -pointer.y);
      uniforms.uAnchor.value.set(deck.anchorX, deck.anchorY);
      uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
      const tint = mixTriplet(palette.action, palette.success, deck.hue);
      uniforms.uTint.value.set(tint[0], tint[1], tint[2]);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function mixTriplet(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function matchMediaSafe(query: string): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches;
}
