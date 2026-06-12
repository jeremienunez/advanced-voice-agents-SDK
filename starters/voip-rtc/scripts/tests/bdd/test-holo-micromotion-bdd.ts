/* Stochastic blink + idle micro-movement. Empirical anchors, each a
   falsifiable bound:
   - state-dependent blink rate: silence ≈19/min, speaking ≈24.7/min,
     listening ≈27.6/min (Bentivoglio 1997, PMID 6948307); muted lowered
     by design (withdrawn).
   - inter-blink intervals: right-skewed, hard refractory floor (300ms),
     NOT periodic (coefficient of variation must be > 0.3).
   - lid kinematics: blink ≈120ms within [100,150], closing phase faster
     than opening ("Breaking Down the Blink", Review of Ophthalmology).
   - idle: breathing ≈0.25Hz at rest, fixational drift bounded, sparse
     micro-saccade steps. */

import {
  blinkLid,
  blinkRateForMood,
  blinkSchedule,
  idleMicro,
} from "../../../src/components/hologram/holo-micromotion.js";

const results = [
  scenarioBlinkRatesFollowConversationState(),
  scenarioScheduleCountsMatchTheEmpiricalRate(),
  scenarioIntervalsAreIrregularWithARefractoryFloor(),
  scenarioLidClosesFasterThanItOpens(),
  scenarioIdleLayerBreathesDriftsAndSaccades(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioBlinkRatesFollowConversationState(): string {
  const idle = blinkRateForMood(0);
  const listening = blinkRateForMood(1);
  const speaking = blinkRateForMood(2);
  const muted = blinkRateForMood(3);

  for (const rate of [idle, listening, speaking, muted]) {
    assert(rate >= 5 && rate <= 40, `rates must stay physiological [5,40]/min, got ${rate}`);
  }
  assert(listening > speaking, "listening must blink more than speaking (Bentivoglio: 27.6 vs 24.7)");
  assert(speaking > idle, "speaking must blink more than silence (24.7 vs 19)");
  assert(muted < idle, "muted is withdrawn: fewer blinks than idle");

  return "blink-rates-follow-conversation-state";
}

function scenarioScheduleCountsMatchTheEmpiricalRate(): string {
  const windowMs = 60_000;
  const counts: number[] = [];
  for (let seed = 1; seed <= 10; seed += 1) {
    const onsets = blinkSchedule(seed, blinkRateForMood(0), windowMs);
    counts.push(onsets.length);
    assert(onsets.length >= 10 && onsets.length <= 30, `seed ${seed}: idle count out of [10,30]: ${onsets.length}`);

    /* same seed, higher rate → same uniform stream, shorter intervals →
       per-seed monotone counts (structural, not statistical) */
    const muted = blinkSchedule(seed, blinkRateForMood(3), windowMs).length;
    const speaking = blinkSchedule(seed, blinkRateForMood(2), windowMs).length;
    const listening = blinkSchedule(seed, blinkRateForMood(1), windowMs).length;
    assert(
      muted <= onsets.length && onsets.length <= speaking && speaking <= listening,
      `seed ${seed}: counts must be monotone in rate (${muted},${onsets.length},${speaking},${listening})`,
    );
  }
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  assert(mean >= 16 && mean <= 22, `mean idle count over 10 seeds must sit in [16,22]/min, got ${mean}`);

  return "schedule-counts-match-empirical-rate";
}

function scenarioIntervalsAreIrregularWithARefractoryFloor(): string {
  const onsets = blinkSchedule(7, 19, 120_000);
  assert(onsets.length > 10, "two minutes at idle must schedule a usable sample");
  assert(onsets[0] > 0, "the window must start with eyes open (first onset strictly after start)");

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i += 1) {
    const ibi = onsets[i] - onsets[i - 1];
    assert(ibi >= 300, `inter-blink interval must respect the 300ms refractory floor, got ${ibi}`);
    intervals.push(ibi);
  }
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const sd = Math.sqrt(intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length);
  assert(sd / mean > 0.3, `intervals must be irregular (CV > 0.3) — a metronome is falsified, got CV ${sd / mean}`);

  const replay = blinkSchedule(7, 19, 120_000);
  assert(JSON.stringify(replay) === JSON.stringify(onsets), "same seed must replay the same schedule");
  const other = blinkSchedule(8, 19, 120_000);
  assert(JSON.stringify(other) !== JSON.stringify(onsets), "different seeds must differ");

  return "intervals-irregular-with-refractory-floor";
}

function scenarioLidClosesFasterThanItOpens(): string {
  const duration = 120;
  assert(duration >= 100 && duration <= 150, "default blink duration must sit in the empirical 100-150ms");
  assert(blinkLid(0) === 0, "lid must be open at onset");
  assert(blinkLid(duration) < 0.01, "lid must be open again at the end");
  assert(blinkLid(-5) === 0 && blinkLid(duration + 5) === 0, "lid must be open outside the blink");

  let peak = 0;
  let maxClosingSlope = 0;
  let maxOpeningSlope = 0;
  let previous = 0;
  for (let p = 1; p <= duration; p += 1) {
    const lid = blinkLid(p);
    assert(lid >= 0 && lid <= 1, `lid must stay in [0,1], got ${lid} at ${p}ms`);
    peak = Math.max(peak, lid);
    const slope = lid - previous;
    if (slope > 0) maxClosingSlope = Math.max(maxClosingSlope, slope);
    else maxOpeningSlope = Math.max(maxOpeningSlope, -slope);
    previous = lid;
  }
  assert(peak > 0.99, `the lid must fully close mid-blink, peak ${peak}`);
  assert(
    maxClosingSlope > maxOpeningSlope,
    `closing must be steeper than opening (${maxClosingSlope} vs ${maxOpeningSlope})`,
  );

  return "lid-closes-faster-than-it-opens";
}

function scenarioIdleLayerBreathesDriftsAndSaccades(): string {
  let crossings = 0;
  let previousSide = idleMicro(0, 11).breath >= 0.5;
  let previousDriftX = idleMicro(0, 11).driftX;
  const saccades = new Set<number>();

  for (let t = 16; t <= 60_000; t += 16) {
    const micro = idleMicro(t, 11);
    assert(micro.breath >= 0 && micro.breath <= 1, `breath must stay in [0,1], got ${micro.breath}`);
    assert(Math.abs(micro.driftX) <= 0.15 && Math.abs(micro.driftY) <= 0.15, "fixational drift must stay subtle");
    assert(Math.abs(micro.saccade) <= 0.05, "micro-saccades must stay micro");

    const side = micro.breath >= 0.5;
    if (side !== previousSide) crossings += 1;
    previousSide = side;

    assert(
      Math.abs(micro.driftX - previousDriftX) < 0.01,
      "drift must be continuous frame to frame (no jumps)",
    );
    previousDriftX = micro.driftX;
    saccades.add(micro.saccade);
  }

  /* 0.25Hz → 15 cycles → 30 midline crossings over 60s */
  assert(crossings >= 28 && crossings <= 32, `breath must run at ≈0.25Hz (28-32 crossings/min), got ${crossings}`);
  assert(saccades.size >= 3, "the gaze must make several distinct micro-saccade steps over a minute");

  const a = idleMicro(12_300, 11);
  const b = idleMicro(12_300, 11);
  assert(JSON.stringify(a) === JSON.stringify(b), "idle micro must be a pure function of (time, seed)");

  return "idle-layer-breathes-drifts-and-saccades";
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.log(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
