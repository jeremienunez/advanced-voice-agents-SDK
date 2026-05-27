import type {
  KnowledgeResearchBudget,
  KnowledgeResearchSpend,
} from "@voiceagentsdk/core/sdk";

export function emptyResearchSpend(): KnowledgeResearchSpend {
  return {
    cycles: 0,
    queries: 0,
    sources: 0,
    estimatedTokens: 0,
    estimatedCostUsd: 0,
  };
}

export function isResearchBudgetExhausted(
  spend: KnowledgeResearchSpend,
  budget: KnowledgeResearchBudget,
): boolean {
  return spend.sources >= budget.maxSources ||
    spend.estimatedTokens >= budget.maxEstimatedTokens ||
    spend.estimatedCostUsd >= budget.maxEstimatedCostUsd;
}
