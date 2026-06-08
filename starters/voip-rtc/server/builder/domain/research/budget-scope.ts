import type {
  KnowledgeResearchBudget,
  KnowledgeResearchIntent,
  KnowledgeResearchSpend,
} from "@voiceagentsdk/core/sdk";
import { resolveResearchBudget } from "./plan.js";

export interface ResearchBudgetScope {
  budget?: KnowledgeResearchBudget;
  stopReason?: string;
}

export function remainingResearchBudget(
  input: Partial<KnowledgeResearchBudget> | undefined,
  spend: KnowledgeResearchSpend | undefined,
): ResearchBudgetScope {
  const budget = resolveResearchBudget(input);
  if (!spend) return { budget };
  const remaining = {
    maxCycles: budget.maxCycles - spend.cycles,
    maxQueriesPerCycle: budget.maxQueriesPerCycle,
    maxSources: budget.maxSources - spend.sources,
    maxEstimatedTokens: budget.maxEstimatedTokens - spend.estimatedTokens,
    maxEstimatedCostUsd: budget.maxEstimatedCostUsd - spend.estimatedCostUsd,
  };
  const stopReason = exhaustedResearchBudgetReason(remaining);
  return stopReason ? { stopReason } : { budget: remaining };
}

export function capResearchIntentQueries(
  intent: KnowledgeResearchIntent,
  budget: KnowledgeResearchBudget,
): KnowledgeResearchIntent | undefined {
  const queries = intent.queries.slice(0, budget.maxQueriesPerCycle);
  return queries.length > 0 ? { ...intent, queries } : undefined;
}

function exhaustedResearchBudgetReason(
  budget: KnowledgeResearchBudget,
): string | undefined {
  if (budget.maxCycles <= 0) {
    return "Research continuation budget exhausted by cycle limit";
  }
  if (budget.maxSources <= 0) {
    return "Research continuation budget exhausted by source limit";
  }
  if (budget.maxEstimatedTokens <= 0) {
    return "Research continuation budget exhausted by token limit";
  }
  if (budget.maxEstimatedCostUsd <= 0) {
    return "Research continuation budget exhausted by cost limit";
  }
  return undefined;
}
