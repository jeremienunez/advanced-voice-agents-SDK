import type {
  AgentBuildDraft,
} from "../../domain/builder/types.js";
import { postJson } from "../http.js";
import type { KnowledgeDocument } from "../../domain/builder/knowledge.js";

export function createDatabasePlan(
  apiBase: string,
  draft: AgentBuildDraft,
  documents: KnowledgeDocument[],
) {
  return postJson<{ draft: AgentBuildDraft }>(`${apiBase}/database-plan`, {
    draftId: draft.id,
    draft,
    documents,
  });
}

export function applyDatabasePlan(apiBase: string, draft: AgentBuildDraft) {
  return postJson<{
    status: string;
    reason?: string;
    draft?: AgentBuildDraft;
  }>(`${apiBase}/apply-database`, { draftId: draft.id, draft });
}
