import type {
  JsonObject,
  KnowledgeDocument,
  KnowledgeResearchCheckpoint,
  KnowledgeResearchCycle,
  KnowledgeResearchResult,
} from "@voiceagentsdk/core/sdk";
import { uniqueSources } from "../domain/research.js";

export function createResearchCycle(
  index: number,
  objective: { objective: string; queries: string[] },
): KnowledgeResearchCycle {
  return {
    id: `research_cycle_${index + 1}`,
    objective: objective.objective,
    queries: objective.queries,
    status: "running",
    sourceCount: 0,
    estimatedTokens: 0,
    estimatedCostUsd: 0,
  };
}

export function pushResearchCheckpoint(
  cycle: KnowledgeResearchCycle,
  input: {
    detail?: string;
    label: string;
    metadata?: JsonObject;
    status: KnowledgeResearchCheckpoint["status"];
  },
): KnowledgeResearchCheckpoint {
  const checkpoint: KnowledgeResearchCheckpoint = {
    id: `checkpoint_${crypto.randomUUID()}`,
    label: input.label,
    status: input.status,
    at: new Date().toISOString(),
    detail: input.detail,
    metadata: input.metadata,
  };
  cycle.checkpoints = [...(cycle.checkpoints ?? []), checkpoint];
  return checkpoint;
}

export function flattenResearchCheckpoints(
  cycles: KnowledgeResearchCycle[],
): KnowledgeResearchCheckpoint[] {
  return cycles.flatMap((cycle) => cycle.checkpoints ?? []);
}

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

export function sourcesFromMarkdown(
  text: string,
): Array<{ url: string; title: string }> {
  const sources = Array.from(text.matchAll(/https?:\/\/[^\s)\]]+/g)).map(
    ([url]) => ({
      url: url.replace(/[.,;:]+$/, ""),
      title: url.replace(/^https?:\/\//, ""),
    }),
  );
  return uniqueSources(sources);
}
