import type { JsonObject } from "../json.js";
import type {
  LearningLoopProfile,
  LearningRunStatus,
  LearningSessionInput,
} from "../learning/index.js";
import type { LearningRunDecision } from "./decisions.js";

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
