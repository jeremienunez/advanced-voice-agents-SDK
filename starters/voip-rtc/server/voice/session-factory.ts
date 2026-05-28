import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import { createRealtimeVoiceSession } from "@voiceagentsdk/core/server";
import { runtimeProvider } from "../providers/catalog.js";
import { instructionsForRequest } from "./instructions.js";
import { tenantResolutionInputFromRequest } from "./tenant-resolution-input.js";
import { toolsForRequest } from "./toolset.js";
import type { StarterVoiceServiceOptions } from "./types.js";

export function createVoiceSessionFactory(
  options: StarterVoiceServiceOptions,
): BrowserVoiceServiceConfig["createSession"] {
  return async (request, callbacks) => {
    const tenant = options.tenantResolver.resolveTenant(
      tenantResolutionInputFromRequest(request),
    );
    const providerDefinition = options.sdk.getProvider(tenant.providerId);
    if (!providerDefinition) {
      throw new Error(
        `No realtime provider configured for tenant "${tenant.tenantId}"`,
      );
    }
    if (!options.sdk.getMediaBridge(tenant.mediaBridgeId)) {
      throw new Error(
        `No media bridge configured for tenant "${tenant.tenantId}"`,
      );
    }

    const providerRuntime = runtimeProvider(
      options.providerCatalog,
      providerDefinition.id,
    );
    const tools = toolsForRequest(request.agent, options);
    const instructions = instructionsForRequest(
      providerDefinition.id,
      request.agent,
      options,
      tenant,
    );
    const provider = options.providerFactory.createProvider({
      definition: providerDefinition,
      requestedModel: request.model,
      requestedVoice: request.voice,
      instructions,
      tools,
      metadata: {
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        planId: tenant.planId,
      },
    });
    return createRealtimeVoiceSession(
      {
        sessionId: request.sessionId,
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        channel: "voice",
        providerId: providerDefinition.id,
        inputFormat: "pcm16",
        sampleRate: providerRuntime.inputSampleRate,
        maxDurationMs: tenant.limits?.maxDurationMs ?? 15 * 60 * 1000,
      },
      { provider, tools },
      callbacks,
    );
  };
}
