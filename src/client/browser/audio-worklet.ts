/**
 * AudioWorklet Processors for Browser Voice
 *
 * Two processors running in the audio rendering thread:
 * - CaptureProcessor: 48kHz Float32 → downsample 2:1 → 24kHz PCM16 → postMessage
 * - PlaybackProcessor: PCM16 24kHz ring buffer → Float32 output → speaker
 *
 * Loaded via: audioContext.audioWorklet.addModule(workletURL)
 * @module modules/voice/infrastructure/audio-worklet
 */

// =============================================================================
// Capture Processor (mic → WebSocket)
// =============================================================================

const CAPTURE_PROCESSOR = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunkSize = 960; // ~40ms at 24kHz
    // Pre-allocated accumulation buffer (max: chunkSize + one input quantum)
    this._accum = new Int16Array(1024);
    this._accumLen = 0;
    // Dynamic sample rate support (default 48kHz, configurable for iOS)
    this._inputRate = 48000;
    this._step = 2; // 48000 / 24000

    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'config' && e.data.sampleRate) {
        this._inputRate = e.data.sampleRate;
        this._step = this._inputRate / 24000;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const float32 = input[0];

    // Downsample inputRate → 24kHz
    const downLen = Math.floor(float32.length / this._step);
    for (let i = 0; i < downLen; i++) {
      const srcIdx = Math.round(i * this._step);
      const s = Math.max(-1, Math.min(1, float32[srcIdx]));
      this._accum[this._accumLen + i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this._accumLen += downLen;

    // Flush full chunks
    while (this._accumLen >= this._chunkSize) {
      const buf = this._accum.slice(0, this._chunkSize);
      this.port.postMessage(buf.buffer, [buf.buffer]);
      // Shift remainder to front
      this._accum.copyWithin(0, this._chunkSize, this._accumLen);
      this._accumLen -= this._chunkSize;
    }

    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
`;

// =============================================================================
// Playback Processor (WebSocket → speaker)
// =============================================================================

const PLAYBACK_PROCESSOR = `
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ring buffer: 30s at 24kHz (long responses can be 20s+)
    this._ringBuffer = new Float32Array(720000);
    this._writePos = 0;
    this._readPos = 0;
    this._buffered = 0;

    // 3-state machine: buffering → playing → rebuffering → playing
    // Prevents garbled audio from oscillating between underrun decay and micro-bursts
    this._state = 'buffering';
    this._INITIAL_PREBUFFER = 48000; // 2s — balance latency vs jitter absorption
    this._REBUFFER_THRESHOLD = 24000; // 1s — fast recovery from underrun

    // Dynamic upsample ratio (48kHz→2x, 96kHz→4x, 44.1kHz→1.8375x)
    this._ratio = 2;
    this._lastSample = 0;
    this._fadeOut = 0; // fast fade counter on underrun
    this._fadeIn = 0;  // smooth ramp-up on resume (avoids click)

    this.port.onmessage = (e) => {
      if (!(e.data instanceof ArrayBuffer)) {
        if (e.data && e.data.type === 'config' && e.data.sampleRate) {
          this._ratio = e.data.sampleRate / 24000;
        }
        if (e.data && e.data.type === 'clear') {
          // Reset ring buffer — flush old TTS on new turn (prevents "deux voix")
          this._writePos = 0;
          this._readPos = 0;
          this._buffered = 0;
          this._state = 'buffering';
          this._lastSample = 0;
          this._fadeOut = 0;
          this._fadeIn = 0;
        }
        return;
      }
      // Ensure even byte length (Int16Array needs multiple of 2)
      const raw = e.data;
      const usable = (raw.byteLength & 1) ? raw.slice(0, raw.byteLength - 1) : raw;
      if (usable.byteLength === 0) return;
      const pcm16 = new Int16Array(usable);
      for (let i = 0; i < pcm16.length; i++) {
        if (this._buffered >= this._ringBuffer.length) {
          this._readPos = (this._readPos + 1) % this._ringBuffer.length;
          this._buffered--;
        }
        this._ringBuffer[this._writePos] = pcm16[i] / 32768;
        this._writePos = (this._writePos + 1) % this._ringBuffer.length;
        this._buffered++;
      }
      // Transition from any non-playing state → playing when threshold met
      const threshold = this._state === 'buffering'
        ? this._INITIAL_PREBUFFER
        : this._REBUFFER_THRESHOLD;
      if (this._state !== 'playing' && this._buffered >= threshold) {
        this._state = 'playing';
        this._fadeOut = 0;
        this._fadeIn = 8; // 8-sample ramp-up (~0.3ms at 24kHz)
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const channel = output[0];

    // Buffering / rebuffering: clean silence
    if (this._state !== 'playing') {
      for (let i = 0; i < channel.length; i++) channel[i] = 0;
      return true;
    }

    const ratio = this._ratio;
    let lastInputIdx = -1;

    for (let i = 0; i < channel.length; i++) {
      const inputIdx = Math.floor(i / ratio);

      if (inputIdx > lastInputIdx) {
        if (this._buffered > 0) {
          this._lastSample = this._ringBuffer[this._readPos];
          this._readPos = (this._readPos + 1) % this._ringBuffer.length;
          this._buffered--;
          this._fadeOut = 0;
          // Smooth ramp-up after rebuffer to avoid click
          if (this._fadeIn > 0) {
            this._lastSample *= (1 - this._fadeIn / 8);
            this._fadeIn--;
          }
        } else {
          // Underrun: fast 4-sample fade then rebuffer
          this._fadeOut++;
          if (this._fadeOut <= 4) {
            this._lastSample *= 0.3;
          } else {
            this._lastSample = 0;
            this._state = 'rebuffering';
          }
        }
        lastInputIdx = inputIdx;
      }

      channel[i] = this._lastSample;
    }

    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
`;

// =============================================================================
// Worklet URL Factory
// =============================================================================

let captureURL: string | null = null;
let playbackURL: string | null = null;

/** Create a blob URL for the capture worklet processor */
export function getCaptureWorkletURL(): string {
  if (!captureURL) {
    const blob = new Blob([CAPTURE_PROCESSOR], {
      type: "application/javascript",
    });
    captureURL = URL.createObjectURL(blob);
  }
  return captureURL;
}

/** Create a blob URL for the playback worklet processor */
export function getPlaybackWorkletURL(): string {
  if (!playbackURL) {
    const blob = new Blob([PLAYBACK_PROCESSOR], {
      type: "application/javascript",
    });
    playbackURL = URL.createObjectURL(blob);
  }
  return playbackURL;
}

/** Cleanup blob URLs (call on module unmount) */
export function revokeWorkletURLs(): void {
  if (captureURL) {
    URL.revokeObjectURL(captureURL);
    captureURL = null;
  }
  if (playbackURL) {
    URL.revokeObjectURL(playbackURL);
    playbackURL = null;
  }
}
