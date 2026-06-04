import type {
  KnowledgeResearchBudget,
  KnowledgeResearchSpend,
} from "@voiceagentsdk/core/sdk";

const MAX_RESEARCH_OUTPUT_TOKENS = 16_384;

export interface ResearchCycleTokenBudget {
  maxOutputTokens: number;
  promptTokens: number;
  remainingTokens: number;
  stopReason?: string;
}

export function researchCycleTokenBudget(
  spend: KnowledgeResearchSpend,
  budget: KnowledgeResearchBudget,
  promptTokens = 0,
): ResearchCycleTokenBudget {
  const remainingTokens = Math.max(
    0,
    budget.maxEstimatedTokens - spend.estimatedTokens,
  );
  const remainingOutputTokens = remainingTokens - Math.max(0, promptTokens);
  if (remainingOutputTokens <= 0) {
    return {
      maxOutputTokens: 0,
      promptTokens,
      remainingTokens,
      stopReason: "Research token budget exhausted before next model call",
    };
  }
  return {
    maxOutputTokens: Math.min(
      MAX_RESEARCH_OUTPUT_TOKENS,
      Math.max(1, Math.floor(remainingOutputTokens)),
    ),
    promptTokens,
    remainingTokens,
  };
}
