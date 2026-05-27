import type { JsonObject, JsonValue } from "./json.js";
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
import type {
  AgentInfraPlan,
  DatabaseBackendPlan,
  InfraResourceRef,
  KnowledgeBackendPlan,
} from "./infra.js";
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

export interface InfraPlanRequest {
  draft: AgentBuildDraft;
  documents?: KnowledgeDocument[];
  knowledgePlan?: KnowledgeBuildPlan;
  databasePlan?: DatabaseBuildPlan;
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

export interface InfraProvisionInput {
  draft: AgentBuildDraft;
  plan: AgentInfraPlan;
}

export interface DatabaseProvisionResult {
  status: DatabaseBuildStatus;
  schemaName: string;
  appliedStatements: string[];
  warnings: string[];
  appliedAt: string;
}

export interface InfraProvisionResult {
  status: AgentInfraPlan["status"];
  planId: string;
  resources: InfraResourceRef[];
  warnings: string[];
  appliedAt?: string;
}

export interface InfraProvisionValidation {
  ok: boolean;
  status: AgentInfraPlan["status"];
  errors: string[];
  warnings: string[];
}

export interface DatabaseProvisionerPort {
  isConfigured(): boolean;
  validate(input: DatabaseProvisionInput): DatabaseProvisionValidation;
  apply(input: DatabaseProvisionInput): Promise<DatabaseProvisionResult>;
}

export interface InfraProvisionerPort {
  isConfigured(): boolean;
  validate(input: InfraProvisionInput): InfraProvisionValidation;
  apply(input: InfraProvisionInput): Promise<InfraProvisionResult>;
}

export type LearningRunStatus =
  | "queued"
  | "running"
  | "applied"
  | "failed"
  | "skipped";

export interface LearningSessionSummary {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  channel: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  messageCount: number;
  toolCallCount: number;
  endReason: string;
}

export interface LearningTranscriptEntry {
  role: "user" | "assistant" | "tool" | string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface LearningToolCallRecord {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "failed" | string;
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface LearningSessionInput {
  runId?: string;
  agentId?: string;
  draftId?: string;
  tenantId?: string;
  userId?: string;
  summary: LearningSessionSummary;
  transcript: LearningTranscriptEntry[];
  toolCalls: LearningToolCallRecord[];
  metadata?: JsonObject;
}

export interface LearningJobStatus {
  jobId: string;
  runId: string;
  status: LearningRunStatus;
  agentId?: string;
  draftId?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  error?: string;
}

export interface TemporalWorkflowPort {
  enqueueLearningSession(
    input: LearningSessionInput,
  ): Promise<LearningJobStatus> | LearningJobStatus;
  getLearningStatus?(runId: string): Promise<LearningJobStatus | null> | LearningJobStatus | null;
}

export interface TemporalMemoryScope {
  tenantId?: string;
  agentId?: string;
  userId?: string;
}

export interface TemporalMemoryRecord {
  id: string;
  scope: TemporalMemoryScope;
  kind: "fact" | "preference" | "failed_intent" | "missing_tool" | "summary";
  text: string;
  data?: JsonValue;
  sourceSessionId: string;
  createdAt: string;
  expiresAt?: string;
}

export interface TemporalMemoryWriteInput {
  scope: TemporalMemoryScope;
  records: Array<Omit<TemporalMemoryRecord, "id" | "scope" | "createdAt" | "expiresAt">>;
  ttlSeconds?: number;
}

export interface TemporalMemoryStorePort {
  isConfigured(): boolean;
  ensure?(): Promise<void> | void;
  write(input: TemporalMemoryWriteInput): Promise<TemporalMemoryRecord[]>;
  list(scope: TemporalMemoryScope): Promise<TemporalMemoryRecord[]>;
  deleteExpired?(now?: Date): Promise<number> | number;
}

export interface GraphMemoryNode {
  id: string;
  type: string;
  label: string;
  properties?: JsonObject;
}

export interface GraphMemoryEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  properties?: JsonObject;
}

export interface GraphMemoryUpsertInput {
  tenantId?: string;
  agentId?: string;
  userId?: string;
  sourceSessionId: string;
  nodes: GraphMemoryNode[];
  edges: GraphMemoryEdge[];
}

export interface GraphMemoryStorePort {
  isConfigured(): boolean;
  ensure?(): Promise<void> | void;
  upsert(input: GraphMemoryUpsertInput): Promise<{ nodeCount: number; edgeCount: number }>;
}

export interface AgentEvolutionInput {
  runId: string;
  draftId: string;
  agentId?: string;
  sourceSessionId: string;
  memories: TemporalMemoryRecord[];
  graph: {
    nodes: GraphMemoryNode[];
    edges: GraphMemoryEdge[];
  };
  recommendations: {
    prompt?: string;
    tools?: string[];
    infraPlan?: AgentInfraPlan;
    retrievalWeights?: Record<string, number>;
  };
}

export interface AgentEvolutionResult {
  status: "applied" | "skipped" | "failed";
  draftId: string;
  version: number;
  previousVersion?: number;
  artifactId?: string;
  rollbackArtifactId?: string;
  auditId?: string;
  reason: string;
}

export interface AgentEvolutionPort {
  validateAndApply(input: AgentEvolutionInput): Promise<AgentEvolutionResult>;
  rollback?(draftId: string): Promise<AgentEvolutionResult>;
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
