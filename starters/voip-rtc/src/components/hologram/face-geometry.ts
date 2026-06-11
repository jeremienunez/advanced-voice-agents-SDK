/**
 * Procedural hologram head for the RTC voice orb — layered scan design.
 *
 * Two layers compose the bust:
 *  - the SCAN layer: a dense point cloud of the reference subject's face,
 *    extracted from photos (MediaPipe landmarks + photo luminance) and
 *    committed as a quantized asset. The likeness lives here.
 *  - the LATTICE layer: ordered spherical rings raymarched onto a
 *    smooth-min SDF (skull, hair, ears, neck) for everything the photo
 *    scan cannot cover. The face window is culled from the lattice so
 *    the scan slots in seamlessly.
 *
 * The merged cloud is sorted crown-to-neck so it still reads as a
 * structured scan. Deterministic for a given rng — verified in BDD.
 */

import { decodeFaceScan, insideFaceWindow } from "./face-scan-decode.js";
import { FACE_SCAN } from "./face-scan.js";
import { beardMask, hairMask, mouthMask } from "./face-masks.js";
import { skullDistance } from "./face-sdf.js";
import type { OrbRng } from "./orb-rng.js";
import { clamp, dot, normalize, type Vec3 } from "./vector-math.js";

export interface FaceGeometry {
  /** xyz triplets in head space (y up, z toward the viewer). */
  readonly positions: Float32Array;
  /** per point: jawMask, hairMask, warmMask, random. */
  readonly aux: Float32Array;
  /** per point: eyeMask, shade, bustFade, irisMask. */
  readonly aux2: Float32Array;
  /** per point: dot-size factor (the scan layer is finer grained). */
  readonly scale: Float32Array;
  readonly count: number;
}

const EYE_CENTERS: ReadonlyArray<Vec3> = [
  [0.2, 0.12, 0.5],
  [-0.2, 0.12, 0.5],
];
/* viewer-aligned light: the front reads uniformly bright, the sides
   fall off by curvature alone — like a scan lit from the camera */
const LIGHT_DIR: Vec3 = normalize([0.08, 0.18, 0.98]);
/** Share of the point budget given to the face-scan layer when present. */
const SCAN_SHARE = 0.55;
/** Share of the point budget given to the baked skull/bust layer. */
const SKULL_SHARE = 0.42;
/** The scan layer renders finer dots than the structural rings. */
const SCAN_DOT_SCALE = 0.58;
/** Below this line the SDF lattice still owns the bust (neck base). */
const NECK_CUT = -1.24;

interface PointRecord {
  p: Vec3;
  aux: [number, number, number, number];
  aux2: [number, number, number, number];
  scale: number;
}

export function buildFaceGeometry(rng: OrbRng, targetPoints = 30000): FaceGeometry {
  const scan = decodeFaceScan(FACE_SCAN);
  const scanTake = scan.count > 0 ? Math.min(scan.count, Math.round(targetPoints * SCAN_SHARE)) : 0;
  const skullTake = scan.skullCount > 0
    ? Math.min(scan.skullCount, Math.round(targetPoints * SKULL_SHARE))
    : 0;
  const latticeBudget = Math.max(skullTake > 0 ? 600 : 2000, targetPoints - scanTake - skullTake);

  const records: PointRecord[] = [];

  /* ---- LATTICE layer: SDF rings — the neck only, once the baked
     skull layer exists (everything above NECK_CUT is photo-driven) ---- */
  const rings = Math.max(36, Math.min(120, Math.round(Math.sqrt(latticeBudget / 1.5))));
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
    const sinPolar = Math.sin(polar);
    /* cap rings shrink toward the pole: keep the angular dot spacing
       constant or the crown packs into an additive hotspot */
    const ringSegments = r < capRows
      ? Math.max(10, Math.round(segments * sinPolar))
      : segments;
    for (let c = 0; c < ringSegments; c++) {
      const theta = ((c + (r % 2) * 0.5) / ringSegments) * Math.PI * 2;
      const dir: Vec3 = [
        sinPolar * Math.sin(theta),
        Math.cos(polar),
        sinPolar * Math.cos(theta),
      ];
      const p = castToSurface(origin, dir);
      if (!p) continue;
      /* the baked skull layer owns the head above the neck line */
      if (skullTake > 0 && p[1] > NECK_CUT + 0.01) continue;
      /* the face window belongs to the scan layer */
      if (scanTake > 0 && p[2] > 0.08 && insideFaceWindow(p[0], p[1], scan.window)) continue;

      /* sub-point jitter: invisible, but it keys the cloud to the seed */
      p[0] += (rng.next() - 0.5) * 0.003;
      p[1] += (rng.next() - 0.5) * 0.003;
      p[2] += (rng.next() - 0.5) * 0.003;

      const random = rng.next();
      const hair = hairMask(p);
      const beard = beardMask(p);
      const warm = clamp((p[2] + 0.05) * 1.6, 0, 1) * (1 - hair * 0.7) * (1 - beard * 0.55);
      const normal = gradient(p);
      const lambert = clamp(dot(normal, LIGHT_DIR) * 0.5 + 0.5, 0, 1);
      let shade = reliefShade(p, lambert);
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
      });
    }
  }

  /* ---- SKULL layer: visual-hull rings, triplanar photo shade ---- */
  for (let k = 0; k < skullTake; k++) {
    const i = skullTake === scan.skullCount ? k : Math.floor((k * scan.skullCount) / skullTake);
    const p: Vec3 = [
      scan.skullPositions[i * 3] + (rng.next() - 0.5) * 0.003,
      scan.skullPositions[i * 3 + 1] + (rng.next() - 0.5) * 0.003,
      scan.skullPositions[i * 3 + 2] + (rng.next() - 0.5) * 0.003,
    ];
    const random = rng.next();
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
        scan.skullShade[i],
        clamp((p[1] + 1.3) / 0.3, 0, 1),
        0,
      ],
      scale: 1,
    });
  }

  /* ---- SCAN layer: the subject's face, photo shade baked in ---- */
  for (let k = 0; k < scanTake; k++) {
    const i = scanTake === scan.count ? k : Math.floor((k * scan.count) / scanTake);
    const p: Vec3 = [
      scan.positions[i * 3] + (rng.next() - 0.5) * 0.003,
      scan.positions[i * 3 + 1] + (rng.next() - 0.5) * 0.003,
      scan.positions[i * 3 + 2] + (rng.next() - 0.5) * 0.003,
    ];
    const random = rng.next();
    const beard = beardMask(p);
    const warm = clamp((p[2] + 0.05) * 1.6, 0, 1) * (1 - beard * 0.45);
    records.push({
      p,
      aux: [jawMask(p), 0, warm, random],
      aux2: [
        eyeSocketMask(p),
        scan.shade[i],
        clamp((p[1] + 1.3) / 0.3, 0, 1),
        irisMask(p),
      ],
      scale: SCAN_DOT_SCALE,
    });
  }

  /* crown-to-neck order: the merged cloud still reads as a scan sweep */
  records.sort((a, b) => b.p[1] - a.p[1]);

  const count = records.length;
  const positions = new Float32Array(count * 3);
  const aux = new Float32Array(count * 4);
  const aux2 = new Float32Array(count * 4);
  const scale = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set(records[i].p, i * 3);
    aux.set(records[i].aux, i * 4);
    aux2.set(records[i].aux2, i * 4);
    scale[i] = records[i].scale;
  }

  return { positions, aux, aux2, scale, count };
}

/* march outward from inside the head to the first surface crossing */
function castToSurface(origin: Vec3, dir: Vec3): Vec3 | null {
  const at = (t: number): Vec3 => [
    origin[0] + dir[0] * t,
    origin[1] + dir[1] * t,
    origin[2] + dir[2] * t,
  ];
  let lo = 0;
  let hi = 0;
  let found = false;
  for (let t = 0.02; t < 2.1; t += 0.03) {
    if (skullDistance(at(t)) >= 0) {
      hi = t;
      lo = t - 0.03;
      found = true;
      break;
    }
  }
  if (!found) return null;
  for (let i = 0; i < 11; i++) {
    const mid = (lo + hi) / 2;
    if (skullDistance(at(mid)) >= 0) hi = mid;
    else lo = mid;
  }
  return at((lo + hi) / 2);
}

function jawMask(p: Vec3): number {
  const lower = clamp(-(p[1] + 0.26) * 5, 0, 1);
  return mouthMask(p) * lower + 0.35 * Math.exp(
    -((p[0] / 0.3) ** 2 + ((p[1] + 0.5) / 0.18) ** 2 + ((p[2] - 0.28) / 0.34) ** 2),
  );
}

/* Painted relief over the lambert, for the lattice layer only — the
   scan layer carries real photo luminance instead. */
function reliefShade(p: Vec3, lambert: number): number {
  const g = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number =>
    Math.exp(-(((p[0] - cx) / rx) ** 2 + ((p[1] - cy) / ry) ** 2 + ((p[2] - cz) / rz) ** 2));

  /* compact dark wells only — broad shadows would dim the whole head */
  let dark = Math.min(eyeSocketMask(p) * 1.3, 1) * 0.85;
  dark = Math.max(dark, g(0, -0.345, 0.5, 0.1, 0.02, 0.08) * 0.6); /* mouth line */

  /* muted paint: the scan layer owns the face, the lattice only rims
     it — bright paint here reads as a glowing hairline band */
  let bright = g(0, -0.05, 0.52, 0.45, 0.55, 0.28) * 0.15; /* face glow */
  bright = Math.max(bright, g(0, 0.42, 0.44, 0.3, 0.16, 0.2) * 0.25); /* forehead */
  bright = Math.max(bright, g(0, -0.555, 0.36, 0.1, 0.05, 0.1) * 0.3); /* chin */

  return clamp(lambert * (1 - dark * 0.85) + bright * 0.55, 0, 1);
}

function eyeSocketMask(p: Vec3): number {
  let m = 0;
  for (const c of EYE_CENTERS) {
    m = Math.max(m, Math.exp(
      -(((p[0] - c[0]) / 0.1) ** 2 + ((p[1] - c[1]) / 0.062) ** 2 + ((p[2] - c[2]) / 0.14) ** 2),
    ));
  }
  return m;
}

function irisMask(p: Vec3): number {
  for (const c of EYE_CENTERS) {
    if (p[2] > 0.4 && Math.hypot(p[0] - c[0], p[1] - c[1]) < 0.028) return 1;
  }
  return 0;
}

function gradient(p: Vec3): Vec3 {
  const e = 0.011;
  const g: Vec3 = [0, 0, 0];
  const q: Vec3 = [...p];
  for (let i = 0; i < 3; i++) {
    q[i] = p[i] + e;
    const a = skullDistance(q);
    q[i] = p[i] - e;
    const b = skullDistance(q);
    q[i] = p[i];
    g[i] = (a - b) / (2 * e);
  }
  return normalize(g);
}
