import type {
  ActiveAgentAssignmentPort,
  ActiveAgentScope,
  AgentBuildDraft,
} from "@voiceagentsdk/core/sdk";
import { activeScopeForDraft } from "./evolution-scope.js";

export async function setActiveAgentFromDraft(
  activeAgentAssignment: ActiveAgentAssignmentPort,
  draft: AgentBuildDraft,
  scope: ActiveAgentScope,
): Promise<void> {
  await activeAgentAssignment.setActiveAgent({
    draftId: draft.id,
    ...activeScopeForDraft(draft, scope),
  });
}
