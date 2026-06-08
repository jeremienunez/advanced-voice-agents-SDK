import {
  createAgentMailboxWorker,
  createInMemoryAgentMailbox,
  type AgentMailboxMessage,
} from "@voiceagentsdk/core/server";

const results = [
  await scenarioWorkerProcessesBatchConcurrently(),
  await scenarioWorkerAcksHandlerFailures(),
  await scenarioMultipleWorkersSplitTheSameInbox(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioWorkerProcessesBatchConcurrently(): Promise<string> {
  const mailbox = seededMailbox("planner", 2);
  let active = 0;
  let maxActive = 0;
  const worker = createAgentMailboxWorker({
    mailbox,
    tenantId: "local",
    targetAgentId: "planner",
    workerId: "planner-worker-1",
    batchSize: 2,
    concurrency: 2,
    async handleMessage() {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
    },
  });

  const run = await worker.runOnce();
  const completed = await mailbox.list({
    tenantId: "local",
    targetAgentId: "planner",
    status: ["completed"],
  });

  assert(run.claimed === 2, "worker must claim a full batch");
  assert(run.completed === 2, "worker must ack completed handlers");
  assert(maxActive === 2, "worker must process messages up to configured concurrency");
  assert(completed.length === 2, "worker must persist completed status");

  return "worker-processes-batch-concurrently";
}

async function scenarioWorkerAcksHandlerFailures(): Promise<string> {
  const mailbox = seededMailbox("critic", 1);
  const worker = createAgentMailboxWorker({
    mailbox,
    tenantId: "local",
    targetAgentId: "critic",
    workerId: "critic-worker-1",
    async handleMessage() {
      throw new Error("missing source");
    },
  });

  const run = await worker.runOnce();
  const failed = await mailbox.list({
    tenantId: "local",
    targetAgentId: "critic",
    status: ["failed"],
  });

  assert(run.failed === 1, "worker must count failed handler executions");
  assert(failed[0]?.failureReason === "missing source", "worker must persist failure reason");

  return "worker-acks-handler-failures";
}

async function scenarioMultipleWorkersSplitTheSameInbox(): Promise<string> {
  const mailbox = seededMailbox("researcher", 3);
  const processed: string[] = [];
  const worker = (workerId: string) => createAgentMailboxWorker({
    mailbox,
    tenantId: "local",
    targetAgentId: "researcher",
    workerId,
    batchSize: 2,
    concurrency: 2,
    async handleMessage(message: AgentMailboxMessage) {
      processed.push(message.id);
    },
  });

  const [left, right] = await Promise.all([
    worker("researcher-worker-1").runOnce(),
    worker("researcher-worker-2").runOnce(),
  ]);
  const completed = await mailbox.list({
    tenantId: "local",
    targetAgentId: "researcher",
    status: ["completed"],
  });

  assert(left.claimed + right.claimed === 3, "workers must split available queued tasks");
  assert(new Set(processed).size === 3, "workers must not process duplicate tasks");
  assert(completed.length === 3, "all split tasks must be completed");

  return "multiple-workers-split-the-same-inbox";
}

function seededMailbox(targetAgentId: string, count: number) {
  const mailbox = createInMemoryAgentMailbox({ idFactory: idSequence("mail") });
  for (let index = 0; index < count; index += 1) {
    mailbox.send({
      tenantId: "local",
      source: { agentId: "planner" },
      target: { agentId: targetAgentId },
      taskId: `${targetAgentId}_task_${index + 1}`,
      parts: [{ kind: "text", text: `Task ${index + 1}` }],
    });
  }
  return mailbox;
}

function idSequence(prefix: string): () => string {
  let current = 0;
  return () => `${prefix}_${++current}`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
