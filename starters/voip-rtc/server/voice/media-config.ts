import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import { runtimeProvider } from "../providers/catalog.js";
import { tenantResolutionInputFromRequest } from "./tenant-resolution-input.js";
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
      const tenant = options.tenantResolver.resolveTenant(
        tenantResolutionInputFromRequest(request),
      );
      const providerDefinition = options.sdk.getProvider(tenant.providerId);
      return providerDefinition
        ? runtimeProvider(options.providerCatalog, providerDefinition.id)
          .inputSampleRate
        : options.browserSampleRate;
    },
  };
}
