import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import { runtimeProvider } from "../providers/catalog.js";
import { resolveProviderDefinition } from "./provider-resolution.js";
import type { StarterVoiceServiceOptions } from "./types.js";

export function createVoiceMediaConfig(
  options: StarterVoiceServiceOptions,
): BrowserVoiceServiceConfig["media"] {
  return {
    enableAgc: true,
    enableNoiseGate: true,
    enableRnnoise: false,
    browserSampleRate: options.browserSampleRate,
    llmInputSampleRate: (request) => {
      const providerDefinition = resolveProviderDefinition(
        options.sdk,
        request.provider,
        request.user.tenantId ?? "local",
      );
      return providerDefinition
        ? runtimeProvider(options.providerCatalog, providerDefinition.id)
          .inputSampleRate
        : options.browserSampleRate;
    },
  };
}
