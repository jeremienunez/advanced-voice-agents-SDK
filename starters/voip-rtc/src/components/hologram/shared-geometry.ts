import {
  buildFaceGeometry,
  OrbSeededRng,
  type FaceGeometry,
} from "./face-geometry.js";

/* One bust for the whole studio: the face is part of the design, not a
   dice roll, and the 30k-point sculpt only ever runs once. */
let shared: FaceGeometry | null = null;

export function getSharedFaceGeometry(): FaceGeometry {
  shared ??= buildFaceGeometry(new OrbSeededRng(1337));
  return shared;
}
