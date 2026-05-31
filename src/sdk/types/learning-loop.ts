import type { JsonObject, JsonValue } from "./json.js";
import type {
  AgentEvolutionPort,
  GraphMemoryEdge,
  GraphMemoryNode,
  GraphMemoryStorePort,
  LearningLoopProfile,
  LearningRunStatus,
  LearningSessionInput,
  TemporalMemoryRecord,
  TemporalMemoryStorePort,
} from "./learning.js";

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

export interface LearningRunStatusUpdate {
  runId: string;
  status: LearningRunStatus;
  message?: string;
  error?: string;
  decision?: LearningRunDecision;
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

export interface LearningReceiptSinkPort {
  emit(receipt: LearningReceipt): void | Promise<void>;
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
  deltas: LearningDelta[];
  redactions: string[];
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

export interface AgentLearningLoopOptions {
  repository: LearningRunRepositoryPort;
  extractor: SessionLearningExtractorPort;
  policy: AgentLearningPolicyPort;
  memoryStore?: TemporalMemoryStorePort;
  graphStore?: GraphMemoryStorePort;
  evolution?: AgentEvolutionPort;
  statusSink?: LearningStatusSinkPort;
  auditSink?: LearningAuditSinkPort;
  evaluationHarness?: EvaluationHarnessPort;
  receiptSink?: LearningReceiptSinkPort;
  defaultProfile?: LearningLoopProfile;
}
