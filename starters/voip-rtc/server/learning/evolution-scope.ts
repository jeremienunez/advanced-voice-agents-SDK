import type {
  ActiveAgentScope,
  AgentBuildDraft,
} from "@voiceagentsdk/core/sdk";
import { draftOwnerScope } from "../builder/state/draft-owner-scope.js";

export function activeScopeForDraft(
  draft: AgentBuildDraft,
  scope: ActiveAgentScope,
): ActiveAgentScope {
  const owner = draftOwnerScope(draft);
  return {
    tenantId: scope.tenantId ?? owner.tenantId,
    userId: scope.userId ?? owner.userId,
    planId: scope.planId ?? owner.planId,
  };
}
