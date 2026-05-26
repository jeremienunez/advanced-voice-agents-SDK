import type { AudioChunk } from "../../types/transport.types.js";
import type {
  OpenAIApiError,
  OpenAIFunctionCall,
  OpenAISessionConfig,
  OpenAIVoice,
  OpenAIRealtimeModel,
  OpenAIRealtimeReasoningSetting,
  TurnDetectionConfig,
} from "../../types/openai.types.js";

export interface OpenAIRealtimeConfig {
  apiKey: string;
  model?: OpenAIRealtimeModel;
  voice?: OpenAIVoice;
  speed?: number;
  reasoningEffort?: OpenAIRealtimeReasoningSetting;
  safetyIdentifier?: string;
  noiseReduction?: "near_field" | "far_field" | null;
  inputFormat?: "pcm16" | "g711_ulaw";
  instructions?: string;
  tools?: OpenAISessionConfig["tools"];
  turnDetection?: TurnDetectionConfig;
  temperature?: number;
  timeoutMs?: number;
}

export interface OpenAIEventHandlers {
  onAudio?: (chunk: AudioChunk) => void;
  onFunctionCall?: (call: OpenAIFunctionCall) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: (audioEndMs?: number) => void;
  onResponseStarted?: (responseId: string) => void;
  onResponseCompleted?: (responseId: string) => void;
  onResponseDone?: (event: {
    responseId: string | null;
    status?: string;
    phase?: string;
    usage?: unknown;
  }) => void;
  onResponseCancelled?: (responseId: string) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: OpenAIApiError) => void;
}
