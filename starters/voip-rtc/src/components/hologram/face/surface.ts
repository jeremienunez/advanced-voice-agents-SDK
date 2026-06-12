import { skullDistance } from "./sdf.js";
import { normalize, type Vec3 } from "../vector-math.js";

/* march outward from inside the head to the first surface crossing */
export function castToSurface(origin: Vec3, dir: Vec3): Vec3 | null {
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

export function surfaceGradient(p: Vec3): Vec3 {
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
