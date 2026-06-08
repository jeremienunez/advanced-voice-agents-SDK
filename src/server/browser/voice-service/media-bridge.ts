import type {
  MediaBridgeDefinition,
  MediaBridgeFactoryPort,
  MediaBridgePort,
} from "../../../sdk/types.js";
import {
  createBrowserMediaHandler,
  type BrowserMediaHandlerConfig,
} from "../../agent/handlers/browser-media.handler.js";
import type { AudioChunk } from "../../agent/types/transport.types.js";

export interface BrowserVoiceMediaBridgeOptions {
  config: BrowserMediaHandlerConfig;
  onAudioToBrowser: (buffer: Buffer) => void;
}

export type BrowserVoiceMediaBridge = MediaBridgePort<
  Buffer,
  AudioChunk,
  AudioChunk
> & {
  init?(): Promise<void> | void;
};

export type BrowserVoiceMediaBridgeFactory = MediaBridgeFactoryPort<
  BrowserVoiceMediaBridge,
  BrowserVoiceMediaBridgeOptions
>;

export function createBrowserMediaBridgeDefinition(
  sampleRate: number,
): MediaBridgeDefinition {
  return {
    id: "browser",
    kind: "browser-websocket",
    inputEncoding: "pcm16",
    outputEncoding: "pcm16",
    sampleRate,
  };
}

export function createDefaultBrowserMediaBridgeFactory():
  BrowserVoiceMediaBridgeFactory {
  return {
    createMediaBridge(input) {
      return new BrowserMediaHandlerBridge(input.options);
    },
  };
}

class BrowserMediaHandlerBridge implements BrowserVoiceMediaBridge {
  private readonly handler;
  private audioToLlm: (chunk: AudioChunk) => void = () => {};

  constructor(options?: BrowserVoiceMediaBridgeOptions) {
    this.handler = createBrowserMediaHandler(options?.config, {
      onAudioToBrowser: options?.onAudioToBrowser,
      onAudioToLLM: (chunk) => this.audioToLlm(chunk),
    });
  }

  async init(): Promise<void> {
    await this.handler.initRnnoise();
  }

  start(): void {
    this.handler.start();
  }

  stop(): void {
    this.handler.stop();
  }

  ingestAudio(buffer: Buffer): void {
    this.handler.handleBrowserAudio(buffer);
  }

  sendAudio(chunk: AudioChunk): void {
    this.handler.handleLLMAudio(chunk);
  }

  clearOutput(): void {
    // Browser playback is client-owned today; keep the hook for bridge parity.
  }

  onAudioToLlm(handler: (chunk: AudioChunk) => void): void {
    this.audioToLlm = handler;
  }
}
