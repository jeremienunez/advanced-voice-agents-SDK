import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import type {
  AgentBuildDraft,
  AgentInfraPlan,
  LearningJobStatus,
} from "@voiceagentsdk/core/sdk";
import type { StarterServerEnv } from "../../server/http/types.js";
import type { RuntimeProviderConfig } from "../../server/providers/catalog.js";
import { E2EFakeRealtimeProvider } from "../../server/providers/e2e-fake-provider.js";
import type { StarterVoiceServiceOptions } from "../../server/voice/types.js";

export type SessionEndedInput = Parameters<
  NonNullable<BrowserVoiceServiceConfig["onSessionEnded"]>
>[0];

export function serverEnv(): StarterServerEnv {
  return {
    allowedOrigins: new Set(["http://localhost:5177"]),
    authToken: "secret-token",
    browserSampleRate: 24_000,
    hostname: "127.0.0.1",
    isProduction: false,
    port: 8787,
    publicHost: "http://127.0.0.1:8787",
  };
}

export function runtimeProvider(requiredEnv: string): RuntimeProviderConfig {
  return {
    id: "gemini",
    label: "Gemini",
    kind: "gemini-live",
    requiredEnv: [requiredEnv],
    enabled: true,
    models: ["gemini-test"],
    voices: ["Puck"],
    defaultModel: "gemini-test",
    defaultVoice: "Puck",
    inputSampleRate: 16_000,
    outputSampleRate: 24_000,
  };
}

export function voiceOptions(
  overrides: Partial<StarterVoiceServiceOptions> = {},
): StarterVoiceServiceOptions {
  return {
    builderService: builderService(agentDraft("draft-solid")),
    browserSampleRate: 24_000,
    providerCatalog: [],
    providerFactory: {
      createProvider: () => new E2EFakeRealtimeProvider(),
    },
    promptCompiler: {
      compilePrompt: () => "test prompt",
    },
    secretResolver: {
      resolveSecret: () => "test-secret",
    },
    tenantResolver: {
      resolveTenant: () => ({
        tenantId: "local",
        providerId: "gemini",
        mediaBridgeId: "browser",
        planId: "dev",
        userId: "demo",
      }),
    },
    sdk: { promptFor: () => "test prompt" },
    ...overrides,
  } as unknown as StarterVoiceServiceOptions;
}

export function builderService(draft: AgentBuildDraft) {
  return {
    getCompiledArtifact: () => draft.compiled,
    getCompiledDraft: () => draft,
    getActiveSession: () => ({}),
    handle: async () => ({ response: null }),
  };
}

export function sessionEndedInput(): SessionEndedInput {
  return {
    request: {
      sessionId: "session-a",
      provider: "gemini",
      model: "gemini-test",
      conversationId: "conversation-a",
      user: { tenantId: "tenant-a", userId: "user-a" },
    },
    summary: {
      sessionId: "session-a",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 0,
      endedAt: 10,
      durationMs: 10,
      messageCount: 1,
      toolCallCount: 1,
      endReason: "completed",
    },
    transcript: [
      { role: "user", text: "Keep answers short", isFinal: true, timestamp: 1 },
    ],
    toolCalls: [{
      callId: "call-a",
      toolName: "lookup",
      arguments: { query: "test" },
      status: "completed",
      startedAt: 2,
      completedAt: 3,
      result: { ok: true },
    }],
  };
}

export function agentDraft(id: string): AgentBuildDraft {
  const now = new Date(0).toISOString();
  return {
    id,
    status: "compiled",
    identity: {
      builderFirstName: "Solid",
      builderLastName: "Tester",
      publicAgentName: "Solid Seam Agent",
      intent: "Validate seams",
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    toolRegistry: [],
    selectedTools: ["lookup"],
    promptParts: { final: "compiled prompt" },
    knowledgePlan: {
      strategy: "hybrid_kg",
      alternativeStrategies: [],
      documents: [{ id: "doc-a", name: "doc.md", kind: "md", status: "parsed" }],
      chunking: { method: "semantic", targetTokens: 420, overlapTokens: 72 },
      indexes: [],
      kg: { enabled: true, entityTypes: ["User"], relationTypes: ["prefers"] },
      reasons: ["test"],
      validationRequired: false,
    },
    compiled: {
      draftId: id,
      sdkDefinition: emptySdkDefinition(),
      prompt: "compiled prompt",
      toolRegistry: [],
      selectedTools: ["lookup"],
      knowledge: {
        strategy: "hybrid_kg",
        documentCount: 1,
        chunkCount: 7,
        status: "compiled",
      },
      createdAt: now,
    },
    createdAt: now,
    updatedAt: now,
    metadata: { knowledgeStore: { chunkCount: 7 } },
  };
}

export function infraPlan(
  draftId: string,
  overrides: Partial<AgentInfraPlan> = {},
): AgentInfraPlan {
  return {
    id: "infra-solid",
    draftId,
    status: "planned",
    computeTarget: "local",
    isolation: "namespace",
    provisioningMode: "server_template",
    defaultBackendId: "postgres-primary",
    database: {
      id: "postgres-primary",
      provider: "postgres-pgvector",
      configured: true,
      namespace: "agent_solid",
      schemaName: "agent_solid",
      provisioningMode: "server_template",
      isolation: "namespace",
      reason: "test",
    },
    knowledgeBackends: [{
      id: "postgres-primary",
      provider: "postgres-pgvector",
      role: "source_of_truth",
      configured: true,
      namespace: "agent_solid",
      required: true,
      capabilities: ["sql", "vector_search"],
      provisioningMode: "server_template",
      isolation: "namespace",
      reason: "test",
    }],
    resources: [],
    migrationPolicy: {
      source: "server_owned_templates",
      allowGeneratedSql: false,
      requiresApproval: false,
      versionTable: "agent_solid.schema_migrations",
    },
    security: {
      tenantScoped: true,
      leastPrivilegeRole: true,
      secretRefs: [],
      networkPolicy: "local_only",
    },
    reasons: ["test"],
    ...overrides,
  };
}

export function learningStatus(
  status: LearningJobStatus["status"],
  draftId: string,
): LearningJobStatus {
  return {
    jobId: `job-${draftId}`,
    runId: `run-${draftId}`,
    status,
    draftId,
    agentId: draftId,
    queuedAt: new Date(0).toISOString(),
  };
}

function emptySdkDefinition(): NonNullable<
  AgentBuildDraft["compiled"]
>["sdkDefinition"] {
  return {
    tenants: [],
    providers: [],
    mediaBridges: [],
    plans: [],
    prompts: [],
    tools: [],
    databases: [],
    stores: [],
    onboarding: [],
    packs: [],
  };
}
