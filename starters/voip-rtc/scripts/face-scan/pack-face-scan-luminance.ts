import { insideFaceWindow, POS_SCALE } from "../../src/components/hologram/face/scan-decode.js";
import type { Vec3 } from "../../src/components/hologram/vector-math.js";
import type {
  EllipseSection,
  LumMap,
  PixelProjector,
  RawScan,
} from "./pack-face-scan-types.js";

interface BuildSkullLayerInput {
  raw: RawScan;
  topUnits: number;
  windowPoly: number[];
  ellipseAt: (y: number) => EllipseSection | null;
  frontPx: PixelProjector;
  sidePx: PixelProjector;
  backPx: PixelProjector;
  lumToShade: (l: number) => number;
}

export function buildSkullLayer(input: BuildSkullLayerInput): {
  skullPts: Vec3[];
  skullShadeArr: number[];
} {
  const { raw, topUnits, windowPoly, ellipseAt, frontPx, sidePx, backPx, lumToShade } = input;
  const ringStep = 0.021;
  const bustCut = -1.25;
  const hullInflate = 0.012;
  const skullPts: Vec3[] = [];
  const skullLum: number[] = [];
  const stepAt = (yv: number): number => {
    const eHere = ellipseAt(yv);
    const eNext = ellipseAt(yv - 0.012);
    if (!eHere || !eNext) return ringStep;
    const slope =
      Math.max(Math.abs(eNext.a - eHere.a), Math.abs(eNext.b - eHere.b)) / 0.012;
    return ringStep / Math.min(4, Math.sqrt(1 + slope * slope));
  };
  const exponentAt = (yv: number): number =>
    2 + 1.7 * Math.max(0, Math.min(1, (-0.84 - yv) / 0.2));

  let ringIndex = 0;
  for (let y = topUnits - 0.006; y > bustCut; y -= stepAt(y), ringIndex++) {
    const e = ellipseAt(y);
    if (!e) continue;
    e.a += hullInflate;
    e.b += hullInflate;
    const exp = exponentAt(y);
    const su = (t: number): [number, number] => {
      const st = Math.sin(t);
      const ct = Math.cos(t);
      return [
        e.xc + e.a * Math.sign(st) * Math.abs(st) ** (2 / exp),
        e.zc + e.b * Math.sign(ct) * Math.abs(ct) ** (2 / exp),
      ];
    };
    let [px2, pz2] = su(0);
    let acc = (ringIndex % 2) * ringStep * 0.5;
    for (let t = 0.003; t <= Math.PI * 2; t += 0.003) {
      const [x, z] = su(t);
      acc += Math.hypot(x - px2, z - pz2);
      px2 = x;
      pz2 = z;
      if (acc < ringStep) continue;
      acc = 0;
      if (z > 0.05 && insideFaceWindow(x, y, windowPoly)) continue;
      if (y < -0.35 && y > -0.8 && z > 0.12) continue;

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

  return {
    skullPts,
    skullShadeArr: skullLum.map((l) => Math.max(0.13, lumToShade(l))),
  };
}

export function quantize(pts: Vec3[], shades: number[]): { pos: string; shade: string } {
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
