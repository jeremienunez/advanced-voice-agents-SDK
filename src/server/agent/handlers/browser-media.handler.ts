/**
 * Browser Media Handler
 * Lightweight audio pipeline for browser WebSocket connections.
 * Unlike MediaStreamHandler (Twilio), no mu-law codec, no 8kHz↔24kHz resampling,
 * no AEC (browser handles via getUserMedia), no high-pass filter.
 *
 * Pipeline: Browser PCM16 24kHz → AGC → [RNNoise] → noise gate → buffer → LLM
 * Outbound: LLM PCM16 24kHz → browser (no transcoding)
 */

import { AudioBuffer, createAudioChunk } from "../utils/audio.js";
import { AutomaticGainControl } from "../utils/agc.js";
import { createAgentLogger } from "../utils/logger.js";
import { loadRnnoise, RnnoiseDenoiser } from "../utils/rnnoise.js";
import type { AudioChunk } from "../types/transport.types.js";

// ============================================================================
// Types
// ============================================================================

export interface BrowserMediaHandlerConfig {
  /** Buffer size threshold in bytes before flushing to LLM (default: 1920 = ~40ms) */
  bufferSizeThreshold?: number;
  /** Maximum buffer duration in ms before force flush (default: 50ms) */
  maxBufferDurationMs?: number;
  /** Enable Automatic Gain Control (default: true) */
  enableAgc?: boolean;
  /** Enable RNNoise ML denoising (default: false — browser mics are cleaner than PSTN) */
  enableRnnoise?: boolean;
  /** Enable noise gate (default: true) */
  enableNoiseGate?: boolean;
  /** AGC target dBFS (default: -20, browser mics are louder than PSTN) */
  agcTargetDbfs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface BrowserMediaHandlerCallbacks {
  /** Called when audio is ready to send to the LLM */
  onAudioToLLM?: (chunk: AudioChunk) => void;
  /** Called when audio is ready to send to the browser (raw PCM16 24kHz) */
  onAudioToBrowser?: (buffer: Buffer) => void;
}

export type BrowserMediaState = "idle" | "streaming" | "paused" | "stopped";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<BrowserMediaHandlerConfig> = {
  bufferSizeThreshold: 1920,
  maxBufferDurationMs: 50,
  enableAgc: true,
  enableRnnoise: false,
  enableNoiseGate: true,
  agcTargetDbfs: -20,
  debug: false,
};

const NOISE_GATE_THRESHOLD = 200; // ~-44dBFS

// ============================================================================
// Handler Class
// ============================================================================

export class BrowserMediaHandler {
  private config: Required<BrowserMediaHandlerConfig>;
  private callbacks: BrowserMediaHandlerCallbacks;
  private logger = createAgentLogger("BrowserMediaHandler");

  private inboundBuffer: AudioBuffer;
  private _state: BrowserMediaState = "idle";
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushTime = 0;

  private rnnoise: RnnoiseDenoiser | null = null;
  private agc: AutomaticGainControl | null = null;

  private bytesToLLM = 0;
  private bytesToBrowser = 0;

  constructor(
    config: BrowserMediaHandlerConfig = {},
    callbacks: BrowserMediaHandlerCallbacks = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.inboundBuffer = new AudioBuffer();
  }

  get state(): BrowserMediaState {
    return this._state;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  start(): void {
    if (this._state === "streaming") return;

    this._state = "streaming";
    this.lastFlushTime = Date.now();
    this.startFlushTimer();

    if (this.config.enableAgc) {
      this.agc = new AutomaticGainControl({
        sampleRate: 24000,
        targetDbfs: this.config.agcTargetDbfs,
        speechThreshold: 500, // Higher than PSTN (browser mics are cleaner)
        maxGainDb: 6, // Lower max gain (less noise to amplify)
      });
    }

    if (this.config.debug) {
      this.logger.debug("Browser media streaming started");
    }
  }

  async initRnnoise(): Promise<void> {
    if (!this.config.enableRnnoise) return;
    try {
      const mod = await loadRnnoise();
      this.rnnoise = new RnnoiseDenoiser(mod);
      this.logger.info("RNNoise denoiser initialized for browser session");
    } catch (error) {
      this.logger.error("Failed to init RNNoise", { error });
    }
  }

  stop(): void {
    this._state = "stopped";
    this.stopFlushTimer();
    this.inboundBuffer.clear();
    this.rnnoise?.destroy();
    this.rnnoise = null;
    this.agc?.reset();
    this.agc = null;

    if (this.config.debug) {
      this.logger.debug("Browser media stopped", {
        bytesToLLM: this.bytesToLLM,
        bytesToBrowser: this.bytesToBrowser,
      });
    }
  }

  // ============================================================================
  // Audio Processing
  // ============================================================================

  /**
   * Handle audio from browser (PCM16 24kHz, inbound to LLM)
   */
  handleBrowserAudio(buffer: Buffer): void {
    if (this._state !== "streaming") return;

    try {
      let processed = buffer;

      // AGC: normalize browser mic levels
      if (this.agc) {
        this.agc.process(processed);
      }

      // RNNoise: optional ML denoising (24→48kHz → denoise → 48→24kHz)
      if (this.rnnoise) {
        const up48 = this.upsample2x(processed);
        const clean48 = this.rnnoise.process(up48);
        processed =
          clean48.length > 0 ? this.downsample2x(clean48) : Buffer.alloc(0);
        if (processed.length === 0) return; // Partial frame buffered in RNNoise
      }

      // Noise gate: zero out below threshold
      if (this.config.enableNoiseGate) {
        this.applyNoiseGate(processed);
      }

      this.inboundBuffer.append(processed);

      if (this.inboundBuffer.size >= this.config.bufferSizeThreshold) {
        this.flushInboundBuffer();
      }
    } catch (error) {
      this.logger.error("Error processing browser audio", { error });
    }
  }

  /**
   * Handle audio from LLM (PCM16 24kHz, outbound to browser)
   * Pass-through: no transcoding needed.
   */
  handleLLMAudio(chunk: AudioChunk): void {
    if (this._state !== "streaming") return;

    this.callbacks.onAudioToBrowser?.(chunk.payload);
    this.bytesToBrowser += chunk.payload.length;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private applyNoiseGate(buffer: Buffer): void {
    const samples = buffer.length / 2;
    for (let i = 0; i < samples; i++) {
      const offset = i * 2;
      const sample = buffer.readInt16LE(offset);
      if (Math.abs(sample) < NOISE_GATE_THRESHOLD) {
        buffer.writeInt16LE(0, offset);
      }
    }
  }

  /** Upsample 24kHz → 48kHz (2x linear interpolation for RNNoise) */
  private upsample2x(buffer: Buffer): Buffer {
    const inputSamples = buffer.length / 2;
    const output = Buffer.alloc(inputSamples * 4);
    for (let i = 0; i < inputSamples; i++) {
      const s0 = buffer.readInt16LE(i * 2);
      const s1 = i + 1 < inputSamples ? buffer.readInt16LE((i + 1) * 2) : s0;
      output.writeInt16LE(s0, i * 4);
      output.writeInt16LE(Math.round((s0 + s1) / 2), i * 4 + 2);
    }
    return output;
  }

  /** Downsample 48kHz → 24kHz (2x decimation) */
  private downsample2x(buffer: Buffer): Buffer {
    const inputSamples = buffer.length / 2;
    const outputSamples = Math.floor(inputSamples / 2);
    const output = Buffer.alloc(outputSamples * 2);
    for (let i = 0; i < outputSamples; i++) {
      output.writeInt16LE(buffer.readInt16LE(i * 4), i * 2);
    }
    return output;
  }

  private flushInboundBuffer(): void {
    if (this.inboundBuffer.isEmpty || this._state !== "streaming") return;

    const buffer = this.inboundBuffer.flush();
    const chunk = createAudioChunk(
      buffer,
      "pcm16",
      this.inboundBuffer.nextSequence(),
    );

    this.callbacks.onAudioToLLM?.(chunk);
    this.bytesToLLM += buffer.length;
    this.lastFlushTime = Date.now();
  }

  private startFlushTimer(): void {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastFlushTime;
      if (
        elapsed >= this.config.maxBufferDurationMs &&
        !this.inboundBuffer.isEmpty
      ) {
        this.flushInboundBuffer();
      }
    }, 50);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createBrowserMediaHandler(
  config?: BrowserMediaHandlerConfig,
  callbacks?: BrowserMediaHandlerCallbacks,
): BrowserMediaHandler {
  return new BrowserMediaHandler(config, callbacks);
}
