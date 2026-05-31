import type {
  ActiveAgentScope,
  AgentBuildDraft,
  AuthTicketIdentity,
} from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../types.js";
import { asRecord, readString } from "../utils/record-readers.js";

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

export function draftVisibleToContext(
  draft: AgentBuildDraft,
  context: BuilderRequestContext,
): boolean {
  if (context.identity?.metadata?.authMode === "local-dev") return true;
  return !context.identity ||
    ownerMatchesIdentity(draftOwnerScope(draft), context.identity);
}

export function draftOwnerScope(draft: AgentBuildDraft): ActiveAgentScope {
  const owner = asRecord(asRecord(draft.metadata)[ownerKey]);
  return {
    tenantId: readString(owner, "tenantId"),
    userId: readString(owner, "userId") || undefined,
    planId: readString(owner, "planId") || undefined,
  };
}

export function ownerMatchesIdentity(
  owner: ActiveAgentScope,
  identity: AuthTicketIdentity,
): boolean {
  if (!owner.tenantId || owner.tenantId !== identity.tenantId) return false;
  if (owner.userId && owner.userId !== identity.userId) return false;
  return true;
}
