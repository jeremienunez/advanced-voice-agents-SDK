import type {
  ActiveAgentAssignmentPort,
  ActiveAgentScope,
} from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../types.js";
import { activeDraftId, setActiveDraft } from "./session-store.js";

export function createGlobalActiveAgentAssignment(): ActiveAgentAssignmentPort {
  return {
    getActiveAgent: () => activeDraftId(),
    setActiveAgent: ({ draftId }) => setActiveDraft(draftId),
  };
}

export function createScopedActiveAgentAssignment(): ActiveAgentAssignmentPort {
  const assignments = new Map<string, string>();
  return {
    getActiveAgent: (scope) => assignments.get(scopeKey(scope)),
    setActiveAgent: ({ draftId, ...scope }) => {
      assignments.set(scopeKey(scope), draftId);
    },
  };
}

export function activeAgentScopeFromContext(
  context: BuilderRequestContext,
): ActiveAgentScope {
  return {
    tenantId: context.identity?.tenantId,
    userId: context.identity?.userId,
    planId: context.identity?.planId,
  };
}

export function scopeKey(scope: ActiveAgentScope): string {
  return [
    scope.tenantId ?? "*",
    scope.userId ?? "*",
    scope.planId ?? "*",
  ].join(":");
}
