import { activeCompiledDraft } from "./active-draft.js";
import { compiledDraftSummaries } from "./compiled-draft-summaries.js";
import type { BuilderRequestContext } from "../types.js";
import {
  activeDraftId,
  sessionUpdatedAt,
  syncActiveDraft,
} from "./session-store.js";
import { summarizeDraftForSession } from "./session-draft-summary.js";

export function builderSessionPayload(
  context: BuilderRequestContext = {},
): Record<string, unknown> {
  const draft = activeCompiledDraft(context);
  if (!context.identity && draft?.compiled && activeDraftId() !== draft.id) {
    syncActiveDraft(draft.id, draft.compiled.createdAt);
  }
  return {
    activeDraftId: draft?.id ?? null,
    updatedAt: sessionUpdatedAt() ?? null,
    artifact: draft?.compiled ?? null,
    draft: draft ? summarizeDraftForSession(draft) : null,
    available: compiledDraftSummaries(context),
  };
}
