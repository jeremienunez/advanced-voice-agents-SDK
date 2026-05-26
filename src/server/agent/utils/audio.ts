/**
 * Audio Utilities - Model-agnostic audio processing
 * Base64 encoding/decoding, buffer management, and duration calculation.
 * Works with any audio model (OpenAI, ElevenLabs, Whisper, etc.)
 */

import type { AudioChunk, AudioEncoding } from "../types/transport.types.js";

/**
 * Default audio settings (common for real-time audio APIs)
 */
export const AUDIO_DEFAULTS = {
  SAMPLE_RATE: 24000,
  CHANNELS: 1,
  BYTES_PER_SAMPLE: 2, // 16-bit PCM
} as const;

/**
 * Encode a raw audio buffer to base64
 */
export function encodeAudioBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

/**
 * Decode base64 audio to raw buffer
 */
export function decodeAudioBase64(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

/**
 * Calculate audio duration in milliseconds from buffer size
 * Formula: (bytes / bytesPerSample) / sampleRate * 1000
 */
export function calculateAudioDurationMs(
  buffer: Buffer,
  sampleRate: number = AUDIO_DEFAULTS.SAMPLE_RATE,
  bytesPerSample: number = AUDIO_DEFAULTS.BYTES_PER_SAMPLE,
): number {
  const samples = buffer.length / bytesPerSample;
  return Math.floor((samples / sampleRate) * 1000);
}

/**
 * Create an AudioChunk from raw buffer data
 */
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

/**
 * Resample mono PCM16 audio with linear interpolation.
 *
 * This keeps provider-specific audio contracts out of browser clients. For
 * example, browser capture stays at 24 kHz while Gemini Live receives 16 kHz.
 */
export function resamplePcm16(
  buffer: Buffer,
  fromSampleRate: number,
  toSampleRate: number,
): Buffer {
  if (fromSampleRate === toSampleRate) return buffer;
  if (fromSampleRate <= 0 || toSampleRate <= 0) {
    throw new Error("Sample rates must be positive");
  }

  const inputSamples = Math.floor(buffer.length / 2);
  if (inputSamples === 0) return Buffer.alloc(0);

  const outputSamples = Math.max(
    1,
    Math.floor((inputSamples * toSampleRate) / fromSampleRate),
  );
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const sourceIndex = (i * fromSampleRate) / toSampleRate;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(inputSamples - 1, leftIndex + 1);
    const weight = sourceIndex - leftIndex;
    const left = buffer.readInt16LE(leftIndex * 2);
    const right = buffer.readInt16LE(rightIndex * 2);
    const sample = Math.round(left + (right - left) * weight);
    output.writeInt16LE(clampPcm16(sample), i * 2);
  }

  return output;
}

/**
 * Convert PCM16 to μ-law (G.711)
 * Used for Twilio which expects μ-law encoded audio
 */
export function pcmToMulaw(pcmBuffer: Buffer): Buffer {
  const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    mulawBuffer[i] = linearToMulaw(sample);
  }

  return mulawBuffer;
}

/**
 * Convert μ-law to PCM16
 * Used for converting Twilio audio to PCM for OpenAI
 */
export function mulawToPcm(mulawBuffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = mulawToLinear(mulawBuffer[i]);
    pcmBuffer.writeInt16LE(sample, i * 2);
  }

  return pcmBuffer;
}

// μ-law constants (ITU-T G.711)
const MULAW_BIAS = 0x84; // 132 - critical for proper encoding
const MULAW_CLIP = 32635;

/**
 * Convert linear PCM16 sample to μ-law (G.711)
 * Reference: ITU-T G.711 specification
 */
function linearToMulaw(pcm: number): number {
  // Get sign and make positive
  const sign = pcm < 0 ? 0x80 : 0;
  if (pcm < 0) pcm = -pcm;

  // Clip and add bias
  if (pcm > MULAW_CLIP) pcm = MULAW_CLIP;
  pcm += MULAW_BIAS;

  // Find exponent (position of highest bit in biased value)
  // Segment boundaries: 0x84, 0x104, 0x204, 0x404, 0x804, 0x1004, 0x2004, 0x4004
  let exponent = 7;
  for (let expMask = 0x4000; exponent > 0; expMask >>= 1, exponent--) {
    if (pcm & expMask) break;
  }

  // Extract 4-bit mantissa from the segment
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;

  // Combine and invert all bits (μ-law convention)
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/**
 * μ-law decode table (precomputed for speed)
 */
const MULAW_DECODE_TABLE = new Int16Array(256);
(function initMulawDecodeTable() {
  for (let i = 0; i < 256; i++) {
    // Invert all bits first
    const mulaw = ~i & 0xff;
    const sign = mulaw & 0x80;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0f;

    // Decode: (mantissa * 16 + bias) << exponent, then remove bias
    // This is the inverse of the encoding formula
    let sample = ((mantissa << 4) + MULAW_BIAS) << exponent;
    sample -= MULAW_BIAS;

    MULAW_DECODE_TABLE[i] = sign ? -sample : sample;
  }
})();

/**
 * Convert μ-law byte to linear PCM16 sample
 */
function mulawToLinear(mulawByte: number): number {
  return MULAW_DECODE_TABLE[mulawByte & 0xff];
}

function clampPcm16(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}

/**
 * Audio buffer for accumulating chunks before processing.
 * Manages chunk accumulation and sequence numbering.
 */
export class AudioBuffer {
  private chunks: Buffer[] = [];
  private _sequenceNumber = 0;

  /**
   * Append a chunk to the buffer
   */
  append(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  /**
   * Flush all accumulated chunks as a single buffer
   */
  flush(): Buffer {
    if (this.chunks.length === 0) {
      return Buffer.alloc(0);
    }
    const combined = Buffer.concat(this.chunks);
    this.chunks = [];
    return combined;
  }

  /**
   * Clear the buffer without returning data
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * Get total size of buffered data in bytes
   */
  get size(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.length, 0);
  }

  /**
   * Get number of chunks in buffer
   */
  get chunkCount(): number {
    return this.chunks.length;
  }

  /**
   * Check if buffer is empty
   */
  get isEmpty(): boolean {
    return this.chunks.length === 0;
  }

  /**
   * Get and increment sequence number
   */
  nextSequence(): number {
    return this._sequenceNumber++;
  }

  /**
   * Reset sequence counter
   */
  resetSequence(): void {
    this._sequenceNumber = 0;
  }

  /**
   * Get current sequence number without incrementing
   */
  get currentSequence(): number {
    return this._sequenceNumber;
  }
}
