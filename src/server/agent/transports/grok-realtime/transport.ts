import WebSocket from "ws";
import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type {
  AudioChunk,
  IRealtimeProvider,
  ProviderError,
  ProviderFunctionCall,
  RealtimeSessionUpdate,
  TransportState,
} from "../../types/transport.types.js";
import { encodeAudioBase64 } from "../../utils/audio.js";
import { createAgentLogger } from "../../utils/logger.js";
import { connectGrokRealtimeSocket } from "./connection.js";
import {
  handleGrokRealtimeMessage,
  type GrokRealtimeEventState,
} from "./events.js";
import {
  buildGrokFunctionResultEvent,
  buildGrokSystemMessageEvent,
} from "./session.js";
import {
  createGrokRealtimeHandlers,
  type GrokRealtimeConfig,
  type GrokRealtimeHandlers,
} from "./types.js";

export class GrokRealtimeTransport implements IRealtimeProvider {
  readonly providerId = "grok-realtime" as const;

  private ws: WebSocket | null = null;
  private _state: TransportState = "disconnected";
  private readonly logger = createAgentLogger("GrokTransport");
  private readonly handlers: GrokRealtimeHandlers =
    createGrokRealtimeHandlers();
  private readonly eventState: GrokRealtimeEventState;

  constructor(private readonly config: GrokRealtimeConfig) {
    this.eventState = {
      lastSpeechEndMs: null,
      currentResponseItemId: null,
      audioSeq: 0,
      config: this.config,
      handlers: this.handlers,
      logger: this.logger,
    };
  }

  get state(): TransportState { return this._state; }
  get isConnected(): boolean { return this._state === "connected"; }
  get lastSpeechEndMs(): number | null { return this.eventState.lastSpeechEndMs; }
  get currentResponseItemId(): string | null { return this.eventState.currentResponseItemId; }

  async connect(): Promise<void> {
    if (this.ws) await this.disconnect();
    this._state = "connecting";
    this.ws = await connectGrokRealtimeSocket({
      config: this.config,
      logger: this.logger,
      handleMessage: (data) => handleGrokRealtimeMessage(data, this.eventState),
      onConnected: () => {
        this._state = "connected";
      },
      onClose: () => {
        this._state = "disconnected";
        this.ws = null;
      },
    });
  }

  async disconnect(): Promise<void> {
    this.eventState.lastSpeechEndMs = null;
    this.eventState.currentResponseItemId = null;
    this.eventState.audioSeq = 0;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._state = "disconnected";
  }

  async dispose(): Promise<void> {
    await this.disconnect();
  }

  async sendAudio(chunk: AudioChunk): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    this.send({
      type: "input_audio_buffer.append",
      audio: encodeAudioBase64(chunk.payload),
    });
  }

  onAudio(handler: (chunk: AudioChunk) => void): void {
    this.handlers.onAudio = handler;
  }

  async updateSession(config: RealtimeSessionUpdate): Promise<void> {
    if (!this.ws || this._state !== "connected") return;

    const session: Record<string, unknown> = {};
    if (config.instructions) session.instructions = config.instructions;
    if (config.tools) session.tools = config.tools;

    this.send({ type: "session.update", session });
  }

  async createResponse(_options?: Record<string, unknown>): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    this.send({ type: "response.create" });
  }

  async cancelResponse(): Promise<void> {
    if (!this.ws || this._state !== "connected") return;
    this.send({ type: "response.cancel" });
  }

  async truncateResponse(
    itemId: string,
    contentIndex: number,
    audioEndMs: number,
  ): Promise<void> {
    if (!this.ws || this._state !== "connected") return;
    this.send({
      type: "conversation.item.truncate",
      item_id: itemId,
      content_index: contentIndex,
      audio_end_ms: audioEndMs,
    });
  }

  async submitFunctionResult(
    callId: string,
    result: unknown,
    triggerResponse = true,
  ): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    this.logger.info("Submitting function result", { callId, triggerResponse });
    this.send(buildGrokFunctionResultEvent(callId, result));
    if (triggerResponse) this.send({ type: "response.create" });
  }

  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void { this.handlers.onFunctionCall = handler; }
  onSpeechStarted(handler: () => void): void { this.handlers.onSpeechStarted = handler; }
  onSpeechStopped(handler: (audioEndMs?: number) => void): void { this.handlers.onSpeechStopped = handler; }
  onResponseStarted(handler: (responseId: string) => void): void { this.handlers.onResponseStarted = handler; }
  onResponseCompleted(handler: (responseId: string) => void): void { this.handlers.onResponseCompleted = handler; }
  onTranscript(handler: (text: string, isFinal: boolean) => void): void { this.handlers.onTranscript = handler; }
  onError(handler: (error: ProviderError) => void): void { this.handlers.onError = handler; }

  async injectSystemMessage(content: string): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    this.send(buildGrokSystemMessageEvent(content));
  }

  async clearAudioBuffer(): Promise<void> {
    // xAI only supports append/commit; buffer clearing is a no-op.
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.logger.debug("Sending event to xAI", { type: msg.type });
      this.ws.send(JSON.stringify(msg));
    }
  }
}

export function createGrokRealtimeTransport(
  config: GrokRealtimeConfig,
): GrokRealtimeTransport {
  return new GrokRealtimeTransport(config);
}
