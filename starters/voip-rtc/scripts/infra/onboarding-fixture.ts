import type {
  AgentBuildDraft,
  DatabaseBuildPlan,
} from "@voiceagentsdk/core/sdk";

export function createOnboardingDraft(input: {
  draftId?: string;
  intent?: string;
}): AgentBuildDraft {
  const id = input.draftId ?? "onboarding";
  return {
    id: `draft_${safeToken(id)}`,
    status: "draft",
    identity: {
      builderFirstName: "Infra",
      builderLastName: "Onboarding",
      publicAgentName: "Voice Agent SDK Infra",
      intent: input.intent ??
        "Provision onboarding infrastructure for a reusable voice agent runtime.",
      mustDo: ["Keep generated artifacts actionable by the solution itself."],
      mustNotDo: ["Do not embed secret values in IaC artifacts."],
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function createDatabasePlan(draftId: string): DatabaseBuildPlan {
  const schemaName = `agent_${safeToken(draftId)}`.slice(0, 60);
  return {
    id: `db_${draftId}`,
    status: "validated",
    databaseProvider: "postgres-pgvector",
    schemaName,
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

export function safeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
}
