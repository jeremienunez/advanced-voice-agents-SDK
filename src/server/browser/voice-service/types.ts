import type {
  VoiceProvider,
} from "../../../sdk/types/browser-voice.js";
import type {
  LearningJobStatus,
  LearningToolCallRecord,
  LearningTranscriptEntry,
} from "../../../sdk/types.js";
import type {
  BrowserMediaHandler,
} from "../../agent/handlers/index.js";
import type {
  IVoiceSession,
  SessionSummary,
  VoiceSessionCallbacks,
} from "../../agent/types/session.types.js";

export interface BrowserVoiceSocket {
  readonly readyState: number;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  on(
    event: "message",
    handler: (data: unknown, isBinary?: boolean) => void | Promise<void>,
  ): this;
  on(event: "close", handler: () => void | Promise<void>): this;
  on(event: "error", handler: (error: unknown) => void | Promise<void>): this;
}

export interface BrowserVoiceUserContext {
  tenantId?: string;
  userId?: string;
  planId?: string;
  metadata?: Record<string, unknown>;
}

export interface BrowserVoiceSessionRequest {
  sessionId: string;
  provider?: VoiceProvider;
  agent?: string;
  model?: string;
  voice?: string;
  providerOptions?: Record<string, unknown>;
  conversationId?: string;
  user: BrowserVoiceUserContext;
}

export type BrowserVoiceSampleRateResolver =
  | number
  | ((request: BrowserVoiceSessionRequest) => number);

export interface BrowserVoiceServiceConfig {
  createSession: (
    request: BrowserVoiceSessionRequest,
    callbacks: VoiceSessionCallbacks,
  ) => Promise<IVoiceSession>;
  createSessionId?: () => string;
  onSessionEnded?: (
    input: BrowserVoiceSessionEndedInput,
    emitStatus: (status: LearningJobStatus) => void,
  ) => Promise<void> | void;
  media?: {
    enableAgc?: boolean;
    enableRnnoise?: boolean;
    enableNoiseGate?: boolean;
    /**
     * Browser worklets stream PCM16 at 24 kHz by default. Keep this aligned
     * with the browser capture/playback processors unless you replace them.
     */
    browserSampleRate?: number;
    /**
     * Provider input sample rate. Can be dynamic per selected provider:
     * OpenAI Realtime expects 24 kHz, Gemini Live expects 16 kHz.
     */
    llmInputSampleRate?: BrowserVoiceSampleRateResolver;
  };
}

export interface ActiveBrowserSession {
  sessionId: string;
  request: BrowserVoiceSessionRequest;
  session: IVoiceSession;
  mediaHandler: BrowserMediaHandler;
  startedAt: number;
  messageCount: number;
  toolCallCount: number;
  transcript: LearningTranscriptEntry[];
  toolCalls: LearningToolCallRecord[];
}

export interface BrowserVoiceSessionEndedInput {
  request: BrowserVoiceSessionRequest;
  summary: SessionSummary;
  transcript: LearningTranscriptEntry[];
  toolCalls: LearningToolCallRecord[];
}
