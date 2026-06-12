/* Face rig foundation: 20 named facial controls (ARKit/FACS-style) and
   the analytic damped-harmonic integrator that eases them. Falsifiable
   bounds: the integrator must be step-size independent (exact flow, not
   Euler), never blow past bounds on rAF dt spikes, and the per-control
   dynamics must keep the documented speed ordering (lips > corners >
   brows > head). */

import {
  CONTROL_DYNAMICS,
  FACE_CONTROL_KEYS,
  clampControls,
  neutralControls,
  type FaceControlKey,
} from "../../../src/components/hologram/face/controls.js";
import {
  createSpringState,
  stepControls,
  type FaceSpringState,
} from "../../../src/components/hologram/face/springs.js";
import {
  foldAudioLevel,
  initialAudioEnvelope,
  mouthTargetsFromAudio,
} from "../../../src/components/hologram/face/audio.js";
import { affectTargets } from "../../../src/components/hologram/face/affect.js";
import { FaceRig } from "../../../src/components/hologram/face/rig.js";

const results = [
  scenarioTwentyControlsWithBoundedNeutral(),
  scenarioSpringIsStepSizeIndependent(),
  scenarioSpringSurvivesFrameDropsWithoutBlowup(),
  scenarioDynamicsKeepTheDocumentedSpeedOrdering(),
  scenarioSnapChannelsFollowTargetsExactly(),
  scenarioSilenceClosesTheMouthAndAttackOpensIt(),
  scenarioAffectIsAsymmetricAndDecaysToTheMoodBaseline(),
  scenarioRigIntegratesAllSourcesBounded(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioTwentyControlsWithBoundedNeutral(): string {
  assert(FACE_CONTROL_KEYS.length === 20, `rig must expose exactly 20 controls, got ${FACE_CONTROL_KEYS.length}`);
  assert(new Set(FACE_CONTROL_KEYS).size === 20, "control keys must be unique");

  const neutral = neutralControls();
  for (const key of FACE_CONTROL_KEYS) {
    assert(neutral[key] === 0, `neutral pose must be all zeros, ${key}=${neutral[key]}`);
    const dyn = CONTROL_DYNAMICS[key];
    assert(dyn.min < dyn.max, `${key} bounds must be ordered`);
    assert(dyn.min >= -1 && dyn.max <= 1, `${key} bounds must stay inside [-1,1]`);
  }

  const wild = { ...neutral, jawOpen: 5, headYaw: -3, mouthSmileL: 2 };
  const clamped = clampControls(wild);
  assert(clamped.jawOpen === CONTROL_DYNAMICS.jawOpen.max, "jawOpen must clamp to its max");
  assert(clamped.headYaw === CONTROL_DYNAMICS.headYaw.min, "headYaw must clamp to its (signed) min");
  assert(CONTROL_DYNAMICS.headYaw.min === -1, "head channels must be signed");
  assert(CONTROL_DYNAMICS.jawOpen.min === 0, "unipolar channels must floor at 0");

  return "twenty-controls-with-bounded-neutral";
}

/* The analytic step is an exact flow: composing many small steps must
   land exactly where one big step lands. Explicit Euler fails this. */
function scenarioSpringIsStepSizeIndependent(): string {
  const targets = { ...neutralControls(), mouthSmileL: 1, headPitch: -0.8 };

  const fine = walk(createSpringState(), targets, 8, 125); /* 1000ms */
  const coarse = walk(createSpringState(), targets, 50, 20); /* 1000ms */

  for (const key of ["mouthSmileL", "headPitch"] as FaceControlKey[]) {
    const drift = Math.abs(fine.values[key] - coarse.values[key]);
    assert(
      drift < 1e-6,
      `integrator must be step-size independent, ${key} drifted ${drift} between 8ms and 50ms steps`,
    );
  }

  return "spring-is-step-size-independent";
}

function scenarioSpringSurvivesFrameDropsWithoutBlowup(): string {
  const targets = { ...neutralControls(), jawOpen: 1, browInnerUp: 1, headYaw: 1 };
  let state = createSpringState();
  const spikes = [8, 16, 33, 50, 50, 16, 8, 33, 50, 16];

  let previousDistance = Number.POSITIVE_INFINITY;
  for (let round = 0; round < 60; round += 1) {
    state = stepControls(state, targets, spikes[round % spikes.length]);
    for (const key of FACE_CONTROL_KEYS) {
      const dyn = CONTROL_DYNAMICS[key];
      const overshootRoom = 0.05 * (dyn.max - dyn.min);
      assert(
        state.values[key] >= dyn.min - overshootRoom && state.values[key] <= dyn.max + overshootRoom,
        `${key} must never blow past its bounds under dt spikes, got ${state.values[key]} at round ${round}`,
      );
    }
    const distance = Math.abs(state.values.jawOpen - 1);
    if (round > 20) {
      assert(distance <= previousDistance + 1e-9, `convergence must be monotone late, round ${round}`);
    }
    previousDistance = distance;
  }
  assert(Math.abs(state.values.jawOpen - 1) < 0.01, "jawOpen must converge to its target within ~1.5s");
  assert(Math.abs(state.values.headYaw - 1) < 0.2, "headYaw (slowest) must still be on its way or settled");

  return "spring-survives-frame-drops-without-blowup";
}

function scenarioDynamicsKeepTheDocumentedSpeedOrdering(): string {
  const lips = settleTimeMs("jawOpen");
  const corners = settleTimeMs("mouthSmileL");
  const brows = settleTimeMs("browInnerUp");
  const head = settleTimeMs("headYaw");

  assert(lips < corners, `lips must settle before mouth corners (${lips} vs ${corners})`);
  assert(corners < brows, `mouth corners must settle before brows (${corners} vs ${brows})`);
  assert(brows < head, `brows must settle before the head (${brows} vs ${head})`);
  assert(lips <= 250, `speech lips must settle within 250ms, got ${lips}`);
  assert(head <= 1500, `head must settle within 1.5s, got ${head}`);

  return "dynamics-keep-documented-speed-ordering";
}

function scenarioSnapChannelsFollowTargetsExactly(): string {
  const targets = { ...neutralControls(), eyeBlinkL: 0.83, eyeBlinkR: 0.27, breath: 0.4 };
  const state = stepControls(createSpringState(), targets, 16);

  assert(state.values.eyeBlinkL === 0.83, "blink lids are profile-driven and must snap, not spring");
  assert(state.values.eyeBlinkR === 0.27, "each lid snaps independently");
  assert(state.values.breath === 0.4, "breath is already a smooth waveform and must snap");

  const again = stepControls(createSpringState(), targets, 16);
  assert(
    JSON.stringify(again) === JSON.stringify(state),
    "stepping identical inputs must be deterministic",
  );

  return "snap-channels-follow-targets-exactly";
}

function scenarioSilenceClosesTheMouthAndAttackOpensIt(): string {
  /* 2s of silence: the mouth must settle closed */
  let env = initialAudioEnvelope();
  for (let i = 0; i < 125; i += 1) env = foldAudioLevel(env, 0, 16);
  const silent = mouthTargetsFromAudio(env);
  assert(silent.jawOpen < 0.02, `silence must close the jaw, got ${silent.jawOpen}`);
  assert(silent.mouthClose > 0.9, `sustained silence must press the lips, got ${silent.mouthClose}`);
  assert(silent.glowMouth < 0.05, "no voice, no mouth glow");

  /* a sharp voice onset: jaw opens fast, attack registers, silence resets */
  env = foldAudioLevel(env, 0.8, 16);
  const onset = mouthTargetsFromAudio(env);
  assert(env.attack > 0.3, `a step from silence to 0.8 must register as attack, got ${env.attack}`);
  assert(env.silence < 0.1, "voice must reset the silence detector");
  for (let i = 0; i < 12; i += 1) env = foldAudioLevel(env, 0.8, 16);
  const sustained = mouthTargetsFromAudio(env);
  assert(sustained.jawOpen > 0.5, `200ms of voice must open the jaw, got ${sustained.jawOpen}`);
  assert(sustained.jawOpen > onset.jawOpen, "the envelope must keep rising during the attack");
  assert(env.attack < 0.3, "attack must decay once the level holds steady");

  /* bounded for any level sequence */
  let wild = initialAudioEnvelope();
  for (let i = 0; i < 200; i += 1) {
    wild = foldAudioLevel(wild, Math.abs(Math.sin(i * 12.9898)) * 1.5, 16);
    const t = mouthTargetsFromAudio(wild);
    for (const v of [t.jawOpen, t.mouthClose, t.glowMouth]) {
      assert(v >= 0 && v <= 1, `audio targets must stay in [0,1], got ${v}`);
    }
  }

  return "silence-closes-the-mouth-attack-opens-it";
}

function scenarioAffectIsAsymmetricAndDecaysToTheMoodBaseline(): string {
  const baseline = affectTargets(null, 2, 0, 5);
  assert(
    baseline.mouthSmileL + baseline.mouthSmileR > 0.3,
    "speaking baseline must carry a smile (parity with the old moodExpression)",
  );
  const muted = affectTargets(null, 3, 0, 5);
  assert(muted.mouthFrownL + muted.mouthFrownR > 0.3, "muted baseline must drop the corners");
  const idle = affectTargets(null, 0, 0, 5);
  assert(
    idle.mouthSmileL === 0 && idle.browInnerUp === 0 && idle.browDown === 0,
    "idle baseline must stay neutral",
  );

  /* a fresh LLM smile: both corners up, asymmetric, bounded */
  const fresh = affectTargets({ label: "smile", intensity: 1, at: 10_000 }, 0, 10_000, 5);
  assert(fresh.mouthSmileL > 0.3 && fresh.mouthSmileR > 0.3, "smile must lift both corners");
  const diff = Math.abs(fresh.mouthSmileL - fresh.mouthSmileR);
  const peak = Math.max(fresh.mouthSmileL, fresh.mouthSmileR);
  assert(diff > 0, "expression must be asymmetric — perfect symmetry reads as dead");
  assert(diff <= 0.3 * peak, `asymmetry must stay subtle (|L-R| <= 0.3*peak), got ${diff} vs ${peak}`);

  /* decay: after 3 time constants, within 5% of the mood baseline */
  const later = affectTargets({ label: "smile", intensity: 1, at: 10_000 }, 0, 10_000 + 18_000, 5);
  assert(
    Math.abs(later.mouthSmileL - idle.mouthSmileL) < 0.05,
    `affect must decay to the mood baseline within 3τ, got ${later.mouthSmileL}`,
  );

  /* distinct labels move distinct regions */
  const concern = affectTargets({ label: "concern", intensity: 1, at: 0 }, 0, 0, 5);
  assert(concern.mouthFrownL > 0 && concern.browInnerUp > 0, "concern must frown and knit the brows");
  const surprise = affectTargets({ label: "surprise", intensity: 1, at: 0 }, 0, 0, 5);
  assert(surprise.browOuterUpL > 0 && surprise.browOuterUpR > 0, "surprise must raise the brows");
  const thinking = affectTargets({ label: "thinking", intensity: 1, at: 0 }, 0, 0, 5);
  assert(thinking.browDown > 0, "thinking must lower the brows");

  return "affect-asymmetric-and-decays-to-mood-baseline";
}

function scenarioRigIntegratesAllSourcesBounded(): string {
  const idx = (key: string): number => FACE_CONTROL_KEYS.indexOf(key as never);
  const out = new Float32Array(FACE_CONTROL_KEYS.length);

  /* listening for 2.5s: posture parity with the legacy mood expression */
  const rig = new FaceRig(7);
  for (let t = 16; t <= 2500; t += 16) {
    rig.update({ timeMs: t, level: 0, mood: 1 }, out);
    for (let i = 0; i < out.length; i += 1) {
      const dyn = CONTROL_DYNAMICS[FACE_CONTROL_KEYS[i]];
      assert(out[i] >= dyn.min && out[i] <= dyn.max, `rig output ${FACE_CONTROL_KEYS[i]} out of bounds: ${out[i]}`);
    }
  }
  assert(out[idx("eyeWiden")] > 0.3, "listening must widen the eyes (legacy parity)");
  assert(out[idx("headRoll")] > 0.2, "listening must roll the head, attentive");

  /* muted: bowed head */
  const mutedRig = new FaceRig(7);
  for (let t = 16; t <= 2500; t += 16) mutedRig.update({ timeMs: t, level: 0, mood: 3 }, out);
  assert(out[idx("headPitch")] < -0.3, "muted must bow the head (negative pitch)");

  /* still frame: complete calm pose, eyes open, mid breath */
  const stillRig = new FaceRig(7);
  const micro = stillRig.update({ timeMs: 12_300, level: 0, mood: 0, still: true }, out);
  assert(micro === null, "still frames must not run the idle layer");
  assert(out[idx("eyeBlinkL")] === 0 && out[idx("eyeBlinkR")] === 0, "still frames keep the eyes open");
  assert(out[idx("breath")] === 0.5, "still frames hold a calm mid-breath");
  assert(out[idx("mouthClose")] > 0.0, "a silent still pose rests the mouth closed");

  return "rig-integrates-all-sources-bounded";
}

function walk(
  state: FaceSpringState,
  targets: ReturnType<typeof neutralControls>,
  dtMs: number,
  steps: number,
): FaceSpringState {
  let current = state;
  for (let i = 0; i < steps; i += 1) {
    current = stepControls(current, targets, dtMs);
  }
  return current;
}

function settleTimeMs(key: FaceControlKey): number {
  const targets = { ...neutralControls(), [key]: 1 };
  let state = createSpringState();
  for (let t = 16; t <= 4000; t += 16) {
    state = stepControls(state, targets, 16);
    if (Math.abs(state.values[key] - 1) < 0.01) return t;
  }
  return 4000;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.log(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
