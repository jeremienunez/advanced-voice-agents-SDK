const PCM16_MAX = 32768;
const DISPLAY_GAIN = 3.8;
const SMOOTHING = 0.68;

export function pcm16OutputLevel(buffer: ArrayBuffer): number {
  const sampleCount = Math.floor(buffer.byteLength / 2);
  if (sampleCount === 0) return 0;

  const view = new DataView(buffer);
  const step = Math.max(1, Math.floor(sampleCount / 720));
  let sumSquares = 0;
  let measured = 0;

  for (let index = 0; index < sampleCount; index += step) {
    const sample = view.getInt16(index * 2, true) / PCM16_MAX;
    sumSquares += sample * sample;
    measured += 1;
  }

  return clamp(Math.sqrt(sumSquares / measured) * DISPLAY_GAIN);
}

export function smoothAudioLevel(previous: number, next: number): number {
  return clamp(previous * SMOOTHING + next * (1 - SMOOTHING));
}

/* Spectral split for the viseme mapper — ThreeLS band edges (Llorach et
   al. 2016): 0-500 (open vowels), 500-700 (vowel formant), 700-3000
   (mid/spread), 3000-6000 Hz (sibilants). Output is the RELATIVE power
   distribution across the 4 bands (sums to <=1, gain-invariant);
   absolute loudness stays pcm16OutputLevel's job. */
const BAND_EDGES_HZ = [0, 500, 700, 3000, 6000] as const;
const DFT_WINDOW = 256;
const SILENCE_POWER_FLOOR = 1e-6;

export function pcm16BandLevels(
  buffer: ArrayBuffer,
  sampleRate: number,
): [number, number, number, number] {
  const sampleCount = Math.floor(buffer.byteLength / 2);
  const powers: [number, number, number, number] = [0, 0, 0, 0];
  if (sampleCount < DFT_WINDOW || sampleRate <= 0) return powers;

  const view = new DataView(buffer);
  const samples = new Float64Array(DFT_WINDOW);
  const windows = Math.min(3, Math.floor(sampleCount / DFT_WINDOW));
  const binHz = sampleRate / DFT_WINDOW;
  let totalPower = 0;

  for (let w = 0; w < windows; w += 1) {
    const offset = w * DFT_WINDOW * 2;
    for (let i = 0; i < DFT_WINDOW; i += 1) {
      samples[i] = view.getInt16(offset + i * 2, true) / PCM16_MAX;
      totalPower += samples[i] * samples[i];
    }
    for (let band = 0; band < 4; band += 1) {
      const kLo = Math.max(1, Math.ceil(BAND_EDGES_HZ[band] / binHz));
      const kHi = Math.min(
        DFT_WINDOW / 2 - 1,
        Math.floor(BAND_EDGES_HZ[band + 1] / binHz),
      );
      for (let k = kLo; k <= kHi; k += 1) {
        powers[band] += goertzelPower(samples, k);
      }
    }
  }

  if (totalPower / (windows * DFT_WINDOW) < SILENCE_POWER_FLOOR) {
    return [0, 0, 0, 0];
  }
  const sum = powers[0] + powers[1] + powers[2] + powers[3];
  if (!(sum > 0) || !Number.isFinite(sum)) return [0, 0, 0, 0];
  return [powers[0] / sum, powers[1] / sum, powers[2] / sum, powers[3] / sum];
}

/** DFT bin power at index k over the window (Goertzel recurrence). */
function goertzelPower(samples: Float64Array, k: number): number {
  const omega = (2 * Math.PI * k) / samples.length;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
