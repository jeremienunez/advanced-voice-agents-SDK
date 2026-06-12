/* BDD: ThreeLS-style viseme mapping (Llorach et al. 2016) — the mouth
   SHAPE must follow the spectral distribution, not just the loudness:
   open vowels drop the jaw, hollow-mid "oo" rounds the lips (funnel),
   sibilants close the lips. Falsifiable bounds per spectral profile,
   plus strict envelope-only parity when no bands are available. */

import {
  foldAudioLevel,
  initialAudioEnvelope,
  mouthTargetsFromAudio,
  type AudioEnvelope,
} from "../../../src/components/hologram/face/audio.js";
import { mouthTargets } from "../../../src/components/hologram/face/viseme.js";
import { assert } from "../shared/assertions.js";

const results = [
  scenarioOpenVowelDropsTheJaw(),
  scenarioHollowMidRoundsTheLips(),
  scenarioSibilantClosesTheLips(),
  scenarioWithoutBandsParityWithEnvelopeMapping(),
  scenarioQuietAudioKeepsTheMouthCalm(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

/** Broad low-frequency vowel ("aa"): energy in the low bands, mid
    populated — jaw opens, no kiss rounding. */
function scenarioOpenVowelDropsTheJaw(): string {
  const t = mouthTargets(voiced(0.7), [0.45, 0.2, 0.3, 0.05]);
  assert(t.jawOpen > 0.4, `open vowel must drop the jaw, got ${t.jawOpen}`);
  assert(
    t.mouthFunnel < 0.35,
    `broad spectrum must not round the lips, got ${t.mouthFunnel}`,
  );
  assert(t.mouthClose < 0.2, `voiced vowel must not close lips, got ${t.mouthClose}`);
  return "open-vowel-drops-the-jaw";
}

/** Rounded vowel ("oo"): low-mid formant present, 700-3000 band hollow —
    the funnel must clearly exceed the broad-vowel case. */
function scenarioHollowMidRoundsTheLips(): string {
  const oo = mouthTargets(voiced(0.7), [0.4, 0.35, 0.2, 0.05]);
  const aa = mouthTargets(voiced(0.7), [0.45, 0.2, 0.3, 0.05]);
  assert(oo.mouthFunnel > 0.3, `hollow mid must round the lips, got ${oo.mouthFunnel}`);
  assert(
    oo.mouthFunnel > 1.5 * aa.mouthFunnel,
    `"oo" must round clearly more than "aa": ${oo.mouthFunnel} vs ${aa.mouthFunnel}`,
  );
  return "hollow-mid-rounds-the-lips";
}

/** Sibilant ("ss"): high-band dominant — lips close, jaw stays shut. */
function scenarioSibilantClosesTheLips(): string {
  const t = mouthTargets(voiced(0.5), [0.05, 0.05, 0.2, 0.7]);
  assert(t.mouthClose > 0.7, `sibilant must close the lips, got ${t.mouthClose}`);
  assert(t.jawOpen < 0.15, `sibilant must not drop the jaw, got ${t.jawOpen}`);
  return "sibilant-closes-the-lips";
}

/** No spectral data (HologramBust preview, legacy streams): the mapping
    must equal the envelope-only path exactly. */
function scenarioWithoutBandsParityWithEnvelopeMapping(): string {
  for (const env of [voiced(0.0), voiced(0.3), voiced(0.9)]) {
    const legacy = mouthTargetsFromAudio(env);
    for (const bands of [null, [0, 0, 0, 0] as const]) {
      const t = mouthTargets(env, bands);
      assert(
        t.jawOpen === legacy.jawOpen &&
          t.mouthClose === legacy.mouthClose &&
          t.glowMouth === legacy.glowMouth &&
          t.mouthFunnel === 0,
        `bands-less mapping must match the envelope path (env ${env.envelope})`,
      );
    }
  }
  return "without-bands-parity-with-envelope-mapping";
}

/** Quiet input: whatever the spectral distribution claims, a silent
    envelope keeps the mouth closed and unrounded. */
function scenarioQuietAudioKeepsTheMouthCalm(): string {
  const t = mouthTargets(quiet(), [0.4, 0.35, 0.2, 0.05]);
  assert(t.jawOpen < 0.05, `silence must keep the jaw shut, got ${t.jawOpen}`);
  assert(t.mouthFunnel < 0.05, `silence must not round the lips, got ${t.mouthFunnel}`);
  assert(t.mouthClose > 0.5, `sustained silence must press the lips, got ${t.mouthClose}`);
  return "quiet-audio-keeps-the-mouth-calm";
}

/** Envelope settled at a given voiced level (fold until steady). */
function voiced(level: number): AudioEnvelope {
  let env = initialAudioEnvelope();
  for (let i = 0; i < 60; i += 1) env = foldAudioLevel(env, level, 16);
  return env;
}

function quiet(): AudioEnvelope {
  let env = initialAudioEnvelope();
  for (let i = 0; i < 120; i += 1) env = foldAudioLevel(env, 0, 16);
  return env;
}
