import type { FaceGeometry } from "./face-geometry.js";
import { blinkAmount, clamp01, moodExpression } from "./holo-motion.js";

/**
 * WebGL point-sprite renderer for the hologram bust. Owns GL state only;
 * everything it draws comes in through HoloFrame each frame.
 *
 * Moods map the RTC session state onto the cloud:
 *   0 idle · 1 listening · 2 speaking · 3 muted
 */

export interface HoloFrame {
  readonly timeMs: number;
  readonly level: number;
  readonly mood: 0 | 1 | 2 | 3;
  /** 0..1 — how assembled the figure is. Below 1 the cloud scatters;
      the builder uses this to materialize the agent step by step. */
  readonly presence?: number;
  /** -1..1 on both axes — the bust turns toward the pointer. */
  readonly gaze?: { readonly x: number; readonly y: number };
  /** Draw a faded reflection below the bust, as if projected on glass. */
  readonly mirror?: boolean;
}

/* uLight-style precision traps: every uniform shared by both stages is
   declared `mediump` explicitly so the program links on every GPU. */
const VERTEX_SHADER = `
attribute vec3 aPos; attribute vec4 aAux; attribute vec4 aAux2;
uniform vec2 uRes;
uniform vec2 uGaze;
uniform vec4 uExpr; /* smile, widen, bow, tilt — eased mood expression */
uniform float uTime,uLevel,uBlink,uGlitch,uEcho,uPresence,uMirror;
uniform mediump float uMood;
varying vec3 vCol; varying float vA;

vec3 moodTint(vec3 base, float mood){
  vec3 listen = vec3(.55,.95,.85);
  vec3 speak  = vec3(1.05,.9,.8);
  vec3 mute   = vec3(.55,.5,.55);
  if(mood>2.5) return base*mute;
  if(mood>1.5) return base*speak;
  if(mood>0.5) return base*listen;
  return base;
}

void main(){
  vec3 p=aPos;
  float jaw=aAux.x, hair=aAux.y, warm=aAux.z, rnd=aAux.w;
  float eye=aAux2.x, shade=aAux2.y, bust=aAux2.z, iris=aAux2.w;
  float talk=uLevel;

  /* materialization: below full presence the cloud drifts apart and
     converges as the agent takes shape */
  float scatter = 1. - uPresence;
  p += vec3(sin(rnd*97.+uTime*.5), cos(rnd*57.-uTime*.4), sin(rnd*31.+uTime*.3))
       * scatter * scatter * (.55 + .45*rnd);

  /* murmur: the jaw drops and the lips tremble with the voice */
  p.y -= jaw*talk*.12;
  p.y += jaw*sin(uTime*33.+rnd*24.)*talk*.02;
  p.z += jaw*sin(uTime*26.+rnd*13.)*talk*.011;
  /* micro-expressions: mouth corners and lids follow the mood */
  p.y += jaw*smoothstep(.05,.16,abs(aPos.x))*uExpr.x*.05;
  p.y += (p.y - .12)*eye*uExpr.y*.22;
  /* blink: the socket lattice squeezes onto the lid line */
  p.y += (.12 - p.y)*uBlink*eye*.85;
  /* the eyes lead the head toward the pointer */
  p.x += uGaze.x*eye*.018;
  p.y += uGaze.y*eye*.012;
  /* whisper ripple + hair drift + breath */
  p.x += sin(p.y*6.5-uTime*2.2)*.005*(.2+talk);
  p.x += sin(uTime*1.15+rnd*40.)*hair*.012;
  p.y += cos(uTime*.85+rnd*30.)*hair*.01;
  p *= .95 + .01*sin(uTime*.7);
  p.y += .10;

  /* slow presence sway plus the head turning toward the pointer */
  float yaw = sin(uTime*.18)*.09 + uGaze.x*.30;
  float cy=cos(yaw), sy=sin(yaw);
  p = vec3(p.x*cy+p.z*sy, p.y, -p.x*sy+p.z*cy);
  /* pitch: pointer height, minus the muted bow */
  float pit = uGaze.y*.14 - uExpr.z*.12;
  float cp=cos(pit), sp=sin(pit);
  float py0 = p.y - .26;
  p = vec3(p.x, py0*cp - p.z*sp + .26, py0*sp + p.z*cp);
  /* attentive roll toward one shoulder while listening */
  float rol = uExpr.w*.08;
  float cl=cos(rol), sl=sin(rol);
  py0 = p.y - .26;
  p = vec3(p.x*cl - py0*sl, p.x*sl + py0*cl + .26, p.z);
  p.x += uEcho*.018;

  /* glass-floor reflection: flip below the head base, fade with height */
  float mirrorFade = 1.;
  if(uMirror > .5){
    float h = max(p.y + .78, 0.);
    p.y = -1.56 - p.y;
    mirrorFade = .30*exp(-h*2.4);
  }

  float band = step(.985, fract(aPos.y*1.6 + uTime*.4));
  p.x += uGlitch*band*.07;

  /* close camera: strong perspective bows the lattice rows around the
     features — that curvature is what makes the head read in 3D */
  vec3 q = p - vec3(0., .06, 2.15);
  float persp = 1.5 / -q.z;
  vec2 scr = q.xy * persp;
  scr.x *= uRes.y/uRes.x;
  gl_Position = vec4(scr, 0., 1.);
  /* uniform lattice dots: size barely varies, the order is the point */
  gl_PointSize = (2.0 + 3.0*persp) * (1. + .1*rnd) * (1. + .25*iris);

  /* scan sweep */
  float scanY = fract(uTime*.05)*3.4-1.9;
  float scan = smoothstep(.12,.0,abs(aPos.y-scanY));

  /* palette: white-cyan lattice, gentle warmth on the face, lit irises */
  vec3 cool = mix(vec3(.55,.85,1.), vec3(.62,.56,1.), .3+.4*rnd+.2*sin(aPos.y*2.5+rnd*4.));
  vec3 skin = vec3(1.,.78,.66);
  vec3 col = mix(cool, skin, warm*.4);
  col = mix(col, vec3(.55,.95,1.), iris);
  col = moodTint(col, uMood);
  /* linear relief: sockets sleep, nose / brow / lips catch the light */
  col *= .12 + 1.25*shade;

  /* calm breathing, no per-point strobe: a lattice should feel stable */
  float fl=.85+.15*sin(uTime*1.7+rnd*6.28);
  float a=(.62+.2*fl)*(.78+.22*talk);
  a = max(a, iris*.5);
  a *= mix(1.,.25,uEcho);
  a *= bust;                       /* projector fade at the base   */
  a *= mix(.18, 1., uPresence);    /* faint until materialized     */
  a *= 1.-uBlink*iris;             /* iris hides behind the lid    */
  if(uMood>2.5) a*=.45;            /* muted: the figure recedes    */
  a += scan*.3*(1.-uMirror);
  a *= mirrorFade;
  vCol = col*(1.+scan*.8);
  vA = min(a,1.);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vCol; varying float vA;
void main(){
  float d=length(gl_PointCoord-.5);
  float a=smoothstep(.5,.1,d)*vA;
  gl_FragColor=vec4(vCol*a, a);
}`;

export class HoloRenderer {
  private readonly gl: WebGLRenderingContext | null;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly count: number;
  private glitch = 0;
  private glitchSeed = 1;
  /* eased mood expression: state changes morph, they never snap */
  private readonly expr = { smile: 0, widen: 0, bow: 0, tilt: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    geometry: FaceGeometry,
    onFailure: (reason: string) => void,
  ) {
    this.count = geometry.count;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      this.gl = null;
      onFailure("webgl unavailable");
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      this.gl = null;
      onFailure("program allocation failed");
      return;
    }
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      this.gl = null;
      onFailure(gl.getProgramInfoLog(program) ?? "shader link failed");
      return;
    }
    gl.useProgram(program);

    bindAttribute(gl, program, "aPos", geometry.positions, 3);
    bindAttribute(gl, program, "aAux", geometry.aux, 4);
    bindAttribute(gl, program, "aAux2", geometry.aux2, 4);
    for (const name of ["uRes", "uTime", "uLevel", "uBlink", "uGlitch", "uEcho", "uMood", "uPresence", "uGaze", "uMirror", "uExpr"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); /* additive on the dark stage */
    gl.clearColor(0, 0, 0, 0);
    this.gl = gl;
  }

  get available(): boolean {
    return this.gl !== null;
  }

  render(frame: HoloFrame): void {
    const gl = this.gl;
    if (!gl) return;
    this.resize();

    /* deterministic-enough glitch pulses, seeded per instance */
    this.glitchSeed = (this.glitchSeed * 16807) % 2147483647;
    if (this.glitchSeed / 2147483647 < 0.012) {
      this.glitch = (this.glitchSeed / 2147483647) * 2 - 1;
    }
    this.glitch *= 0.86;

    const u = this.uniforms;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, frame.timeMs * 0.001);
    gl.uniform1f(u.uLevel, frame.level);
    gl.uniform1f(u.uBlink, blinkAmount(frame.timeMs));
    gl.uniform1f(u.uGlitch, this.glitch);
    gl.uniform1f(u.uMood, frame.mood);
    gl.uniform1f(u.uPresence, clamp01(frame.presence ?? 1));
    gl.uniform2f(u.uGaze, frame.gaze?.x ?? 0, frame.gaze?.y ?? 0);

    const target = moodExpression(frame.mood);
    this.expr.smile += (target.smile - this.expr.smile) * 0.04;
    this.expr.widen += (target.widen - this.expr.widen) * 0.04;
    this.expr.bow += (target.bow - this.expr.bow) * 0.04;
    this.expr.tilt += (target.tilt - this.expr.tilt) * 0.04;
    gl.uniform4f(u.uExpr, this.expr.smile, this.expr.widen, this.expr.bow, this.expr.tilt);

    /* the reflection is drawn first so the figure reads above it */
    if (frame.mirror) {
      gl.uniform1f(u.uMirror, 1);
      gl.uniform1f(u.uEcho, 0);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }
    gl.uniform1f(u.uMirror, 0);
    gl.uniform1f(u.uEcho, 1);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.uniform1f(u.uEcho, 0);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  private resize(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = (this.canvas.clientWidth * dpr) | 0;
    const h = (this.canvas.clientHeight * dpr) | 0;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl?.viewport(0, 0, w, h);
    }
  }
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function bindAttribute(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  data: Float32Array,
  size: number,
): void {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}
