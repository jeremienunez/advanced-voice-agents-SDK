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
import { GEMINI_INPUT_MIME } from "../../types/gemini.types.js";
import { AudioBuffer, encodeAudioBase64 } from "../../utils/audio.js";
import { createAgentLogger } from "../../utils/logger.js";
import {
  connectGeminiRealtimeSocket,
} from "./connection.js";
import {
  handleGeminiServerMessage,
  type GeminiRealtimeEventState,
} from "./events.js";
import {
  buildGeminiCreateResponseMessage,
  buildGeminiSystemMessage,
  DEFAULT_GEMINI_LIVE_MODEL,
  normalizeGeminiModel,
} from "./setup.js";
import {
  createGeminiRealtimeHandlers,
  type GeminiRealtimeConfig,
  type GeminiRealtimeHandlers,
} from "./types.js";

export class GeminiRealtimeTransport implements IRealtimeProvider {
  readonly providerId = "gemini-realtime" as const;

  private ws: WebSocket | null = null;
  private _state: TransportState = "disconnected";
  private readonly audioBuffer = new AudioBuffer();
  private readonly logger = createAgentLogger("GeminiTransport");
  private readonly handlers: GeminiRealtimeHandlers =
    createGeminiRealtimeHandlers();
  private readonly functionNamesById = new Map<string, string>();
  private readonly eventState: GeminiRealtimeEventState;

  constructor(private readonly config: GeminiRealtimeConfig) {
    this.eventState = {
      audioBuffer: this.audioBuffer,
      currentResponseId: null,
      currentItemId: null,
      lastAudioEndMs: null,
      responseStarted: false,
      handlers: this.handlers,
      logger: this.logger,
    };
  }

  get state(): TransportState { return this._state; }
  get isConnected(): boolean { return this._state === "connected"; }
  get lastSpeechEndMs(): number | null { return this.eventState.lastAudioEndMs; }
  get currentResponseItemId(): string | null { return this.eventState.currentItemId; }

  async connect(): Promise<void> {
    if (this.ws) await this.disconnect();
    this._state = "connecting";
    const model = normalizeGeminiModel(this.config.model);

    this.ws = await connectGeminiRealtimeSocket({
      config: this.config,
      model,
      logger: this.logger,
      handleMessage: (msg) => handleGeminiServerMessage(msg, this.eventState),
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
    this.audioBuffer.clear();
    this.eventState.currentResponseId = null;
    this.eventState.currentItemId = null;
    this.eventState.lastAudioEndMs = null;
    this.eventState.responseStarted = false;
    this.functionNamesById.clear();
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

    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: encodeAudioBase64(chunk.payload),
            mimeType: GEMINI_INPUT_MIME,
          },
        },
      }),
    );
  }

  onAudio(handler: (chunk: AudioChunk) => void): void {
    this.handlers.onAudio = handler;
  }

  async updateSession(_config: RealtimeSessionUpdate): Promise<void> {
    this.logger.warn(
      "updateSession() is a no-op on Gemini (config is immutable after setup)",
    );
  }

  async createResponse(_options?: Record<string, unknown>): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    const model = this.config.model ?? DEFAULT_GEMINI_LIVE_MODEL;
    this.ws.send(JSON.stringify(buildGeminiCreateResponseMessage(model)));
  }

  async cancelResponse(): Promise<void> {
    this.logger.debug("cancelResponse() - Gemini handles barge-in natively");
  }

  async truncateResponse(
    _itemId: string,
    _contentIndex: number,
    _audioEndMs: number,
  ): Promise<void> {
    this.logger.debug(
      "truncateResponse() - Gemini handles truncation natively",
    );
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
    this.ws.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              id: callId,
              name: this.functionNamesById.get(callId) ?? callId,
              response: typeof result === "object" ? result : { result },
            },
          ],
        },
      }),
    );
  }

  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void {
    this.handlers.onFunctionCall = (call) => {
      this.functionNamesById.set(call.callId, call.name);
      handler(call);
    };
  }
  onSpeechStarted(handler: () => void): void { this.handlers.onSpeechStarted = handler; }
  onSpeechStopped(handler: (audioEndMs?: number) => void): void { this.handlers.onSpeechStopped = handler; }
  onResponseStarted(handler: (responseId: string) => void): void { this.handlers.onResponseStarted = handler; }
  onResponseCompleted(handler: (responseId: string) => void): void { this.handlers.onResponseCompleted = handler; }
  onTranscript(handler: (text: string, isFinal: boolean, role?: "user" | "assistant") => void): void { this.handlers.onTranscript = handler; }
  onError(handler: (error: ProviderError) => void): void { this.handlers.onError = handler; }

  async injectSystemMessage(content: string): Promise<void> {
    if (!this.ws || this._state !== "connected") {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    this.ws.send(JSON.stringify(buildGeminiSystemMessage(content)));
  }
}

export function createGeminiRealtimeTransport(
  config: GeminiRealtimeConfig,
): GeminiRealtimeTransport {
  return new GeminiRealtimeTransport(config);
}
