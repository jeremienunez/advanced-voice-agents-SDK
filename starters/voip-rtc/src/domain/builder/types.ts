import type { DatabaseBuildPlan } from "./database.js";
import type { AgentEvolutionSummary } from "./evolution.js";
import type { AgentInfraPlan } from "./infra.js";
import type {
  KnowledgeDocument,
  KnowledgeResearchBudget,
} from "./knowledge.js";
import type { ToolBuildPlan, ToolValidationReport } from "./tooling.js";

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

export interface BuilderIdentity {
  builderFirstName: string;
  builderLastName: string;
  publicAgentName: string;
  intent: string;
  mustDo: string;
  mustNotDo: string;
}

export type BuilderSystemRole =
  | "builder.planner"
  | "builder.researcher"
  | "builder.verifier"
  | "builder.prompt_composer"
  | "builder.tool_planner"
  | "builder.database_planner";

export interface BuilderSystemModelSelection {
  provider: string;
  model: string;
}

export type BuilderSystemModelSelections = Partial<
  Record<BuilderSystemRole, BuilderSystemModelSelection>
>;

export interface BuilderSystemConfig {
  modelSelections: BuilderSystemModelSelections;
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
  infraPlan?: AgentInfraPlan;
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
  builderSystem?: BuilderSystemConfig;
}

export interface CompiledAgentSummary {
  draftId: string;
  publicAgentName?: string;
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
  evolution?: AgentEvolutionSummary;
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
    documentParseTimeoutMs: number;
    documentIngestionQuotaPerIp: number;
    documentIngestionQuotaWindowMs: number;
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
