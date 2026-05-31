import type {
  LearningLoopProfile,
  LearningRunRecord,
  LearningRunRepositoryPort,
} from "../types.js";

export function createInMemoryLearningRunRepository(): LearningRunRepositoryPort {
  const runs = new Map<string, LearningRunRecord>();

  return {
    createQueued(input, options) {
      const run: LearningRunRecord = {
        jobId: options.jobId,
        runId: options.runId,
        status: "queued",
        profile: options.profile,
        agentId: input.agentId,
        draftId: input.draftId,
        tenantId: input.tenantId,
        userId: input.userId,
        sourceSessionId: input.summary.sessionId,
        queuedAt: new Date().toISOString(),
        message: "Learning job queued.",
      };
      runs.set(run.runId, run);
      return run;
    },

    save(record) {
      runs.set(record.runId, record);
      return record;
    },

    get(runId) {
      return runs.get(runId) ?? null;
    },

    findBySource(input) {
      return Array.from(runs.values()).find((run) => {
        return (
          run.sourceSessionId === input.sourceSessionId &&
          (!input.agentId || run.agentId === input.agentId) &&
          (!input.draftId || run.draftId === input.draftId)
        );
      }) ?? null;
    },
  };
}

export function normalizeLearningLoopProfile(
  value: LearningLoopProfile | undefined,
  fallback: LearningLoopProfile = "memory_only",
): LearningLoopProfile {
  return value ?? fallback;
}
