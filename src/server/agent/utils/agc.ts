/**
 * Automatic Gain Control (AGC)
 * RMS-based level normalization for PSTN telephony audio.
 *
 * Operates at any sample rate (configured at construction).
 * Place in the audio pipeline AFTER high-pass, BEFORE noise suppression.
 * Pipeline: AEC → upsample → HP → **AGC** → RNNoise → gate → LLM
 *
 * PSTN-tuned defaults:
 * - Target: -23dBFS RMS (~2319 PCM16) — mulaw speech sits at -26 to -20
 * - Attack 8ms: catches transients without over-reacting to syllable onsets
 * - Release 120ms: prevents audible gain pumping on noisy PSTN lines
 * - Max gain 8dB: enough for quiet callers, won't amplify noise floor
 * - Speech-only adaptation: gain FREEZES during silence (prevents noise pumping)
 * - Gain ramp-up limiter: max +6dB/s increase (prevents sudden boosts after silence)
 * - Soft knee: gentle correction near target, aggressive far from it
 *
 * Usage:
 *   agc.process(pcm16Buffer)  // mutates buffer in-place
 */

import { createAgentLogger } from "./logger.js";

const logger = createAgentLogger("AGC");

// ============================================================================
// Configuration
// ============================================================================

export interface AGCConfig {
  /** Sample rate in Hz (default: 24000) */
  sampleRate?: number;
  /** Target RMS level in dBFS (default: -23). PSTN speech ~-26 to -20, don't push too hot. */
  targetDbfs?: number;
  /** Attack time in ms (default: 8). Catches transients without over-reacting. */
  attackMs?: number;
  /** Release time in ms (default: 120). Slow release avoids gain pumping on noisy PSTN lines. */
  releaseMs?: number;
  /** Maximum gain in dB (default: 8). Limited to avoid amplifying PSTN noise floor. */
  maxGainDb?: number;
  /** Minimum gain in dB (default: -20). Limits attenuation for very loud signals. */
  minGainDb?: number;
  /** Speech threshold in PCM16 RMS (default: 400). Below this = silence → gain freezes. */
  speechThreshold?: number;
  /** Soft knee width in dB (default: 6). Correction is gentle within ±kneeWidth of target. */
  kneeWidthDb?: number;
  /** Max gain increase rate in dB/s (default: 6). Limits ramp-up after silence. */
  maxGainRampDbPerSec?: number;
}

// ============================================================================
// AGC Class
// ============================================================================

export class AutomaticGainControl {
  private readonly targetRms: number;
  private readonly targetDb: number;
  private readonly attackCoeff: number;
  private readonly releaseCoeff: number;
  private readonly maxGain: number;
  private readonly minGain: number;
  private readonly speechThreshold: number;
  private readonly kneeWidthDb: number;
  private readonly maxGainRampPerSample: number;

  // State
  private currentGain = 1.0;
  private smoothedRms = 0;

  constructor(config?: AGCConfig) {
    const sampleRate = config?.sampleRate ?? 24000;
    const targetDbfs = config?.targetDbfs ?? -23;
    const attackMs = config?.attackMs ?? 8;
    const releaseMs = config?.releaseMs ?? 120;
    const maxGainDb = config?.maxGainDb ?? 8;
    const minGainDb = config?.minGainDb ?? -20;
    this.speechThreshold = config?.speechThreshold ?? 400;
    this.kneeWidthDb = config?.kneeWidthDb ?? 6;

    // Convert target dBFS to linear PCM16 RMS: 10^(dBFS/20) * 32768
    this.targetRms = Math.pow(10, targetDbfs / 20) * 32768;
    this.targetDb = targetDbfs;

    // Smoothing coefficients: α = 1 - e^(-1 / (τ * sampleRate))
    this.attackCoeff = 1 - Math.exp(-1000 / (attackMs * sampleRate));
    this.releaseCoeff = 1 - Math.exp(-1000 / (releaseMs * sampleRate));

    // Gain limits (linear)
    this.maxGain = Math.pow(10, maxGainDb / 20);
    this.minGain = Math.pow(10, minGainDb / 20);

    // Max gain increase per sample: convert dB/s to linear/sample
    const maxRampDbPerSec = config?.maxGainRampDbPerSec ?? 6;
    // linear factor per second = 10^(dB/20), per sample = (factor-1)/sampleRate
    const rampFactorPerSec = Math.pow(10, maxRampDbPerSec / 20) - 1;
    this.maxGainRampPerSample = rampFactorPerSec / sampleRate;

    logger.info("AGC initialized", {
      targetDbfs,
      targetRms: Math.round(this.targetRms),
      attackMs,
      releaseMs,
      maxGainDb,
      speechThreshold: this.speechThreshold,
      kneeWidthDb: this.kneeWidthDb,
      maxGainRampDbPerSec: maxRampDbPerSec,
      sampleRate,
    });
  }

  /**
   * Process a PCM16 buffer, applying automatic gain control.
   * Mutates the buffer in-place for zero-allocation performance.
   *
   * Key behaviors:
   * - Freezes gain during silence (speech-only adaptation)
   * - Soft knee: gentle correction near target, full correction far from it
   * - Rate-limited gain increase (prevents sudden boost after silence)
   */
  process(buffer: Buffer): void {
    const samples = buffer.length / 2;
    if (samples === 0) return;

    for (let i = 0; i < samples; i++) {
      const offset = i * 2;
      const sample = buffer.readInt16LE(offset);
      const absSample = Math.abs(sample);

      // Update smoothed RMS (envelope follower)
      const envCoeff =
        absSample > this.smoothedRms ? this.attackCoeff : this.releaseCoeff;
      this.smoothedRms += envCoeff * (absSample - this.smoothedRms);

      // Speech detection: freeze gain during silence/noise
      // Prevents noise pumping — the critical PSTN fix
      if (this.smoothedRms < this.speechThreshold) {
        // Apply current gain but don't adapt
        const adjusted = Math.round(sample * this.currentGain);
        buffer.writeInt16LE(
          Math.max(-32768, Math.min(32767, adjusted)),
          offset,
        );
        continue;
      }

      // Compute correction in dB domain for soft knee
      const rmsDb = 20 * Math.log10(this.smoothedRms / 32768);
      const diffDb = this.targetDb - rmsDb; // positive = need boost, negative = need cut

      // Soft knee: quadratic interpolation within ±kneeWidth
      // Near target → gentle. Far from target → full correction.
      const absDiff = Math.abs(diffDb);
      let correctionDb: number;
      if (absDiff <= this.kneeWidthDb) {
        // Quadratic ramp: correction grows as square of distance from target
        const t = absDiff / this.kneeWidthDb; // 0..1
        correctionDb = Math.sign(diffDb) * absDiff * t;
      } else {
        correctionDb = diffDb;
      }

      // Convert correction to linear gain
      let desiredGain = Math.pow(10, correctionDb / 20);

      // Clamp to limits
      desiredGain = Math.max(this.minGain, Math.min(this.maxGain, desiredGain));

      // Rate-limit gain INCREASE (decrease via attack is unrestricted)
      if (desiredGain > this.currentGain) {
        desiredGain = Math.min(
          desiredGain,
          this.currentGain + this.maxGainRampPerSample,
        );
      }

      // Smooth gain transitions
      const gainCoeff =
        desiredGain < this.currentGain ? this.attackCoeff : this.releaseCoeff;
      this.currentGain += gainCoeff * (desiredGain - this.currentGain);

      // Apply gain
      const adjusted = Math.round(sample * this.currentGain);
      buffer.writeInt16LE(Math.max(-32768, Math.min(32767, adjusted)), offset);
    }
  }

  /**
   * Reset AGC state (call on new session/call)
   */
  reset(): void {
    this.currentGain = 1.0;
    this.smoothedRms = 0;
  }
}
