import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { summarizeEvolution } from "./draft-evolution-summary.js";
import { summarizePlannedKnowledge } from "./draft-knowledge-summary.js";

export function summarizeDraftForBank(
  draft: AgentBuildDraft,
  activeDraftId: string | undefined,
): Record<string, unknown> {
  return {
    draftId: draft.id,
    kind: draft.compiled ? "compiled" : "draft",
    publicAgentName: draft.identity.publicAgentName,
    intent: draft.identity.intent,
    status: draft.status,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    active: activeDraftId === draft.id,
    canRunRtc: Boolean(draft.compiled),
    knowledge: draft.compiled?.knowledge ?? summarizePlannedKnowledge(draft),
    database: draft.databasePlan
      ? {
          schemaName: draft.databasePlan.schemaName,
          status: draft.databasePlan.status,
          appliedAt: draft.databasePlan.appliedAt,
        }
      : null,
    selectedTools: draft.compiled?.selectedTools ?? draft.selectedTools,
    promptChars:
      draft.compiled?.prompt.length ??
      draft.promptParts.final?.length ??
      draft.promptParts.tools?.length ??
      draft.promptParts.part1?.length ??
      0,
    evolution: summarizeEvolution(draft),
  };
}
