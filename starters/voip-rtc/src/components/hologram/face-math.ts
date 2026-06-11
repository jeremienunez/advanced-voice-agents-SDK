/* SDF toolbox shared by the face sculpt. */

import type { Vec3 } from "./vector-math.js";

export { type Vec3, type Vec4 } from "./vector-math.js";

export function ell(
  p: Vec3,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
): number {
  const qx = (p[0] - cx) / rx;
  const qy = (p[1] - cy) / ry;
  const qz = (p[2] - cz) / rz;
  return (Math.sqrt(qx * qx + qy * qy + qz * qz) - 1) * Math.min(rx, ry, rz);
}

export function sph(p: Vec3, cx: number, cy: number, cz: number, r: number): number {
  return Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) - r;
}

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}
