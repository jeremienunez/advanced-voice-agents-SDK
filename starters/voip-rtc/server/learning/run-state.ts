import type {
  LearningJobStatus,
  LearningLoopProfile,
  LearningRunRecord,
  LearningRunRepositoryPort,
} from "@voiceagentsdk/core/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { asRecord } from "../builder/utils/record-readers.js";

const learningRunsPath = join(process.cwd(), ".builder-state", "learning-runs.json");
const runs = loadRuns();

export function saveLearningRun(run: LearningJobStatus): void {
  runs.set(run.runId, run);
  persistRuns();
}

export function getLearningRun(runId: string): LearningJobStatus | null {
  return runs.get(runId) ?? null;
}

export function latestLearningRunForDraft(
  draftId: string,
): LearningJobStatus | null {
  return Array.from(runs.values())
    .filter((run) => run.draftId === draftId)
    .sort((left, right) => {
      const leftTime = Date.parse(left.finishedAt ?? left.startedAt ?? left.queuedAt);
      const rightTime = Date.parse(right.finishedAt ?? right.startedAt ?? right.queuedAt);
      return (rightTime || 0) - (leftTime || 0);
    })[0] ?? null;
}

export function createLocalLearningRunRepository(): LearningRunRepositoryPort {
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
      saveLearningRun(run);
      return run;
    },

    save(record) {
      saveLearningRun(record);
      return record;
    },

    get(runId) {
      return asLearningRunRecord(getLearningRun(runId));
    },

    findBySource(input) {
      return Array.from(runs.values())
        .map(asLearningRunRecord)
        .filter((run): run is LearningRunRecord => Boolean(run))
        .find((run) => {
          return run.sourceSessionId === input.sourceSessionId &&
            (!input.agentId || run.agentId === input.agentId) &&
            (!input.draftId || run.draftId === input.draftId);
        }) ?? null;
    },
  };
}

export function learningProfileFromEnv(
  env: Record<string, string | undefined>,
): LearningLoopProfile {
  const value = env.AGENT_LEARNING_PROFILE;
  if (
    value === "observe" ||
    value === "memory_only" ||
    value === "memory_and_candidates" ||
    value === "auto_apply_prompt_safe" ||
    value === "approval_required"
  ) {
    return value;
  }
  return "auto_apply_prompt_safe";
}

function loadRuns(): Map<string, LearningJobStatus> {
  if (!existsSync(learningRunsPath)) return new Map();
  try {
    const raw = readFileSync(learningRunsPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed
        .filter(isLearningJobStatus)
        .map((run): [string, LearningJobStatus] => [run.runId, run]),
    );
  } catch (error) {
    console.warn("Failed to load learning run state:", error);
    return new Map();
  }
}

function persistRuns(): void {
  try {
    mkdirSync(dirname(learningRunsPath), { recursive: true });
    writeFileSync(learningRunsPath, JSON.stringify(Array.from(runs.values()), null, 2));
  } catch (error) {
    console.warn("Failed to persist learning run state:", error);
  }
}

function isLearningJobStatus(value: unknown): value is LearningJobStatus {
  const record = asRecord(value);
  return (
    typeof record.jobId === "string" &&
    typeof record.runId === "string" &&
    typeof record.status === "string" &&
    typeof record.queuedAt === "string"
  );
}

function asLearningRunRecord(
  run: LearningJobStatus | null,
): LearningRunRecord | null {
  if (!run) return null;
  return {
    profile: "memory_only",
    ...run,
  };
}
