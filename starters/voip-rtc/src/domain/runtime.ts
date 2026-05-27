import type {
  BrowserVoiceSessionSnapshot,
  VoiceProvider,
} from "@voiceagentsdk/core/client/browser";

export interface RuntimeProviderConfig {
  id: VoiceProvider;
  label: string;
  kind: string;
  enabled: boolean;
  missingEnv: string[];
  models: string[];
  voices: string[];
  defaultModel: string;
  defaultVoice: string;
  inputSampleRate: number;
  outputSampleRate: number;
}

export interface RuntimeConfig {
  wsUrl: string;
  defaultProviderId: VoiceProvider;
  browserAudio: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
  providers: RuntimeProviderConfig[];
}

export const initialSnapshot: BrowserVoiceSessionSnapshot = {
  state: "idle",
  sessionId: null,
  transcript: [],
  toolCalls: [],
  durationMs: 0,
  isMuted: false,
  outputLevel: 0,
  error: null,
  learning: null,
};

export function createFallbackRuntimeProviders(): RuntimeProviderConfig[] {
  return [
    {
      id: "gemini",
      label: "Gemini Live",
      kind: "gemini-live",
      enabled: false,
      missingEnv: ["GEMINI_API_KEY"],
      models: ["gemini-3.1-flash-live-preview"],
      voices: ["Puck"],
      defaultModel: "gemini-3.1-flash-live-preview",
      defaultVoice: "Puck",
      inputSampleRate: 16000,
      outputSampleRate: 24000,
    },
  ];
}
