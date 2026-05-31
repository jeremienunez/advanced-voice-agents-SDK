import { LocalTemporalWorkflowPort } from "../temporal-workflow.js";
import { createLocalLearningRunRepository } from "../run-state.js";
import { DynamicTemporalWorkerClient } from "./dynamic-client.js";
import type {
  LearningWorkflowDriver,
  LearningWorkflowPortInput,
  StarterLearningWorkflowPort,
} from "./types.js";
import { TemporalWorkerWorkflowPort } from "./worker-port.js";

export function createLearningWorkflowPort(
  input: LearningWorkflowPortInput,
): StarterLearningWorkflowPort {
  if (learningWorkflowDriver(input.env) === "temporal") {
    return new TemporalWorkerWorkflowPort({
      address: temporalAddress(input.env),
      client: input.temporalClient ?? new DynamicTemporalWorkerClient(),
      namespace: input.env.TEMPORAL_NAMESPACE ?? "default",
      onStatus: input.onStatus,
      repository: input.repository ?? createLocalLearningRunRepository(),
      taskQueue: input.env.TEMPORAL_TASK_QUEUE ?? "agent-learning",
      workflowType: input.env.TEMPORAL_WORKFLOW_TYPE ?? "learnFromSession",
    });
  }
  return new LocalTemporalWorkflowPort({
    workflow: input.workflow,
    onStatus: input.onStatus,
  });
}

function learningWorkflowDriver(env: Record<string, string | undefined>): LearningWorkflowDriver {
  return env.AGENT_LEARNING_WORKFLOW_DRIVER === "temporal" ? "temporal" : "local";
}

function temporalAddress(env: Record<string, string | undefined>): string {
  const address = env.TEMPORAL_ADDRESS?.trim();
  if (!address) throw new Error("TEMPORAL_ADDRESS is required for temporal learning driver");
  return address;
}
