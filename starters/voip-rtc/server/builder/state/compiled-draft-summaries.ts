import { summarizeEvolution } from "./draft-evolution-summary.js";
import type { BuilderRequestContext } from "../types.js";
import { draftVisibleToContext } from "./draft-owner-scope.js";
import { draftValues } from "./draft-store.js";

export function compiledDraftSummaries(
  context: BuilderRequestContext = {},
): Array<Record<string, unknown>> {
  return draftValues()
    .filter((draft) => Boolean(draft.compiled) && draftVisibleToContext(draft, context))
    .sort((left, right) => {
      const leftTime = Date.parse(left.compiled?.createdAt ?? "");
      const rightTime = Date.parse(right.compiled?.createdAt ?? "");
      return (rightTime || 0) - (leftTime || 0);
    })
    .map((draft) => ({
      draftId: draft.id,
      publicAgentName: draft.identity.publicAgentName,
      status: draft.status,
      createdAt: draft.compiled?.createdAt,
      knowledge: draft.compiled?.knowledge,
      selectedTools: draft.compiled?.selectedTools,
      evolution: summarizeEvolution(draft),
    }));
}
