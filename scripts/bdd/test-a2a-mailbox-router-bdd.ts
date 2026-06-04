import {
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
} from "@voiceagentsdk/core/server";

const mailbox = createInMemoryAgentMailbox({
  idFactory: idSequence("mail"),
  now: clock([
    "2026-06-04T09:00:00.000Z",
    "2026-06-04T09:00:01.000Z",
  ]),
});
const router = createA2AMailboxTaskRouter({ mailbox });

const results = [
  await scenarioSendMessageCreatesA2ATask(),
  await scenarioListAndGetTasksReadMailboxProjection(),
  await scenarioClaimAndAckTasksCoordinateWorkers(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioSendMessageCreatesA2ATask(): Promise<string> {
  const task = await router.sendMessage({
    tenantId: "local",
    sourceAgentId: "researcher",
    targetAgentId: "planner",
    contextId: "ctx_wine_trip",
    taskId: "task_itinerary",
    referenceTaskIds: ["task_sources"],
    message: {
      role: "user",
      parts: [{ kind: "text", text: "Prepare two itineraries." }],
    },
  });

  assert(task.id === "task_itinerary", "A2A router must preserve task id");
  assert(task.contextId === "ctx_wine_trip", "A2A router must preserve context id");
  assert(task.status.state === "TASK_STATE_SUBMITTED", "new mailbox task must be submitted");
  assert(
    task.history?.[0]?.referenceTaskIds?.[0] === "task_sources",
    "A2A router must preserve task references",
  );

  return "send-message-creates-a2a-task";
}

async function scenarioListAndGetTasksReadMailboxProjection(): Promise<string> {
  await router.sendMessage({
    tenantId: "local",
    sourceAgentId: "planner",
    targetAgentId: "researcher",
    contextId: "ctx_wine_trip",
    taskId: "task_research",
    message: {
      role: "user",
      parts: [{ kind: "text", text: "Find source documents." }],
    },
  });

  const listed = await router.listTasks({
    tenantId: "local",
    targetAgentId: "researcher",
    contextId: "ctx_wine_trip",
  });
  const task = await router.getTask({
    tenantId: "local",
    targetAgentId: "researcher",
    taskId: "task_research",
  });

  assert(listed.length === 1, "A2A router must list recipient tasks");
  assert(listed[0]?.id === "task_research", "A2A router list must expose task ids");
  const firstPart = task?.history?.[0]?.parts[0] as Record<string, any> | undefined;
  assert(firstPart?.text === "Find source documents.", "A2A router must get task history");

  return "list-and-get-tasks-read-mailbox-projection";
}

async function scenarioClaimAndAckTasksCoordinateWorkers(): Promise<string> {
  await router.sendMessage({
    tenantId: "local",
    sourceAgentId: "planner",
    targetAgentId: "critic",
    contextId: "ctx_wine_trip",
    taskId: "task_review",
    message: {
      role: "user",
      parts: [{ kind: "text", text: "Review the final plan." }],
    },
  });

  const claimed = await router.claimTasks({
    tenantId: "local",
    targetAgentId: "critic",
    workerId: "critic-worker-1",
    leaseMs: 30_000,
    limit: 1,
  });
  const completed = await router.ackTask({
    tenantId: "local",
    targetAgentId: "critic",
    taskId: "task_review",
    status: "completed",
  });

  assert(claimed.length === 1, "A2A router must claim one queued recipient task");
  assert(claimed[0]?.id === "task_review", "claim must preserve task id");
  assert(claimed[0]?.status.state === "TASK_STATE_WORKING", "claimed mailbox task must be working");
  assert(completed.status.state === "TASK_STATE_COMPLETED", "acked mailbox task must be completed");

  return "claim-and-ack-tasks-coordinate-workers";
}

function idSequence(prefix: string): () => string {
  let current = 0;
  return () => `${prefix}_${++current}`;
}

function clock(values: string[]): () => Date {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]!);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
