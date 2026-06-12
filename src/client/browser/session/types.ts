import type {
  BrowserVoiceState,
  ServerVoiceMessage,
  VoiceAffect,
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
  /** Relative 4-band spectral distribution of the agent's output audio
      (ThreeLS split 0-500/500-700/700-3000/3000-6000 Hz) — drives
      viseme-style mouth shaping downstream. All zeros when quiet. */
  outputBands: readonly [number, number, number, number];
  error: string | null;
  learning: VoiceLearningSummary | null;
  /** Latest model-signaled facial affect, timestamped at reception. */
  affect: (VoiceAffect & { at: number }) | null;
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
