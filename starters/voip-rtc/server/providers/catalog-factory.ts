import { hasAnyEnv } from "./env.js";
import type { RuntimeProviderConfig } from "./types.js";

export function createProviderCatalog(): RuntimeProviderConfig[] {
  const e2eFakeProvider = Bun.env.RTC_E2E_FAKE_PROVIDER === "1";
  const openaiModel = Bun.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-1.5";
  const openaiVoice = Bun.env.OPENAI_REALTIME_VOICE ?? "marin";
  const geminiModel =
    Bun.env.GEMINI_REALTIME_MODEL ?? "gemini-3.1-flash-live-preview";
  const geminiVoice = Bun.env.GEMINI_REALTIME_VOICE ?? "Puck";

  const providers: RuntimeProviderConfig[] = [
    {
      id: "gemini",
      label: "Gemini Live",
      kind: "gemini-live",
      requiredEnv: [
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_GENERATIVE_AI_API_KEY",
      ],
      enabled: hasAnyEnv([
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_GENERATIVE_AI_API_KEY",
      ]) || e2eFakeProvider,
      models: [
        geminiModel,
        "gemini-3.1-flash-live-preview",
        "gemini-2.5-flash-native-audio-preview-12-2025",
      ],
      voices: [
        geminiVoice,
        "Puck",
        "Charon",
        "Kore",
        "Fenrir",
        "Aoede",
        "Leda",
        "Orus",
        "Zephyr",
      ],
      defaultModel: geminiModel,
      defaultVoice: geminiVoice,
      inputSampleRate: 16000,
      outputSampleRate: 24000,
    },
    {
      id: "openai",
      label: "OpenAI Realtime",
      kind: "openai-realtime",
      requiredEnv: ["OPENAI_API_KEY"],
      enabled: hasAnyEnv(["OPENAI_API_KEY"]) || e2eFakeProvider,
      models: [openaiModel, "gpt-realtime-1.5", "gpt-realtime-2"],
      voices: [openaiVoice, "marin", "cedar", "verse", "alloy"],
      defaultModel: openaiModel,
      defaultVoice: openaiVoice,
      inputSampleRate: 24000,
      outputSampleRate: 24000,
    },
  ];

  return providers.map((provider) => ({
    ...provider,
    models: unique(provider.models),
    voices: unique(provider.voices),
  }));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
