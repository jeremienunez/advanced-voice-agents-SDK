import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import { createRealtimeVoiceSession } from "@voiceagentsdk/core/server";
import type {
  MemoryRecord,
  MemoryScope,
  TenantResolutionResult,
} from "@voiceagentsdk/core/sdk";
import { runtimeProvider } from "../providers/catalog.js";
import { tenantResolutionInputFromRequest } from "./tenant-resolution-input.js";
import { toolsForRequest } from "./toolset.js";
import type { StarterVoiceServiceOptions } from "./types.js";

export function createVoiceSessionFactory(
  options: StarterVoiceServiceOptions,
): BrowserVoiceServiceConfig["createSession"] {
  return async (request, callbacks) => {
    if (options.starterMode === "production" && !request.agent) {
      throw new Error(
        "Explicit agent id is required in production starter mode",
      );
    }
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
    const memories = await runtimeMemories(options, tenant, request);
    const instructions = await options.promptCompiler.compilePrompt({
      channel: "voice",
      providerId: providerDefinition.id,
      agentId: request.agent,
      tenant,
      toolNames: tools.map((tool) => tool.name),
      memories,
    });
    await options.memoryStore?.write({
      scope: sessionMemoryScope(tenant, request),
      kind: "session.started",
      value: {
        providerId: providerDefinition.id,
        model: request.model,
        voice: request.voice,
        toolNames: tools.map((tool) => tool.name),
      },
    });
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

async function runtimeMemories(
  options: StarterVoiceServiceOptions,
  tenant: TenantResolutionResult,
  request: Parameters<BrowserVoiceServiceConfig["createSession"]>[0],
): Promise<readonly MemoryRecord[]> {
  return options.memoryStore?.list({
    scope: runtimeMemoryScope(tenant, request),
    limit: 12,
  }) ?? [];
}

function runtimeMemoryScope(
  tenant: TenantResolutionResult,
  request: Parameters<BrowserVoiceServiceConfig["createSession"]>[0],
): MemoryScope {
  return {
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    agentId: request.agent,
  };
}

function sessionMemoryScope(
  tenant: TenantResolutionResult,
  request: Parameters<BrowserVoiceServiceConfig["createSession"]>[0],
): MemoryScope {
  return {
    ...runtimeMemoryScope(tenant, request),
    sessionId: request.sessionId,
  };
}
