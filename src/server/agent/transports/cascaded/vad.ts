/**
 * VadEngine — Energy-based Voice Activity Detection
 *
 * Operates on already-denoised PCM16 24kHz audio from MediaStreamHandler.
 * Uses RMS energy threshold to detect speech start/stop.
 * Buffers audio during speech, flushes on silence detection.
 */

import type { AudioChunk } from "../../types/transport.types.js";

export interface VadResult {
  event: "speech_started" | "speech_stopped" | null;
  /** Full accumulated audio buffer (only on speech_stopped) */
  buffer?: Buffer;
}

interface VadConfig {
  /** Silence duration in ms before flushing speech buffer (default: 600) */
  silenceDurationMs: number;
  /** RMS threshold for speech detection (default: 300) */
  speechThresholdRms: number;
  /** Consecutive frames above threshold to confirm speech start (default: 3) */
  confirmationFrames: number;
}

const FRAME_DURATION_MS = 20; // MediaStreamHandler sends ~20-40ms chunks

export class VadEngine {
  private speechBuffer: Buffer[] = [];
  private silenceFrameCount = 0;
  private speechConfirmCount = 0;
  private isSpeaking = false;
  private readonly silenceFrameThreshold: number;

  constructor(private readonly config: VadConfig) {
    this.silenceFrameThreshold = Math.ceil(
      config.silenceDurationMs / FRAME_DURATION_MS,
    );
  }

  push(chunk: AudioChunk): VadResult {
    const rms = this.computeRms(chunk.payload);
    const isSpeech = rms > this.config.speechThresholdRms;

    if (!this.isSpeaking) {
      if (isSpeech) {
        this.speechConfirmCount++;
        // Buffer audio during confirmation phase (don't lose start of speech)
        this.speechBuffer.push(chunk.payload);
        if (this.speechConfirmCount >= this.config.confirmationFrames) {
          this.isSpeaking = true;
          this.silenceFrameCount = 0;
          return { event: "speech_started" };
        }
      } else {
        // Reset confirmation counter and discard buffered frames
        this.speechConfirmCount = 0;
        this.speechBuffer = [];
      }
      return { event: null };
    }

    // Currently speaking
    this.speechBuffer.push(chunk.payload);

    if (isSpeech) {
      this.silenceFrameCount = 0;
    } else {
      this.silenceFrameCount++;
      if (this.silenceFrameCount >= this.silenceFrameThreshold) {
        // Silence confirmed — flush buffer
        const buffer = Buffer.concat(this.speechBuffer);
        this.speechBuffer = [];
        this.isSpeaking = false;
        this.silenceFrameCount = 0;
        this.speechConfirmCount = 0;
        return { event: "speech_stopped", buffer };
      }
    }

    return { event: null };
  }

  clear(): void {
    this.speechBuffer = [];
    this.isSpeaking = false;
    this.silenceFrameCount = 0;
    this.speechConfirmCount = 0;
  }

  private computeRms(pcm16: Buffer): number {
    const samples = pcm16.length / 2;
    if (samples === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < samples; i++) {
      const sample = pcm16.readInt16LE(i * 2);
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / samples);
  }
}
