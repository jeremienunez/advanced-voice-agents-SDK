import type { AudioChunk, AudioEncoding } from "../types/transport.types.js";
import { AUDIO_DEFAULTS } from "./audio-defaults.js";

export function createAudioChunk(
  payload: Buffer,
  encoding: AudioEncoding = "pcm16",
  sequenceNumber?: number,
): AudioChunk {
  return {
    payload,
    encoding,
    sampleRate: AUDIO_DEFAULTS.SAMPLE_RATE,
    channels: AUDIO_DEFAULTS.CHANNELS,
    timestamp: Date.now(),
    sequenceNumber,
  };
}
