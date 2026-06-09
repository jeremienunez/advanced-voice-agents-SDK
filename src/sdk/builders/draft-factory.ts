import type { AgentBuilderIdentity } from "../types/builder.js";
import { AgentBuildDraftBuilder } from "./draft.js";

export function createAgentBuildDraftBuilder(
  id: string,
  identity: AgentBuilderIdentity,
): AgentBuildDraftBuilder {
  return new AgentBuildDraftBuilder(id, identity);
}
