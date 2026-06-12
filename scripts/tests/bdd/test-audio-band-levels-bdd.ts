/* BDD: pcm16BandLevels — the 4-band spectral distribution that feeds the
   starter's viseme mapper (ThreeLS band split: 0-500 / 500-700 /
   700-3000 / 3000-6000 Hz; Llorach et al. 2016). Bounds are falsifiable:
   a pure tone must land in its band regardless of gain or sample rate,
   silence must be all-zero, and noise must never read as a pure tone. */

import { pcm16BandLevels } from "../../../src/client/browser/session/audio-level.js";

const results = [
  scenarioPureTonesLandInTheirBand(),
  scenarioDistributionIsGainInvariant(),
  scenarioSilenceYieldsZeroBands(),
  scenarioNoiseNeverReadsAsPureTone(),
  scenarioSampleRateIndependence(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioPureTonesLandInTheirBand(): string {
  const cases: Array<{ hz: number; band: number }> = [
    { hz: 300, band: 0 },
    { hz: 620, band: 1 },
    { hz: 2000, band: 2 },
    { hz: 4500, band: 3 },
  ];
  for (const { hz, band } of cases) {
    const bands = pcm16BandLevels(sine(hz, 24_000, 0.4), 24_000);
    for (let i = 0; i < 4; i += 1) {
      if (i === band) continue;
      assert(
        bands[band] > bands[i],
        `${hz}Hz tone must dominate band ${band}, got ${fmt(bands)}`,
      );
    }
    assert(
      bands[band] > 0.5,
      `${hz}Hz tone must concentrate >0.5 of the energy in band ${band}, got ${fmt(bands)}`,
    );
  }
  return "pure-tones-land-in-their-band";
}

function scenarioDistributionIsGainInvariant(): string {
  const loud = pcm16BandLevels(sine(2000, 24_000, 0.5), 24_000);
  const quiet = pcm16BandLevels(sine(2000, 24_000, 0.05), 24_000);
  for (let i = 0; i < 4; i += 1) {
    assert(
      Math.abs(loud[i] - quiet[i]) < 0.05,
      `band distribution must be gain-invariant, band ${i}: ${loud[i]} vs ${quiet[i]}`,
    );
  }
  return "band-distribution-is-gain-invariant";
}

function scenarioSilenceYieldsZeroBands(): string {
  const bands = pcm16BandLevels(new ArrayBuffer(960 * 2), 24_000);
  assert(
    bands.every((value) => value === 0),
    `silence must yield all-zero bands, got ${fmt(bands)}`,
  );
  const empty = pcm16BandLevels(new ArrayBuffer(0), 24_000);
  assert(
    empty.every((value) => value === 0),
    "an empty buffer must yield all-zero bands",
  );
  return "silence-yields-zero-bands";
}

function scenarioNoiseNeverReadsAsPureTone(): string {
  const bands = pcm16BandLevels(noise(2048, 0.4), 24_000);
  assert(
    bands.every((value) => value < 0.9),
    `broadband noise must not concentrate in one band, got ${fmt(bands)}`,
  );
  const total = bands.reduce((sum, value) => sum + value, 0);
  assert(
    total > 0.5 && total <= 1.000001,
    `noise band distribution must stay a distribution, total ${total}`,
  );
  return "noise-never-reads-as-pure-tone";
}

function scenarioSampleRateIndependence(): string {
  const bands = pcm16BandLevels(sine(300, 16_000, 0.4), 16_000);
  assert(
    bands[0] > 0.5 && bands[0] > bands[1] && bands[0] > bands[2] && bands[0] > bands[3],
    `300Hz at 16kHz must still dominate band 0, got ${fmt(bands)}`,
  );
  return "band-split-respects-sample-rate";
}

function sine(hz: number, sampleRate: number, amplitude: number): ArrayBuffer {
  const count = 2048;
  const buffer = new ArrayBuffer(count * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < count; i += 1) {
    const sample = Math.sin((2 * Math.PI * hz * i) / sampleRate) * amplitude;
    view.setInt16(i * 2, Math.round(sample * 32767), true);
  }
  return buffer;
}

/** Deterministic LCG noise — no Math.random in tests. */
function noise(count: number, amplitude: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * 2);
  const view = new DataView(buffer);
  let state = 48271;
  for (let i = 0; i < count; i += 1) {
    state = (state * 48271) % 2147483647;
    const sample = ((state / 2147483647) * 2 - 1) * amplitude;
    view.setInt16(i * 2, Math.round(sample * 32767), true);
  }
  return buffer;
}

function fmt(bands: readonly number[]): string {
  return `[${bands.map((value) => value.toFixed(3)).join(", ")}]`;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.log(JSON.stringify({ status: "error", error: message }));
    process.exit(1);
  }
}
