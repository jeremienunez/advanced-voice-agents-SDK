/**
 * Acoustic Echo Canceller (AEC) with Double-Talk Detection
 * NLMS (Normalized Least Mean Squares) adaptive filter for telephony echo cancellation.
 *
 * Operates at 8kHz PCM16 mono (Twilio native rate) for efficiency.
 * Place in the audio pipeline AFTER mulaw→PCM decode, BEFORE upsampling.
 *
 * Echo path: LLM audio → Twilio → phone speaker → phone mic → Twilio → inbound.
 * Typical telephony round-trip: 60-200ms → filter covers 256ms.
 *
 * Double-talk detection (Geigel-inspired):
 * When near-end speaker talks over far-end playback, NLMS adaptation freezes
 * and residual suppression is bypassed to preserve near-end speech.
 *
 * Usage:
 *   aec.feedReference(pcm8k)  // outbound audio going to speaker
 *   cancelled = aec.cancel(pcm8k)  // inbound mic audio, echo removed
 */

import { createAgentLogger } from "./logger.js";

const logger = createAgentLogger("AEC");

// ============================================================================
// Configuration
// ============================================================================

export interface AECConfig {
  /** Filter length in ms (default: 256 — covers typical telephony echo path) */
  filterLengthMs?: number;
  /** Sample rate in Hz (default: 8000) */
  sampleRate?: number;
  /** NLMS step size (default: 0.05, range 0.01-0.5). Lower = more stable, higher = faster convergence. */
  mu?: number;
  /** Residual echo suppression factor (default: 0.72). Lighter with DT detection in place. */
  suppressionFactor?: number;
  /** Double-talk detection threshold (default: 0.65). Higher = less sensitive. */
  doubleTalkThreshold?: number;
  /** Double-talk hangover in ms (default: 40). Keeps DT state active briefly after detection ends. */
  doubleTalkHangoverMs?: number;
}

// ============================================================================
// AEC Class
// ============================================================================

export class AcousticEchoCanceller {
  // NLMS filter
  private readonly filterLen: number;
  private readonly weights: Float64Array;
  private readonly mu: number;
  private readonly suppressionFactor: number;
  private readonly sampleRate: number;

  // Reference (far-end/playback) circular buffer
  private readonly refBuf: Float64Array;
  private refPos = 0;

  // Running reference power (incrementally updated for efficiency)
  private refPower = 0;

  // Double-talk detection
  private readonly dtThreshold: number;
  private readonly dtHangoverSamples: number;
  private nearPower = 0; // running near-end (mic) power
  private nearPowerWindow: Float64Array; // circular buffer for windowed power
  private nearPowerPos = 0;
  private dtHangoverCounter = 0;
  private _isDoubleTalk = false;

  // State tracking
  private _isActive = false;
  private _samplesProcessed = 0;
  private playbackActive = false;
  private silenceSincePlayback = 0;

  constructor(config?: AECConfig) {
    const filterLengthMs = config?.filterLengthMs ?? 256;
    this.sampleRate = config?.sampleRate ?? 8000;
    this.mu = config?.mu ?? 0.05;
    this.suppressionFactor = config?.suppressionFactor ?? 0.72;
    this.dtThreshold = config?.doubleTalkThreshold ?? 0.65;

    const dtHangoverMs = config?.doubleTalkHangoverMs ?? 40;
    this.dtHangoverSamples = Math.floor(
      (dtHangoverMs * this.sampleRate) / 1000,
    );

    this.filterLen = Math.floor((filterLengthMs * this.sampleRate) / 1000);
    this.weights = new Float64Array(this.filterLen);
    this.refBuf = new Float64Array(this.filterLen);

    // Near-end power window: 20ms window for responsive DT detection
    const dtWindowMs = 20;
    const dtWindowLen = Math.floor((dtWindowMs * this.sampleRate) / 1000);
    this.nearPowerWindow = new Float64Array(dtWindowLen);

    logger.info("AEC initialized", {
      filterLen: this.filterLen,
      filterLengthMs,
      sampleRate: this.sampleRate,
      mu: this.mu,
      dtThreshold: this.dtThreshold,
      dtHangoverMs,
    });
  }

  get isActive(): boolean {
    return this._isActive;
  }
  get samplesProcessed(): number {
    return this._samplesProcessed;
  }
  get isDoubleTalk(): boolean {
    return this._isDoubleTalk;
  }

  /**
   * Feed reference signal (outbound audio going to phone speaker).
   * Call with PCM16 8kHz BEFORE converting to mulaw for Twilio.
   */
  feedReference(pcm8k: Buffer): void {
    const samples = pcm8k.length / 2;

    for (let i = 0; i < samples; i++) {
      const sample = pcm8k.readInt16LE(i * 2);

      // Incremental power update: add new², subtract oldest²
      const oldest = this.refBuf[this.refPos];
      this.refPower += sample * sample - oldest * oldest;
      if (this.refPower < 0) this.refPower = 0;

      this.refBuf[this.refPos] = sample;
      this.refPos = (this.refPos + 1) % this.filterLen;
    }

    this._isActive = true;
    this.playbackActive = true;
    this.silenceSincePlayback = 0;
  }

  /**
   * Process microphone signal, removing estimated echo.
   * Call with PCM16 8kHz from Twilio BEFORE upsampling.
   * Returns echo-cancelled PCM16 8kHz buffer.
   *
   * Double-talk detection:
   * When near-end energy is significant relative to far-end, adaptation freezes
   * and residual suppression is bypassed to preserve the caller's voice.
   */
  cancel(mic8k: Buffer): Buffer {
    if (!this._isActive) return mic8k;

    const samples = mic8k.length / 2;
    const output = Buffer.alloc(mic8k.length);
    const fl = this.filterLen;
    const npw = this.nearPowerWindow;
    const npwLen = npw.length;

    for (let i = 0; i < samples; i++) {
      const mic = mic8k.readInt16LE(i * 2);

      // Update near-end power (windowed, incremental)
      const oldestNear = npw[this.nearPowerPos];
      const micSq = mic * mic;
      this.nearPower += micSq - oldestNear;
      if (this.nearPower < 0) this.nearPower = 0;
      npw[this.nearPowerPos] = micSq;
      this.nearPowerPos = (this.nearPowerPos + 1) % npwLen;

      // Double-talk detection (Geigel-inspired)
      // Compare windowed near-end power to reference power
      const avgRefPower = this.refPower / fl;
      const avgNearPower = this.nearPower / npwLen;
      const refSignificant = avgRefPower > 100; // far-end is playing
      const nearSignificant = avgNearPower > 200; // near-end is talking

      // DT = near-end has significant energy AND ratio exceeds threshold
      // When ref is silent, no echo to cancel — skip DT logic
      if (refSignificant && nearSignificant) {
        const ratio = avgNearPower / (avgRefPower + 1e-8);
        if (ratio > this.dtThreshold) {
          this._isDoubleTalk = true;
          this.dtHangoverCounter = this.dtHangoverSamples;
        }
      }

      // Hangover: keep DT active briefly after detection ends
      if (this.dtHangoverCounter > 0) {
        this.dtHangoverCounter--;
        this._isDoubleTalk = true;
      } else if (this._isDoubleTalk) {
        this._isDoubleTalk = false;
      }

      // Compute estimated echo: FIR filter on reference buffer
      let echoEst = 0;
      for (let j = 0; j < fl; j++) {
        const refIdx = (this.refPos - 1 - j + fl * 2) % fl;
        echoEst += this.weights[j] * this.refBuf[refIdx];
      }

      // Error = mic - estimated echo (the signal we want to keep)
      let error = mic - echoEst;

      // NLMS weight update — FREEZE during double-talk to prevent divergence
      if (!this._isDoubleTalk) {
        const normPower = this.refPower / fl + 1e-8;
        if (normPower > 50) {
          const step = (this.mu * error) / (this.refPower + 1e-8);
          for (let j = 0; j < fl; j++) {
            const refIdx = (this.refPos - 1 - j + fl * 2) % fl;
            this.weights[j] += step * this.refBuf[refIdx];
          }
        }
      }

      // Residual echo suppression — BYPASS during double-talk
      if (
        !this._isDoubleTalk &&
        (this.playbackActive || this.silenceSincePlayback < fl)
      ) {
        error *= this.suppressionFactor;
      }

      output.writeInt16LE(
        Math.max(-32768, Math.min(32767, Math.round(error))),
        i * 2,
      );
      this._samplesProcessed++;
    }

    // Track post-playback silence
    if (this.playbackActive) {
      const avgPower = this.refPower / fl;
      if (avgPower < 100) {
        this.playbackActive = false;
        this.silenceSincePlayback = 0;
      }
    } else {
      this.silenceSincePlayback += samples;
    }

    return output;
  }

  /**
   * Reset filter state (call on new session/call)
   */
  reset(): void {
    this.weights.fill(0);
    this.refBuf.fill(0);
    this.refPos = 0;
    this.refPower = 0;
    this.nearPower = 0;
    this.nearPowerWindow.fill(0);
    this.nearPowerPos = 0;
    this.dtHangoverCounter = 0;
    this._isDoubleTalk = false;
    this._isActive = false;
    this._samplesProcessed = 0;
    this.playbackActive = false;
    this.silenceSincePlayback = 0;
  }
}
