import type { KnowledgeResearchCycle } from "@voiceagentsdk/core/sdk";

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
