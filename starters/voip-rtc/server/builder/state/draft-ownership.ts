import type {
  AgentBuildDraft,
  AuthTicketIdentity,
} from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../types.js";
import { asRecord, readString } from "../utils/record-readers.js";
import { resolveDraft } from "./draft-store.js";

const ownerKey = "builderOwner";

export function ownerMetadata(
  identity: AuthTicketIdentity | undefined,
): Record<string, unknown> {
  if (!identity) return {};
  return {
    [ownerKey]: {
      tenantId: identity.tenantId,
      userId: identity.userId,
      planId: identity.planId,
    },
  };
}

export function resolveOwnedDraft(
  body: unknown,
  context: BuilderRequestContext,
): AgentBuildDraft {
  const draft = resolveDraft(body);
  assertDraftOwnedBy(draft, context);
  return draft;
}

function assertDraftOwnedBy(
  draft: AgentBuildDraft,
  context: BuilderRequestContext,
): void {
  const identity = context.identity;
  const owner = draftOwner(draft);
  if (!identity || !ownerMatchesIdentity(owner, identity)) {
    throw new Error(
      `Draft "${draft.id}" is not owned by authenticated identity`,
    );
  }
}

function draftOwner(draft: AgentBuildDraft): {
  tenantId: string;
  userId?: string;
} {
  const owner = asRecord(asRecord(draft.metadata)[ownerKey]);
  return {
    tenantId: readString(owner, "tenantId"),
    userId: readString(owner, "userId") || undefined,
  };
}

function ownerMatchesIdentity(
  owner: { tenantId: string; userId?: string },
  identity: AuthTicketIdentity,
): boolean {
  if (!owner.tenantId || owner.tenantId !== identity.tenantId) return false;
  if (owner.userId && owner.userId !== identity.userId) return false;
  return true;
}
