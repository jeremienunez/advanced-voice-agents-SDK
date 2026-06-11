/** GLSL for the hologram point lattice, ported verbatim from the legacy
    raw-WebGL renderer. The vertex shader does its own clip-space
    perspective (eye z=2.15) — three's camera matrices are deliberately
    unused, which is what keeps the port pixel-identical. */

export const HOLO_VERTEX_SHADER = `
attribute vec4 aAux; attribute vec4 aAux2; attribute float aScale;
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
  vec3 p=position;
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
  p.y += jaw*smoothstep(.05,.16,abs(position.x))*uExpr.x*.05;
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

  float band = step(.985, fract(position.y*1.6 + uTime*.4));
  p.x += uGlitch*band*.07;

  /* close camera: strong perspective bows the lattice rows around the
     features — that curvature is what makes the head read in 3D */
  vec3 q = p - vec3(0., .06, 2.15);
  float persp = 1.5 / -q.z;
  vec2 scr = q.xy * persp;
  scr.x *= uRes.y/uRes.x;
  gl_Position = vec4(scr, 0., 1.);
  /* uniform lattice dots: size barely varies, the order is the point —
     the dense scan layer renders finer (aScale) so it doesn't blow out */
  gl_PointSize = (2.0 + 3.0*persp) * (1. + .1*rnd) * (1. + .25*iris) * aScale;

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

  /* calm breathing, no per-point strobe: a lattice should feel stable */
  float fl=.85+.15*sin(uTime*1.7+rnd*6.28);
  float a=(.62+.2*fl)*(.78+.22*talk);
  /* the scan layer is ~16x denser than the lattice: rein in additive
     accumulation so the face glows instead of blowing out */
  a *= mix(.27, 1., step(.99, aScale));
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

export const HOLO_FRAGMENT_SHADER = `
varying vec3 vCol; varying float vA;
void main(){
  float d=length(gl_PointCoord-.5);
  float a=smoothstep(.5,.1,d)*vA;
  gl_FragColor=vec4(vCol*a, a);
}`;
