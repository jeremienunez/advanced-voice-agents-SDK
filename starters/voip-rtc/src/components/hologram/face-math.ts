/* Small vector + SDF toolbox shared by the face sculpt. */

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

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

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
