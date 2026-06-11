import * as THREE from "three";
import type { AtmosphereLayer } from "./atmosphere-field.js";
import type { DeckState } from "./mode-director.js";
import type { ScenePalette } from "./scene-theme.js";

/** One fullscreen additive quad: a soft radial glow at the deck anchor,
    three slow procedural light shafts above it, and a horizon grade.
    Cheap (single draw), and it is what makes the glass chrome read as
    glass — the sidebar/topbar backdrop-filter blurs this live wash. */

const VOLUME_VERTEX = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0., 1.);
}`;

const VOLUME_FRAGMENT = `
uniform float uTime, uEnergy, uDark, uHue;
uniform vec2 uAnchor, uRes;
uniform vec3 uTintA, uTintB;
varying vec2 vUv;
void main(){
  float aspect = uRes.x/uRes.y;
  vec2 p = vec2(vUv.x*aspect, vUv.y);
  vec2 anchor = vec2(uAnchor.x*aspect, 1.-uAnchor.y);
  vec3 tint = mix(uTintA, uTintB, uHue);

  /* anchor glow */
  float glow = exp(-length(p-anchor)*2.1) * .5;
  /* three slow shafts falling from above the anchor */
  float shafts = 0.;
  for(int i=0;i<3;i++){
    float fi = float(i);
    float cx = anchor.x + sin(uTime*.05+fi*2.1)*.18 + (fi-1.)*.14;
    float w = .035 + .02*fi;
    float band = smoothstep(w, 0., abs(p.x-cx));
    float fall = smoothstep(anchor.y+.9, anchor.y-.1, vUv.y);
    shafts += band * fall * (.16 + .08*sin(uTime*.3+fi*1.7));
  }
  /* horizon grade pinning the deck floor */
  float horizon = smoothstep(.55, 0., vUv.y) * .22;

  float strength = (glow + shafts + horizon) * uEnergy * mix(.35, 1., uDark);
  vec3 col = tint * strength;
  gl_FragColor = vec4(col, strength);
}`;

export function createAtmosphereVolume(): AtmosphereLayer {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uDark: { value: 1 },
    uHue: { value: 0 },
    uAnchor: { value: new THREE.Vector2(0.5, 0.5) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTintA: { value: new THREE.Vector3(0.3, 0.76, 1) },
    uTintB: { value: new THREE.Vector3(0.23, 0.82, 0.6) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VOLUME_VERTEX,
    fragmentShader: VOLUME_FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1; /* wash first, dust on top */

  return {
    object: mesh,
    update(timeMs, deck: DeckState, palette: ScenePalette) {
      uniforms.uTime.value = timeMs * 0.001;
      uniforms.uEnergy.value = deck.energy;
      uniforms.uDark.value = palette.dark ? 1 : 0;
      uniforms.uHue.value = deck.hue;
      uniforms.uAnchor.value.set(deck.anchorX, deck.anchorY);
      uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
      uniforms.uTintA.value.set(palette.action[0], palette.action[1], palette.action[2]);
      uniforms.uTintB.value.set(palette.success[0], palette.success[1], palette.success[2]);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
