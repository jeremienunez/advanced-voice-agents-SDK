import type {
  LearningJobStatus,
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningRunStatusUpdate,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import {
  publishLearningRunStatus,
} from "@voiceagentsdk/core/sdk";
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
      repository: LearningRunRepositoryPort;
      taskQueue: string;
      workflowType: string;
    },
  ) {}

  enqueueLearningSession(input: LearningSessionInput): LearningJobStatus {
    const runId = input.runId ?? `learn_${crypto.randomUUID()}`;
    const queued: LearningRunRecord = {
      jobId: `job_${crypto.randomUUID()}`,
      runId,
      status: "queued",
      profile: "memory_only",
      agentId: input.agentId,
      draftId: input.draftId,
      tenantId: input.tenantId,
      userId: input.userId,
      sourceSessionId: input.summary.sessionId,
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
    return this.options.repository.get(runId) as LearningJobStatus | null;
  }

  async publishWorkerStatus(
    update: LearningRunStatusUpdate,
  ): Promise<LearningJobStatus> {
    const status = await publishLearningRunStatus(this.options.repository, update);
    this.options.onStatus?.(status);
    return status;
  }

  private async startWorkerWorkflow(
    input: LearningSessionInput,
    queued: LearningRunRecord,
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

  private publish(status: LearningRunRecord): void {
    this.options.repository.save(status);
    this.options.onStatus?.(status);
  }
}
