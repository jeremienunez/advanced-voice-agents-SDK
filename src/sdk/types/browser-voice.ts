export type BrowserVoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "processing"
  | "interrupted"
  | "error"
  | "ended";

export type VoiceProvider = "openai" | "gemini" | "grok" | "cascaded";

export interface VoiceSessionStartOptions {
  provider?: VoiceProvider;
  agent?: string;
  conversationId?: string;
  model?: string;
  voice?: string;
  providerOptions?: Record<string, unknown>;
}

/** Closed label set for the agent's facial affect side-channel. */
export type VoiceAffectLabel =
  | "neutral"
  | "smile"
  | "concern"
  | "surprise"
  | "thinking";

export interface VoiceAffect {
  label: VoiceAffectLabel;
  /** Always clamped to [0,1] server-side. */
  intensity: number;
}

export type ClientVoiceMessage =
  | ({ type: "session.start" } & VoiceSessionStartOptions)
  | { type: "session.end" }
  | { type: "audio.pause" }
  | { type: "audio.resume" };

export type ServerVoiceMessage =
  | { type: "session.started"; sessionId: string }
  | { type: "session.ended"; summary: VoiceSessionSummary }
  | { type: "learning.status"; learning: VoiceLearningSummary }
  | { type: "session.error"; error: { code: string; message: string } }
  | { type: "state.change"; state: BrowserVoiceState }
  | {
      type: "tool.call";
      tool: {
        callId?: string;
        name: string;
        arguments: unknown;
        status?: "pending" | "executing" | "awaiting_confirmation";
      };
    }
  | {
      type: "tool.result";
      tool: {
        callId?: string;
        name: string;
        result: unknown;
        status?: "completed" | "failed";
      };
    }
  | {
      type: "transcript";
      text: string;
      isFinal: boolean;
      role: "user" | "assistant";
    }
  | { type: "affect"; affect: VoiceAffect }
  | { type: "text_delta"; text: string }
  | {
      type: "tool_start";
      toolName: string;
      toolCallId?: string;
      toolArgs?: unknown;
    }
  | {
      type: "tool_result";
      toolName: string;
      toolCallId?: string;
      toolData: unknown;
      durationMs?: number;
    }
  | { type: "tool_error"; toolName: string; toolCallId?: string; error: string }
  | { type: "mode"; mode: string }
  | { type: "done"; conversationId?: string };

export interface VoiceSessionSummary {
  sessionId: string;
  durationMs: number;
  messageCount: number;
  toolCallCount: number;
}

export type VoiceLearningStatus =
  | "queued"
  | "running"
  | "evaluated"
  | "applied"
  | "pending_approval"
  | "rejected"
  | "failed"
  | "skipped";

export interface VoiceLearningSummary {
  jobId: string;
  runId: string;
  status: VoiceLearningStatus;
  agentId?: string;
  draftId?: string;
  queuedAt: string;
  startedAt?: string;
  evaluatedAt?: string;
  finishedAt?: string;
  message?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
