import { mouthMask } from "./masks.js";
import { surfaceGradient } from "./surface.js";
import { clamp, dot, normalize, type Vec3 } from "../vector-math.js";

const EYE_CENTERS: ReadonlyArray<Vec3> = [
  [0.2, 0.12, 0.5],
  [-0.2, 0.12, 0.5],
];
/* viewer-aligned light: the front reads uniformly bright, the sides
   fall off by curvature alone — like a scan lit from the camera */
const LIGHT_DIR: Vec3 = normalize([0.08, 0.18, 0.98]);

export function jawMask(p: Vec3): number {
  const lower = clamp(-(p[1] + 0.26) * 5, 0, 1);
  return mouthMask(p) * lower + 0.35 * Math.exp(
    -((p[0] / 0.3) ** 2 + ((p[1] + 0.5) / 0.18) ** 2 + ((p[2] - 0.28) / 0.34) ** 2),
  );
}

export function latticeReliefShade(p: Vec3): number {
  const normal = surfaceGradient(p);
  const lambert = clamp(dot(normal, LIGHT_DIR) * 0.5 + 0.5, 0, 1);
  return reliefShade(p, lambert);
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

export function eyeSocketMask(p: Vec3): number {
  let m = 0;
  for (const c of EYE_CENTERS) {
    m = Math.max(m, Math.exp(
      -(((p[0] - c[0]) / 0.1) ** 2 + ((p[1] - c[1]) / 0.062) ** 2 + ((p[2] - c[2]) / 0.14) ** 2),
    ));
  }
  return m;
}

export function irisMask(p: Vec3): number {
  for (const c of EYE_CENTERS) {
    if (p[2] > 0.4 && Math.hypot(p[0] - c[0], p[1] - c[1]) < 0.028) return 1;
  }
  return 0;
}
