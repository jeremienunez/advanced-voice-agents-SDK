import type { ProviderDefinition } from "@voiceagentsdk/core/sdk";

export type StarterProviderId = "openai" | "gemini";

export interface RuntimeProviderConfig {
  id: StarterProviderId;
  label: string;
  kind: ProviderDefinition["kind"];
  requiredEnv: string[];
  enabled: boolean;
  models: string[];
  voices: string[];
  defaultModel: string;
  defaultVoice: string;
  inputSampleRate: number;
  outputSampleRate: number;
}

export function createProviderCatalog(): RuntimeProviderConfig[] {
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
      ]),
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
      enabled: hasAnyEnv(["OPENAI_API_KEY"]),
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

export function resolveDefaultProviderId(
  providers: RuntimeProviderConfig[],
): StarterProviderId {
  const preferred = Bun.env.DEFAULT_REALTIME_PROVIDER as
    | StarterProviderId
    | undefined;
  if (
    preferred &&
    providers.some((provider) => provider.id === preferred && provider.enabled)
  ) {
    return preferred;
  }

  return (
    providers.find((provider) => provider.id === "gemini" && provider.enabled)
      ?.id ??
    providers.find((provider) => provider.enabled)?.id ??
    "gemini"
  );
}

export function runtimeProvider(
  providers: RuntimeProviderConfig[],
  providerId: string,
): RuntimeProviderConfig {
  const provider = providers.find((item) => item.id === providerId);
  if (!provider) {
    throw new Error(`Provider "${providerId}" is not exposed by this starter`);
  }
  return provider;
}

export function publicProviderConfig(provider: RuntimeProviderConfig) {
  return {
    id: provider.id,
    label: provider.label,
    kind: provider.kind,
    enabled: provider.enabled,
    missingEnv: provider.enabled ? [] : provider.requiredEnv,
    models: provider.models,
    voices: provider.voices,
    defaultModel: provider.defaultModel,
    defaultVoice: provider.defaultVoice,
    inputSampleRate: provider.inputSampleRate,
    outputSampleRate: provider.outputSampleRate,
  };
}

export function resolveCatalogOption(
  label: "model" | "voice",
  value: string | undefined,
  allowedValues: string[],
  fallback: string,
): string {
  const selected = value ?? fallback;
  if (!allowedValues.includes(selected)) {
    throw new Error(`Unsupported ${label} "${selected}"`);
  }
  return selected;
}

export function requireEnv(names: string[]): string {
  for (const name of names) {
    const value = Bun.env[name];
    if (value) return value;
  }
  throw new Error(`Missing one of: ${names.join(", ")}`);
}

function hasAnyEnv(names: string[]): boolean {
  return names.some((name) => Boolean(Bun.env[name]));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
