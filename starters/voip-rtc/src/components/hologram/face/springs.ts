/* Analytic damped-harmonic integrator for the face controls. The step is
   the EXACT closed-form flow of w'' + 2ζω w' + ω²(w − target) = 0, so it
   is unconditionally stable and step-size independent: composing many
   small steps lands exactly where one big step lands, even across rAF
   frame drops. (Explicit Euler fails both — asserted by BDD.) */

import {
  CONTROL_DYNAMICS,
  FACE_CONTROL_KEYS,
  neutralControls,
  type ControlDynamics,
  type FaceControls,
} from "./controls.js";

export interface FaceSpringState {
  readonly values: FaceControls;
  readonly velocities: FaceControls;
}

export function createSpringState(): FaceSpringState {
  return { values: neutralControls(), velocities: neutralControls() };
}

/** One exact step of the damped oscillator toward `target`. */
export function springStep(
  value: number,
  velocity: number,
  target: number,
  dtMs: number,
  dynamics: ControlDynamics,
): { value: number; velocity: number } {
  if (dynamics.snap) return { value: target, velocity: 0 };

  const t = dtMs / 1000;
  const w = dynamics.omega;
  const z = Math.min(1, Math.max(0.05, dynamics.zeta));
  const x0 = value - target;
  const v0 = velocity;

  if (z >= 1) {
    /* critically damped: x(t) = e^{-ωt} (x0 + (v0 + ωx0) t) */
    const e = Math.exp(-w * t);
    const c = v0 + w * x0;
    const x = e * (x0 + c * t);
    const v = e * (v0 - w * c * t);
    return { value: target + x, velocity: v };
  }

  /* underdamped: oscillation under a decaying envelope */
  const wd = w * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * w * t);
  const cos = Math.cos(wd * t);
  const sin = Math.sin(wd * t);
  const b = (v0 + z * w * x0) / wd;
  const x = e * (x0 * cos + b * sin);
  const v = -z * w * x + e * wd * (b * cos - x0 * sin);
  return { value: target + x, velocity: v };
}

/** Steps all 20 controls and clamps each into its bounds. Pure. */
export function stepControls(
  state: FaceSpringState,
  targets: FaceControls,
  dtMs: number,
): FaceSpringState {
  const values = {} as FaceControls;
  const velocities = {} as FaceControls;
  for (const key of FACE_CONTROL_KEYS) {
    const dynamics = CONTROL_DYNAMICS[key];
    const target = Math.min(dynamics.max, Math.max(dynamics.min, targets[key]));
    const next = springStep(state.values[key], state.velocities[key], target, dtMs, dynamics);
    values[key] = Math.min(dynamics.max, Math.max(dynamics.min, next.value));
    velocities[key] = next.velocity;
  }
  return { values, velocities };
}
