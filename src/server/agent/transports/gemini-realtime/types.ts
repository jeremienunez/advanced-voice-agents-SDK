import type {
  AudioChunk,
  ProviderError,
  ProviderFunctionCall,
} from "../../types/transport.types.js";
import type {
  GeminiRealtimeModel,
  GeminiVoice,
} from "../../types/gemini.types.js";

export interface GeminiRealtimeConfig {
  apiKey: string;
  model?: GeminiRealtimeModel;
  voice?: GeminiVoice;
  instructions?: string;
  tools?: Array<{
    type: "function";
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  temperature?: number;
  timeoutMs?: number;
}

export interface GeminiRealtimeHandlers {
  onAudio: ((chunk: AudioChunk) => void) | null;
  onFunctionCall: ((call: ProviderFunctionCall) => void) | null;
  onSpeechStarted: (() => void) | null;
  onSpeechStopped: ((audioEndMs?: number) => void) | null;
  onResponseStarted: ((responseId: string) => void) | null;
  onResponseCompleted: ((responseId: string) => void) | null;
  onTranscript: ((text: string, isFinal: boolean, role?: "user" | "assistant") => void) | null;
  onError: ((error: ProviderError) => void) | null;
}

export function createGeminiRealtimeHandlers(): GeminiRealtimeHandlers {
  return {
    onAudio: null,
    onFunctionCall: null,
    onSpeechStarted: null,
    onSpeechStopped: null,
    onResponseStarted: null,
    onResponseCompleted: null,
    onTranscript: null,
    onError: null,
  };
}
