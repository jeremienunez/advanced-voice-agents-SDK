import type { LearningJobStatus } from "@voiceagentsdk/core/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { asRecord } from "../builder/utils.js";

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
