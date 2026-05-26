/**
 * RNNoise WASM Wrapper — ML-based noise suppression for voice audio
 *
 * RNNoise (Xiph/Mozilla) removes non-speech audio (music, crowd noise, HVAC)
 * while preserving voice. Operates on 480-sample frames at 48kHz (10ms).
 *
 * Input/output: PCM16 Buffer at 48kHz mono.
 * Handles frame alignment internally (accumulates partial frames across calls).
 */

import { Rnnoise } from "@shiguredo/rnnoise-wasm";
import type { DenoiseState } from "@shiguredo/rnnoise-wasm";
import { createAgentLogger } from "./logger.js";

const FRAME_SIZE = 480; // 10ms at 48kHz — fixed by RNNoise
const logger = createAgentLogger("RNNoise");

// Singleton WASM module — loaded once, shared across all sessions
let rnnoiseModule: Rnnoise | null = null;

export async function loadRnnoise(): Promise<Rnnoise> {
  if (!rnnoiseModule) {
    rnnoiseModule = await Rnnoise.load();
    logger.info("RNNoise WASM loaded", { frameSize: rnnoiseModule.frameSize });
  }
  return rnnoiseModule;
}

/**
 * Per-session RNNoise denoiser.
 * Stateful — maintains filter continuity across audio chunks.
 * MUST call destroy() when session ends to free WASM memory.
 */
export class RnnoiseDenoiser {
  private state: DenoiseState;
  private residual = new Float32Array(0);
  private destroyed = false;

  constructor(rnnoise: Rnnoise) {
    this.state = rnnoise.createDenoiseState();
  }

  /**
   * Denoise a PCM16 buffer at 48kHz.
   * Returns denoised PCM16 buffer (may be shorter than input if partial frame remains).
   */
  process(pcm16Buffer: Buffer): Buffer {
    if (this.destroyed) return pcm16Buffer;

    const inputSamples = pcm16Buffer.length / 2;

    // Convert PCM16 → float32 (int16 range, no scaling — RNNoise expects this)
    const floats = new Float32Array(inputSamples);
    for (let i = 0; i < inputSamples; i++) {
      floats[i] = pcm16Buffer.readInt16LE(i * 2);
    }

    // Prepend residual from previous call
    let samples: Float32Array;
    if (this.residual.length > 0) {
      samples = new Float32Array(this.residual.length + floats.length);
      samples.set(this.residual);
      samples.set(floats, this.residual.length);
    } else {
      samples = floats;
    }

    // Process complete frames
    const totalSamples = samples.length;
    const completeFrames = Math.floor(totalSamples / FRAME_SIZE);
    const processedSamples = completeFrames * FRAME_SIZE;

    if (completeFrames === 0) {
      // Not enough for a full frame — store everything as residual
      this.residual = new Float32Array(samples);
      return Buffer.alloc(0);
    }

    // Process each frame in-place
    const frame = new Float32Array(FRAME_SIZE);
    for (let f = 0; f < completeFrames; f++) {
      const offset = f * FRAME_SIZE;
      for (let i = 0; i < FRAME_SIZE; i++) frame[i] = samples[offset + i];
      this.state.processFrame(frame); // modifies frame in-place
      for (let i = 0; i < FRAME_SIZE; i++) samples[offset + i] = frame[i];
    }

    // Store leftover as residual
    if (processedSamples < totalSamples) {
      this.residual = new Float32Array(
        samples.slice(processedSamples, totalSamples),
      );
    } else {
      this.residual = new Float32Array(0);
    }

    // Convert denoised float32 → PCM16 Buffer
    const output = Buffer.alloc(processedSamples * 2);
    for (let i = 0; i < processedSamples; i++) {
      output.writeInt16LE(
        Math.max(-32768, Math.min(32767, Math.round(samples[i]))),
        i * 2,
      );
    }

    return output;
  }

  destroy(): void {
    if (!this.destroyed) {
      this.state.destroy();
      this.destroyed = true;
    }
  }
}
