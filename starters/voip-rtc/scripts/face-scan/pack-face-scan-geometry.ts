import type { Vec3 } from "../../src/components/hologram/vector-math.js";
import type { EllipseSection } from "./pack-face-scan-types.js";

export function meanLandmarks(landmarks: number[][], ids: number[]): number[] {
  return ids.reduce(
    (acc, i) => [
      acc[0] + landmarks[i][0] / ids.length,
      acc[1] + landmarks[i][1] / ids.length,
      acc[2] + landmarks[i][2] / ids.length,
    ],
    [0, 0, 0],
  );
}

/** Box-smooth a chain's x values and return a y-to-x linear interpolator. */
export function chainInterp(
  chain: number[][],
  toUnits: (x: number, y: number) => [number, number],
) {
  const pts = chain
    .map(([x, y]) => toUnits(x, y))
    .sort((a, b) => b[1] - a[1]);
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

export function smoothFaceDepth(headPts: Vec3[], radius: number, passes: number): void {
  for (let pass = 0; pass < passes; pass++) {
    const grid = new Map<string, number[]>();
    const keyOf = (x: number, y: number): string =>
      `${Math.floor(x / radius)},${Math.floor(y / radius)}`;
    headPts.forEach((p, i) => {
      const k = keyOf(p[0], p[1]);
      (grid.get(k) ?? grid.set(k, []).get(k))!.push(i);
    });
    const nextZ = headPts.map((p) => {
      let sum = 0;
      let n = 0;
      const gx = Math.floor(p[0] / radius);
      const gy = Math.floor(p[1] / radius);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const j of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
            const q = headPts[j];
            if (Math.hypot(q[0] - p[0], q[1] - p[1]) < radius) {
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
}

export function blendFaceSeam(
  headPts: Vec3[],
  ovalHead: Vec3[],
  ellipseAt: (y: number) => EllipseSection | null,
  seamBand: number,
): void {
  for (const p of headPts) {
    const edge = distToOvalEdge(p[0], p[1], ovalHead);
    if (edge >= seamBand) continue;
    const e = ellipseAt(p[1]);
    if (!e) continue;
    const sin = Math.max(-1, Math.min(1, (p[0] - e.xc) / e.a));
    const zEll = e.zc + e.b * Math.sqrt(1 - sin * sin);
    const w = edge / seamBand;
    const s = w * w * (3 - 2 * w);
    p[2] = p[2] * s + zEll * (1 - s);
  }
}

export function buildHull(
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

function distToOvalEdge(x: number, y: number, ovalHead: Vec3[]): number {
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
