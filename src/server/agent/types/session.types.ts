import type { Channel } from "./event.types.js";
import type { AudioChunk } from "./transport.types.js";

export type SessionState =
  | "initializing"
  | "connecting"
  | "authenticating"
  | "awaiting_pin"
  | "verifying_pin"
  | "active"
  | "listening"
  | "speaking"
  | "processing"
  | "processing_tool"
  | "interrupted"
  | "paused"
  | "quota_warning"
  | "ending"
  | "ended"
  | "error"
  | "auth_failed"
  | "fatal_error";

export type SessionEndReason =
  | "completed"
  | "user_hangup"
  | "timeout"
  | "error";

export interface BaseSessionConfig {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  channel: Channel;
  language?: string;
  maxDurationMs?: number;
}

export interface VoiceSessionConfig extends BaseSessionConfig {
  channel: "voice";
  callSid?: string;
  streamSid?: string;
  providerId?: string;
  inputFormat?: "pcm16" | "g711_ulaw" | "mulaw";
  sampleRate?: number;
}

export interface PendingToolCall {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  startedAt: number;
  status: "pending" | "executing" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

export interface SessionContext {
  config: VoiceSessionConfig;
  state: SessionState;
  startedAt: number;
  lastActivityAt: number;
  messageCount: number;
  pendingToolCalls: Map<string, PendingToolCall>;
  toolCallsCompleted: number;
  interruptedAt?: number;
}

export interface SessionSummary {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  channel: Channel;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  messageCount: number;
  toolCallCount: number;
  endReason: SessionEndReason;
}

export interface VoiceSessionCallbacks {
  onStateChange?: (state: SessionState) => void;
  onToolCall?: (call: PendingToolCall) => void;
  onError?: (error: import("./error.types.js").AgentError) => void;
  onEnded?: (summary: SessionSummary) => void;
  onAudioOutput?: (chunk: AudioChunk) => void;
  onInterrupted?: () => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

export interface VoiceSessionToolContext {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  providerId?: string;
}

export interface VoiceSessionTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    args: Record<string, unknown>,
    context: VoiceSessionToolContext,
  ): Promise<unknown>;
}

export interface IVoiceSession {
  readonly sessionId: string;
  readonly state: SessionState;
  readonly config: VoiceSessionConfig;
  start(): Promise<void>;
  end(reason?: SessionEndReason): Promise<void>;
  handleAudio(chunk: Buffer): void;
  interrupt(): void;
}

export interface StateTransitionResult {
  success: boolean;
  previousState: SessionState;
  newState: SessionState;
  reason?: string;
}

export interface StateMetadata {
  allowsInput: boolean;
  allowsOutput: boolean;
  isTerminal: boolean;
  description: string;
}

export interface StateMachineConfig {
  sessionId: string;
  channel: Channel;
  initialState?: SessionState;
}

export interface ISessionStateMachine {
  readonly state: SessionState;
  readonly previous: SessionState | null;
  readonly isTerminated: boolean;
  readonly metadata: StateMetadata;
  transition(to: SessionState, reason?: string): StateTransitionResult;
  canTransitionTo(to: SessionState): boolean;
  getValidTransitions(): SessionState[];
  reset(initialState?: SessionState): void;
}
