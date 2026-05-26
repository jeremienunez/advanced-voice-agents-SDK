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

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
