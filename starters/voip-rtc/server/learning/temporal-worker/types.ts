import type {
  LearningJobStatus,
  LearningSessionInput,
  TemporalWorkflowPort,
} from "@voiceagentsdk/core/sdk";
import type { LearningStatusSink } from "../temporal-workflow.js";
import type { LearnFromSessionRunner } from "../workflow.js";

export type LearningWorkflowDriver = "local" | "temporal";

export interface TemporalWorkerStartInput {
  address: string;
  namespace: string;
  taskQueue: string;
  workflowType: string;
  workflowId: string;
  input: LearningSessionInput;
}

export interface TemporalWorkerStartResult {
  workflowId: string;
  runId?: string;
}

export interface TemporalWorkerClientPort {
  startLearningWorkflow(
    input: TemporalWorkerStartInput,
  ): Promise<TemporalWorkerStartResult>;
}

export interface LearningWorkflowPortInput {
  env: Record<string, string | undefined>;
  workflow: LearnFromSessionRunner;
  onStatus?: LearningStatusSink;
  temporalClient?: TemporalWorkerClientPort;
}

export interface StarterLearningWorkflowPort extends TemporalWorkflowPort {
  enqueueLearningSession(input: LearningSessionInput): LearningJobStatus;
  getLearningStatus(runId: string): LearningJobStatus | null;
}
