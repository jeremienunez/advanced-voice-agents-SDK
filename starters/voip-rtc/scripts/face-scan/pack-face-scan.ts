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
import type { Vec3 } from "../../src/components/hologram/vector-math.js";
import {
  blendFaceSeam,
  buildHull,
  chainInterp,
  meanLandmarks,
  smoothFaceDepth,
} from "./pack-face-scan-geometry.js";
import { buildSkullLayer, quantize } from "./pack-face-scan-luminance.js";
import type { EllipseSection, RawScan } from "./pack-face-scan-types.js";

const here = new URL(".", import.meta.url).pathname;
const raw: RawScan = JSON.parse(readFileSync(`${here}scan-raw.json`, "utf8"));
const Z_GAIN = Number(process.env.Z_GAIN ?? 0.9);
const Z_EYE = 0.52; /* head-frame depth of the eye plane */

/* ================= face registration (landmarks) ================= */

const lm = raw.landmarks;
const mean = (ids: number[]): number[] => meanLandmarks(lm, ids);
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
smoothFaceDepth(headPts, SMOOTH_R, 2);

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

function ellipseAt(y: number): EllipseSection | null {
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
blendFaceSeam(headPts, ovalHead, ellipseAt, SEAM_BAND);

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

const { skullPts, skullShadeArr } = buildSkullLayer({
  raw,
  topUnits,
  windowPoly,
  ellipseAt,
  frontPx,
  sidePx,
  backPx,
  lumToShade,
});

/* ================= dense hulls (kept for the neck SDF + BDD) ================= */

const hullFront = buildHull(raw.outlineFront.right, raw.outlineFront.left, frontUnits, -1.32);
const hullSide = buildHull(raw.outlineSide.right, raw.outlineSide.left, sideUnits, -1.32);

/* ================= quantize + emit ================= */

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
