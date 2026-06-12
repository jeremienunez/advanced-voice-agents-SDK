/** GLSL for the hologram point lattice. The vertex shader does its own
    clip-space perspective (eye z≈3.1) — three's camera matrices are
    deliberately unused. Facial deformation is driven by the uCtrl[]
    array, one float per FaceControl, indices generated from
    FACE_CONTROL_KEYS so TS and GLSL share one source of truth. */

import { FACE_CONTROL_KEYS } from "./face/controls.js";

const CTRL_COUNT = FACE_CONTROL_KEYS.length;
const CTRL_DEFS = FACE_CONTROL_KEYS.map((key, i) => `#define C_${key} uCtrl[${i}]`).join("\n");

export const HOLO_VERTEX_SHADER = `
${CTRL_DEFS}
attribute vec4 aAux; attribute vec4 aAux2; attribute float aScale; attribute float aBrow;
uniform vec2 uRes;
uniform vec2 uGaze;
uniform float uCtrl[${CTRL_COUNT}];
uniform float uTime,uLevel,uGlitch,uEcho,uPresence,uMirror;
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
  vec3 p=position;
  float jaw=aAux.x, hair=aAux.y, warm=aAux.z, rnd=aAux.w;
  float eye=aAux2.x, shade=aAux2.y, bust=aAux2.z, iris=aAux2.w;
  float talk=uLevel;
  /* anatomical side select: x>0 carries the L channels */
  float left = step(0., position.x);

  /* materialization: below full presence the cloud drifts apart and
     converges as the agent takes shape */
  float scatter = 1. - uPresence;
  p += vec3(sin(rnd*97.+uTime*.5), cos(rnd*57.-uTime*.4), sin(rnd*31.+uTime*.3))
       * scatter * scatter * (.55 + .45*rnd);

  /* voice: the jaw drops with the audio envelope, lips tremble */
  p.y -= jaw*C_jawOpen*.12;
  p.y += jaw*sin(uTime*33.+rnd*24.)*talk*.02;
  p.z += jaw*sin(uTime*26.+rnd*13.)*talk*.011;
  /* sustained silence presses the lips toward the mouth line */
  p.y += (-.33 - p.y)*jaw*C_mouthClose*.08;
  /* funnel: the lips gather toward the mouth center */
  p.x -= position.x*jaw*C_mouthFunnel*.18;
  /* mouth corners: per-side smile lift / frown drop */
  float corner = jaw*smoothstep(.05,.16,abs(position.x));
  p.y += corner*(mix(C_mouthSmileR, C_mouthSmileL, left)
               - mix(C_mouthFrownR, C_mouthFrownL, left))*.07;
  /* lids: per-side stochastic blink + widen/squint posture */
  float lid = mix(C_eyeBlinkR, C_eyeBlinkL, left);
  p.y += (p.y - .12)*eye*C_eyeWiden*.22;
  p.y += (.12 - p.y)*eye*(lid*.85 + C_eyeSquint*.4);
  /* brows: inner/outer raise against the knit */
  float inner = 1.-smoothstep(.08,.28,abs(position.x));
  float browLift = inner*C_browInnerUp
                 + (1.-inner)*mix(C_browOuterUpR, C_browOuterUpL, left);
  p.y += aBrow*(browLift*.07 - C_browDown*.05);
  /* the eyes lead the head toward the pointer */
  p.x += uGaze.x*eye*.018;
  p.y += uGaze.y*eye*.012;
  /* whisper ripple + hair drift + breath (rig-driven, ≈0.25Hz) */
  p.x += sin(p.y*6.5-uTime*2.2)*.005*(.2+talk);
  p.x += sin(uTime*1.15+rnd*40.)*hair*.012;
  p.y += cos(uTime*.85+rnd*30.)*hair*.01;
  p *= .945 + .012*C_breath;
  p.y += .10;

  /* slow presence sway plus the head turning toward the pointer */
  float yaw = sin(uTime*.18)*.09 + uGaze.x*.30 + C_headYaw*.22;
  float cy=cos(yaw), sy=sin(yaw);
  p = vec3(p.x*cy+p.z*sy, p.y, -p.x*sy+p.z*cy);
  /* pitch: pointer height plus the rig posture (muted bow is negative) */
  float pit = uGaze.y*.14 + C_headPitch*.14;
  float cp=cos(pit), sp=sin(pit);
  float py0 = p.y - .26;
  p = vec3(p.x, py0*cp - p.z*sp + .26, py0*sp + p.z*cp);
  /* roll toward one shoulder (attentive listening) */
  float rol = C_headRoll*.08;
  float cl=cos(rol), sl=sin(rol);
  py0 = p.y - .26;
  p = vec3(p.x*cl - py0*sl, p.x*sl + py0*cl + .26, p.z);
  p.x += uEcho*.018;

  /* glass-floor reflection: flip below the bust base, fade with height */
  float mirrorFade = 1.;
  if(uMirror > .5){
    float h = max(p.y + 1.28, 0.);
    p.y = -2.56 - p.y;
    mirrorFade = .30*exp(-h*2.4);
  }

  float band = step(.985, fract(position.y*1.6 + uTime*.4));
  p.x += uGlitch*band*.07;

  /* moderate tele camera: enough perspective to bow the lattice rows
     in 3D, far enough that the face (z~.6) no longer balloons against
     the skull sides (z~0) — close-camera ratio read as a pinched
     cranium head-on */
  vec3 q = p - vec3(0., .06, 3.1);
  float persp = 2.25 / -q.z;
  vec2 scr = q.xy * persp;
  scr.x *= uRes.y/uRes.x;
  gl_Position = vec4(scr, 0., 1.);
  /* uniform lattice dots: size barely varies, the order is the point —
     the dense scan layer renders finer (aScale) so it doesn't blow out */
  gl_PointSize = (2.0 + 3.0*persp) * (1. + .1*rnd) * (1. + .25*iris) * aScale
               * (1. - hair*.3);

  /* scan sweep */
  float scanY = fract(uTime*.05)*3.4-1.9;
  float scan = smoothstep(.12,.0,abs(position.y-scanY));

  /* palette: white-cyan lattice, gentle warmth on the face, lit irises */
  vec3 cool = mix(vec3(.55,.85,1.), vec3(.62,.56,1.), .3+.4*rnd+.2*sin(position.y*2.5+rnd*4.));
  vec3 skin = vec3(1.,.78,.66);
  vec3 col = mix(cool, skin, warm*.4);
  col = mix(col, vec3(.55,.95,1.), iris);
  col = moodTint(col, uMood);
  /* linear relief: sockets sleep, nose / brow / lips catch the light */
  col *= .12 + 1.25*shade;
  /* the mouth glows with the voice */
  col *= 1. + jaw*C_glowMouth*.45;

  /* calm breathing, no per-point strobe: a lattice should feel stable */
  float fl=.85+.15*sin(uTime*1.7+rnd*6.28);
  float a=(.62+.2*fl)*(.78+.22*talk);
  /* the scan layer is ~16x denser than the lattice: rein in additive
     accumulation so the face glows instead of blowing out */
  a *= mix(.32, 1., step(.99, aScale));
  /* dark hair: the structural lattice runs hot next to the reined-in
     face — without this the crown reads as a glowing swim cap */
  a *= 1. - hair*.55;
  a = max(a, iris*.5);
  a *= mix(1.,.25,uEcho);
  a *= bust;                       /* projector fade at the base   */
  a *= mix(.18, 1., uPresence);    /* faint until materialized     */
  a *= 1.-lid*iris;                /* iris hides behind the lid    */
  if(uMood>2.5) a*=.45;            /* muted: the figure recedes    */
  a += scan*.3*(1.-uMirror);
  a *= mirrorFade;
  vCol = col*(1.+scan*.8);
  vA = min(a,1.);
}`;

export const HOLO_FRAGMENT_SHADER = `
varying vec3 vCol; varying float vA;
void main(){
  float d=length(gl_PointCoord-.5);
  float a=smoothstep(.5,.1,d)*vA;
  gl_FragColor=vec4(vCol*a, a);
}`;
