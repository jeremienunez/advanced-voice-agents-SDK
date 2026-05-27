import type {
  ToolBuildPlan,
  ToolValidationReport,
} from "./builder-tooling.js";

export type {
  ToolBuildContract,
  ToolBuildPlan,
  ToolValidationReport,
} from "./builder-tooling.js";

export interface ToolRegistryItem {
  name: string;
  title: string;
  description: string;
  category: string;
  permissions: string[];
  requiresKnowledge?: boolean;
  requiresGraph?: boolean;
  selectedByDefault?: boolean;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  kind: "txt" | "md" | "pdf" | "xlsx" | "xls" | "web_research" | "unknown";
  mimeType?: string;
  sizeBytes?: number;
  text?: string;
  status: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeResearchBudget {
  maxQueriesPerCycle: number;
  maxSources: number;
  maxEstimatedTokens: number;
  maxEstimatedCostUsd: number;
}

export interface KnowledgeResearchCheckpoint {
  id: string;
  label: string;
  status: "planned" | "running" | "completed" | "failed";
  at: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeResearchResult {
  status: string;
  budget: KnowledgeResearchBudget;
  spend: {
    cycles: number;
    queries: number;
    sources: number;
    estimatedTokens: number;
    estimatedCostUsd: number;
  };
  documents: KnowledgeDocument[];
  cycles: Array<{
    id: string;
    objective: string;
    queries: string[];
    status: string;
    sourceCount: number;
    estimatedTokens: number;
    estimatedCostUsd: number;
    documentId?: string;
    checkpoints?: KnowledgeResearchCheckpoint[];
    warnings?: string[];
  }>;
  checkpoints?: KnowledgeResearchCheckpoint[];
  stopReason?: string;
  warnings?: string[];
}

export interface DatabaseBuildPlan {
  id: string;
  status: string;
  databaseProvider: string;
  schemaName: string;
  sqlMigration: string;
  statements: Array<{
    id: string;
    sql: string;
    purpose: string;
    riskLevel: string;
  }>;
  vectorization: {
    embeddingProvider: string;
    embeddingModel: string;
    dimensions: number;
    sourceFields: string[];
    metadataFields: string[];
    retrievalMode: string;
    index: {
      kind: string;
      metric: string;
    };
    rationale?: string;
  };
  repositories: {
    repositories: Array<{
      id: string;
      table: string;
      operations: string[];
      vectorSearch?: boolean;
      lexicalSearch?: boolean;
    }>;
    safetyRules: string[];
    rationale?: string;
  };
  reasons: string[];
  risks: string[];
  validationErrors?: string[];
  appliedAt?: string;
}

export interface BuilderIdentity {
  builderFirstName: string;
  builderLastName: string;
  publicAgentName: string;
  intent: string;
  mustDo: string;
  mustNotDo: string;
  llmProvider: string;
  llmModel: string;
}

export interface BuilderProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
  notes?: string[];
}

export interface BuilderResearchSettings {
  provider: string;
  model: string;
  verifierProvider?: string;
  verifierModel?: string;
  verificationPasses?: number;
}

export interface AgentBuildDraft {
  id: string;
  status: string;
  identity: BuilderIdentity;
  promptPlan?: {
    questions: Array<{ id: string; label: string; reason?: string }>;
    assumptions: string[];
    recommendedVoice: {
      provider?: string;
      voice: string;
      tone: string;
      rationale: string;
    };
    promptPart1: string;
    doRules: string[];
    dontRules: string[];
    confidence?: number;
    warnings?: string[];
  };
  knowledgePlan?: {
    strategy: string;
    alternativeStrategies: string[];
    documents: KnowledgeDocument[];
    chunking: {
      method: string;
      targetTokens: number;
      overlapTokens: number;
      rationale?: string;
    };
    indexes: Array<{
      id: string;
      kind: string;
      fields: string[];
      implementation?: string;
    }>;
    kg: {
      enabled: boolean;
      entityTypes: string[];
      relationTypes: string[];
      rationale?: string;
    };
    reasons: string[];
    validationRequired: boolean;
    warnings?: string[];
  };
  databasePlan?: DatabaseBuildPlan;
  toolBuildPlan?: ToolBuildPlan;
  toolValidation?: ToolValidationReport;
  toolRegistry: ToolRegistryItem[];
  selectedTools: string[];
  promptParts: {
    part1?: string;
    tools?: string;
    final?: string;
  };
  compiled?: CompiledAgentSummary;
}

export interface CompiledAgentSummary {
  draftId: string;
  prompt: string;
  selectedTools: string[];
  createdAt: string;
  knowledge?: {
    strategy: string;
    status: string;
    documentCount: number;
    chunkCount?: number;
  };
}

export interface BuilderSessionResponse {
  activeDraftId: string | null;
  updatedAt: string | null;
  artifact: CompiledAgentSummary | null;
  draft: {
    id: string;
    status: string;
    identity: BuilderIdentity;
    promptChars: number;
  } | null;
  available: AgentBankItem[];
}

export interface AgentBankKnowledgeSummary {
  strategy?: string;
  status?: string;
  documentCount?: number;
  chunkCount?: number;
}

export interface AgentBankItem {
  draftId: string;
  kind: "compiled" | "draft";
  publicAgentName: string;
  intent: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  canRunRtc: boolean;
  knowledge: AgentBankKnowledgeSummary | null;
  database: {
    schemaName: string;
    status: string;
    appliedAt?: string;
  } | null;
  selectedTools: string[];
  promptChars: number;
}

export interface AgentBankResponse {
  activeDraftId: string | null;
  agents: AgentBankItem[];
}

export interface BuilderDraftResponse {
  draft: AgentBuildDraft;
}

export interface BuilderConfig {
  defaults: {
    promptProvider: string;
    promptModel: string;
    researchProvider: string;
    researchModel: string;
    knowledgeVerificationProvider: string;
    knowledgeVerificationModel: string;
    knowledgeVerificationPasses: number;
    voyageEmbeddingModel: string;
    voyageEmbeddingDimensions: number;
    researchBudget: KnowledgeResearchBudget;
  };
  availability: {
    deepseek: boolean;
    voyage: boolean;
    knowledgeStore: boolean;
    databaseProvisioner: boolean;
    research: boolean;
    knowledgeVerifier: boolean;
  };
  toolRegistry: ToolRegistryItem[];
  strategies: string[];
  providers: {
    prompt: BuilderProviderOption[];
    research: BuilderProviderOption[];
    verification: BuilderProviderOption[];
  };
}
export type AppMode = "hub" | "builder" | "agents" | "rtc";
