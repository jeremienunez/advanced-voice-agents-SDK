/**
 * OpenAI Audio Utilities - Re-exports from utils with OpenAI-specific naming
 * for OpenAI Realtime API audio streaming.
 */

// Re-export from utils with OpenAI-specific naming
export {
  encodeAudioBase64 as encodeAudioForOpenAI,
  decodeAudioBase64 as decodeAudioFromOpenAI,
  calculateAudioDurationMs,
  createAudioChunk,
  AudioBuffer,
  AUDIO_DEFAULTS,
} from "../utils/audio.js";

// OpenAI-specific constants (aliases for clarity)
export const OPENAI_SAMPLE_RATE = 24000;
export const OPENAI_CHANNELS = 1;
export const OPENAI_BYTES_PER_SAMPLE = 2; // 16-bit PCM
