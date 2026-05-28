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
    pendingInfraEvolution: pendingInfraSummary(raw.pendingInfraEvolution),
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

function pendingInfraSummary(value: unknown): Record<string, unknown> | null {
  const pending = asRecord(value);
  const proposedPlan = asRecord(pending.proposedPlan);
  if (!pending.id || pending.status !== "pending") return null;
  return {
    id: readString(pending, "id"),
    status: readString(pending, "status"),
    proposedPlanId: readString(proposedPlan, "id"),
    computeTarget: readString(proposedPlan, "computeTarget"),
    provisioningMode: readString(proposedPlan, "provisioningMode"),
    approvalReasons: Array.isArray(pending.approvalReasons)
      ? pending.approvalReasons.filter((item) => typeof item === "string")
      : [],
    createdAt: readString(pending, "createdAt"),
  };
}
