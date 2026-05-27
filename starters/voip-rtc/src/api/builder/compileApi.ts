import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../../domain/builder.js";
import { postJson } from "../http.js";

export function compileAgentSpec(
  apiBase: string,
  draft: AgentBuildDraft,
  selectedTools: string[],
) {
  return postJson<{
    draft: AgentBuildDraft;
    artifact: CompiledAgentSummary;
  }>(`${apiBase}/compile-agent`, {
    draftId: draft.id,
    draft,
    selectedTools,
  });
}
