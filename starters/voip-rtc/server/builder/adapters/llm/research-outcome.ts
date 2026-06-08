import type {
  KnowledgeDocument,
  KnowledgeResearchResult,
} from "@voiceagentsdk/core/sdk";

export function researchStatus(
  documents: KnowledgeDocument[],
  stopReason: string | undefined,
): KnowledgeResearchResult["status"] {
  if ((stopReason ?? "").includes("budget")) return "budget-exhausted";
  if (documents.length > 0) return "completed";
  return "failed";
}

export function researchStopReason(
  documents: KnowledgeDocument[],
  objectives: Array<{ objective: string }>,
): string {
  return documents.length === objectives.length
    ? "All planned research cycles completed"
    : "Research stopped before all objectives completed";
}
