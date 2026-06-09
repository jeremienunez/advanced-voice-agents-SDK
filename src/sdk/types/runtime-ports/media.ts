import type { MediaBridgeDefinition } from "../core/index.js";

export interface MediaBridgeFactoryInput<TOptions = unknown> {
  definition: MediaBridgeDefinition;
  browserSampleRate?: number;
  llmInputSampleRate?: number;
  options?: TOptions;
  metadata?: Record<string, unknown>;
}

export interface MediaBridgePort<
  TInboundAudio = unknown,
  TOutboundAudio = unknown,
  TLlmAudio = unknown,
> {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
  ingestAudio(audio: TInboundAudio): void | Promise<void>;
  sendAudio(audio: TOutboundAudio): void | Promise<void>;
  clearOutput(): void | Promise<void>;
  onAudioToLlm(handler: (audio: TLlmAudio) => void): void;
}

export interface MediaBridgeFactoryPort<
  TBridge = MediaBridgePort,
  TOptions = unknown,
> {
  createMediaBridge(input: MediaBridgeFactoryInput<TOptions>): TBridge;
}
