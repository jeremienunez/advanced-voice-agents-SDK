import {
  createDefaultLearningPolicy,
  createInMemoryLearningRunRepository,
  extractDefaultSessionLearningSignals,
} from "@voiceagentsdk/core/sdk";
import type {
  LearningRunRecord,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";

const results = [
  await scenarioRepositoryCreatesAndPersistsRuns(),
  await scenarioRepositoryFindsDuplicateSessionRuns(),
  await scenarioExtractorRedactsSecretsAndFindsSignals(),
  await scenarioPolicyProfilesGateMutations(),
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

async function scenarioExtractorRedactsSecretsAndFindsSignals(): Promise<string> {
  const fakeSecret = ["sk", "test", "secret", "value"].join("-");
  const signals = extractDefaultSessionLearningSignals(learningInput({
    transcript: `I prefer short answers for Acme Routes. api_key=${fakeSecret}`,
    toolStatus: "failed",
    toolError: "Unknown tool create_invoice",
  }));

  assert(
    signals.memories.length >= 3,
    "extractor must produce summary, preference, and failed tool memories",
  );
  assert(
    signals.memories.every((memory) => !memory.text.includes(fakeSecret)),
    "extractor must redact secrets",
  );
  assert(
    signals.missingTools.includes("create_invoice"),
    "extractor must retain missing tool recommendation",
  );
  return "extractor-redacts-secrets-and-finds-signals";
}

async function scenarioPolicyProfilesGateMutations(): Promise<string> {
  const policy = createDefaultLearningPolicy();
  const input = learningInput({
    transcript: "I prefer short answers.",
    toolStatus: "failed",
    toolError: "Unknown tool create_invoice",
  });
  const signals = extractDefaultSessionLearningSignals(input);
  const memoryOnly = await policy.decide({
    profile: "memory_only",
    input,
    signals,
  });
  const candidates = await policy.decide({
    profile: "memory_and_candidates",
    input,
    signals,
  });
  const autoApply = await policy.decide({
    profile: "auto_apply_prompt_safe",
    input,
    signals,
  });
  const approvalRequired = await policy.decide({
    profile: "approval_required",
    input,
    signals,
  });

  assert(memoryOnly.action === "write_memory", "memory_only must not mutate agent artifacts");
  assert(candidates.action === "candidate", "memory_and_candidates must create inactive candidates");
  assert(autoApply.action === "apply", "auto_apply_prompt_safe must apply prompt-safe changes");
  assert(approvalRequired.action === "pending_approval", "approval_required must require approval");
  return "policy-profiles-gate-mutations";
}

function learningInput(options: {
  transcript?: string;
  toolStatus?: string;
  toolError?: string;
} = {}): LearningSessionInput {
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
      messageCount: options.transcript ? 1 : 0,
      toolCallCount: options.toolStatus ? 1 : 0,
      endReason: "completed",
    },
    transcript: options.transcript
      ? [{ role: "user", text: options.transcript, isFinal: true, timestamp: 50 }]
      : [],
    toolCalls: options.toolStatus
      ? [{
          callId: "call-a",
          toolName: "create_invoice",
          arguments: {},
          status: options.toolStatus,
          startedAt: 60,
          completedAt: 80,
          error: options.toolError,
        }]
      : [],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
