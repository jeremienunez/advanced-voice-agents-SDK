import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { asRecord, readChunkCount } from "../utils.js";

export function summarizePlannedKnowledge(
  draft: AgentBuildDraft,
): Record<string, unknown> | null {
  if (!draft.knowledgePlan) return null;
  return {
    strategy: draft.knowledgePlan.strategy,
    status: draft.status,
    documentCount: draft.knowledgePlan.documents.length,
    chunkCount: readKnowledgeChunkCount(draft.metadata),
  };
}

function readKnowledgeChunkCount(
  metadata: Record<string, unknown> | undefined,
): number | undefined {
  const store = asRecord(metadata?.knowledgeStore);
  return readChunkCount(store);
}
