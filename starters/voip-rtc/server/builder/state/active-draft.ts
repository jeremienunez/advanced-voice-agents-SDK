import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../types.js";
import { draftVisibleToContext } from "./draft-owner-scope.js";
import { activeDraftId } from "./session-store.js";
import { draftValues, getDraft } from "./draft-store.js";

export function activeCompiledDraft(
  context: BuilderRequestContext = {},
): AgentBuildDraft | undefined {
  const draftId = activeDraftId();
  if (draftId) {
    const active = getDraft(draftId);
    if (active?.compiled && draftVisibleToContext(active, context)) return active;
  }
  return latestCompiledDraft(context);
}

function latestCompiledDraft(
  context: BuilderRequestContext,
): AgentBuildDraft | undefined {
  return draftValues()
    .filter((draft) => Boolean(draft.compiled) && draftVisibleToContext(draft, context))
    .sort((left, right) => {
      const leftTime = Date.parse(left.compiled?.createdAt ?? "");
      const rightTime = Date.parse(right.compiled?.createdAt ?? "");
      return (rightTime || 0) - (leftTime || 0);
    })[0];
}
