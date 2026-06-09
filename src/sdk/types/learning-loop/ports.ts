import type {
  AgentEvolutionPort,
  GraphMemoryStorePort,
  LearningLoopProfile,
  LearningSessionInput,
  TemporalMemoryStorePort,
} from "../learning/index.js";
import type { EvaluationResult } from "./artifacts.js";
import type { LearningDelta, LearningRunDecision } from "./decisions.js";
import type { LearningAuditEvent, LearningReceipt } from "./receipts.js";
import type {
  LearningLoopEnqueueOptions,
  LearningRunRecord,
  LearningRunRepositoryPort,
} from "./runs.js";
import type { SessionLearningSignals } from "./signals.js";

export interface AgentLearningLoopPort {
  enqueueSessionLearning(
    input: LearningSessionInput,
    options?: LearningLoopEnqueueOptions,
  ): Promise<LearningRunRecord> | LearningRunRecord;
  getLearningRun(
    runId: string,
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

export interface LearningAuditSinkPort {
  emit(event: LearningAuditEvent): void | Promise<void>;
}

export interface LearningReceiptSinkPort {
  emit(receipt: LearningReceipt): void | Promise<void>;
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
