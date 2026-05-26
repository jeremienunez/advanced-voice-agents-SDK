import type {
  AudioChunk,
  ProviderError,
  ProviderFunctionCall,
} from "../../types/transport.types.js";
import type { GrokAudioFormat, GrokVoice } from "../../types/grok.types.js";

export interface GrokRealtimeConfig {
  apiKey: string;
  voice?: GrokVoice;
  instructions?: string;
  tools?: Array<{
    type: "function";
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  audioFormat?: GrokAudioFormat;
  timeoutMs?: number;
}

export type GrokSessionUpdatePayload = {
  voice: GrokVoice;
  turn_detection: { type: "server_vad" };
  audio: {
    input: { format: GrokAudioFormat };
    output: { format: GrokAudioFormat };
  };
  instructions?: string;
  tools?: GrokRealtimeConfig["tools"];
};

export interface GrokRealtimeHandlers {
  onAudio: ((chunk: AudioChunk) => void) | null;
  onFunctionCall: ((call: ProviderFunctionCall) => void) | null;
  onSpeechStarted: (() => void) | null;
  onSpeechStopped: ((audioEndMs?: number) => void) | null;
  onResponseStarted: ((responseId: string) => void) | null;
  onResponseCompleted: ((responseId: string) => void) | null;
  onTranscript: ((text: string, isFinal: boolean) => void) | null;
  onError: ((error: ProviderError) => void) | null;
}

export function createGrokRealtimeHandlers(): GrokRealtimeHandlers {
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
