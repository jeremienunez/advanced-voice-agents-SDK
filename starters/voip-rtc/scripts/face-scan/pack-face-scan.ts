/* Packs the raw browser scan (scan-raw.json, produced by extract.html)
   into the committed face-scan asset.

   FACE layer — MediaPipe landmarks + photo luminance, registered onto
   the shader's facial frame (iris centers ±0.2/0.12, mouth 0/-0.345) so
   blink/murmur/mood keep working. Depth = relative z (Z_GAIN), smoothed,
   clamped against the profile silhouette (MediaPipe bulges at the rim).

   SKULL layer — the rest of the head is a visual-hull surface: per
   y-row, the cross-section is an ellipse spanning the segmenter-traced
   front silhouette (x extent) and right-profile silhouette (z extent).
   Each ring point samples photo luminance triplanar-style from the
   front / profile / back views. No hand-drawn polygons anywhere: the
   silhouettes come from MediaPipe ImageSegmenter at pixel resolution. */

import { readFileSync, writeFileSync } from "node:fs";
import { insideFaceWindow, POS_SCALE } from "../../src/components/hologram/face-scan-decode.js";
import type { Vec3 } from "../../src/components/hologram/vector-math.js";

interface LumMap {
  x0: number;
  y0: number;
  step: number;
  lw: number;
  lh: number;
  data: number[];
}

interface OutlineTrace {
  w: number;
  h: number;
  left: number[][];
  right: number[][];
  lum: LumMap;
}

interface RawScan {
  w: number;
  h: number;
  landmarks: number[][];
  oval: number[];
  samples: number[][];
  outlineFront: OutlineTrace;
  outlineSide: OutlineTrace;
  outlineBack: OutlineTrace;
}

const here = new URL(".", import.meta.url).pathname;
const raw: RawScan = JSON.parse(readFileSync(`${here}scan-raw.json`, "utf8"));
const Z_GAIN = Number(process.env.Z_GAIN ?? 0.9);
const Z_EYE = 0.52; /* head-frame depth of the eye plane */

/* ================= face registration (landmarks) ================= */

const lm = raw.landmarks;
const mean = (ids: number[]): number[] =>
  ids.reduce(
    (acc, i) => [acc[0] + lm[i][0] / ids.length, acc[1] + lm[i][1] / ids.length, acc[2] + lm[i][2] / ids.length],
    [0, 0, 0],
  );
const irisA = mean([468, 469, 470, 471, 472]);
const irisB = mean([473, 474, 475, 476, 477]);
const [eyeLeftPx, eyeRightPx] = irisA[0] < irisB[0] ? [irisA, irisB] : [irisB, irisA];
const mouthPx = mean([13, 14]);

const roll = Math.atan2(eyeRightPx[1] - eyeLeftPx[1], eyeRightPx[0] - eyeLeftPx[0]);
const cr = Math.cos(-roll);
const sr = Math.sin(-roll);
const mid = [(eyeLeftPx[0] + eyeRightPx[0]) / 2, (eyeLeftPx[1] + eyeRightPx[1]) / 2, (eyeLeftPx[2] + eyeRightPx[2]) / 2];
const rot = (x: number, y: number): [number, number] => [
  (x - mid[0]) * cr - (y - mid[1]) * sr,
  (x - mid[0]) * sr + (y - mid[1]) * cr,
];

const interocular = Math.hypot(eyeRightPx[0] - eyeLeftPx[0], eyeRightPx[1] - eyeLeftPx[1]);
const sx = 0.4 / interocular; /* eyes land on ±0.2 */
const mouthRotated = rot(mouthPx[0], mouthPx[1]);
const sy = 0.465 / mouthRotated[1]; /* mouth lands on y = -0.345 */
const sz = sy * Z_GAIN;

function toHead(x: number, y: number, z: number): Vec3 {
  const [rx, ry] = rot(x, y);
  return [rx * sx, 0.12 - ry * sy, Z_EYE + (mid[2] - z) * sz];
}
/* inverse, for luminance sampling (roll is <1° — ignored) */
const frontPx = (x: number, y: number): [number, number] => [
  mid[0] + x / sx,
  mid[1] + (0.12 - y) / sy,
];

/* ================= silhouettes (segmenter chains) ================= */

/** Box-smooth a chain's x values and return a y→x linear interpolator. */
function chainInterp(chain: number[][], toUnits: (x: number, y: number) => [number, number]) {
  const pts = chain
    .map(([x, y]) => toUnits(x, y))
    .sort((a, b) => b[1] - a[1]); /* y desc */
  const xs = pts.map((p) => p[0]);
  const smooth = xs.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(xs.length - 1, i + 3); j++) {
      sum += xs[j];
      n++;
    }
    return sum / n;
  });
  const ys = pts.map((p) => p[1]);
  return (y: number): number | null => {
    if (y > ys[0] || y < ys[ys.length - 1]) return null;
    let lo = 0;
    let hi = ys.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ys[m] >= y) lo = m;
      else hi = m;
    }
    const t = (ys[lo] - y) / (ys[lo] - ys[hi] || 1);
    return smooth[lo] + (smooth[hi] - smooth[lo]) * t;
  };
}

/* front chains → x extents (units via the landmark registration) */
const frontUnits = (x: number, y: number): [number, number] => {
  const p = toHead(x, y, mid[2]);
  return [p[0], p[1]];
};
const XL = chainInterp(raw.outlineFront.left, frontUnits);
const XR = chainInterp(raw.outlineFront.right, frontUnits);
const topUnits = Math.max(
  ...raw.outlineFront.left.map(([x, y]) => frontUnits(x, y)[1]),
);

/* side registration: crown top + nose tip anchor the scale */
const sideRows = raw.outlineSide.left.map((p) => p[1]);
const sideTopRow = Math.min(...sideRows);
const sideBottomRow = Math.max(...sideRows);
let noseRowPx = sideTopRow;
let noseColPx = 0;
for (const [x, y] of raw.outlineSide.right) {
  if (y < sideTopRow + (sideBottomRow - sideTopRow) * 0.65 && x > noseColPx) {
    noseColPx = x;
    noseRowPx = y;
  }
}
const noseTipUnitsY = toHead(lm[1][0], lm[1][1], lm[1][2])[1];
const sideScale = (topUnits - noseTipUnitsY) / (noseRowPx - sideTopRow);

/* face depth max — the side z anchor (computed before any clamping) */
const faceZRaw = raw.samples.map(([x, y, z]) => toHead(x, y, z)[2]);
const noseTipZ = Math.max(...faceZRaw);

const sideUnits = (x: number, y: number): [number, number] => [
  noseTipZ - (noseColPx - x) * sideScale,
  topUnits - (y - sideTopRow) * sideScale,
];
const ZB = chainInterp(raw.outlineSide.left, sideUnits);
const ZF = chainInterp(raw.outlineSide.right, sideUnits);
const sidePx = (z: number, y: number): [number, number] => [
  noseColPx - (noseTipZ - z) / sideScale,
  sideTopRow + (topUnits - y) / sideScale,
];

/* back registration: crown top + head-width match against the front */
const backRows = raw.outlineBack.left.map((p) => p[1]);
const backTopRow = Math.min(...backRows);
const backBottomRow = Math.max(...backRows);
let backWidthPx = 0;
let backCenterPx = raw.outlineBack.w / 2;
for (let i = 0; i < raw.outlineBack.left.length; i++) {
  const [xl, y] = raw.outlineBack.left[i];
  const [xr] = raw.outlineBack.right[i];
  if (y < backTopRow + (backBottomRow - backTopRow) * 0.45 && xr - xl > backWidthPx) {
    backWidthPx = xr - xl;
    backCenterPx = (xl + xr) / 2;
  }
}
let frontWidthUnits = 0;
for (let y = topUnits; y > -0.3; y -= 0.01) {
  const l = XL(y);
  const r = XR(y);
  if (l !== null && r !== null) frontWidthUnits = Math.max(frontWidthUnits, r - l);
}
const backScale = frontWidthUnits / backWidthPx;
/* seen from behind, the subject's screen-left is the front view's
   screen-right: x is mirrored */
const backPx = (x: number, y: number): [number, number] => [
  backCenterPx - x / backScale,
  backTopRow + (topUnits - y) / backScale,
];

/* ================= luminance sampling (triplanar) ================= */

function sampleLum(map: LumMap, px: number, py: number): number | null {
  const fi = (px - map.x0) / map.step;
  const fj = (py - map.y0) / map.step;
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  if (i < 0 || j < 0 || i >= map.lw - 1 || j >= map.lh - 1) return null;
  const tx = fi - i;
  const ty = fj - j;
  const at = (ii: number, jj: number): number => map.data[jj * map.lw + ii] / 255;
  return (
    at(i, j) * (1 - tx) * (1 - ty) +
    at(i + 1, j) * tx * (1 - ty) +
    at(i, j + 1) * (1 - tx) * ty +
    at(i + 1, j + 1) * tx * ty
  );
}

/* ================= face layer ================= */

const headPts: Vec3[] = [];
const lums: number[] = [];
for (const [x, y, z, lum] of raw.samples) {
  headPts.push(toHead(x, y, z));
  lums.push(lum);
}

/* depth smoothing: IDW depth carries per-sample noise that reads as
   froth in profile — relax z toward the neighborhood mean */
const SMOOTH_R = 0.035;
for (let pass = 0; pass < 2; pass++) {
  const grid = new Map<string, number[]>();
  const keyOf = (x: number, y: number): string =>
    `${Math.floor(x / SMOOTH_R)},${Math.floor(y / SMOOTH_R)}`;
  headPts.forEach((p, i) => {
    const k = keyOf(p[0], p[1]);
    (grid.get(k) ?? grid.set(k, []).get(k))!.push(i);
  });
  const nextZ = headPts.map((p) => {
    let sum = 0;
    let n = 0;
    const gx = Math.floor(p[0] / SMOOTH_R);
    const gy = Math.floor(p[1] / SMOOTH_R);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          const q = headPts[j];
          if (Math.hypot(q[0] - p[0], q[1] - p[1]) < SMOOTH_R) {
            sum += q[2];
            n++;
          }
        }
      }
    }
    return n > 0 ? p[2] * 0.45 + (sum / n) * 0.55 : p[2];
  });
  nextZ.forEach((z, i) => {
    headPts[i][2] = z;
  });
}

/* clamp face depth against the profile silhouette: MediaPipe bulges at
   the oval rim (forehead) — the photo is the authority */
let clamped = 0;
for (const p of headPts) {
  const zf = ZF(p[1]);
  if (zf !== null && p[2] > zf + 0.005) {
    p[2] = zf + 0.005;
    clamped += 1;
  }
}

/* seam: blend the oval boundary onto the hull ellipse cross-section so
   the face meets the skull layer without a step */
const ovalHead = raw.oval.map((i) => toHead(lm[i][0], lm[i][1], lm[i][2]));
function distToOvalEdge(x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = ovalHead.length - 1; i < ovalHead.length; j = i++) {
    const [x1, y1] = [ovalHead[j][0], ovalHead[j][1]];
    const [x2, y2] = [ovalHead[i][0], ovalHead[i][1]];
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - x1 - dx * t, y - y1 - dy * t));
  }
  return best;
}

function ellipseAt(y: number): { xc: number; a: number; zc: number; b: number } | null {
  const l = XL(y);
  const r = XR(y);
  const zb = ZB(y);
  const zf = ZF(y);
  if (l === null || r === null || zb === null || zf === null) return null;
  const a = Math.max(0.02, (r - l) / 2);
  const b = Math.max(0.02, (zf - zb) / 2);
  return { xc: (l + r) / 2, a, zc: (zb + zf) / 2, b };
}

const SEAM_BAND = 0.2;
for (const p of headPts) {
  const edge = distToOvalEdge(p[0], p[1]);
  if (edge >= SEAM_BAND) continue;
  const e = ellipseAt(p[1]);
  if (!e) continue;
  const sin = Math.max(-1, Math.min(1, (p[0] - e.xc) / e.a));
  const zEll = e.zc + e.b * Math.sqrt(1 - sin * sin); /* front half */
  const w = edge / SEAM_BAND;
  const s = w * w * (3 - 2 * w);
  p[2] = p[2] * s + zEll * (1 - s);
}

/* luminance → shade (percentile-normalized on the face; the skull layer
   reuses the same mapping so hair stays dark relative to skin) */
const sorted = [...lums].sort((a, b) => a - b);
const p5 = sorted[Math.floor(sorted.length * 0.05)];
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const lumToShade = (l: number): number => {
  const v = (l - p5) / (p95 - p5);
  return Math.max(0.04, Math.min(1, 0.04 + v * 0.96));
};
const shade = lums.map(lumToShade);

/* ================= face window (lattice/skull culling) ================= */

const cx = ovalHead.reduce((a, p) => a + p[0], 0) / ovalHead.length;
const cy = ovalHead.reduce((a, p) => a + p[1], 0) / ovalHead.length;
const windowPoly: number[] = [];
for (const p of ovalHead) {
  windowPoly.push(
    Math.round((cx + (p[0] - cx) * 0.93) * 1e4) / 1e4,
    Math.round((cy + (p[1] - cy) * 0.93) * 1e4) / 1e4,
  );
}

/* ================= skull layer: hull-surface rings ================= */

const RING_STEP = 0.021;
const BUST_CUT = -1.25; /* the projector fade owns everything below */
/* the segmenter slightly erodes wispy hair edges — breathe back out */
const HULL_INFLATE = 0.012;
const skullPts: Vec3[] = [];
const skullLum: number[] = [];
/* adaptive descent: where the silhouette widens fast (shoulders) the
   surface is near-horizontal — tighten the ring spacing so the shell
   stays a surface instead of a stack of plates */
const stepAt = (yv: number): number => {
  const eHere = ellipseAt(yv);
  const eNext = ellipseAt(yv - 0.012);
  if (!eHere || !eNext) return RING_STEP;
  const slope =
    Math.max(Math.abs(eNext.a - eHere.a), Math.abs(eNext.b - eHere.b)) / 0.012;
  return RING_STEP / Math.min(4, Math.sqrt(1 + slope * slope));
};
/* torso cross-sections flatten from head-ellipse toward a rounded
   rectangle (the true two-view visual hull is the superellipse) */
const exponentAt = (yv: number): number =>
  2 + 1.7 * Math.max(0, Math.min(1, (-0.84 - yv) / 0.2));

let ringIndex = 0;
for (let y = topUnits - 0.006; y > BUST_CUT; y -= stepAt(y), ringIndex++) {
  const e = ellipseAt(y);
  if (!e) continue;
  e.a += HULL_INFLATE;
  e.b += HULL_INFLATE;
  const exp = exponentAt(y);
  /* walk the superellipse and place dots at equal arc spacing — flat
     sides would otherwise starve and corners cluster */
  const su = (t: number): [number, number] => {
    const st = Math.sin(t);
    const ct = Math.cos(t);
    return [
      e.xc + e.a * Math.sign(st) * Math.abs(st) ** (2 / exp),
      e.zc + e.b * Math.sign(ct) * Math.abs(ct) ** (2 / exp),
    ];
  };
  let [px2, pz2] = su(0);
  let acc = (ringIndex % 2) * RING_STEP * 0.5;
  for (let t = 0.003; t <= Math.PI * 2; t += 0.003) {
    const [x, z] = su(t);
    acc += Math.hypot(x - px2, z - pz2);
    px2 = x;
    pz2 = z;
    if (acc < RING_STEP) continue;
    acc = 0;
    /* the face window belongs to the scan layer */
    if (z > 0.05 && insideFaceWindow(x, y, windowPoly)) continue;
    /* from mid-face to under the chin the front belongs to the scan
       (jaw, beard) or to honest shadow — in the profile photo the chin
       occludes the throat, so the hull has no real data there */
    if (y < -0.35 && y > -0.8 && z > 0.12) continue;
    /* triplanar luminance: blend the three views by facing direction */
    const nx = (x - e.xc) / (e.a * e.a);
    const nz = (z - e.zc) / (e.b * e.b);
    const nl = Math.hypot(nx, nz) || 1;
    const fx = nx / nl, fz = nz / nl;
    let wsum = 0;
    let lsum = 0;
    const views: Array<[number, LumMap, [number, number]]> = [
      [Math.max(0, fz) ** 2, raw.outlineFront.lum, frontPx(x, y)],
      [fx * fx, raw.outlineSide.lum, sidePx(z, y)],
      [Math.max(0, -fz) ** 2, raw.outlineBack.lum, backPx(x, y)],
    ];
    for (const [w, map, [px, py]] of views) {
      if (w < 0.02) continue;
      const l = sampleLum(map, px, py);
      if (l === null) continue;
      wsum += w;
      lsum += l * w;
    }
    if (wsum < 0.02) continue;
    skullPts.push([x, y, z]);
    skullLum.push(lsum / wsum);
  }
}
/* hair is honestly dark in the photos, but a hologram needs the back
   of the skull to stay legible — gentle floor under the photo shade */
const skullShadeArr = skullLum.map((l) => Math.max(0.13, lumToShade(l)));

/* ================= dense hulls (kept for the neck SDF + BDD) ================= */

function buildHull(
  rightChain: number[][],
  leftChain: number[][],
  toUnits: (x: number, y: number) => [number, number],
  yMin: number,
): number[] {
  const out: number[] = [];
  const push = ([u, v]: [number, number]): void => {
    out.push(Math.round(u * 1e4) / 1e4, Math.round(v * 1e4) / 1e4);
  };
  const right = rightChain.map(([x, y]) => toUnits(x, y)).filter((p) => p[1] > yMin);
  const left = leftChain.map(([x, y]) => toUnits(x, y)).filter((p) => p[1] > yMin);
  for (let i = 0; i < right.length; i += 3) push(right[i]);
  for (let i = left.length - 1; i >= 0; i -= 3) push(left[i]);
  return out;
}

const hullFront = buildHull(raw.outlineFront.right, raw.outlineFront.left, frontUnits, -1.32);
const hullSide = buildHull(raw.outlineSide.right, raw.outlineSide.left, sideUnits, -1.32);

/* ================= quantize + emit ================= */

function quantize(pts: Vec3[], shades: number[]): { pos: string; shade: string } {
  const posInts = new Int16Array(pts.length * 3);
  const shadeBytes = new Uint8Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    posInts[i * 3] = Math.round(pts[i][0] * POS_SCALE);
    posInts[i * 3 + 1] = Math.round(pts[i][1] * POS_SCALE);
    posInts[i * 3 + 2] = Math.round(pts[i][2] * POS_SCALE);
    shadeBytes[i] = Math.round(shades[i] * 255);
  }
  return {
    pos: Buffer.from(posInts.buffer).toString("base64"),
    shade: Buffer.from(shadeBytes).toString("base64"),
  };
}

const face = quantize(headPts, shade);
const skull = quantize(skullPts, skullShadeArr);

const out = `/* AUTO-GENERATED by scripts/face-scan/pack-face-scan.ts — do not edit.
   Source: reference photos in scripts/face-scan/ref/ (not committed).
   Face: landmarks registered on eyes ±0.2/0.12, mouth 0/-0.345, Z_GAIN=${Z_GAIN}.
   Skull: visual-hull rings from segmenter silhouettes, triplanar photo
   luminance (front/profile/back). */
import type { FaceScanData } from "./face-scan-decode.js";

export const FACE_SCAN: FaceScanData = {
  count: ${headPts.length},
  pos: "${face.pos}",
  shade: "${face.shade}",
  window: [${windowPoly.join(", ")}],
  hullFront: [${hullFront.join(", ")}],
  hullSide: [${hullSide.join(", ")}],
  skullCount: ${skullPts.length},
  skullPos: "${skull.pos}",
  skullShade: "${skull.shade}",
};
`;

writeFileSync(`${here}../../src/components/hologram/face-scan.ts`, out);

console.log(JSON.stringify({
  status: "ok",
  faceCount: headPts.length,
  skullCount: skullPts.length,
  faceClampedToProfile: clamped,
  topUnits: Math.round(topUnits * 1e3) / 1e3,
  noseTipZ: Math.round(noseTipZ * 1e3) / 1e3,
  occiputZ: Math.round(Math.min(...skullPts.map((p) => p[2])) * 1e3) / 1e3,
  hullFrontVerts: hullFront.length / 2,
  hullSideVerts: hullSide.length / 2,
}));
