import type {
  LearningJobStatus,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import { LocalTemporalWorkflowPort } from "../../server/learning/temporal-workflow.js";
import type { LearnFromSessionWorkflow } from "../../server/learning/workflow.js";

export function runTemporalScenario(
  workflow: LearnFromSessionWorkflow,
  input: LearningSessionInput,
) {
  return new Promise<{
    terminal: LearningJobStatus;
    statuses: string[];
  }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Temporal BDD status timeout"));
    }, 5_000);
    const statuses: string[] = [];
    const temporal = new LocalTemporalWorkflowPort({
      workflow,
      onStatus: (status) => {
        statuses.push(status.status);
        if (isTerminal(status.status)) {
          clearTimeout(timeout);
          resolve({ terminal: status, statuses });
        }
      },
    });
    temporal.enqueueLearningSession(input);
  });
}

export function successfulWorkflow() {
  return {
    async learnFromSession() {
      return {
        status: "applied" as const,
        memoryCount: 1,
        graphNodeCount: 1,
        graphEdgeCount: 1,
        evolution: {
          status: "applied" as const,
          draftId: "draft-agent-a",
          version: 2,
          reason: "BDD success",
        },
      };
    },
  } as unknown as LearnFromSessionWorkflow;
}

export function failingWorkflow() {
  return {
    async learnFromSession() {
      throw new Error("intentional bdd failure");
    },
  } as unknown as LearnFromSessionWorkflow;
}

function isTerminal(status: string): boolean {
  return status === "applied" || status === "failed" || status === "skipped";
}
