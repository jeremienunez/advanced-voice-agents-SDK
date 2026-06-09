import type { JsonValue } from "./json.js";
import type {
  PromptBuildPlan,
} from "./builder.js";
import type {
  KnowledgeBuildPlan,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchIntent,
  KnowledgeResearchResult,
  KnowledgeVerificationVerdict,
} from "./knowledge.js";
import type { DatabaseBuildPlan } from "./database.js";
import type { ToolManifest, ToolName } from "./core.js";
import type {
  LlmResolvedModel,
  LlmTask,
  LlmTaskResult,
} from "./llm.js";
import type {
  AgentInfraPlan,
  DatabaseBackendPlan,
  KnowledgeBackendPlan,
  RuntimeDatabaseCredentialRef,
} from "./infra.js";
import type { ToolBuildPlan, ToolValidationReport } from "./tooling.js";
import type {
  AgentBuildDraft,
} from "./draft.js";

export * from "./runtime-ports.js";

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

export interface ToolRegistryRuntimeContext {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  providerId?: string;
}

export interface ToolRegistryExecutionInput {
  tool: ToolManifest;
  args: Record<string, unknown>;
  context?: ToolRegistryRuntimeContext;
}

export interface ToolRegistryAdapterPort {
  availableHandlerRefs(): readonly string[];
  canExecute(tool: ToolManifest): boolean;
  execute(input: ToolRegistryExecutionInput): Promise<unknown>;
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

export interface InfraPlannerPort {
  createInfraPlan(input: InfraPlanRequest): Promise<AgentInfraPlan> | AgentInfraPlan;
}

export interface DatabaseBackendResolverPort {
  resolveDatabaseBackend(input: InfraPlanRequest): DatabaseBackendPlan;
}

export interface KnowledgeBackendResolveResult {
  defaultBackendId: string;
  backends: KnowledgeBackendPlan[];
  reasons: string[];
  warnings?: string[];
}

export interface KnowledgeBackendPort {
  id: string;
  plan: KnowledgeBackendPlan;
  isConfigured(): boolean;
  ensure?(): Promise<void>;
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
  databaseCredentialRef?: RuntimeDatabaseCredentialRef;
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

export interface DatabaseCredentialResolverPort {
  resolveDatabaseUrl(
    ref: RuntimeDatabaseCredentialRef,
  ): Promise<string | undefined> | string | undefined;
}

export interface KnowledgeStorePort {
  isConfigured(): boolean;
  ensureSchema?(): Promise<void>;
  compile(input: KnowledgeStoreCompileInput): Promise<KnowledgeStoreCompileResult>;
}
