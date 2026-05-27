import { activeCompiledDraft } from "./active-draft.js";
import { activeDraftId } from "./session-store.js";
import { summarizeDraftForBank } from "./draft-bank-summary.js";
import { draftValues } from "./draft-store.js";

export function builderAgentBankPayload(): Record<string, unknown> {
  const activeDraft = activeCompiledDraft();
  return {
    activeDraftId: activeDraft?.id ?? null,
    agents: agentBankItems(activeDraft?.id ?? activeDraftId()),
  };
}

function agentBankItems(
  currentDraftId: string | undefined,
): Array<Record<string, unknown>> {
  return draftValues()
    .sort((left, right) => {
      const leftTime = Date.parse(
        left.compiled?.createdAt ?? left.updatedAt ?? left.createdAt,
      );
      const rightTime = Date.parse(
        right.compiled?.createdAt ?? right.updatedAt ?? right.createdAt,
      );
      return (rightTime || 0) - (leftTime || 0);
    })
    .slice(0, 24)
    .map((draft) => summarizeDraftForBank(draft, currentDraftId));
}
