import {
  createAgentLearningLoop,
  createDefaultLearningPolicy,
  createInMemoryLearningRunRepository,
  extractDefaultSessionLearningSignals,
} from "@voiceagentsdk/core/sdk";
import type {
  GraphMemoryStorePort,
  LearningReceipt,
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningSessionInput,
  TemporalMemoryStorePort,
} from "@voiceagentsdk/core/sdk";

const results = [
  await scenarioMemoryAndCandidatesCreatesInactiveSkillDelta(),
  await scenarioLearningReceiptCapturesRedactedDeltaDecision(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioMemoryAndCandidatesCreatesInactiveSkillDelta(): Promise<string> {
  const signals = extractDefaultSessionLearningSignals(learningInput({
    transcript: "When a route wine customer asks for pairing, first ask region, budget, and cuisine.",
  }));
  const skillDelta = signals.deltas.find((delta) => delta.kind === "skill");

  assert(skillDelta, "procedural guidance must create a skill candidate delta");
  assert(skillDelta.promotionState === "candidate", "skill delta must remain inactive");
  assert(skillDelta.scope === "agent", "default skill candidates must be agent-scoped");
  return "memory-and-candidates-creates-inactive-skill-delta";
}

async function scenarioLearningReceiptCapturesRedactedDeltaDecision(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const fakeSecret = ["sk", "test", "secret", "value"].join("-");
  const receipts: LearningReceipt[] = [];
  const loop = createAgentLearningLoop({
    repository,
    extractor: { extract: extractDefaultSessionLearningSignals },
    policy: createDefaultLearningPolicy(),
    memoryStore: fakeMemoryStore(),
    graphStore: fakeGraphStore(),
    receiptSink: { emit: (receipt) => { receipts.push(receipt); } },
  });
  await waitForTerminal(await loop.enqueueSessionLearning(learningInput({
    transcript: `I prefer short answers. api_key=${fakeSecret}`,
  }), { profile: "memory_and_candidates" }), repository);

  assert(receipts.length === 1, "learning loop must emit one receipt");
  assert(receipts[0].redactions.length > 0, "receipt must mention redactions");
  assert(
    receipts[0].deltas.every((delta) =>
      !JSON.stringify(delta).includes(fakeSecret)
    ),
    "receipt deltas must be redacted",
  );
  return "learning-receipt-captures-redacted-delta-decision";
}

function learningInput(options: { transcript?: string } = {}): LearningSessionInput {
  return {
    agentId: "agent-a",
    draftId: "draft-a",
    tenantId: "tenant-a",
    userId: "user-a",
    summary: {
      sessionId: `session-${Math.random().toString(36).slice(2)}`,
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 0,
      endedAt: 100,
      durationMs: 100,
      messageCount: options.transcript ? 1 : 0,
      toolCallCount: 0,
      endReason: "completed",
    },
    transcript: options.transcript
      ? [{ role: "user", text: options.transcript, isFinal: true, timestamp: 50 }]
      : [],
    toolCalls: [],
  };
}

function fakeMemoryStore(): TemporalMemoryStorePort {
  return {
    isConfigured: () => true,
    write: async (writeInput) =>
      writeInput.records.map((record, index) => ({
        ...record,
        id: `memory-${index}`,
        scope: writeInput.scope,
        createdAt: new Date().toISOString(),
      })),
    list: async () => [],
  };
}

function fakeGraphStore(): GraphMemoryStorePort {
  return {
    isConfigured: () => true,
    upsert: async () => ({ nodeCount: 1, edgeCount: 1 }),
  };
}

async function waitForTerminal(
  queued: LearningRunRecord,
  repository: LearningRunRepositoryPort,
) {
  const terminal = new Set(["evaluated", "applied", "pending_approval", "rejected", "failed", "skipped"]);
  for (let attempt = 0; attempt < 40; attempt++) {
    const current = await repository.get(queued.runId);
    if (current && terminal.has(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for terminal learning run ${queued.runId}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
