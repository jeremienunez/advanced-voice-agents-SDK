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
import { ell, smin, sph } from "./face-math.js";
import { clamp, dot, normalize, type Vec3 } from "./vector-math.js";

export interface OrbRng {
  /** Uniform float in [0, 1). */
  next(): number;
}

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

/** Deterministic mulberry32 — the default seed is part of the design. */
export class OrbSeededRng implements OrbRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const EYE_CENTERS: ReadonlyArray<Vec3> = [
  [0.2, 0.12, 0.5],
  [-0.2, 0.12, 0.5],
];
/* viewer-aligned light: the front reads uniformly bright, the sides
   fall off by curvature alone — like a scan lit from the camera */
const LIGHT_DIR: Vec3 = normalize([0.08, 0.18, 0.98]);
/** Share of the point budget given to the scan layer when present. */
const SCAN_SHARE = 0.55;
/** The scan layer renders finer dots than the structural lattice. */
const SCAN_DOT_SCALE = 0.58;

interface PointRecord {
  p: Vec3;
  aux: [number, number, number, number];
  aux2: [number, number, number, number];
  scale: number;
}

export function buildFaceGeometry(rng: OrbRng, targetPoints = 30000): FaceGeometry {
  const scan = decodeFaceScan(FACE_SCAN);
  const scanTake = scan.count > 0 ? Math.min(scan.count, Math.round(targetPoints * SCAN_SHARE)) : 0;
  const latticeBudget = Math.max(2000, targetPoints - scanTake);

  const records: PointRecord[] = [];

  /* ---- LATTICE layer: skull, hair, ears, neck ---- */
  const rings = Math.max(36, Math.min(120, Math.round(Math.sqrt(latticeBudget / 1.5))));
  const segments = Math.round(rings * 1.5);
  /* hybrid lattice: a spherical cap crowns the skull, then evenly
     spaced horizontal rings hug the head — rays hit the face plane
     square-on, so the grid never stretches over the features */
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
        aux2: [eyeSocketMask(p), shade, clamp((p[1] + 0.98) / 0.3, 0, 1), irisMask(p)],
        scale: 1,
      });
    }
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
        clamp((p[1] + 0.98) / 0.3, 0, 1),
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

/* ============================ masks ============================ */

export function mouthMask(p: Vec3): number {
  return Math.exp(
    -((p[0] / 0.24) ** 2 + ((p[1] + 0.33) / 0.12) ** 2 + ((p[2] - 0.45) / 0.26) ** 2),
  );
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

export function hairMask(p: Vec3): number {
  if (p[1] < -0.62) return 0; /* the face and neck are never hair */
  /* theta walks around the head: 0 faces the viewer, ±π is the nape */
  const theta = Math.atan2(p[0], p[2]);
  const around = Math.abs(theta) / Math.PI;
  /* the subject's hairline: high front, receded temples, short sides
     over the ears, tapered low at the nape */
  const temple = Math.exp(-(((Math.abs(theta) - 0.62) / 0.22) ** 2));
  const line =
    0.44 + temple * 0.09 - smooth01(0.12, 0.5, around) * 0.42 - smooth01(0.5, 1, around) * 0.62;
  return clamp((p[1] - line) * 4.0, 0, 1);
}

/** Short boxed beard + mustache: chin, jawline, sideburn link. */
export function beardMask(p: Vec3): number {
  if (p[1] > 0 || p[1] < -0.75) return 0;
  const g = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number =>
    Math.exp(-(((p[0] - cx) / rx) ** 2 + ((p[1] - cy) / ry) ** 2 + ((p[2] - cz) / rz) ** 2));
  let m = g(0, -0.52, 0.3, 0.2, 0.17, 0.2); /* chin patch */
  m = Math.max(m, g(0.29, -0.4, 0.16, 0.16, 0.18, 0.24)); /* jawline R */
  m = Math.max(m, g(-0.29, -0.4, 0.16, 0.16, 0.18, 0.24)); /* jawline L */
  m = Math.max(m, g(0, -0.295, 0.5, 0.13, 0.045, 0.1)); /* mustache */
  m = Math.max(m, g(0.44, -0.14, 0.04, 0.09, 0.24, 0.18)); /* sideburn R */
  m = Math.max(m, g(-0.44, -0.14, 0.04, 0.09, 0.24, 0.18)); /* sideburn L */
  /* the lower lip stays bare inside the beard frame */
  m *= 1 - Math.min(1, g(0, -0.385, 0.48, 0.09, 0.04, 0.09) * 1.4);
  return clamp(m * 1.25, 0, 1);
}

function smooth01(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/* ============================ sdf ============================ */

/** Core head SDF, before the photo hull. The hair volumes deliberately
    overshoot the subject's silhouette: the front-photo hull is the one
    that carves them down to the exact contour. */
export function skullCoreDistance(p: Vec3): number {
  let d = ell(p, 0, 0.3, -0.06, 0.56, 0.55, 0.6); /* cranium */
  d = smin(d, ell(p, 0, 0.05, 0.28, 0.5, 0.44, 0.3), 0.16); /* face plane */
  d = smin(d, ell(p, 0, -0.2, 0.2, 0.42, 0.36, 0.32), 0.14); /* midface */
  d = smin(d, ell(p, 0, -0.4, 0.1, 0.33, 0.26, 0.3), 0.12); /* jaw */
  d = smin(d, ell(p, 0, -0.55, 0.26, 0.15, 0.12, 0.13), 0.08); /* chin */
  d = smin(d, ell(p, 0.26, 0.0, 0.34, 0.13, 0.15, 0.14), 0.1); /* cheekbone R */
  d = smin(d, ell(p, -0.26, 0.0, 0.34, 0.13, 0.15, 0.14), 0.1); /* cheekbone L */
  /* the subject's hair: tall swept-up volume — generous on purpose,
     the photo hull trims it to the real quiff and temples */
  d = smin(d, ell(p, 0, 0.58, -0.04, 0.55, 0.5, 0.58), 0.08); /* hair crown */
  d = smin(d, ell(p, 0, 0.78, 0.2, 0.34, 0.3, 0.32), 0.09); /* front quiff */
  d = smin(d, ell(p, 0, 0.4, -0.3, 0.5, 0.55, 0.6), 0.07); /* occiput */
  d = smin(d, ell(p, 0.56, 0.04, -0.05, 0.045, 0.1, 0.08), 0.04); /* ear R */
  d = smin(d, ell(p, -0.56, 0.04, -0.05, 0.045, 0.1, 0.08), 0.04); /* ear L */
  d = smin(d, ell(p, 0, -0.85, -0.04, 0.26, 0.38, 0.25), 0.1); /* neck stub */
  d = smin(d, sph(p, 0, -0.12, 0.6, 0.07), 0.09); /* nose root, seam aid */
  /* the trimmed beard pads the jaw and chin outward */
  d -= beardMask(p) * 0.018;
  return d;
}

/** Structural head SDF: the core sculpt intersected with the two-view
    photo hull (front xy + right-profile zy), so the hair contour and
    the occiput/nape depth match the reference subject exactly. */
export function skullDistance(p: Vec3): number {
  let d = skullCoreDistance(p);
  /* visual hull: the photo silhouettes carve the head — gated above
     the neck so the closed polygons never crop the bust */
  if (p[1] > -0.6) {
    const gate = smooth01(-0.55, -0.42, p[1]);
    const front = FACE_SCAN.hullFront;
    if (front && front.length >= 6) {
      const pd = polygonSignedDistance(p[0], p[1], front);
      d = d + (Math.max(d, pd) - d) * gate;
    }
    const side = FACE_SCAN.hullSide;
    if (side && side.length >= 6) {
      const pd = polygonSignedDistance(p[2], p[1], side);
      d = d + (Math.max(d, pd) - d) * gate;
    }
  }
  return d;
}

/** Signed distance to a flat-pair polygon in head-frame xy (negative
    inside). Drives the photo-true silhouette hull of the skull. */
function polygonSignedDistance(x: number, y: number, v: ReadonlyArray<number>): number {
  const n = v.length / 2;
  let dist = Infinity;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = v[i * 2], yi = v[i * 2 + 1];
    const xj = v[j * 2], yj = v[j * 2 + 1];
    const ex = xj - xi, ey = yj - yi;
    const t = Math.max(0, Math.min(1, ((x - xi) * ex + (y - yi) * ey) / (ex * ex + ey * ey || 1)));
    dist = Math.min(dist, Math.hypot(x - xi - ex * t, y - yi - ey * t));
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? -dist : dist;
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
