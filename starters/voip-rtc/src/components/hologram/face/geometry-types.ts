import type { Vec3 } from "../vector-math.js";

export interface FaceGeometry {
  /** xyz triplets in head space (y up, z toward the viewer). */
  readonly positions: Float32Array;
  /** per point: jawMask, hairMask, warmMask, random. */
  readonly aux: Float32Array;
  /** per point: eyeMask, shade, bustFade, irisMask. */
  readonly aux2: Float32Array;
  /** per point: dot-size factor (the scan layer is finer grained). */
  readonly scale: Float32Array;
  /** per point: brow-arch mask (drives brow raise/knit controls). */
  readonly brow: Float32Array;
  readonly count: number;
}

export interface FacePointRecord {
  p: Vec3;
  aux: [number, number, number, number];
  aux2: [number, number, number, number];
  scale: number;
  brow: number;
}
