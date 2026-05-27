import type { JsonValue } from "./json.js";
import type {
  DatabaseBuildPlan,
  DatabaseBuildStatus,
  KnowledgeBuildPlan,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchIntent,
  KnowledgeResearchResult,
  KnowledgeVerificationVerdict,
  PromptBuildPlan,
} from "./builder.js";
import type { ToolName } from "./core.js";
import type {
  LlmResolvedModel,
  LlmTask,
  LlmTaskResult,
} from "./llm.js";
import type { ToolBuildPlan, ToolValidationReport } from "./tooling.js";
import type {
  AgentBuildDraft,
} from "./draft.js";

export interface PromptBuildRequest {
  draft: AgentBuildDraft;
  answers?: Record<string, JsonValue>;
}

export interface KnowledgeBuildRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
}

export interface KnowledgeResearchRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  budget?: Partial<KnowledgeResearchBudget>;
  settings?: {
    provider?: string;
    model?: string;
    researchIntents?: KnowledgeResearchIntent[];
  };
}

export interface KnowledgeVerificationRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  research?: KnowledgeResearchResult;
  settings?: {
    provider?: string;
    model?: string;
  };
}

export interface DatabaseBuildRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  knowledgePlan?: KnowledgeBuildPlan;
}

export interface FinalPromptBuildRequest {
  draft: AgentBuildDraft;
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

export interface LlmModelResolverPort {
  resolveModel(input: LlmTask): Promise<LlmResolvedModel> | LlmResolvedModel;
}

export interface LlmTaskRunnerPort {
  run<TOutput = unknown>(input: LlmTask): Promise<LlmTaskResult<TOutput>>;
}

export interface KnowledgeResearchPort {
  growKnowledge(input: KnowledgeResearchRequest): Promise<KnowledgeResearchResult>;
}

export interface KnowledgeVerifierPort {
  isConfigured?(): boolean;
  verifyKnowledge(
    input: KnowledgeVerificationRequest,
  ): Promise<KnowledgeVerificationVerdict>;
}

export interface DatabasePlannerPort {
  createDatabasePlan(input: DatabaseBuildRequest): Promise<DatabaseBuildPlan>;
}

export interface EmbeddingInput {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingVector {
  id: string;
  values: number[];
  dimensions: number;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingPort {
  embed(input: EmbeddingInput[]): Promise<EmbeddingVector[]>;
}

export interface KnowledgeStoreCompileInput {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
  embeddings: EmbeddingVector[];
}

export interface KnowledgeStoreCompileResult {
  storeId: string;
  documentCount: number;
  chunkCount: number;
  vectorIndexId?: string;
  lexicalIndexId?: string;
}

export type KnowledgeSearchMode = "lexical" | "vector" | "hybrid";

export interface KnowledgeSearchScope {
  draftId: string;
  schemaName?: string;
  storeId?: string;
}

export interface KnowledgeSearchInput {
  scope: KnowledgeSearchScope;
  query: string;
  mode?: KnowledgeSearchMode;
  limit?: number;
  embedding?: number[];
}

export interface KnowledgeSearchResultItem {
  chunkId: string;
  documentId: string;
  documentName: string;
  ordinal: number;
  content: string;
  score: number;
  lexicalScore?: number;
  vectorScore?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchResult {
  status: "ok" | "not-configured" | "not-compiled" | "empty";
  query: string;
  mode: KnowledgeSearchMode;
  resultCount: number;
  results: KnowledgeSearchResultItem[];
}

export interface KnowledgeSearchPort {
  isConfigured(): boolean;
  search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult>;
}

export interface KnowledgeStorePort {
  isConfigured(): boolean;
  ensureSchema?(): Promise<void>;
  compile(input: KnowledgeStoreCompileInput): Promise<KnowledgeStoreCompileResult>;
}

export interface DatabaseProvisionValidation {
  ok: boolean;
  status: DatabaseBuildStatus;
  errors: string[];
  warnings: string[];
}

export interface DatabaseProvisionInput {
  draft: AgentBuildDraft;
  plan: DatabaseBuildPlan;
}

export interface DatabaseProvisionResult {
  status: DatabaseBuildStatus;
  schemaName: string;
  appliedStatements: string[];
  warnings: string[];
  appliedAt: string;
}

export interface DatabaseProvisionerPort {
  isConfigured(): boolean;
  validate(input: DatabaseProvisionInput): DatabaseProvisionValidation;
  apply(input: DatabaseProvisionInput): Promise<DatabaseProvisionResult>;
}

export interface DocumentIngestionInput {
  id?: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  content: string | ArrayBuffer;
}

export interface DocumentIngestionPort {
  parse(input: DocumentIngestionInput): Promise<KnowledgeDocument>;
}
