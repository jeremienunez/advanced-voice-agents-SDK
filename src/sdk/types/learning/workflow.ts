import type { LearningSessionInput } from "./session.js";
import type { LearningRunStatus } from "./status.js";

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
