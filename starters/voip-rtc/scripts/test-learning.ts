import type { LearnFromSessionResult } from "../server/learning/workflow.js";
import type {
  AgentEvolutionPort,
  GraphMemoryStorePort,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import { LocalGraphMemoryStore } from "../server/learning/graph-store.js";
import { LocalRedisTemporalMemoryStore } from "../server/learning/memory-store.js";
import { LocalTemporalWorkflowPort } from "../server/learning/temporal-workflow.js";
import { LearnFromSessionWorkflow } from "../server/learning/workflow.js";

await Promise.all([
  testTemporalMemoryTtl(),
  testGraphUpsertIdempotency(),
  testGraphFailureDoesNotFailLearning(),
  testLearningJobPayload(),
]);

console.log(JSON.stringify({ status: "ok" }, null, 2));

async function testTemporalMemoryTtl() {
  const store = new LocalRedisTemporalMemoryStore();
  const scope = { tenantId: "tenant-a", agentId: "agent-a", userId: "user-a" };
  await store.write({
    scope,
    ttlSeconds: 1,
    records: [
      {
        kind: "preference",
        text: "User preference: concise answers",
        sourceSessionId: "session-a",
      },
    ],
  });
  assert((await store.list(scope)).length === 1, "memory should be visible before TTL");
  store.deleteExpired(new Date(Date.now() + 1500));
  assert((await store.list(scope)).length === 0, "memory should expire after TTL");
  assert(
    (await store.list({ ...scope, userId: "other" })).length === 0,
    "memory must respect tenant/user scope",
  );
}

async function testGraphUpsertIdempotency() {
  const store = new LocalGraphMemoryStore();
  const input = {
    tenantId: "tenant-a",
    agentId: "agent-a",
    userId: "user-a",
    sourceSessionId: "session-a",
    nodes: [
      { id: "agent:agent-a", type: "agent", label: "agent-a" },
      { id: "user:user-a", type: "user", label: "user-a" },
    ],
    edges: [
      {
        id: "edge:agent-a:user-a",
        from: "agent:agent-a",
        to: "user:user-a",
        type: "served",
      },
    ],
  };
  await store.upsert(input);
  await store.upsert(input);
  assert(store.nodeCount === 2, "graph nodes should upsert idempotently");
  assert(store.edgeCount === 1, "graph edges should upsert idempotently");
}

async function testGraphFailureDoesNotFailLearning() {
  const memoryStore = new LocalRedisTemporalMemoryStore();
  const workflow = new LearnFromSessionWorkflow({
    memoryStore,
    graphStore: failingGraphStore(),
    evolution: appliedEvolution(),
    memoryTtlSeconds: 60,
  });
  const input = learningSessionInput();
  const result = await workflow.learnFromSession(input);
  const memories = await memoryStore.list({
    tenantId: input.tenantId,
    agentId: input.draftId,
    userId: input.userId,
  });

  assert(result.status === "applied", "graph failure must not fail learning");
  assert(result.graphNodeCount === 0, "failed graph writes must report zero nodes");
  assert(memories.length > 0, "memory should still be written when graph fails");
}

async function testLearningJobPayload() {
  let captured: LearningSessionInput | null = null;
  const workflow = {
    async learnFromSession(input: LearningSessionInput): Promise<LearnFromSessionResult> {
      captured = input;
      return {
        status: "applied",
        memoryCount: 1,
        graphNodeCount: 1,
        graphEdgeCount: 1,
        evolution: {
          status: "applied",
          draftId: input.draftId ?? "",
          version: 2,
          reason: "ok",
        },
      };
    },
  } as LearnFromSessionWorkflow;
  const applied = new Promise<void>((resolve, reject) => {
    const temporal = new LocalTemporalWorkflowPort({
      workflow,
      onStatus: (status) => {
        if (status.status === "applied") resolve();
        if (status.status === "failed") reject(new Error(status.error));
      },
    });
    temporal.enqueueLearningSession({
      agentId: "agent-a",
      draftId: "draft-a",
      tenantId: "tenant-a",
      userId: "user-a",
      summary: {
        sessionId: "session-a",
        tenantId: "tenant-a",
        userId: "user-a",
        channel: "voice",
        startedAt: 0,
        endedAt: 10,
        durationMs: 10,
        messageCount: 1,
        toolCallCount: 1,
        endReason: "completed",
      },
      transcript: [
        {
          role: "user",
          text: "I prefer concise answers.",
          isFinal: true,
          timestamp: 5,
        },
      ],
      toolCalls: [
        {
          callId: "call-a",
          toolName: "lookup",
          arguments: { query: "x" },
          startedAt: 6,
          completedAt: 8,
          status: "completed",
          result: { ok: true },
        },
      ],
    });
  });
  await applied;
  const seen = captured as LearningSessionInput | null;
  assert(seen !== null, "learning workflow should receive payload");
  assert(seen.agentId === "agent-a", "learning payload should include agent id");
  assert(seen.userId === "user-a", "learning payload should include user id");
  assert(seen.transcript.length === 1, "learning payload should include transcript");
  assert(seen.toolCalls.length === 1, "learning payload should include tool calls");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function learningSessionInput(): LearningSessionInput {
  return {
    agentId: "agent-a",
    draftId: "draft-a",
    tenantId: "tenant-a",
    userId: "user-a",
    summary: {
      sessionId: "session-a",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 0,
      endedAt: 10,
      durationMs: 10,
      messageCount: 1,
      toolCallCount: 1,
      endReason: "completed",
    },
    transcript: [
      {
        role: "user",
        text: "I prefer concise answers.",
        isFinal: true,
        timestamp: 5,
      },
    ],
    toolCalls: [],
  };
}

function failingGraphStore(): GraphMemoryStorePort {
  return {
    isConfigured: () => true,
    ensure: () => {
      throw new Error("intentional graph failure");
    },
    upsert: async () => ({ nodeCount: 0, edgeCount: 0 }),
  };
}

function appliedEvolution(): AgentEvolutionPort {
  return {
    async validateAndApply(input) {
      return {
        status: "applied",
        draftId: input.draftId,
        version: 2,
        reason: "ok",
      };
    },
  };
}

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
