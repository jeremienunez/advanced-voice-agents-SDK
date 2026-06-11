import type {
  AgentBuildDraft,
  BuilderDraftResponse,
  BuilderIdentity,
  BuilderSystemConfig,
} from "../../domain/builder/types.js";
import { postJson, readError } from "../http.js";

export function createPromptPlan(
  apiBase: string,
  identity: BuilderIdentity,
  builderSystem: BuilderSystemConfig,
) {
  return postJson<{ draft: AgentBuildDraft }>(`${apiBase}/prompt-plan`, {
    builderSystem,
    identity,
  });
}

export function savePromptClarifications(
  apiBase: string,
  draft: AgentBuildDraft,
  answers: Record<string, string>,
) {
  return postJson<{ draft: AgentBuildDraft }>(`${apiBase}/prompt-clarifications`, {
    draftId: draft.id,
    answers,
    acceptUnanswered: true,
  });
}

export async function fetchDraft(
  apiBase: string,
  draftId: string,
): Promise<BuilderDraftResponse> {
  const response = await fetch(`${apiBase}/drafts/${encodeURIComponent(draftId)}`);
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail || `Draft request failed with ${response.status}`);
  }
  return (await response.json()) as BuilderDraftResponse;
}
