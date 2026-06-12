import { FACE_SCAN } from "./scan.js";
import { ell, smin, sph } from "./math.js";
import { beardMask } from "./masks.js";
import { clamp, type Vec3 } from "../vector-math.js";

/** Core head SDF, before the photo hull. The hair volumes deliberately
    overshoot the subject's silhouette: the front-photo hull is the one
    that carves them down to the exact contour. */
export function skullCoreDistance(p: Vec3): number {
  let d = ell(p, 0, 0.3, -0.06, 0.56, 0.55, 0.6);
  d = smin(d, ell(p, 0, 0.05, 0.28, 0.5, 0.44, 0.3), 0.16);
  d = smin(d, ell(p, 0, -0.2, 0.2, 0.42, 0.36, 0.32), 0.14);
  d = smin(d, ell(p, 0, -0.4, 0.1, 0.33, 0.26, 0.3), 0.12);
  d = smin(d, ell(p, 0, -0.55, 0.26, 0.15, 0.12, 0.13), 0.08);
  d = smin(d, ell(p, 0.26, 0.0, 0.34, 0.13, 0.15, 0.14), 0.1);
  d = smin(d, ell(p, -0.26, 0.0, 0.34, 0.13, 0.15, 0.14), 0.1);
  d = smin(d, ell(p, 0, 0.58, -0.04, 0.55, 0.5, 0.58), 0.08);
  d = smin(d, ell(p, 0, 0.78, 0.2, 0.34, 0.3, 0.32), 0.09);
  d = smin(d, ell(p, 0, 0.4, -0.3, 0.5, 0.55, 0.6), 0.07);
  d = smin(d, ell(p, 0.56, 0.04, -0.05, 0.045, 0.1, 0.08), 0.04);
  d = smin(d, ell(p, -0.56, 0.04, -0.05, 0.045, 0.1, 0.08), 0.04);
  d = smin(d, ell(p, 0, -0.85, -0.04, 0.26, 0.38, 0.25), 0.1);
  d = smin(d, sph(p, 0, -0.12, 0.6, 0.07), 0.09);
  d -= beardMask(p) * 0.018;
  return d;
}

/** Structural head SDF: the core sculpt intersected with the two-view
    photo hull (front xy + right-profile zy), so the hair contour and
    the occiput/nape depth match the reference subject exactly. */
export function skullDistance(p: Vec3): number {
  let d = skullCoreDistance(p);
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

function smooth01(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Signed distance to a flat-pair polygon in head-frame xy (negative inside). */
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
