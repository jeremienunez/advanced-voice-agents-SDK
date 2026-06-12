/* The face rig's vocabulary: 20 named facial controls (ARKit/FACS-style
   coefficients) and their per-control dynamics. Pure data — the spring
   integrator (face-springs) and the renderer consume this single source
   of truth. Speed ordering is a design contract asserted by BDD:
   lips settle before mouth corners, corners before brows, brows before
   the head. */

export type FaceControlKey =
  | "jawOpen"
  | "mouthClose"
  | "mouthFunnel"
  | "mouthSmileL"
  | "mouthSmileR"
  | "mouthFrownL"
  | "mouthFrownR"
  | "glowMouth"
  | "eyeBlinkL"
  | "eyeBlinkR"
  | "eyeWiden"
  | "eyeSquint"
  | "browInnerUp"
  | "browOuterUpL"
  | "browOuterUpR"
  | "browDown"
  | "headYaw"
  | "headPitch"
  | "headRoll"
  | "breath";

export type FaceControls = Record<FaceControlKey, number>;

export interface ControlDynamics {
  /** Natural frequency in rad/s — higher settles faster. */
  readonly omega: number;
  /** Damping ratio; 1 = critically damped (no overshoot). */
  readonly zeta: number;
  readonly min: number;
  readonly max: number;
  /** Profile-driven channels (blink lids, breath waveform) bypass the
      spring: their source already encodes the temporal shape. */
  readonly snap?: boolean;
}

const LIPS = { omega: 30, zeta: 1, min: 0, max: 1 } as const;
const VISEME = { omega: 26, zeta: 1, min: 0, max: 1 } as const;
const CORNER = { omega: 16, zeta: 1, min: 0, max: 1 } as const;
const BROW = { omega: 10, zeta: 1, min: 0, max: 1 } as const;
const HEAD = { omega: 5.5, zeta: 1, min: -1, max: 1 } as const;
const SNAP = { omega: 0, zeta: 1, min: 0, max: 1, snap: true } as const;

export const CONTROL_DYNAMICS: Record<FaceControlKey, ControlDynamics> = {
  jawOpen: LIPS,
  mouthClose: LIPS,
  mouthFunnel: VISEME,
  mouthSmileL: CORNER,
  mouthSmileR: CORNER,
  mouthFrownL: CORNER,
  mouthFrownR: CORNER,
  glowMouth: LIPS,
  eyeBlinkL: SNAP,
  eyeBlinkR: SNAP,
  eyeWiden: { omega: 18, zeta: 1, min: 0, max: 1 },
  eyeSquint: { omega: 18, zeta: 1, min: 0, max: 1 },
  browInnerUp: BROW,
  browOuterUpL: BROW,
  browOuterUpR: BROW,
  browDown: BROW,
  headYaw: HEAD,
  headPitch: HEAD,
  headRoll: HEAD,
  breath: SNAP,
};

export const FACE_CONTROL_KEYS = Object.keys(CONTROL_DYNAMICS) as readonly FaceControlKey[];

export function neutralControls(): FaceControls {
  const controls = {} as FaceControls;
  for (const key of FACE_CONTROL_KEYS) controls[key] = 0;
  return controls;
}

export function clampControls(controls: FaceControls): FaceControls {
  const clamped = {} as FaceControls;
  for (const key of FACE_CONTROL_KEYS) {
    const { min, max } = CONTROL_DYNAMICS[key];
    clamped[key] = Math.min(max, Math.max(min, controls[key]));
  }
  return clamped;
}
