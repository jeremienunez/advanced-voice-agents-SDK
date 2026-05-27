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
