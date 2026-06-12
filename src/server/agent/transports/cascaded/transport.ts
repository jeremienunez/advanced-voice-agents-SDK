import type {
  AudioChunk,
  IRealtimeProvider,
  ProviderError,
  ProviderFunctionCall,
  RealtimeSessionUpdate,
  TransportState,
} from "../../types/transport.types.js";
import type {
  CascadedTransportConfig,
  ILLM,
  ISTT,
  ITTS,
} from "./types.js";
import { VadEngine } from "./vad.js";
import {
  cancelCascadedInFlight,
  processCascadedTurn,
  runCascadedLlmWithTts,
  submitCascadedToolResult,
  type CascadedPipelineState,
} from "./pipeline.js";
import { createCascadedHandlers } from "./handlers.js";
import { cascadedLogger } from "./logger.js";

export class CascadedRealtimeTransport implements IRealtimeProvider {
  readonly providerId = "cascaded";

  private _state: TransportState = "disconnected";
  private _lastSpeechEndMs: number | null = null;
  private readonly pipeline: CascadedPipelineState;
  private instructions: string;

  constructor(
    private readonly config: CascadedTransportConfig,
    stt: ISTT | null,
    llm: ILLM,
    tts: ITTS | null,
    private readonly vad: VadEngine,
  ) {
    this.instructions = config.instructions ?? "";
    this.pipeline = {
      stt,
      llm,
      tts,
      history: [],
      tools: config.tools ?? [],
      handlers: createCascadedHandlers(),
      activeAborts: new Set<AbortController>(),
      pendingToolResults: new Map<string, (result: unknown) => void>(),
      currentResponseItemId: null,
      toolResultTimeoutMs: config.toolResultTimeoutMs,
      logger: cascadedLogger,
    };
  }

  get state(): TransportState { return this._state; }
  get isConnected(): boolean { return this._state === "connected"; }
  get lastSpeechEndMs(): number | null { return this._lastSpeechEndMs; }
  get currentResponseItemId(): string | null { return this.pipeline.currentResponseItemId; }

  async connect(): Promise<void> {
    this.pipeline.history = [{ role: "system", content: this.instructions }];
    this._state = "connected";
    cascadedLogger.info("Connected", { mode: this.config.mode });
  }

  async disconnect(): Promise<void> {
    cancelCascadedInFlight(this.pipeline);
    this.vad.clear();
    this.pipeline.history = [];
    this._state = "disconnected";
    cascadedLogger.info("Disconnected");
  }

  async dispose(): Promise<void> {
    await this.disconnect();
  }

  async sendAudio(chunk: AudioChunk): Promise<void> {
    if (this._state !== "connected") return;

    const result = this.vad.push(chunk);
    if (result.event === "speech_started") {
      this._lastSpeechEndMs = null;
      this.pipeline.handlers.onSpeechStarted?.();
    }
    if (result.event === "speech_stopped" && result.buffer) {
      this._lastSpeechEndMs = Date.now();
      this.pipeline.handlers.onSpeechStopped?.(this._lastSpeechEndMs);
      void processCascadedTurn(this.pipeline, result.buffer);
    }
  }

  onAudio(handler: (chunk: AudioChunk) => void): void {
    this.pipeline.handlers.onAudio = handler;
  }

  async updateSession(config: RealtimeSessionUpdate): Promise<void> {
    if (config.instructions) {
      this.instructions = config.instructions;
      if (this.pipeline.history.length > 0) {
        this.pipeline.history[0] = { role: "system", content: config.instructions };
      }
    }
    if (config.tools) {
      this.pipeline.tools = config.tools as typeof this.pipeline.tools;
    }
  }

  async createResponse(): Promise<void> {
    if (this._state !== "connected") return;
    this.pipeline.history.push({ role: "user", content: "." });
    void runCascadedLlmWithTts(this.pipeline, `greeting-${Date.now()}`);
  }

  async cancelResponse(): Promise<void> {
    cascadedLogger.info("cancelResponse - aborting all in-flight");
    cancelCascadedInFlight(this.pipeline);
    this.vad.clear();
    this.pipeline.currentResponseItemId = null;
  }

  async truncateResponse(): Promise<void> {
    // No-op: barge-in handled by cancelResponse().
  }

  async submitFunctionResult(callId: string, result: unknown): Promise<void> {
    if (!submitCascadedToolResult(this.pipeline, callId, result)) {
      cascadedLogger.warn("submitFunctionResult: no pending resolver", { callId });
    }
  }

  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void {
    this.pipeline.handlers.onFunctionCall = handler;
  }
  onSpeechStarted(handler: () => void): void { this.pipeline.handlers.onSpeechStarted = handler; }
  onSpeechStopped(handler: (audioEndMs?: number) => void): void { this.pipeline.handlers.onSpeechStopped = handler; }
  onResponseStarted(handler: (id: string) => void): void { this.pipeline.handlers.onResponseStarted = handler; }
  onResponseCompleted(handler: (id: string) => void): void { this.pipeline.handlers.onResponseCompleted = handler; }
  onTranscript(handler: (text: string, isFinal: boolean, role?: "user" | "assistant") => void): void { this.pipeline.handlers.onTranscript = handler; }
  onError(handler: (error: ProviderError) => void): void { this.pipeline.handlers.onError = handler; }

  async injectSystemMessage(content: string): Promise<void> {
    this.pipeline.history.push({ role: "user", content: `[System] ${content}` });
  }
}
