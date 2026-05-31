import type { AgentInfraPlan } from "./infra.js";
import type { JsonObject, JsonValue } from "./json.js";

export type LearningRunStatus =
  | "queued"
  | "running"
  | "evaluated"
  | "applied"
  | "pending_approval"
  | "rejected"
  | "failed"
  | "skipped";

export type LearningLoopProfile =
  | "observe"
  | "memory_only"
  | "memory_and_candidates"
  | "auto_apply_prompt_safe"
  | "approval_required";

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

export interface LearningRunDecision {
  action:
    | "none"
    | "write_memory"
    | "candidate"
    | "apply"
    | "pending_approval"
    | "reject";
  reason: string;
  requiresApproval?: boolean;
  confidence?: number;
  metadata?: JsonObject;
}

export type LearningDeltaKind = "memory" | "prompt" | "skill" | "tool" | "infra";
export type LearningPromotionScope = "session" | "user" | "agent" | "tenant" | "global";
export type LearningPromotionState =
  | "candidate"
  | "evaluated"
  | "approved"
  | "active"
  | "rolled_back"
  | "rejected"
  | "expired";

export interface LearningDelta {
  id: string;
  kind: LearningDeltaKind;
  scope: LearningPromotionScope;
  title: string;
  summary: string;
  confidence: number;
  payload: JsonObject;
  sourceSessionIds: string[];
  promotionState: LearningPromotionState;
}

export interface AgentSkillArtifact {
  id: string;
  title: string;
  description: string;
  scope: "agent" | "tenant" | "global";
  preconditions: string[];
  procedure: string[];
  pitfalls: string[];
  validationChecks: string[];
  sourceSessionIds: string[];
  confidence: number;
  createdAt: string;
  updatedAt?: string;
  metadata?: JsonObject;
}

export interface EvaluationResult {
  status: "passed" | "failed" | "skipped";
  score?: number;
  checks: Array<{
    name: string;
    status: "passed" | "failed" | "skipped";
    message?: string;
  }>;
  metadata?: JsonObject;
}

export interface LearningReceipt {
  id: string;
  runId: string;
  sourceSessionId: string;
  inputHash: string;
  redactions: string[];
  deltas: LearningDelta[];
  decision: LearningRunDecision;
  evaluation?: EvaluationResult;
  previousArtifactId?: string;
  nextArtifactId?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface LearningRunRecord {
  jobId: string;
  runId: string;
  status: LearningRunStatus;
  profile: LearningLoopProfile;
  agentId?: string;
  draftId?: string;
  tenantId?: string;
  userId?: string;
  sourceSessionId?: string;
  queuedAt: string;
  startedAt?: string;
  evaluatedAt?: string;
  finishedAt?: string;
  decision?: LearningRunDecision;
  message?: string;
  error?: string;
  metadata?: JsonObject;
}

export interface LearningLoopEnqueueOptions {
  profile?: LearningLoopProfile;
  onStatus?: (status: LearningRunRecord) => void;
}

export interface AgentLearningLoopPort {
  enqueueSessionLearning(
    input: LearningSessionInput,
    options?: LearningLoopEnqueueOptions,
  ): Promise<LearningRunRecord> | LearningRunRecord;
  getLearningRun(
    runId: string,
  ): Promise<LearningRunRecord | null> | LearningRunRecord | null;
}

export interface LearningRunRepositoryPort {
  createQueued(
    input: LearningSessionInput,
    options: { profile: LearningLoopProfile; runId: string; jobId: string },
  ): Promise<LearningRunRecord> | LearningRunRecord;
  save(record: LearningRunRecord): Promise<LearningRunRecord> | LearningRunRecord;
  get(runId: string): Promise<LearningRunRecord | null> | LearningRunRecord | null;
  findBySource?(
    input: { sourceSessionId: string; agentId?: string; draftId?: string },
  ): Promise<LearningRunRecord | null> | LearningRunRecord | null;
}

export interface LearningWorkflowDriverPort {
  enqueue(
    input: LearningSessionInput,
    run: LearningRunRecord,
  ): Promise<LearningRunRecord> | LearningRunRecord;
}

export interface LearningStatusSinkPort {
  publish(status: LearningRunRecord): void | Promise<void>;
}

export interface LearningAuditEvent {
  type: string;
  runId: string;
  at: string;
  payload?: JsonObject;
}

export interface LearningAuditSinkPort {
  emit(event: LearningAuditEvent): void | Promise<void>;
}

export interface LearningMemorySignal {
  kind: TemporalMemoryRecord["kind"];
  text: string;
  data?: JsonValue;
}

export interface SessionLearningSignals {
  memories: LearningMemorySignal[];
  graph: {
    nodes: GraphMemoryNode[];
    edges: GraphMemoryEdge[];
  };
  missingTools: string[];
  promptRecommendation?: string;
  retrievalWeights?: Record<string, number>;
  confidence: number;
}

export interface SessionLearningExtractorPort {
  extract(input: LearningSessionInput): SessionLearningSignals | Promise<SessionLearningSignals>;
}

export interface AgentLearningPolicyInput {
  profile: LearningLoopProfile;
  input: LearningSessionInput;
  signals: SessionLearningSignals;
}

export interface AgentLearningPolicyPort {
  decide(
    input: AgentLearningPolicyInput,
  ): LearningRunDecision | Promise<LearningRunDecision>;
}

export interface EvaluationHarnessInput {
  input: LearningSessionInput;
  deltas: LearningDelta[];
}

export interface EvaluationHarnessPort {
  evaluate(input: EvaluationHarnessInput): EvaluationResult | Promise<EvaluationResult>;
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
