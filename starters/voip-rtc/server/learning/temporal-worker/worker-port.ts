import type {
  LearningJobStatus,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import {
  getLearningRun,
  saveLearningRun,
} from "../run-state.js";
import type { LearningStatusSink } from "../temporal-workflow.js";
import type {
  StarterLearningWorkflowPort,
  TemporalWorkerClientPort,
} from "./types.js";

export class TemporalWorkerWorkflowPort implements StarterLearningWorkflowPort {
  constructor(
    private readonly options: {
      address: string;
      client: TemporalWorkerClientPort;
      namespace: string;
      onStatus?: LearningStatusSink;
      taskQueue: string;
      workflowType: string;
    },
  ) {}

  enqueueLearningSession(input: LearningSessionInput): LearningJobStatus {
    const runId = input.runId ?? `learn_${crypto.randomUUID()}`;
    const queued: LearningJobStatus = {
      jobId: `job_${crypto.randomUUID()}`,
      runId,
      status: "queued",
      agentId: input.agentId,
      draftId: input.draftId,
      queuedAt: new Date().toISOString(),
      message: "Learning job queued for Temporal worker.",
    };
    this.publish(queued);
    setTimeout(() => {
      void this.startWorkerWorkflow({ ...input, runId }, queued);
    }, 0);
    return queued;
  }

  getLearningStatus(runId: string): LearningJobStatus | null {
    return getLearningRun(runId);
  }

  private async startWorkerWorkflow(
    input: LearningSessionInput,
    queued: LearningJobStatus,
  ): Promise<void> {
    try {
      await this.options.client.startLearningWorkflow({
        address: this.options.address,
        namespace: this.options.namespace,
        taskQueue: this.options.taskQueue,
        workflowId: queued.runId,
        workflowType: this.options.workflowType,
        input,
      });
      this.publish({
        ...queued,
        status: "running",
        startedAt: new Date().toISOString(),
        message: "Learning workflow dispatched to Temporal worker.",
      });
    } catch (error) {
      this.publish({
        ...queued,
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        message: "Temporal worker dispatch failed.",
      });
    }
  }

  private publish(status: LearningJobStatus): void {
    saveLearningRun(status);
    this.options.onStatus?.(status);
  }
}
