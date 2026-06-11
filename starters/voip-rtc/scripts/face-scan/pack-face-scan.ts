/* Packs the raw browser scan (scan-raw.json, produced by extract.html)
   into the committed face-scan asset.

   Registration anchors the photo cloud onto the shader's facial frame:
   iris centers land on (±0.2, 0.12), the mouth line on (0, -0.345) — so
   blink, murmur and mood expressions keep working untouched. Depth comes
   from MediaPipe's relative z (Z_GAIN env tunes the profile projection).
   The face-oval boundary is blended onto the skull SDF so the scan layer
   meets the lattice without a seam. */

import { readFileSync, writeFileSync } from "node:fs";
import { skullCoreDistance } from "../../src/components/hologram/face-geometry.js";
import { POS_SCALE } from "../../src/components/hologram/face-scan-decode.js";
import type { Vec3 } from "../../src/components/hologram/vector-math.js";

interface OutlineTrace {
  w: number;
  h: number;
  left: number[][];
  right: number[][];
}

interface RawScan {
  w: number;
  h: number;
  landmarks: number[][];
  oval: number[];
  samples: number[][];
  outlineFront?: OutlineTrace;
  outlineSide?: OutlineTrace;
}

const here = new URL(".", import.meta.url).pathname;
const raw: RawScan = JSON.parse(readFileSync(`${here}scan-raw.json`, "utf8"));
const Z_GAIN = Number(process.env.Z_GAIN ?? 1.0);
const Z_EYE = 0.52; /* head-frame depth of the eye plane */

/* ---------- registration ---------- */

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

/* ---------- seam blend onto the skull SDF ---------- */

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

function projectOnSkull(p: Vec3): Vec3 {
  const q: Vec3 = [...p];
  for (let iter = 0; iter < 3; iter++) {
    const d = skullCoreDistance(q);
    const e = 0.011;
    const g: Vec3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const a: Vec3 = [...q]; a[i] += e;
      const b: Vec3 = [...q]; b[i] -= e;
      g[i] = (skullCoreDistance(a) - skullCoreDistance(b)) / (2 * e);
    }
    const len = Math.hypot(g[0], g[1], g[2]) || 1;
    q[0] -= (g[0] / len) * d;
    q[1] -= (g[1] / len) * d;
    q[2] -= (g[2] / len) * d;
  }
  return q;
}

const SEAM_BAND = Number(process.env.SEAM_BAND ?? 0.2);

/* ---------- transform, blend, normalize ---------- */

const headPts: Vec3[] = [];
const lums: number[] = [];
for (const [x, y, z, lum] of raw.samples) {
  headPts.push(toHead(x, y, z));
  lums.push(lum);
}

/* depth smoothing: IDW depth carries per-sample noise that reads as
   froth in profile — relax z toward the neighborhood mean (xy radius)
   while keeping the sharp luminance untouched */
const SMOOTH_R = 0.035;
const SMOOTH_PASSES = 2;
for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
  const cell = SMOOTH_R;
  const grid = new Map<string, number[]>();
  const keyOf = (x: number, y: number): string =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  headPts.forEach((p, i) => {
    const k = keyOf(p[0], p[1]);
    (grid.get(k) ?? grid.set(k, []).get(k))!.push(i);
  });
  const nextZ = headPts.map((p, i) => {
    let sum = 0;
    let n = 0;
    const gx = Math.floor(p[0] / cell);
    const gy = Math.floor(p[1] / cell);
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

/* seam blend after smoothing so the boundary lands exactly on the SDF */
for (const p of headPts) {
  const edge = distToOvalEdge(p[0], p[1]);
  if (edge >= SEAM_BAND) continue;
  const w = edge / SEAM_BAND;
  const s = w * w * (3 - 2 * w);
  const proj = projectOnSkull(p);
  p[0] = p[0] * s + proj[0] * (1 - s);
  p[1] = p[1] * s + proj[1] * (1 - s);
  p[2] = p[2] * s + proj[2] * (1 - s);
}

/* luminance → shade: percentile-normalized so the face uses the full
   value range of the hologram palette */
const sorted = [...lums].sort((a, b) => a - b);
const p5 = sorted[Math.floor(sorted.length * 0.05)];
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const shade = lums.map((l) => {
  const v = (l - p5) / (p95 - p5);
  return Math.max(0.04, Math.min(1, 0.04 + v * 0.96));
});

/* ---------- face window for lattice culling (shrunk oval) ---------- */

const cx = ovalHead.reduce((a, p) => a + p[0], 0) / ovalHead.length;
const cy = ovalHead.reduce((a, p) => a + p[1], 0) / ovalHead.length;
const windowPoly: number[] = [];
for (const p of ovalHead) {
  windowPoly.push(
    Math.round((cx + (p[0] - cx) * 0.93) * 1e4) / 1e4,
    Math.round((cy + (p[1] - cy) * 0.93) * 1e4) / 1e4,
  );
}

/* ---------- front silhouette hull (photo-true hair contour) ---------- */

/* Hand-traced head silhouette from ref/front.png (source-image pixels).
   Automatic tracing is unreliable here — dark hair against a dark
   backdrop — so the contour was read off a coordinate grid overlay.
   Order: crown → screen-right side → jaw → chin → screen-left side →
   back to crown. The quiff peak, receded temples, ear bumps and jaw
   taper are the subject's. */
const FRONT_OUTLINE_PX: ReadonlyArray<[number, number]> = [
  [330, 26], [360, 28], [400, 42], [440, 66], [465, 96], [478, 130],
  [484, 170], [486, 215], [483, 260], [486, 300], [490, 335], [480, 370],
  [458, 420], [420, 464], [372, 490], [330, 498],
  [288, 492], [243, 467], [205, 418], [182, 362], [170, 330], [172, 295],
  [178, 255], [180, 210], [182, 165], [192, 118], [212, 78], [248, 46],
  [290, 28],
];

const hullFront: number[] = [];
for (const [x, y] of FRONT_OUTLINE_PX) {
  const p = toHead(x, y, mid[2]);
  hullFront.push(Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4);
}

/* ---------- quantize + emit ---------- */

const count = headPts.length;
const posInts = new Int16Array(count * 3);
const shadeBytes = new Uint8Array(count);
for (let i = 0; i < count; i++) {
  posInts[i * 3] = Math.round(headPts[i][0] * POS_SCALE);
  posInts[i * 3 + 1] = Math.round(headPts[i][1] * POS_SCALE);
  posInts[i * 3 + 2] = Math.round(headPts[i][2] * POS_SCALE);
  shadeBytes[i] = Math.round(shade[i] * 255);
}

const posB64 = Buffer.from(posInts.buffer).toString("base64");
const shadeB64 = Buffer.from(shadeBytes).toString("base64");

const out = `/* AUTO-GENERATED by scripts/face-scan/pack-face-scan.ts — do not edit.
   Source: reference photos in scripts/face-scan/ref/ (not committed).
   Registration: eyes ±0.2/0.12, mouth 0/-0.345, Z_GAIN=${Z_GAIN}. */
import type { FaceScanData } from "./face-scan-decode.js";

export const FACE_SCAN: FaceScanData = {
  count: ${count},
  pos: "${posB64}",
  shade: "${shadeB64}",
  window: [${windowPoly.join(", ")}],
  hullFront: [${hullFront.join(", ")}],
};
`;

writeFileSync(`${here}../../src/components/hologram/face-scan.ts`, out);

const zs = headPts.map((p) => p[2]);
console.log(JSON.stringify({
  status: "ok",
  count,
  hullFrontVerts: hullFront.length / 2,
  zGain: Z_GAIN,
  noseTipZ: Math.max(...zs),
  zRange: [Math.min(...zs), Math.max(...zs)],
  yRange: [Math.min(...headPts.map((p) => p[1])), Math.max(...headPts.map((p) => p[1]))],
  xRange: [Math.min(...headPts.map((p) => p[0])), Math.max(...headPts.map((p) => p[0]))],
}));
