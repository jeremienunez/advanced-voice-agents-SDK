import type { AgentInfraPlan } from "./infra.js";
import type { JsonObject, JsonValue } from "./json.js";

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
  tenantId?: string;
  userId?: string;
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
