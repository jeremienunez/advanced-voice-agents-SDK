import type {
  LearningJobStatus,
  LearningSessionInput,
  TemporalWorkflowPort,
} from "@voiceagentsdk/core/sdk";
import {
  getLearningRun,
  saveLearningRun,
} from "./run-state.js";
import type { LearnFromSessionRunner } from "./workflow.js";

export type LearningStatusSink = (status: LearningJobStatus) => void;

export class LocalTemporalWorkflowPort implements TemporalWorkflowPort {
  constructor(
    private readonly options: {
      workflow: LearnFromSessionRunner;
      onStatus?: LearningStatusSink;
    },
  ) {}

  enqueueLearningSession(input: LearningSessionInput): LearningJobStatus {
    const runId = input.runId ?? `learn_${crypto.randomUUID()}`;
    const status: LearningJobStatus = {
      jobId: `job_${crypto.randomUUID()}`,
      runId,
      status: "queued",
      agentId: input.agentId,
      draftId: input.draftId,
      queuedAt: new Date().toISOString(),
      message: "Learning job queued.",
    };
    this.publish(status);
    setTimeout(() => {
      void this.run({ ...input, runId }, status);
    }, 0);
    return status;
  }

  getLearningStatus(runId: string): LearningJobStatus | null {
    return getLearningRun(runId);
  }

  private async run(
    input: LearningSessionInput,
    queued: LearningJobStatus,
  ): Promise<void> {
    const running: LearningJobStatus = {
      ...queued,
      status: "running",
      startedAt: new Date().toISOString(),
      message: "Learning workflow running.",
    };
    this.publish(running);
    try {
      const result = await this.options.workflow.learnFromSession(input);
      this.publish({
        ...running,
        status: result.status === "applied" ? "applied" : "skipped",
        finishedAt: new Date().toISOString(),
        message: result.evolution.reason,
      });
    } catch (error) {
      this.publish({
        ...running,
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        message: "Learning workflow failed.",
      });
    }
  }

  private publish(status: LearningJobStatus): void {
    saveLearningRun(status);
    this.options.onStatus?.(status);
  }
}
