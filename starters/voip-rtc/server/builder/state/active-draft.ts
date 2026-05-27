import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { activeDraftId } from "./session-store.js";
import { draftValues, getDraft } from "./draft-store.js";

export function activeCompiledDraft(): AgentBuildDraft | undefined {
  const draftId = activeDraftId();
  if (draftId) {
    const active = getDraft(draftId);
    if (active?.compiled) return active;
  }
  return latestCompiledDraft();
}

function latestCompiledDraft(): AgentBuildDraft | undefined {
  return draftValues()
    .filter((draft) => Boolean(draft.compiled))
    .sort((left, right) => {
      const leftTime = Date.parse(left.compiled?.createdAt ?? "");
      const rightTime = Date.parse(right.compiled?.createdAt ?? "");
      return (rightTime || 0) - (leftTime || 0);
    })[0];
}
