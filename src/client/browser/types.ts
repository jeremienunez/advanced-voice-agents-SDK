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

export type ClientVoiceMessage =
  | ({ type: "session.start" } & VoiceSessionStartOptions)
  | { type: "session.end" }
  | { type: "audio.pause" }
  | { type: "audio.resume" };

export type ServerVoiceMessage =
  | { type: "session.started"; sessionId: string }
  | { type: "session.ended"; summary: VoiceSessionSummary }
  | { type: "session.error"; error: { code: string; message: string } }
  | { type: "state.change"; state: BrowserVoiceState }
  | { type: "tool.call"; tool: { name: string; arguments: unknown } }
  | { type: "tool.result"; tool: { name: string; result: unknown } }
  | {
      type: "transcript";
      text: string;
      isFinal: boolean;
      role: "user" | "assistant";
    }
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

export interface VoiceWSCallbacks {
  onAudio: (buffer: ArrayBuffer) => void;
  onMessage: (message: ServerVoiceMessage) => void;
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Event) => void;
}

export interface VoiceWSClient {
  readonly isConnected: boolean;
  connect(url: string): void;
  disconnect(): void;
  sendAudio(buffer: ArrayBuffer): void;
  sendControl(message: ClientVoiceMessage): void;
}

export const BROWSER_VOICE_AUDIO = {
  SAMPLE_RATE: 24000,
  CHANNELS: 1,
  BYTES_PER_SAMPLE: 2,
  CHUNK_SIZE: 1920,
} as const;
