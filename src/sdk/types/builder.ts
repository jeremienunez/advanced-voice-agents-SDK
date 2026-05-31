import type { JsonObject } from "./json.js";
import type { ProviderId } from "./core.js";

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

export type KnowledgeStrategy =
  | "vector"
  | "lexical"
  | "hybrid"
  | "raptor"
  | "kg"
  | "hybrid_kg";

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

export type KnowledgeDocumentKind =
  | "txt"
  | "md"
  | "pdf"
  | "xlsx"
  | "xls"
  | "web_research"
  | "unknown";
export type KnowledgeDocumentStatus =
  | "pending"
  | "parsed"
  | "unsupported"
  | "planned"
  | "ingested"
  | "failed";

export interface KnowledgeDocument {
  id: string;
  name: string;
  kind: KnowledgeDocumentKind;
  mimeType?: string;
  sizeBytes?: number;
  text?: string;
  status: KnowledgeDocumentStatus;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface KnowledgeResearchBudget {
  maxCycles: number;
  maxQueriesPerCycle: number;
  maxSources: number;
  maxEstimatedTokens: number;
  maxEstimatedCostUsd: number;
}

export interface KnowledgeResearchIntent {
  objective: string;
  queries: string[];
}

export interface KnowledgeResearchCheckpoint {
  id: string;
  label: string;
  status: "planned" | "running" | "completed" | "failed";
  at: string;
  detail?: string;
  metadata?: JsonObject;
}

export interface KnowledgeResearchCycle {
  id: string;
  objective: string;
  queries: string[];
  status: "planned" | "running" | "completed" | "skipped" | "failed";
  sourceCount: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  documentId?: string;
  checkpoints?: KnowledgeResearchCheckpoint[];
  warnings?: string[];
}

export interface KnowledgeResearchSpend {
  cycles: number;
  queries: number;
  sources: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export interface KnowledgeResearchResult {
  status: "completed" | "blocked" | "budget-exhausted" | "failed";
  budget: KnowledgeResearchBudget;
  spend: KnowledgeResearchSpend;
  documents: KnowledgeDocument[];
  cycles: KnowledgeResearchCycle[];
  checkpoints?: KnowledgeResearchCheckpoint[];
  stopReason?: string;
  warnings?: string[];
}

export interface KnowledgeVerificationVerdict {
  status: "sufficient" | "needs_more_data" | "failed";
  confidence: number;
  reasons: string[];
  missingTopics: string[];
  recommendedQueries: string[];
  coverageMatrix?: Array<{
    topic: string;
    status: "covered" | "weak" | "missing";
    evidence: string[];
    followUp: string[];
  }>;
  artifactTables?: Array<{
    name: string;
    purpose: string;
    recommendedFormat: "markdown" | "csv" | "xlsx";
    columns: string[];
    rows: string[][];
  }>;
  enrichmentMarkdown?: string;
  warnings?: string[];
  raw?: JsonObject;
}

export interface KnowledgeChunkingPlan {
  method: "fixed" | "semantic" | "recursive" | "raptor";
  targetTokens: number;
  overlapTokens: number;
  rationale?: string;
}

export interface KnowledgeIndexPlan {
  id: string;
  kind: "vector" | "lexical" | "graph";
  fields: string[];
  metric?: "cosine" | "dot" | "euclidean";
  dimensions?: number;
  implementation?: string;
}

export interface KnowledgeGraphPlan {
  enabled: boolean;
  entityTypes: string[];
  relationTypes: string[];
  rationale?: string;
}

export interface KnowledgeBuildPlan {
  strategy: KnowledgeStrategy;
  alternativeStrategies: KnowledgeStrategy[];
  documents: KnowledgeDocument[];
  chunking: KnowledgeChunkingPlan;
  indexes: KnowledgeIndexPlan[];
  kg: KnowledgeGraphPlan;
  reasons: string[];
  validationRequired: boolean;
  warnings?: string[];
  raw?: JsonObject;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
  tokenEstimate: number;
  metadata?: Record<string, unknown>;
}
