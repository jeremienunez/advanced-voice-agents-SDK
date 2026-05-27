import type {
  EmbeddingPort,
  KnowledgeSearchPort,
  LearningJobStatus,
  LearningSessionInput,
  ProviderDefinition,
} from "@voiceagentsdk/core/sdk";
import {
  GeminiRealtimeTransport,
  type IRealtimeProvider,
  type VoiceSessionTool,
  OpenAIRealtimeTransport,
  createRealtimeVoiceSession,
} from "@voiceagentsdk/core/server";
import { createBrowserVoiceService } from "@voiceagentsdk/core/server/browser";
import type { createBuilderService } from "./builder.js";
import {
  requireEnv,
  resolveCatalogOption,
  runtimeProvider,
  type RuntimeProviderConfig,
} from "./provider-catalog.js";
import { withRuntimeKnowledgePolicy } from "./runtime/knowledge-policy.js";
import { runtimeKnowledgeTools } from "./runtime/knowledge-tools.js";
import { runtimeAgentFromDraft } from "./runtime/compiled-agent.js";
import { runtimeActionTools } from "./runtime/tools/action-tools.js";
import type { createStarterSdk } from "./starter-sdk.js";
import type { StarterLearningService } from "./learning/service.js";

type BuilderService = ReturnType<typeof createBuilderService>;
type StarterSdk = ReturnType<typeof createStarterSdk>;

export function createStarterVoiceService(options: {
  builderService: BuilderService;
  browserSampleRate: number;
  providerCatalog: RuntimeProviderConfig[];
  runtimeKnowledge?: {
    embeddings: EmbeddingPort;
    embeddingAvailable: boolean;
    search: KnowledgeSearchPort;
  };
  learning?: StarterLearningService;
  sdk: StarterSdk;
}) {
  const { browserSampleRate, providerCatalog, sdk } = options;

  return createBrowserVoiceService({
    createSession: async (request, callbacks) => {
      const tenantId = request.user.tenantId ?? "local";
      const providerDefinition = resolveProviderDefinition(
        sdk,
        request.provider,
        tenantId,
      );
      if (!providerDefinition) {
        throw new Error(`No realtime provider configured for tenant "${tenantId}"`);
      }

      const providerRuntime = runtimeProvider(providerCatalog, providerDefinition.id);
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
    },
    media: {
      enableAgc: true,
      enableNoiseGate: true,
      enableRnnoise: false,
      browserSampleRate,
      llmInputSampleRate: (request) => {
        const providerDefinition = resolveProviderDefinition(
          sdk,
          request.provider,
          request.user.tenantId ?? "local",
        );
        return providerDefinition
          ? runtimeProvider(providerCatalog, providerDefinition.id).inputSampleRate
          : browserSampleRate;
      },
    },
    onSessionEnded: (input, emitStatus) => {
      if (!options.learning) {
        emitStatus(skippedLearningStatus(input.summary.sessionId, "Learning service is not configured."));
        return;
      }
      const draft = options.builderService.getCompiledDraft(input.request.agent);
      const draftId = input.request.agent ?? draft?.id;
      if (!draftId) {
        emitStatus(skippedLearningStatus(input.summary.sessionId, "No compiled draft was attached to the session."));
        return;
      }
      options.learning.enqueueSessionLearning(
        {
          agentId: draftId,
          draftId,
          tenantId: input.summary.tenantId,
          userId: input.summary.userId,
          summary: input.summary,
          transcript: input.transcript,
          toolCalls: input.toolCalls,
          metadata: compactMetadata({
            conversationId: input.request.conversationId,
            provider: input.request.provider,
            model: input.request.model,
            voice: input.request.voice,
          }),
        } satisfies LearningSessionInput,
        emitStatus,
      );
    },
  });
}

function skippedLearningStatus(
  sessionId: string,
  message: string,
): LearningJobStatus {
  const now = new Date().toISOString();
  return {
    jobId: `job_${sessionId}`,
    runId: `learn_${sessionId}`,
    status: "skipped",
    queuedAt: now,
    finishedAt: now,
    message,
  };
}

function compactMetadata(
  value: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string" && entry[1].length > 0;
    }),
  );
}

function createProvider(
  definition: ProviderDefinition,
  request: { agent?: string; model?: string; voice?: string },
  tools: VoiceSessionTool[],
  options: {
    builderService: BuilderService;
    providerCatalog: RuntimeProviderConfig[];
    sdk: StarterSdk;
  },
): IRealtimeProvider {
  const runtime = runtimeProvider(options.providerCatalog, definition.id);
  const model = resolveCatalogOption(
    "model",
    request.model ?? definition.model,
    runtime.models,
    runtime.defaultModel,
  );
  const voice = resolveCatalogOption(
    "voice",
    request.voice ?? definition.voice,
    runtime.voices,
    runtime.defaultVoice,
  );
  const instructions = instructionsForRequest(
    definition.id,
    request.agent,
    options,
  );

  if (definition.kind === "openai-realtime") {
    return new OpenAIRealtimeTransport({
      apiKey: requireEnv(runtime.requiredEnv),
      model: model as never,
      voice: voice as never,
      inputFormat: "pcm16",
      instructions,
      tools: providerTools(tools),
      noiseReduction: "near_field",
    });
  }

  if (definition.kind === "gemini-live") {
    return new GeminiRealtimeTransport({
      apiKey: requireEnv(runtime.requiredEnv),
      model: model as never,
      voice: voice as never,
      instructions,
      tools: providerTools(tools),
    });
  }

  throw new Error(`Unsupported starter provider "${definition.kind}"`);
}

function instructionsForRequest(
  providerId: string,
  agentId: string | undefined,
  options: {
    builderService: BuilderService;
    sdk: StarterSdk;
  },
): string {
  const compiled = options.builderService.getCompiledArtifact(agentId);
  if (compiled?.prompt) {
    return withRuntimeKnowledgePolicy(compiled.prompt, compiled);
  }
  return options.sdk.promptFor({
    channel: "voice",
    variables: {
      tenantId: "local",
      providerId,
    },
  });
}

function toolsForRequest(
  agentId: string | undefined,
  options: {
    builderService: BuilderService;
    runtimeKnowledge?: {
      embeddings: EmbeddingPort;
      embeddingAvailable: boolean;
      search: KnowledgeSearchPort;
    };
  },
): VoiceSessionTool[] {
  const agent = runtimeAgentFromDraft(options.builderService.getCompiledDraft(agentId));
  const knowledge = options.runtimeKnowledge
    ? runtimeKnowledgeTools(agentId, {
        ...options.runtimeKnowledge,
        getAgent: () => agent,
      })
    : [];
  const actions = agent ? runtimeActionTools(agent) : [];
  return [...knowledge, ...actions];
}

function providerTools(tools: VoiceSessionTool[]) {
  return tools.map(({ execute: _execute, ...tool }) => tool);
}

function resolveProviderDefinition(
  sdk: StarterSdk,
  requestedProviderId: string | undefined,
  tenantId: string,
): ProviderDefinition | undefined {
  if (requestedProviderId) return sdk.getProvider(requestedProviderId);
  return sdk.providerForTenant(tenantId);
}
