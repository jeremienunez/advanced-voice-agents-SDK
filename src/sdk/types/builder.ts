import type { ProviderId } from "./core.js";
import type { JsonObject } from "./json.js";

export type {
  DatabaseBuildPlan,
  DatabaseBuildStatus,
  DatabaseIndexPlan,
  DatabaseSqlStatement,
  RepositoryBuildPlan,
  RepositorySafeOperationPlan,
  VectorizationIndexKind,
  VectorizationPlan,
} from "./database.js";

export type AgentBuilderLlmProvider =
  | "deepseek"
  | "qwen"
  | "kimi"
  | "openai"
  | "gemini"
  | "anthropic"
  | "custom";

export type AgentBuildDraftStatus =
  | "draft"
  | "prompt-planned"
  | "knowledge-planned"
  | "database-planned"
  | "database-applied"
  | "knowledge-compiled"
  | "compiled";

export interface AgentBuilderIdentity {
  builderFirstName: string;
  builderLastName: string;
  publicAgentName: string;
  intent: string;
  mustDo: string[];
  mustNotDo: string[];
  llmProvider: AgentBuilderLlmProvider;
  llmModel: string;
}

export interface PromptBuildQuestion {
  id: string;
  label: string;
  reason?: string;
  required?: boolean;
}

export interface VoiceRecommendation {
  provider?: ProviderId;
  voice: string;
  tone: string;
  rationale: string;
}

export interface PromptBuildPlan {
  questions: PromptBuildQuestion[];
  assumptions: string[];
  recommendedVoice: VoiceRecommendation;
  promptPart1: string;
  doRules: string[];
  dontRules: string[];
  confidence?: number;
  warnings?: string[];
  raw?: JsonObject;
}
