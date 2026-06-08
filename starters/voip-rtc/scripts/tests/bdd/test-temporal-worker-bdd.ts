import type {
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import {
  createLearningWorkflowPort,
  type TemporalWorkerClientPort,
  type TemporalWorkerStartInput,
} from "../../../server/learning/temporal-worker.js";
import { createStarterLearningServiceFromEnv } from "../../../server/learning/service.js";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioTemporalDriverDispatchesToWorker(),
  await scenarioTemporalStartFailureStaysAsync(),
  await scenarioTemporalWorkerCanPublishTerminalStatus(),
  await scenarioLocalDriverStillRunsInProcess(),
  await scenarioLearningServiceUsesTemporalDriverFromEnv(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioTemporalDriverDispatchesToWorker(): Promise<string> {
  const workflow = recordingWorkflow();
  const client = recordingClient();
  const statuses: string[] = [];
  const temporal = createLearningWorkflowPort({
    env: temporalEnv(),
    workflow,
    temporalClient: client,
    onStatus: (status) => statuses.push(status.status),
  });

  const queued = temporal.enqueueLearningSession(learningSession({ runId: "learn-worker-a" }));
  await waitFor(() => client.starts.length === 1);

  assert(queued.status === "queued", "Temporal enqueue must return queued immediately");
  assert(workflow.calls === 0, "Temporal driver must not run learning in the server process");
  assert(statuses.join(">") === "queued>running", "Temporal driver must publish queued then running");
  assert(client.starts[0].address === "temporal:7233", "Temporal address must come from env");
  assert(client.starts[0].namespace === "tenant-learning", "Temporal namespace must come from env");
  assert(client.starts[0].taskQueue === "agent-learning-prod", "Temporal task queue must come from env");
  assert(client.starts[0].workflowType === "learnFromSession", "workflow type must be explicit");
  assert(client.starts[0].workflowId === "learn-worker-a", "workflow id must use the learning run id");
  assert(
    client.starts[0].input.summary.sessionId === "session-worker-a",
    "Temporal payload must include the learning session",
  );

  return "temporal-driver-dispatches-to-worker";
}

async function scenarioTemporalStartFailureStaysAsync(): Promise<string> {
  const client = recordingClient(new Error("temporal offline"));
  const statuses: string[] = [];
  const temporal = createLearningWorkflowPort({
    env: temporalEnv(),
    workflow: recordingWorkflow(),
    temporalClient: client,
    onStatus: (status) => statuses.push(status.status),
  });

  const queued = temporal.enqueueLearningSession(learningSession({ runId: "learn-worker-fail" }));
  await waitFor(() => statuses.includes("failed"));

  assert(queued.status === "queued", "Temporal start failure must not break enqueue");
  assert(statuses.join(">") === "queued>failed", "Temporal start failure must be reported async");

  return "temporal-start-failure-async-status";
}

async function scenarioTemporalWorkerCanPublishTerminalStatus(): Promise<string> {
  const client = recordingClient();
  const temporal = createLearningWorkflowPort({
    env: temporalEnv(),
    workflow: recordingWorkflow(),
    temporalClient: client,
  });
  const queued = temporal.enqueueLearningSession(learningSession({ runId: "learn-worker-terminal" }));
  await waitFor(() => client.starts.length === 1);

  const terminal = await temporal.publishWorkerStatus({
    runId: queued.runId,
    status: "applied",
    message: "Worker applied learning.",
  });

  assert(terminal.status === "applied", "worker terminal status must be persisted");
  assert(
    temporal.getLearningStatus(queued.runId)?.status === "applied",
    "terminal status must be queryable",
  );

  return "temporal-worker-can-publish-terminal-status";
}

async function scenarioLocalDriverStillRunsInProcess(): Promise<string> {
  const workflow = recordingWorkflow();
  const statuses: string[] = [];
  const local = createLearningWorkflowPort({
    env: { AGENT_LEARNING_WORKFLOW_DRIVER: "local" },
    workflow,
    onStatus: (status) => statuses.push(status.status),
  });

  local.enqueueLearningSession(learningSession({ runId: "learn-local-a" }));
  await waitFor(() => statuses.includes("applied"));

  assert(workflow.calls === 1, "local driver must still run the in-process workflow");
  assert(statuses.join(">") === "queued>running>applied", "local status order must stay unchanged");

  return "local-driver-still-in-process";
}

async function scenarioLearningServiceUsesTemporalDriverFromEnv(): Promise<string> {
  const client = recordingClient();
  const statuses: string[] = [];
  const service = createStarterLearningServiceFromEnv(temporalEnv(), {
    temporalClient: client,
  });

  const queued = service.enqueueSessionLearning(
    learningSession({ runId: "learn-service-worker-a" }),
    (status) => statuses.push(status.status),
  );
  await waitFor(() => statuses.includes("running"));

  const status = service.getLearningStatus("learn-service-worker-a");

  assert(queued.status === "queued", "learning service must return queued immediately");
  assert(client.starts.length === 1, "learning service must dispatch to the Temporal client");
  assert(status?.status === "running", "learning service must expose Temporal dispatch status");

  return "learning-service-uses-temporal-driver-env";
}

function recordingClient(error?: Error): TemporalWorkerClientPort & {
  starts: TemporalWorkerStartInput[];
} {
  const starts: TemporalWorkerStartInput[] = [];
  return {
    starts,
    async startLearningWorkflow(input) {
      starts.push(input);
      if (error) throw error;
      return { runId: input.workflowId, workflowId: input.workflowId };
    },
  };
}

function recordingWorkflow() {
  return {
    calls: 0,
    async learnFromSession() {
      this.calls += 1;
      return {
        status: "applied" as const,
        memoryCount: 0,
        graphNodeCount: 0,
        graphEdgeCount: 0,
        evolution: {
          status: "applied" as const,
          draftId: "draft-worker-a",
          version: 2,
          reason: "Temporal worker BDD",
        },
      };
    },
  };
}

function temporalEnv(): Record<string, string> {
  return {
    AGENT_LEARNING_WORKFLOW_DRIVER: "temporal",
    TEMPORAL_ADDRESS: "temporal:7233",
    TEMPORAL_NAMESPACE: "tenant-learning",
    TEMPORAL_TASK_QUEUE: "agent-learning-prod",
  };
}

function learningSession(input: { runId: string }): LearningSessionInput {
  return {
    runId: input.runId,
    agentId: "agent-worker-a",
    draftId: "draft-worker-a",
    tenantId: "tenant-a",
    userId: "user-a",
    summary: {
      sessionId: "session-worker-a",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 0,
      endedAt: 1,
      durationMs: 1,
      messageCount: 1,
      toolCallCount: 0,
      endReason: "completed",
    },
    transcript: [],
    toolCalls: [],
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > 1_000) {
      throw new Error("Timed out waiting for Temporal worker BDD condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
