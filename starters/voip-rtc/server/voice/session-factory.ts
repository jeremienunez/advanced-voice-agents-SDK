import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import { createRealtimeVoiceSession } from "@voiceagentsdk/core/server";
import { runtimeProvider } from "../providers/catalog.js";
import { createProvider } from "./provider-factory.js";
import { resolveProviderDefinition } from "./provider-resolution.js";
import { toolsForRequest } from "./toolset.js";
import type { StarterVoiceServiceOptions } from "./types.js";

export function createVoiceSessionFactory(
  options: StarterVoiceServiceOptions,
): BrowserVoiceServiceConfig["createSession"] {
  return async (request, callbacks) => {
    const tenantId = request.user.tenantId ?? "local";
    const providerDefinition = resolveProviderDefinition(
      options.sdk,
      request.provider,
      tenantId,
    );
    if (!providerDefinition) {
      throw new Error(`No realtime provider configured for tenant "${tenantId}"`);
    }

    const providerRuntime = runtimeProvider(
      options.providerCatalog,
      providerDefinition.id,
    );
    const tools = toolsForRequest(request.agent, options);
    const provider = createProvider(providerDefinition, request, tools, options);
    return createRealtimeVoiceSession(
      {
        sessionId: request.sessionId,
        tenantId,
        userId: request.user.userId,
        channel: "voice",
        providerId: providerDefinition.id,
        inputFormat: "pcm16",
        sampleRate: providerRuntime.inputSampleRate,
        maxDurationMs: 15 * 60 * 1000,
      },
      { provider, tools },
      callbacks,
    );
  };
}
