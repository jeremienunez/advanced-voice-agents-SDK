export interface LlmResearchCycleResult {
  estimatedCostUsd: number;
  estimatedTokens: number;
  model: string;
  objective: string;
  provider: string;
  queries: string[];
  sources: Array<{ url: string; title: string }>;
  text: string;
}
