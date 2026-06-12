import WebSocket, { RawData } from "ws";
import { createAgentLogger } from "../../utils/logger.js";
import type {
  AudioChunk,
  IRealtimeProvider,
  IVoiceTransport,
  ProviderError,
  ProviderFunctionCall,
  RealtimeSessionUpdate,
  TransportMessage,
  TransportState,
} from "../../types/transport.types.js";
import type {
  OpenAIServerEvent,
  OpenAISessionConfig,
  ResponseCreateOptions,
} from "../../types/openai.types.js";
import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import {
  AudioBuffer,
  encodeAudioForOpenAI,
} from "../openai-audio.js";
import { createOpenAIDebugAudioDump } from "./debug-audio.js";
import {
  handleOpenAIRealtimeMessage,
  type OpenAIRealtimeEventState,
} from "./events.js";
import {
  buildOpenAIRealtimeSessionConfig,
  buildOpenAIRealtimeSessionUpdate,
} from "./session-config.js";
import { connectOpenAIRealtimeSocket } from "./connection.js";
import {
  buildFunctionResultItem,
  buildSystemMessageItem,
} from "./messages.js";
import type {
  OpenAIEventHandlers,
  OpenAIRealtimeConfig,
} from "./types.js";

export class OpenAIRealtimeTransport
  implements IVoiceTransport, IRealtimeProvider
{
  readonly id: string;
  readonly type = "openai-realtime" as const;
  readonly providerId = "openai-realtime" as const;

  private ws: WebSocket | null = null;
  private _state: TransportState = "disconnected";
  private readonly audioBuffer = new AudioBuffer();
  private readonly functionCallArgs = new Map<string, string>();
  private readonly logger = createAgentLogger("OpenAITransport");
  private readonly debugAudio = createOpenAIDebugAudioDump(this.logger);
  private readonly eventState: OpenAIRealtimeEventState;

  constructor(
    private readonly config: OpenAIRealtimeConfig,
    private readonly handlers: OpenAIEventHandlers = {},
  ) {
    this.id = `openai-${Date.now()}`;
    this.eventState = {
      sessionId: null,
      currentResponseId: null,
      currentItemId: null,
      lastAudioEndMs: null,
      audioBuffer: this.audioBuffer,
      functionCallArgs: this.functionCallArgs,
      handlers: this.handlers,
      logger: this.logger,
      appendOutputAudio: (chunk) => this.debugAudio?.appendOutput(chunk),
    };
  }

  get state(): TransportState { return this._state; }
  get isConnected(): boolean { return this._state === "connected"; }
  get lastSpeechEndMs(): number | null { return this.eventState.lastAudioEndMs; }
  get currentResponseItemId(): string | null { return this.eventState.currentItemId; }

  async connect(): Promise<void> {
    if (this.ws) await this.disconnect();
    this._state = "connecting";
    this.ws = await connectOpenAIRealtimeSocket({
      config: this.config,
      handleMessage: (data) => this.handleMessage(data),
      onSessionCreated: () => {
        this._state = "connected";
        this.configureSession();
      },
      onClose: () => {
        this._state = "disconnected";
        this.ws = null;
        this.eventState.sessionId = null;
      },
    });
  }

  async disconnect(): Promise<void> {
    this.debugAudio?.finalize();
    this.audioBuffer.clear();
    this.functionCallArgs.clear();
    this.eventState.currentResponseId = null;
    this.eventState.currentItemId = null;
    this.eventState.lastAudioEndMs = null;
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
    this.debugAudio?.appendInput(chunk.payload);
    this.sendEvent("input_audio_buffer.append", {
      audio: encodeAudioForOpenAI(chunk.payload),
    });
  }

  onAudio(handler: (chunk: AudioChunk) => void): void {
    this.handlers.onAudio = handler;
  }

  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void {
    this.handlers.onFunctionCall = (openaiCall) => {
      handler({
        callId: openaiCall.call_id,
        name: openaiCall.name,
        arguments: openaiCall.arguments,
      });
    };
  }

  onSpeechStarted(handler: () => void): void { this.handlers.onSpeechStarted = handler; }
  onSpeechStopped(handler: (audioEndMs?: number) => void): void { this.handlers.onSpeechStopped = handler; }
  onResponseStarted(handler: (responseId: string) => void): void { this.handlers.onResponseStarted = handler; }
  onResponseCompleted(handler: (responseId: string) => void): void { this.handlers.onResponseCompleted = handler; }

  onResponseDone(
    handler: (event: {
      responseId: string | null;
      status?: string;
      phase?: string;
      usage?: unknown;
    }) => void,
  ): void {
    this.handlers.onResponseDone = handler;
  }

  onResponseCancelled(handler: (responseId: string) => void): void { this.handlers.onResponseCancelled = handler; }
  onTranscript(handler: (text: string, isFinal: boolean, role?: "user" | "assistant") => void): void { this.handlers.onTranscript = handler; }

  onError(handler: (error: ProviderError) => void): void {
    this.handlers.onError = (apiError) => {
      handler({
        code: apiError.error.code ?? "unknown",
        message: apiError.error.message,
        type: apiError.error.type,
      });
    };
  }

  async send(message: TransportMessage): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    this.ws.send(JSON.stringify(message.payload));
  }

  on(): this {
    return this;
  }
  off(): this {
    return this;
  }

  async createResponse(options?: ResponseCreateOptions): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    this.sendEvent("response.create", options ? { response: options } : {});
  }

  async cancelResponse(): Promise<void> {
    if (this.ws && this._state === "connected") {
      this.sendEvent("response.cancel", {});
    }
  }

  async truncateResponse(
    itemId: string,
    contentIndex: number,
    audioEndMs: number,
  ): Promise<void> {
    if (this.ws && this._state === "connected") {
      this.sendEvent("conversation.item.truncate", {
        item_id: itemId,
        content_index: contentIndex,
        audio_end_ms: audioEndMs,
      });
    }
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
    this.sendEvent("conversation.item.create", buildFunctionResultItem(callId, result));
    if (triggerResponse) await this.createResponse();
  }

  async updateSession(
    config: RealtimeSessionUpdate | Partial<OpenAISessionConfig>,
  ): Promise<void> {
    if (this.ws && this._state === "connected") {
      this.sendEvent("session.update", {
        session: buildOpenAIRealtimeSessionUpdate(config),
      });
    }
  }

  async commitAudioBuffer(): Promise<void> {
    if (this.ws && this._state === "connected") {
      this.sendEvent("input_audio_buffer.commit", {});
    }
  }

  async clearAudioBuffer(): Promise<void> {
    if (this.ws && this._state === "connected") {
      this.logger.info("Clearing audio buffer");
      this.sendEvent("input_audio_buffer.clear", {});
      this.audioBuffer.clear();
    }
  }

  async deleteConversationItem(itemId: string): Promise<void> {
    if (this.ws && this._state === "connected") {
      this.sendEvent("conversation.item.delete", { item_id: itemId });
    }
  }

  async injectSystemMessage(content: string): Promise<string> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    const itemId = `msg_warmup_${Date.now()}`;
    this.sendEvent("conversation.item.create", buildSystemMessageItem(itemId, content));
    return itemId;
  }

  private sendEvent(type: string, data: Record<string, unknown>): void {
    if (this.ws) this.ws.send(JSON.stringify({ type, ...data }));
  }

  private configureSession(): void {
    const session = buildOpenAIRealtimeSessionConfig(this.config);
    this.sendEvent("session.update", { session });
  }

  private handleMessage(data: RawData): OpenAIServerEvent | null {
    return handleOpenAIRealtimeMessage(data, this.eventState);
  }
}

export function createOpenAIRealtimeTransport(
  config: OpenAIRealtimeConfig,
  handlers?: OpenAIEventHandlers,
): OpenAIRealtimeTransport {
  return new OpenAIRealtimeTransport(config, handlers);
}
