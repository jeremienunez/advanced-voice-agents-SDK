import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import { createRealtimeVoiceSession } from "@voiceagentsdk/core/server";
import type {
  ActiveAgentScope,
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
    const tenant = options.tenantResolver.resolveTenant(
      tenantResolutionInputFromRequest(request),
    );
    const agentId = await resolveAgentId(options, request.agent, tenant);
    if (options.starterMode === "production" && !agentId) {
      throw new Error(
        "Explicit agent id or scoped active agent assignment is required in production starter mode",
      );
    }
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
    const tools = toolsForRequest(agentId, options);
    const memories = await runtimeMemories(options, tenant, agentId);
    const instructions = await options.promptCompiler.compilePrompt({
      channel: "voice",
      providerId: providerDefinition.id,
      agentId,
      tenant,
      toolNames: tools.map((tool) => tool.name),
      memories,
    });
    await options.memoryStore?.write({
      scope: sessionMemoryScope(tenant, request, agentId),
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
        agentId,
      },
    });
    return createRealtimeVoiceSession(
      {
        sessionId: request.sessionId,
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        agentId,
        channel: "voice",
        providerId: providerDefinition.id,
        inputFormat: "pcm16",
        sampleRate: providerRuntime.inputSampleRate,
        maxDurationMs: tenant.limits?.maxDurationMs ?? 15 * 60 * 1000,
      },
      { provider, tools, toolPolicyEngine: options.toolPolicyEngine },
      callbacks,
    );
  };
}

async function resolveAgentId(
  options: StarterVoiceServiceOptions,
  requestedAgentId: string | undefined,
  tenant: TenantResolutionResult,
): Promise<string | undefined> {
  if (requestedAgentId) return requestedAgentId;
  return options.activeAgentAssignment?.getActiveAgent(activeAgentScope(tenant));
}

async function runtimeMemories(
  options: StarterVoiceServiceOptions,
  tenant: TenantResolutionResult,
  agentId: string | undefined,
): Promise<readonly MemoryRecord[]> {
  return options.memoryStore?.list({
    scope: runtimeMemoryScope(tenant, agentId),
    limit: 12,
  }) ?? [];
}

function runtimeMemoryScope(
  tenant: TenantResolutionResult,
  agentId: string | undefined,
): MemoryScope {
  return {
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    agentId,
  };
}

function sessionMemoryScope(
  tenant: TenantResolutionResult,
  request: Parameters<BrowserVoiceServiceConfig["createSession"]>[0],
  agentId: string | undefined,
): MemoryScope {
  return {
    ...runtimeMemoryScope(tenant, agentId),
    sessionId: request.sessionId,
  };
}

function activeAgentScope(tenant: TenantResolutionResult): ActiveAgentScope {
  return {
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    planId: tenant.planId,
  };
}
