import type {
  AgentBuildDraft,
} from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../types.js";
import {
  draftOwnerScope,
  ownerMatchesIdentity,
} from "./draft-owner-scope.js";
import { requireDraft, resolveDraft } from "./draft-store.js";

export function resolveOwnedDraft(
  body: unknown,
  context: BuilderRequestContext,
): AgentBuildDraft {
  const draft = resolveDraft(body);
  assertDraftOwnedBy(draft, context);
  return draft;
}

export function requireOwnedDraft(
  draftId: string,
  context: BuilderRequestContext,
): AgentBuildDraft {
  const draft = requireDraft(draftId);
  assertDraftOwnedBy(draft, context);
  return draft;
}

export function assertDraftOwnedBy(
  draft: AgentBuildDraft,
  context: BuilderRequestContext,
): void {
  const identity = context.identity;
  if (identity?.metadata?.authMode === "local-dev") return;
  const owner = draftOwnerScope(draft);
  if (!identity || !ownerMatchesIdentity(owner, identity)) {
    throw new Error(
      `Draft "${draft.id}" is not owned by authenticated identity`,
    );
  }
}
