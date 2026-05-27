import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { summarizeEvolution } from "./draft-evolution-summary.js";

export function summarizeDraftForSession(draft: AgentBuildDraft): Record<string, unknown> {
  return {
    id: draft.id,
    status: draft.status,
    identity: draft.identity,
    selectedTools: draft.selectedTools,
    knowledge: draft.compiled?.knowledge,
    database: draft.databasePlan
      ? {
          schemaName: draft.databasePlan.schemaName,
          status: draft.databasePlan.status,
          appliedAt: draft.databasePlan.appliedAt,
        }
      : null,
    promptChars: draft.compiled?.prompt.length ?? 0,
    evolution: summarizeEvolution(draft),
  };
}
