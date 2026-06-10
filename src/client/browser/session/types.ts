import type {
  BrowserVoiceState,
  ServerVoiceMessage,
  VoiceLearningSummary,
} from "../types.js";

export interface BrowserVoiceSupport {
  supported: boolean;
  reason?: string;
}

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface ToolCallEntry {
  id: string;
  callId?: string;
  name: string;
  arguments: unknown;
  result: unknown;
  status: "pending" | "executing" | "awaiting_confirmation" | "completed" | "failed";
  timestamp: number;
}

export interface BrowserVoiceSessionSnapshot {
  state: BrowserVoiceState;
  sessionId: string | null;
  transcript: TranscriptEntry[];
  toolCalls: ToolCallEntry[];
  durationMs: number;
  isMuted: boolean;
  outputLevel: number;
  error: string | null;
  learning: VoiceLearningSummary | null;
}

export interface BrowserVoiceSessionCallbacks {
  onSnapshot?: (snapshot: BrowserVoiceSessionSnapshot) => void;
  onMessage?: (message: ServerVoiceMessage) => void;
  onError?: (error: Error) => void;
}

export type BrowserVoiceAudioMode = "microphone" | "silent";

export interface BrowserVoiceSessionClientOptions {
  getWsUrl: () => string | Promise<string>;
  callbacks?: BrowserVoiceSessionCallbacks;
  audio?: MediaTrackConstraints;
  audioMode?: BrowserVoiceAudioMode;
}
