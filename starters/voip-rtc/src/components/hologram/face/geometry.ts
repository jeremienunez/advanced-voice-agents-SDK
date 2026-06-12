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

import { FACE_SCAN } from "./scan.js";
import { decodeFaceScan } from "./scan-decode.js";
import {
  appendLatticeLayer,
  appendScanLayer,
  appendSkullLayer,
  faceLayerBudget,
} from "./layers.js";
import type { FaceGeometry, FacePointRecord } from "./geometry-types.js";
import type { OrbRng } from "../orb-rng.js";

export type { FaceGeometry } from "./geometry-types.js";

export function buildFaceGeometry(rng: OrbRng, targetPoints = 30000): FaceGeometry {
  const scan = decodeFaceScan(FACE_SCAN);
  const budget = faceLayerBudget(scan, targetPoints);
  const records: FacePointRecord[] = [];

  appendLatticeLayer(records, { rng, scan, ...budget });
  appendSkullLayer(records, { rng, scan, skullTake: budget.skullTake });
  appendScanLayer(records, { rng, scan, scanTake: budget.scanTake });

  return packFaceGeometry(records);
}

function packFaceGeometry(records: FacePointRecord[]): FaceGeometry {
  /* crown-to-neck order: the merged cloud still reads as a scan sweep */
  records.sort((a, b) => b.p[1] - a.p[1]);

  const count = records.length;
  const positions = new Float32Array(count * 3);
  const aux = new Float32Array(count * 4);
  const aux2 = new Float32Array(count * 4);
  const scale = new Float32Array(count);
  const brow = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set(records[i].p, i * 3);
    aux.set(records[i].aux, i * 4);
    aux2.set(records[i].aux2, i * 4);
    scale[i] = records[i].scale;
    brow[i] = records[i].brow;
  }

  return { positions, aux, aux2, scale, brow, count };
}
