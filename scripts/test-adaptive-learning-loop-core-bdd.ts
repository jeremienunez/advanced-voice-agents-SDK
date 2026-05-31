import {
  createInMemoryLearningRunRepository,
} from "@voiceagentsdk/core/sdk";
import type {
  LearningRunRecord,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";

const results = [
  await scenarioRepositoryCreatesAndPersistsRuns(),
  await scenarioRepositoryFindsDuplicateSessionRuns(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioRepositoryCreatesAndPersistsRuns(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const input = learningInput();
  const queued = await repository.createQueued(input, {
    profile: "memory_only",
    runId: "learn-session-a",
    jobId: "job-session-a",
  });
  assert(queued.status === "queued", "repository must create queued run");
  assert(queued.sourceSessionId === "session-a", "run must track source session");

  const running: LearningRunRecord = {
    ...queued,
    status: "running",
    startedAt: new Date().toISOString(),
  };
  await repository.save(running);

  const stored = await repository.get("learn-session-a");
  assert(stored?.status === "running", "repository must persist updated status");
  return "repository-creates-and-persists-runs";
}

async function scenarioRepositoryFindsDuplicateSessionRuns(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const input = learningInput();
  await repository.createQueued(input, {
    profile: "memory_only",
    runId: "learn-session-a",
    jobId: "job-session-a",
  });

  const found = await repository.findBySource?.({
    sourceSessionId: "session-a",
    agentId: "agent-a",
    draftId: "draft-a",
  });
  assert(found?.runId === "learn-session-a", "repository must support idempotency lookup");
  return "repository-finds-duplicate-session-runs";
}

function learningInput(): LearningSessionInput {
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
      endedAt: 100,
      durationMs: 100,
      messageCount: 1,
      toolCallCount: 0,
      endReason: "completed",
    },
    transcript: [],
    toolCalls: [],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
