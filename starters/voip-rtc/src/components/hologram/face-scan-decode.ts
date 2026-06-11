/* Decoder for the committed face-scan asset (see scripts/face-scan/).
   The asset is a quantized point cloud of the reference subject's face:
   positions in head space (Int16 / 8000) and photo luminance baked as
   the shade channel (Uint8 / 255). */

export interface FaceScanData {
  /** points in the cloud (0 when the asset has not been generated). */
  readonly count: number;
  /** base64 Int16 xyz triplets, quantized by POS_SCALE. */
  readonly pos: string;
  /** base64 Uint8 luminance per point. */
  readonly shade: string;
  /** face-window polygon in head-frame xy (flat pairs), pre-shrunk —
      lattice points falling inside it make way for the scan layer. */
  readonly window: ReadonlyArray<number>;
  /** head silhouette traced from the front photo (head-frame xy flat
      pairs, crown to jaw) — the skull SDF is hulled against it so the
      hair contour is photo-exact. Empty = unconstrained. */
  readonly hullFront?: ReadonlyArray<number>;
  /** head silhouette traced from the right-profile photo (head-frame zy
      flat pairs) — second visual-hull view: occiput depth, nape taper,
      quiff overhang. Scan points are pre-clamped inside it at pack time.
      Empty = unconstrained. */
  readonly hullSide?: ReadonlyArray<number>;
  /** points in the baked skull/hair layer (hull-surface rings with
      triplanar photo luminance). 0 = fall back to the SDF lattice. */
  readonly skullCount?: number;
  /** base64 Int16 xyz triplets for the skull layer. */
  readonly skullPos?: string;
  /** base64 Uint8 luminance per skull point. */
  readonly skullShade?: string;
}

export interface FaceScan {
  readonly count: number;
  readonly positions: Float32Array;
  readonly shade: Float32Array;
  readonly window: ReadonlyArray<number>;
  readonly hullFront: ReadonlyArray<number>;
  readonly hullSide: ReadonlyArray<number>;
  readonly skullCount: number;
  readonly skullPositions: Float32Array;
  readonly skullShade: Float32Array;
}

export const POS_SCALE = 8000;

function b64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodeFaceScan(data: FaceScanData): FaceScan {
  const decodeLayer = (count: number, posB64: string, shadeB64: string) => {
    const positions = new Float32Array(count * 3);
    const shade = new Float32Array(count);
    if (count > 0) {
      const posBytes = b64ToBytes(posB64);
      const posInts = new Int16Array(posBytes.buffer, posBytes.byteOffset, count * 3);
      for (let i = 0; i < posInts.length; i++) positions[i] = posInts[i] / POS_SCALE;
      const shadeBytes = b64ToBytes(shadeB64);
      for (let i = 0; i < count; i++) shade[i] = shadeBytes[i] / 255;
    }
    return { positions, shade };
  };
  const face = decodeLayer(data.count, data.pos, data.shade);
  const skullCount = data.skullCount ?? 0;
  const skull = decodeLayer(skullCount, data.skullPos ?? "", data.skullShade ?? "");
  return {
    count: data.count,
    positions: face.positions,
    shade: face.shade,
    window: data.window,
    hullFront: data.hullFront ?? [],
    hullSide: data.hullSide ?? [],
    skullCount,
    skullPositions: skull.positions,
    skullShade: skull.shade,
  };
}

/** Even-odd test against the face window polygon (head-frame xy). */
export function insideFaceWindow(
  x: number,
  y: number,
  window: ReadonlyArray<number>,
): boolean {
  let inside = false;
  const n = window.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = window[i * 2], yi = window[i * 2 + 1];
    const xj = window[j * 2], yj = window[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
