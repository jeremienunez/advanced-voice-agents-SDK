import type { SecretRef, ToolName, VoiceAgentSdkDefinition } from "./core.js";
import type {
  AgentBuilderIdentity,
  AgentBuildDraftStatus,
  DatabaseBuildPlan,
  KnowledgeBuildPlan,
  KnowledgeStrategy,
  PromptBuildPlan,
} from "./builder.js";
import type { ToolBuildPlan, ToolValidationReport } from "./tooling.js";

export interface ToolRegistryItem {
  name: ToolName;
  title: string;
  description: string;
  category: string;
  permissions: string[];
  requiresKnowledge?: boolean;
  requiresGraph?: boolean;
  requiredSecrets?: SecretRef[];
  selectedByDefault?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentBuildDraft {
  id: string;
  status: AgentBuildDraftStatus;
  identity: AgentBuilderIdentity;
  promptPlan?: PromptBuildPlan;
  knowledgePlan?: KnowledgeBuildPlan;
  databasePlan?: DatabaseBuildPlan;
  toolBuildPlan?: ToolBuildPlan;
  toolValidation?: ToolValidationReport;
  toolRegistry: ToolRegistryItem[];
  selectedTools: ToolName[];
  promptParts: {
    part1?: string;
    tools?: string;
    final?: string;
  };
  compiled?: CompiledAgentArtifact;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CompiledAgentArtifact {
  draftId: string;
  sdkDefinition: VoiceAgentSdkDefinition;
  prompt: string;
  toolRegistry: ToolRegistryItem[];
  selectedTools: ToolName[];
  knowledge?: {
    strategy: KnowledgeStrategy;
    storeId?: string;
    documentCount: number;
    chunkCount?: number;
    status: "not-configured" | "planned" | "compiled";
  };
  createdAt: string;
}
