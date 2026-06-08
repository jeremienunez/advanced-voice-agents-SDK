import type {
  AgentBuildDraft,
  AgentInfraPlan,
  DatabaseBuildPlan,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import { IntentInfraPlanner } from "../../../../server/builder/domain/infra/planner.js";

export function learningSession(options: {
  agentId?: string | null;
  draftId?: string | null;
  runId?: string;
  transcriptText: string;
  toolStatus: "completed" | "failed";
  toolError?: string;
}): LearningSessionInput {
  return {
    runId: options.runId ?? "learn-bdd-session-a",
    agentId: options.agentId === null
      ? undefined
      : options.agentId ?? "draft-agent-a",
    draftId: options.draftId === null
      ? undefined
      : options.draftId ?? "draft-agent-a",
    tenantId: "tenant-a",
    userId: "user-a",
    summary: {
      sessionId: "session-bdd-a",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 1_000,
      endedAt: 9_000,
      durationMs: 8_000,
      messageCount: 1,
      toolCallCount: 1,
      endReason: "completed",
    },
    transcript: [{
      role: "user",
      text: options.transcriptText,
      isFinal: true,
      timestamp: 2_000,
    }],
    toolCalls: [{
      callId: "call-bdd-a",
      toolName: "create_invoice",
      arguments: { account: "Acme Routes" },
      startedAt: 3_000,
      completedAt: 4_000,
      status: options.toolStatus,
      result: options.toolStatus === "completed" ? { ok: true } : undefined,
      error: options.toolError,
    }],
  };
}

export function infraPlan(options: {
  learningEnabled: boolean;
  configured: boolean;
}): AgentInfraPlan {
  return new IntentInfraPlanner({
    databaseUrl: options.configured ? "postgres://local/test" : undefined,
    learningEnabled: options.learningEnabled,
    redisUrl: options.configured ? "redis://localhost:6379" : undefined,
    temporalAddress: options.configured ? "localhost:7233" : undefined,
    temporalNamespace: options.configured ? "default" : undefined,
    temporalTaskQueue: options.configured ? "agent-learning" : undefined,
  }).createInfraPlan({
    draft: draft("learning-bdd", "Self-improve after RTC sessions"),
    databasePlan: databasePlan("learning_bdd"),
  });
}

function draft(id: string, intent: string): AgentBuildDraft {
  return {
    id: `draft_${id}`,
    status: "draft",
    identity: {
      builderFirstName: "BDD",
      builderLastName: "Tester",
      publicAgentName: `Learning ${id}`,
      intent,
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function databasePlan(id: string): DatabaseBuildPlan {
  return {
    id: `db_${id}`,
    status: "validated",
    databaseProvider: "postgres-pgvector",
    schemaName: `agent_${id}`,
    sqlMigration: "create extension if not exists vector;",
    statements: [],
    tables: [],
    indexes: [],
    vectorization: {
      embeddingProvider: "voyage",
      embeddingModel: "voyage-4-large",
      dimensions: 1024,
      sourceFields: ["knowledge_chunks.content"],
      metadataFields: ["document_id"],
      retrievalMode: "hybrid",
      chunking: { method: "semantic", targetTokens: 420, overlapTokens: 72 },
      index: { kind: "hnsw", metric: "cosine" },
    },
    kg: { enabled: false, entityTypes: [], relationTypes: [] },
    repositories: { repositories: [], safetyRules: [] },
    reasons: [],
    risks: [],
  };
}
