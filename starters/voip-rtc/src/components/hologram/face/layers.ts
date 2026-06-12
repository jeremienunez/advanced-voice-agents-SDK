import { beardMask, browMask, hairMask } from "./masks.js";
import type { FaceScan } from "./scan-decode.js";
import { insideFaceWindow } from "./scan-decode.js";
import {
  eyeSocketMask,
  irisMask,
  jawMask,
  latticeReliefShade,
} from "./shading.js";
import { castToSurface } from "./surface.js";
import type { OrbRng } from "../orb-rng.js";
import { clamp, type Vec3 } from "../vector-math.js";
import type { FacePointRecord } from "./geometry-types.js";

/** Share of the point budget given to the face-scan layer when present. */
const SCAN_SHARE = 0.55;
/** Share of the point budget given to the baked skull/bust layer. */
const SKULL_SHARE = 0.42;
/** The scan layer renders finer dots than the structural rings. */
const SCAN_DOT_SCALE = 0.58;
/** Below this line the SDF lattice still owns the bust (neck base). */
const NECK_CUT = -1.24;

export interface FaceLayerBudget {
  scanTake: number;
  skullTake: number;
  latticeBudget: number;
}

export function faceLayerBudget(scan: FaceScan, targetPoints: number): FaceLayerBudget {
  const scanTake = scan.count > 0 ? Math.min(scan.count, Math.round(targetPoints * SCAN_SHARE)) : 0;
  const skullTake = scan.skullCount > 0
    ? Math.min(scan.skullCount, Math.round(targetPoints * SKULL_SHARE))
    : 0;
  return {
    scanTake,
    skullTake,
    latticeBudget: Math.max(skullTake > 0 ? 600 : 2000, targetPoints - scanTake - skullTake),
  };
}

export function appendLatticeLayer(
  records: FacePointRecord[],
  input: {
    rng: OrbRng;
    scan: FaceScan;
    scanTake: number;
    skullTake: number;
    latticeBudget: number;
  },
) {
  const rings = Math.max(36, Math.min(120, Math.round(Math.sqrt(input.latticeBudget / 1.5))));
  const segments = Math.round(rings * 1.5);
  const capRows = Math.round(rings * 0.3);
  for (let r = 0; r < rings; r++) {
    let origin: Vec3;
    let polar: number;
    if (r < capRows) {
      origin = [0, 0.38, 0];
      polar = (0.06 + ((r + 0.5) / capRows) * 0.86) * (Math.PI / 2);
    } else {
      const s = (r - capRows + 0.5) / (rings - capRows);
      origin = [0, 0.42 - s * 1.34, 0];
      polar = Math.PI / 2;
    }
    appendLatticeRing(records, { ...input, origin, polar, r, segments, capRows });
  }
}

export function appendSkullLayer(
  records: FacePointRecord[],
  input: { rng: OrbRng; scan: FaceScan; skullTake: number },
) {
  for (let k = 0; k < input.skullTake; k++) {
    const i = input.skullTake === input.scan.skullCount
      ? k
      : Math.floor((k * input.scan.skullCount) / input.skullTake);
    const p: Vec3 = [
      input.scan.skullPositions[i * 3] + (input.rng.next() - 0.5) * 0.003,
      input.scan.skullPositions[i * 3 + 1] + (input.rng.next() - 0.5) * 0.003,
      input.scan.skullPositions[i * 3 + 2] + (input.rng.next() - 0.5) * 0.003,
    ];
    const random = input.rng.next();
    const hair = hairMask(p);
    const beard = beardMask(p);
    /* below the collar the bust is sweater, not skin — keep it cool */
    const collar = clamp((p[1] + 1.02) / 0.25, 0, 1);
    const warm =
      clamp((p[2] + 0.05) * 1.6, 0, 1) * (1 - hair * 0.7) * (1 - beard * 0.55) * collar;
    records.push({
      p,
      aux: [jawMask(p), hair, warm, random],
      aux2: [
        eyeSocketMask(p),
        input.scan.skullShade[i],
        clamp((p[1] + 1.3) / 0.3, 0, 1),
        0,
      ],
      scale: 1,
      brow: browMask(p),
    });
  }
}

export function appendScanLayer(
  records: FacePointRecord[],
  input: { rng: OrbRng; scan: FaceScan; scanTake: number },
) {
  for (let k = 0; k < input.scanTake; k++) {
    const i = input.scanTake === input.scan.count
      ? k
      : Math.floor((k * input.scan.count) / input.scanTake);
    const p: Vec3 = [
      input.scan.positions[i * 3] + (input.rng.next() - 0.5) * 0.003,
      input.scan.positions[i * 3 + 1] + (input.rng.next() - 0.5) * 0.003,
      input.scan.positions[i * 3 + 2] + (input.rng.next() - 0.5) * 0.003,
    ];
    const random = input.rng.next();
    const beard = beardMask(p);
    const warm = clamp((p[2] + 0.05) * 1.6, 0, 1) * (1 - beard * 0.45);
    records.push({
      p,
      aux: [jawMask(p), 0, warm, random],
      aux2: [
        eyeSocketMask(p),
        input.scan.shade[i],
        clamp((p[1] + 1.3) / 0.3, 0, 1),
        irisMask(p),
      ],
      scale: SCAN_DOT_SCALE,
      brow: browMask(p),
    });
  }
}

function appendLatticeRing(
  records: FacePointRecord[],
  input: {
    rng: OrbRng;
    scan: FaceScan;
    scanTake: number;
    skullTake: number;
    origin: Vec3;
    polar: number;
    r: number;
    segments: number;
    capRows: number;
  },
) {
  const sinPolar = Math.sin(input.polar);
  /* cap rings shrink toward the pole: keep the angular dot spacing
     constant or the crown packs into an additive hotspot */
  const ringSegments = input.r < input.capRows
    ? Math.max(10, Math.round(input.segments * sinPolar))
    : input.segments;
  for (let c = 0; c < ringSegments; c++) {
    const theta = ((c + (input.r % 2) * 0.5) / ringSegments) * Math.PI * 2;
    const dir: Vec3 = [
      sinPolar * Math.sin(theta),
      Math.cos(input.polar),
      sinPolar * Math.cos(theta),
    ];
    const p = castToSurface(input.origin, dir);
    if (!p) continue;
    /* the baked skull layer owns the head above the neck line */
    if (input.skullTake > 0 && p[1] > NECK_CUT + 0.01) continue;
    /* the face window belongs to the scan layer */
    if (input.scanTake > 0 && p[2] > 0.08 && insideFaceWindow(p[0], p[1], input.scan.window)) continue;

    /* sub-point jitter: invisible, but it keys the cloud to the seed */
    p[0] += (input.rng.next() - 0.5) * 0.003;
    p[1] += (input.rng.next() - 0.5) * 0.003;
    p[2] += (input.rng.next() - 0.5) * 0.003;

    const random = input.rng.next();
    const hair = hairMask(p);
    const beard = beardMask(p);
    const warm = clamp((p[2] + 0.05) * 1.6, 0, 1) * (1 - hair * 0.7) * (1 - beard * 0.55);
    let shade = latticeReliefShade(p);
    /* dark swept-up hair: streaks follow the strand direction */
    const strand = 0.5 + 0.5 * Math.sin(Math.atan2(p[0], p[2] + 0.06) * 22 + p[1] * 4);
    shade *= 1 - hair * (0.72 - 0.3 * strand);
    /* trimmed beard: darker than skin, stubble speckle from the seed */
    shade *= 1 - beard * (0.5 - 0.14 * random);

    records.push({
      p,
      aux: [jawMask(p), hair, warm, random],
      aux2: [eyeSocketMask(p), shade, clamp((p[1] + 1.3) / 0.3, 0, 1), irisMask(p)],
      scale: 1,
      brow: browMask(p),
    });
  }
}
