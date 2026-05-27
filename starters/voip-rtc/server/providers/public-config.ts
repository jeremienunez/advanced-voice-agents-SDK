import type { RuntimeProviderConfig } from "./types.js";

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
