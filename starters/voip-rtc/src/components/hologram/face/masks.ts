import { clamp, type Vec3 } from "../vector-math.js";

export function mouthMask(p: Vec3): number {
  return Math.exp(
    -((p[0] / 0.24) ** 2 + ((p[1] + 0.33) / 0.12) ** 2 + ((p[2] - 0.45) / 0.26) ** 2),
  );
}

export function hairMask(p: Vec3): number {
  if (p[1] < -0.62) return 0;
  const theta = Math.atan2(p[0], p[2]);
  const around = Math.abs(theta) / Math.PI;
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
  let m = g(0, -0.52, 0.3, 0.2, 0.17, 0.2);
  m = Math.max(m, g(0.29, -0.4, 0.16, 0.16, 0.18, 0.24));
  m = Math.max(m, g(-0.29, -0.4, 0.16, 0.16, 0.18, 0.24));
  m = Math.max(m, g(0, -0.295, 0.5, 0.13, 0.045, 0.1));
  m = Math.max(m, g(0.44, -0.14, 0.04, 0.09, 0.24, 0.18));
  m = Math.max(m, g(-0.44, -0.14, 0.04, 0.09, 0.24, 0.18));
  m *= 1 - Math.min(1, g(0, -0.385, 0.48, 0.09, 0.04, 0.09) * 1.4);
  return clamp(m * 1.25, 0, 1);
}

/** Brow arches: one gaussian band just above each eye socket. */
export function browMask(p: Vec3): number {
  const g = (cx: number): number =>
    Math.exp(-(((p[0] - cx) / 0.15) ** 2 + ((p[1] - 0.24) / 0.075) ** 2 + ((p[2] - 0.48) / 0.16) ** 2));
  return clamp(Math.max(g(0.2), g(-0.2)) * 1.15, 0, 1);
}

function smooth01(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
