import type { PromptBuildPlan } from "../builder.js";
import type { DatabaseBuildPlan } from "../database.js";
import type { AgentBuildDraft } from "../draft.js";
import type { AgentInfraPlan } from "../infra/index.js";
import type { JsonValue } from "../json.js";
import type { KnowledgeBuildPlan, KnowledgeDocument } from "../knowledge.js";
import type { ToolName } from "../core/index.js";
import type { ToolBuildPlan, ToolValidationReport } from "../tooling.js";

export interface PromptBuildRequest {
  draft: AgentBuildDraft;
  answers?: Record<string, JsonValue>;
}

export interface KnowledgeBuildRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
}

export interface DatabaseBuildRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  knowledgePlan?: KnowledgeBuildPlan;
}

export interface InfraPlanRequest {
  draft: AgentBuildDraft;
  documents?: KnowledgeDocument[];
  knowledgePlan?: KnowledgeBuildPlan;
  databasePlan?: DatabaseBuildPlan;
}

export interface FinalPromptBuildRequest {
  draft: AgentBuildDraft;
  compositionAttempt?: number;
  previousPrompt?: string;
  promptQualityFeedback?: string[];
  selectedTools: ToolName[];
}

export interface ToolBuildRequest {
  draft: AgentBuildDraft;
  selectedTools: ToolName[];
  availableHandlers: string[];
}

export interface ToolValidationRequest {
  draft: AgentBuildDraft;
  plan: ToolBuildPlan;
  availableSecrets: string[];
}

export interface PromptPlannerPort {
  createPromptPlan(input: PromptBuildRequest): Promise<PromptBuildPlan>;
  createKnowledgePlan(input: KnowledgeBuildRequest): Promise<KnowledgeBuildPlan>;
  composeFinalPrompt(input: FinalPromptBuildRequest): Promise<string>;
}

export interface ToolPlannerPort {
  createToolPlan(input: ToolBuildRequest): Promise<ToolBuildPlan>;
  validateToolPlan(input: ToolValidationRequest): Promise<ToolValidationReport>;
}

export interface DatabasePlannerPort {
  createDatabasePlan(input: DatabaseBuildRequest): Promise<DatabaseBuildPlan>;
}

export interface InfraPlannerPort {
  createInfraPlan(input: InfraPlanRequest): Promise<AgentInfraPlan> | AgentInfraPlan;
}
