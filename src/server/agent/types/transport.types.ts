/**
 * Transport Types - Audio, messages, and connection interfaces
 */

// Audio encoding types supported by transports
export type AudioEncoding = "mulaw" | "pcm16" | "g711_ulaw";

// Audio chunk for streaming
export interface AudioChunk {
  payload: Buffer;
  encoding: AudioEncoding;
  sampleRate: number;
  channels: number;
  timestamp: number;
  sequenceNumber?: number;
}

// Transport message wrapper
export interface TransportMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  sequenceId?: string;
}

// Transport connection states
export type TransportState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

// Transport type identifiers
export type TransportType =
  | "twilio-voice"
  | "twilio-sms"
  | "openai-realtime"
  | "gemini-realtime"
  | "grok-realtime";

// Realtime LLM provider identifiers (for provider selection)
export type RealtimeProviderType = "openai" | "gemini" | "grok" | "cascaded";

// Transport configuration
export interface TransportConfig {
  id: string;
  type: TransportType;
  reconnectAttempts?: number;
  reconnectDelayMs?: number;
  timeoutMs?: number;
}

// Events emitted by transports
export interface TransportEvents {
  connected: { endpoint?: string };
  disconnected: { reason: string };
  reconnecting: { attempt: number };
  error: { code: string; message: string };
  message: TransportMessage;
  stateChange: { previous: TransportState; current: TransportState };
}

// Event handler type
export type TransportEventHandler<T> = (data: T) => void | Promise<void>;

// Transport interface - all transports must implement this
export interface ITransport {
  readonly id: string;
  readonly type: TransportType;
  readonly state: TransportState;
  readonly isConnected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: TransportMessage): Promise<void>;
  dispose(): Promise<void>;

  on<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEventHandler<TransportEvents[K]>,
  ): this;
  off<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEventHandler<TransportEvents[K]>,
  ): this;
}

// Voice-specific transport interface
export interface IVoiceTransport extends ITransport {
  readonly type: "twilio-voice" | "openai-realtime";
  sendAudio(chunk: AudioChunk): Promise<void>;
  onAudio(handler: (chunk: AudioChunk) => void): void;
}

// SMS-specific transport interface
export interface ISmsTransport extends ITransport {
  readonly type: "twilio-sms";
  sendSms(
    to: string,
    body: string,
    from?: string,
  ): Promise<{ messageSid: string; segmentCount: number }>;
}

// Connection info for monitoring
export interface ConnectionInfo {
  transportId: string;
  connectedAt: Date;
  remoteAddress?: string;
  latencyMs?: number;
}

// =============================================================================
// IRealtimeProvider - Provider-agnostic interface for realtime LLM providers
// =============================================================================

/** Configuration for connecting to a realtime provider */
export interface RealtimeProviderConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  instructions?: string;
  tools?: Array<{
    type: "function";
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  turnDetection?: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
    create_response?: boolean;
    interrupt_response?: boolean;
  };
  timeoutMs?: number;
}

/** Session update payload (partial config changes) */
export interface RealtimeSessionUpdate {
  instructions?: string;
  tools?: RealtimeProviderConfig["tools"];
  turnDetection?: RealtimeProviderConfig["turnDetection"];
  voice?: string;
}

/** Provider-agnostic function call */
export interface ProviderFunctionCall {
  callId: string;
  name: string;
  arguments: string;
}

/** Provider-agnostic error */
export interface ProviderError {
  code: string;
  message: string;
  type?: string;
}

export interface ProviderResponseDone {
  responseId: string | null;
  status?: string;
  phase?: string;
  usage?: unknown;
}

/**
 * Provider-agnostic interface for realtime LLM audio providers.
 * Allows swapping OpenAI Realtime for another provider (e.g. Google Gemini Live, Anthropic Voice)
 * without changing session or sub-module code.
 */
export interface IRealtimeProvider {
  readonly providerId: string;
  readonly state: TransportState;
  readonly isConnected: boolean;

  // Provider-specific state accessors (used by InterruptController)
  readonly lastSpeechEndMs: number | null;
  readonly currentResponseItemId: string | null;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  dispose(): Promise<void>;

  // Audio I/O
  sendAudio(chunk: AudioChunk): Promise<void>;
  onAudio(handler: (chunk: AudioChunk) => void): void;

  // Session control
  updateSession(config: RealtimeSessionUpdate): Promise<void>;
  createResponse(options?: Record<string, unknown>): Promise<void>;
  cancelResponse(): Promise<void>;
  truncateResponse(
    itemId: string,
    contentIndex: number,
    audioEndMs: number,
  ): Promise<void>;

  // Tool results
  submitFunctionResult(
    callId: string,
    result: unknown,
    triggerResponse?: boolean,
  ): Promise<void>;

  // Event registration
  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void;
  onSpeechStarted(handler: () => void): void;
  onSpeechStopped(handler: (audioEndMs?: number) => void): void;
  onResponseStarted(handler: (responseId: string) => void): void;
  onResponseCompleted(handler: (responseId: string) => void): void;
  onResponseDone?(handler: (event: ProviderResponseDone) => void): void;
  /** Fired when server-side VAD cancels a response (barge-in) */
  onResponseCancelled?(handler: (responseId: string) => void): void;
  onTranscript(handler: (text: string, isFinal: boolean) => void): void;
  onError(handler: (error: ProviderError) => void): void;

  // Per-turn context injection (returns item ID for cleanup)
  injectSystemMessage?(content: string): Promise<string | void>;

  // Conversation management (warm-up cleanup)
  deleteConversationItem?(itemId: string): Promise<void>;
}
