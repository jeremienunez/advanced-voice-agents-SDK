import { AUDIO_DEFAULTS } from "./audio-defaults.js";

export function calculateAudioDurationMs(
  buffer: Buffer,
  sampleRate: number = AUDIO_DEFAULTS.SAMPLE_RATE,
  bytesPerSample: number = AUDIO_DEFAULTS.BYTES_PER_SAMPLE,
): number {
  const samples = buffer.length / bytesPerSample;
  return Math.floor((samples / sampleRate) * 1000);
}
