/* BDD: expressiveness depth — TalkingHead-style liveliness policy and
   enriched affect presets. Falsifiable bounds: emphasis gestures fire on
   audio attacks with a refractory period (no spam), gaze wanders most
   when idle/muted and least when engaged (eye-contact ordering, TalkingHead
   defaults 0.2 idle / 0.5 speaking), the speaking head-bob is bounded and
   envelope-gated, and each affect label moves its full channel set
   (Duchenne squint on smile, head drop on concern, widened eyes on
   surprise, seeded gaze aversion on thinking). */

import {
  affectTargets,
  type AffectSignal,
} from "../../../src/components/hologram/face/affect.js";
import {
  foldEmphasis,
  initialEmphasis,
  livelinessForMood,
  speakingBob,
} from "../../../src/components/hologram/face/liveliness.js";
import { FaceRig } from "../../../src/components/hologram/face/rig.js";
import { FACE_CONTROL_KEYS } from "../../../src/components/hologram/face/controls.js";
import { assert } from "../shared/assertions.js";

const results = [
  scenarioEmphasisFiresOnAttackWithRefractory(),
  scenarioGazeWanderOrderingFollowsEngagement(),
  scenarioSpeakingBobIsBoundedAndEnvelopeGated(),
  scenarioAffectPresetsMoveTheirFullChannelSet(),
  scenarioMoodBaselinesKeepLegacyPoses(),
  scenarioStillFramesIgnoreEmphasisAndBob(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioEmphasisFiresOnAttackWithRefractory(): string {
  let state = initialEmphasis();
  state = foldEmphasis(state, 0.8, 1000);
  const peak = foldEmphasis(state, 0, 1150);
  assert(peak.pulse > 0.8, `attack spike must pulse the brows, got ${peak.pulse}`);

  /* a second spike inside the refractory window must NOT restart */
  const blocked = foldEmphasis(peak, 0.9, 1400);
  const after = foldEmphasis(blocked, 0, 1450);
  assert(
    after.pulse < 0.2,
    `spikes inside the refractory window must not re-trigger, got ${after.pulse}`,
  );

  /* after the refractory window a new spike fires again */
  const rearmed = foldEmphasis(after, 0.9, 2100);
  const second = foldEmphasis(rearmed, 0, 2250);
  assert(second.pulse > 0.8, `emphasis must re-arm after refractory, got ${second.pulse}`);

  /* weak attacks never trigger */
  let calm = initialEmphasis();
  for (let t = 0; t <= 2000; t += 50) calm = foldEmphasis(calm, 0.3, t);
  assert(calm.pulse === 0, `weak attacks must not trigger emphasis, got ${calm.pulse}`);

  return "emphasis-fires-on-attack-with-refractory";
}

function scenarioGazeWanderOrderingFollowsEngagement(): string {
  const idle = livelinessForMood(0);
  const listening = livelinessForMood(1);
  const speaking = livelinessForMood(2);
  const muted = livelinessForMood(3);
  assert(
    muted.gazeWander >= idle.gazeWander &&
      idle.gazeWander > speaking.gazeWander &&
      idle.gazeWander > listening.gazeWander,
    "gaze must wander most when disengaged (muted >= idle > engaged)",
  );
  for (const l of [idle, listening, speaking, muted]) {
    assert(
      l.gazeWander > 0 && l.gazeWander <= 1,
      "gaze wander must stay a (0,1] scale",
    );
  }
  assert(
    speaking.bobGain > 0 && idle.bobGain === 0 && listening.bobGain === 0 &&
      muted.bobGain === 0,
    "the head bob belongs to speech only",
  );
  return "gaze-wander-ordering-follows-engagement";
}

function scenarioSpeakingBobIsBoundedAndEnvelopeGated(): string {
  let peak = 0;
  let varied = false;
  let previous: number | null = null;
  for (let t = 0; t <= 4000; t += 33) {
    const bob = speakingBob(0.7, t);
    peak = Math.max(peak, Math.abs(bob));
    if (previous !== null && Math.abs(bob - previous) > 1e-4) varied = true;
    previous = bob;
  }
  assert(peak <= 0.08 + 1e-9, `head bob must stay subtle (<=0.08), got ${peak}`);
  assert(peak > 0.02, `an animated bob must actually move, got ${peak}`);
  assert(varied, "the bob must oscillate, not hold a constant offset");
  assert(speakingBob(0, 1234) === 0, "a silent envelope must produce no bob");
  return "speaking-bob-bounded-and-envelope-gated";
}

function scenarioAffectPresetsMoveTheirFullChannelSet(): string {
  const smile = affectTargets(signal("smile"), 0, 1000, 11);
  assert(smile.eyeSquint > 0.15, `smile must squint the lower lids (Duchenne), got ${smile.eyeSquint}`);

  const concern = affectTargets(signal("concern"), 0, 1000, 11);
  assert(concern.headPitch < -0.05, `concern must drop the head, got ${concern.headPitch}`);

  const surprise = affectTargets(signal("surprise"), 0, 1000, 11);
  assert(surprise.eyeWiden > 0.3, `surprise must widen the eyes, got ${surprise.eyeWiden}`);

  const thinking = affectTargets(signal("thinking"), 0, 1000, 11);
  assert(
    Math.abs(thinking.headYaw) >= 0.05,
    `thinking must avert the gaze sideways, got ${thinking.headYaw}`,
  );
  const thinkingSameSeed = affectTargets(signal("thinking"), 0, 1000, 11);
  assert(
    thinking.headYaw === thinkingSameSeed.headYaw,
    "the aversion side must be deterministic per seed",
  );

  /* head channels are signed: never clamped into [0,1] */
  assert(
    concern.headPitch >= -1 && concern.headPitch < 0,
    "head channels must keep their signed range",
  );
  return "affect-presets-move-their-full-channel-set";
}

function scenarioMoodBaselinesKeepLegacyPoses(): string {
  const listening = affectTargets(null, 1, 0, 1);
  assert(listening.eyeWiden > 0.3, "listening baseline must widen the eyes");
  assert(listening.headRoll > 0.2, "listening baseline must roll the head");
  const muted = affectTargets(null, 3, 0, 1);
  assert(muted.headPitch < -0.3, "muted baseline must bow the head");
  return "mood-baselines-keep-legacy-poses";
}

function scenarioStillFramesIgnoreEmphasisAndBob(): string {
  const rig = new FaceRig(7);
  const out = new Float32Array(FACE_CONTROL_KEYS.length);
  /* loud, spiky audio on a still (reduced-motion) frame */
  rig.update(
    { timeMs: 0, level: 0.9, mood: 2, still: true },
    out,
  );
  rig.update(
    { timeMs: 200, level: 0.9, mood: 2, still: true },
    out,
  );
  const brow = out[FACE_CONTROL_KEYS.indexOf("browInnerUp")];
  const pitch = out[FACE_CONTROL_KEYS.indexOf("headPitch")];
  assert(brow < 0.2, `still frames must not pulse the brows, got ${brow}`);
  assert(
    Math.abs(pitch) < 0.1,
    `still frames must not bob the head, got ${pitch}`,
  );
  return "still-frames-ignore-emphasis-and-bob";
}

function signal(label: AffectSignal["label"]): AffectSignal {
  return { label, intensity: 1, at: 1000 };
}
