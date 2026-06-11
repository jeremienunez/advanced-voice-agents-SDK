/**
 * Procedural hologram head for the RTC voice orb.
 *
 * Structured-scan style: points sit on an ordered spherical lattice
 * (rings x segments) raymarched onto a smooth-min SDF head, like the
 * vertex grid of a 3D scan. The face reads through the deformation of
 * the lattice — eye sockets, nose, lips — not through painted strokes.
 * Deterministic for a given rng (sub-point jitter only) — verified in
 * the BDD harness.
 */

import { ell, smax, smin, sph } from "./face-math.js";
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

export function buildFaceGeometry(rng: OrbRng, targetPoints = 30000): FaceGeometry {
  /* the lattice must stay readable as a dot grid: cap its resolution */
  const rings = Math.max(36, Math.min(56, Math.round(Math.sqrt(targetPoints / 1.5))));
  const segments = Math.round(rings * 1.5);

  const capacity = rings * segments;
  const positions = new Float32Array(capacity * 3);
  const aux = new Float32Array(capacity * 4);
  const aux2 = new Float32Array(capacity * 4);
  let count = 0;

  /* hybrid lattice: a spherical cap crowns the skull, then evenly
     spaced horizontal rings hug the face — rays hit the face plane
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
    for (let c = 0; c < segments; c++) {
      const theta = ((c + (r % 2) * 0.5) / segments) * Math.PI * 2;
      const dir: Vec3 = [
        sinPolar * Math.sin(theta),
        Math.cos(polar),
        sinPolar * Math.cos(theta),
      ];
      const p = castToSurface(origin, dir);
      if (!p) continue;

      /* sub-point jitter: invisible, but it keys the cloud to the seed */
      p[0] += (rng.next() - 0.5) * 0.003;
      p[1] += (rng.next() - 0.5) * 0.003;
      p[2] += (rng.next() - 0.5) * 0.003;

      const random = rng.next();
      const hair = hairMask(p);
      const warm = clamp((p[2] + 0.05) * 1.6, 0, 1) * (1 - hair * 0.7);
      const eye = eyeSocketMask(p);
      const iris = irisMask(p);
      const normal = gradient(p);
      const lambert = clamp(dot(normal, LIGHT_DIR) * 0.5 + 0.5, 0, 1);
      const shade = reliefShade(p, lambert);
      const bust = clamp((p[1] + 0.98) / 0.3, 0, 1);

      positions.set(p, count * 3);
      aux.set([jawMask(p), 0, warm, random], count * 4);
      aux2.set([eye, shade, bust, iris], count * 4);
      count += 1;
    }
  }

  return {
    positions: positions.subarray(0, count * 3),
    aux: aux.subarray(0, count * 4),
    aux2: aux2.subarray(0, count * 4),
    count,
  };
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
    if (bustDistance(at(t)) >= 0) {
      hi = t;
      lo = t - 0.03;
      found = true;
      break;
    }
  }
  if (!found) return null;
  for (let i = 0; i < 11; i++) {
    const mid = (lo + hi) / 2;
    if (bustDistance(at(mid)) >= 0) hi = mid;
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

/* Painted relief over the lambert: in a frontal hologram the features
   read through value, not depth — sockets sleep, ridges catch light. */
function reliefShade(p: Vec3, lambert: number): number {
  const g = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number =>
    Math.exp(-(((p[0] - cx) / rx) ** 2 + ((p[1] - cy) / ry) ** 2 + ((p[2] - cz) / rz) ** 2));

  /* compact dark wells only — broad shadows would dim the whole face */
  let dark = Math.min(eyeSocketMask(p) * 1.3, 1) * 0.85;
  dark = Math.max(dark, g(0, -0.345, 0.5, 0.1, 0.02, 0.08) * 0.6); /* mouth line */
  dark = Math.max(dark, g(0, -0.19, 0.54, 0.045, 0.025, 0.08) * 0.35); /* philtrum */

  /* the face plane itself glows: the front is the bright side */
  let bright = g(0, -0.05, 0.52, 0.45, 0.55, 0.28) * 0.3;
  bright = Math.max(bright, g(0, -0.02, 0.58, 0.05, 0.2, 0.12) * 0.8); /* nose ridge */
  bright = Math.max(bright, g(0, -0.12, 0.64, 0.07, 0.06, 0.08)); /* nose tip */
  bright = Math.max(bright, g(0.21, 0.275, 0.52, 0.13, 0.035, 0.12) * 0.85); /* brow R */
  bright = Math.max(bright, g(-0.21, 0.275, 0.52, 0.13, 0.035, 0.12) * 0.85); /* brow L */
  bright = Math.max(bright, g(0, -0.3, 0.47, 0.1, 0.03, 0.08) * 0.6); /* lip bow */
  bright = Math.max(bright, g(0, -0.555, 0.36, 0.1, 0.05, 0.1) * 0.5); /* chin */
  bright = Math.max(bright, g(0.27, -0.06, 0.44, 0.1, 0.08, 0.1) * 0.5); /* cheek R */
  bright = Math.max(bright, g(-0.27, -0.06, 0.44, 0.1, 0.08, 0.1) * 0.5); /* cheek L */

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
  const back = clamp((0.18 - p[2]) * 1.5, 0, 1);
  const line = 0.5 - back * 0.58; /* hairline up front, nape low behind */
  return clamp((p[1] - line) * 3.0, 0, 1);
}

/* ============================ sdf ============================ */

export function bustDistance(p: Vec3): number {
  let d = ell(p, 0, 0.3, -0.06, 0.56, 0.55, 0.6); /* cranium */
  d = smin(d, ell(p, 0, 0.05, 0.28, 0.5, 0.44, 0.3), 0.16); /* face plane */
  d = smin(d, ell(p, 0, -0.2, 0.2, 0.44, 0.36, 0.32), 0.14); /* midface */
  d = smin(d, ell(p, 0, -0.4, 0.1, 0.34, 0.26, 0.3), 0.12); /* jaw */
  d = smin(d, ell(p, 0, -0.54, 0.26, 0.15, 0.11, 0.12), 0.08); /* chin */
  d = smin(d, ell(p, 0.24, -0.04, 0.36, 0.14, 0.16, 0.14), 0.1); /* cheek R */
  d = smin(d, ell(p, -0.24, -0.04, 0.36, 0.14, 0.16, 0.14), 0.1); /* cheek L */
  /* relief is exaggerated: the lattice only shows what really dents */
  d = smin(d, ell(p, 0, 0.04, 0.54, 0.085, 0.2, 0.13), 0.07); /* nose bridge */
  d = smin(d, sph(p, 0, -0.12, 0.62, 0.095), 0.06); /* nose tip */
  d = smin(d, sph(p, 0.085, -0.15, 0.55, 0.055), 0.04); /* wing R */
  d = smin(d, sph(p, -0.085, -0.15, 0.55, 0.055), 0.04); /* wing L */
  d = smin(d, ell(p, 0, -0.3, 0.45, 0.18, 0.05, 0.1), 0.05); /* upper lip */
  d = smin(d, ell(p, 0, -0.38, 0.44, 0.16, 0.055, 0.11), 0.05); /* lower lip */
  d = smin(d, ell(p, 0.56, 0.04, -0.05, 0.045, 0.1, 0.08), 0.04); /* ear R */
  d = smin(d, ell(p, -0.56, 0.04, -0.05, 0.045, 0.1, 0.08), 0.04); /* ear L */
  d = smin(d, ell(p, 0, -0.85, -0.04, 0.26, 0.38, 0.25), 0.1); /* neck stub */
  /* deep sockets: the lattice dives in and the gaze appears */
  d = smax(d, -ell(p, 0.2, 0.12, 0.6, 0.15, 0.075, 0.12), 0.05); /* socket R */
  d = smax(d, -ell(p, -0.2, 0.12, 0.6, 0.15, 0.075, 0.12), 0.05); /* socket L */
  /* the mouth line parts the lips */
  d = smax(d, -ell(p, 0, -0.345, 0.52, 0.13, 0.018, 0.06), 0.02);
  return d;
}

function gradient(p: Vec3): Vec3 {
  const e = 0.011;
  const g: Vec3 = [0, 0, 0];
  const q: Vec3 = [...p];
  for (let i = 0; i < 3; i++) {
    q[i] = p[i] + e;
    const a = bustDistance(q);
    q[i] = p[i] - e;
    const b = bustDistance(q);
    q[i] = p[i];
    g[i] = (a - b) / (2 * e);
  }
  return normalize(g);
}
