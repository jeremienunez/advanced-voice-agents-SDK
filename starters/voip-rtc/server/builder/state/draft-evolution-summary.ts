import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { latestLearningRunForDraft } from "../../learning/run-state.js";
import { asRecord, readString } from "../utils/record-readers.js";

export function summarizeEvolution(draft: AgentBuildDraft): Record<string, unknown> {
  const raw = asRecord(draft.metadata?.agentEvolution);
  const version = typeof raw.version === "number" && raw.version > 0
    ? raw.version
    : draft.compiled
      ? 1
      : 0;
  const lastRun = asRecord(raw.lastLearningRun);
  const persistedRun = latestLearningRunForDraft(draft.id);
  return {
    version,
    currentArtifactId: readString(raw, "currentArtifactId") || null,
    rollbackAvailable: Boolean(raw.rollbackArtifact),
    lastLearningRun: lastRun.runId
      ? {
          runId: readString(lastRun, "runId"),
          status: readString(lastRun, "status"),
          at: readString(lastRun, "at"),
          sourceSessionId: readString(lastRun, "sourceSessionId"),
        }
      : persistedRun
        ? {
            runId: persistedRun.runId,
            status: persistedRun.status,
            at: persistedRun.finishedAt ?? persistedRun.startedAt ?? persistedRun.queuedAt,
            sourceSessionId: null,
          }
        : null,
  };
}
