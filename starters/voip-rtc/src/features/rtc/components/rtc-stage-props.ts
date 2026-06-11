import * as THREE from "three";

/** Floor grid + volumetric projector cone for the RTC stage, projected
    with the same pseudo-camera as the hologram head so reflection,
    grid, and cone share one space. Fixed projector palette by design
    (the RTC theater is theme-independent, like the legacy CSS floor).
    Props emit a real w component (-q.z) so varyings interpolate
    perspective-correct across the quads. */

const PROJECT_GLSL = `
uniform vec2 uRes;
vec4 stageProject(vec3 p){
  /* must mirror the hologram camera in holo-shaders.ts exactly */
  vec3 q = p - vec3(0., .06, 3.1);
  float w = -q.z;
  return vec4(q.x*2.25*(uRes.y/uRes.x), q.y*2.25, 0., w);
}`;

const FLOOR_VERTEX = `
varying vec2 vWorld;
${PROJECT_GLSL}
void main(){
  vWorld = position.xz;
  gl_Position = stageProject(vec3(position.x, -1.28, position.z));
}`;

const FLOOR_FRAGMENT = `
uniform float uTime, uLevel;
varying vec2 vWorld;
void main(){
  /* grid lines, AA'd with fwidth, fading away from the figure */
  vec2 cell = abs(fract(vWorld/.24-.5)-.5)/fwidth(vWorld/.24);
  float line = 1.-min(min(cell.x,cell.y),1.);
  float dist = length(vWorld);
  float fade = exp(-dist*1.15);
  float pulse = .8 + .2*sin(uTime*1.1 - dist*2.4);
  float a = line*fade*pulse*(.16+.3*uLevel);
  vec3 col = vec3(.30,.76,1.); /* projector cyan, theme-independent */
  gl_FragColor = vec4(col*a, a);
}`;

const CONE_VERTEX = `
varying vec2 vUv;
${PROJECT_GLSL}
void main(){
  vUv = uv;
  /* a trapezoid from a tight apex above the head to a wide base under it */
  float spread = mix(.08, .95, 1.-uv.y);
  vec3 world = vec3((uv.x-.5)*2.*spread, mix(-1.28, 1.5, uv.y), 0.);
  gl_Position = stageProject(world);
}`;

const CONE_FRAGMENT = `
uniform float uTime, uLevel;
varying vec2 vUv;
void main(){
  float edge = smoothstep(.5, .12, abs(vUv.x-.5));          /* soft sides  */
  float fall = smoothstep(1., .15, vUv.y) * smoothstep(.0, .25, vUv.y);
  float shimmer = .85 + .15*sin(uTime*2.3 + vUv.y*14.);
  float a = edge*fall*shimmer*(.05+.10*uLevel);
  vec3 col = vec3(.30,.76,1.);
  gl_FragColor = vec4(col*a, a);
}`;

export interface StageProp {
  readonly object: THREE.Object3D;
  update(timeMs: number, level: number, size: { width: number; height: number }): void;
  dispose(): void;
}

export function createStageFloor(): StageProp {
  /* xz plane patch in head space; z stays well below the eye at 2.15 */
  const geometry = new THREE.PlaneGeometry(5.4, 3.2, 1, 1);
  geometry.rotateX(-Math.PI / 2); /* xy plane -> xz plane */
  return makeProp(geometry, FLOOR_VERTEX, FLOOR_FRAGMENT, -3);
}

export function createProjectorCone(): StageProp {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 8);
  geometry.translate(0.5, 0.5, 0); /* uv-aligned unit quad */
  return makeProp(geometry, CONE_VERTEX, CONE_FRAGMENT, -2);
}

function makeProp(
  geometry: THREE.BufferGeometry,
  vertexShader: string,
  fragmentShader: string,
  renderOrder: number,
): StageProp {
  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return {
    object: mesh,
    update(timeMs, level, size) {
      uniforms.uTime.value = timeMs * 0.001;
      uniforms.uLevel.value = level;
      uniforms.uRes.value.set(size.width, size.height);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
