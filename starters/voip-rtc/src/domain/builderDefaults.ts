import type { BuilderIdentity, KnowledgeResearchBudget } from "./builder.js";

export const emptyIdentity: BuilderIdentity = {
  builderFirstName: "",
  builderLastName: "",
  publicAgentName: "",
  intent: "",
  mustDo: "",
  mustNotDo: "",
  llmProvider: "",
  llmModel: "",
};

export const defaultResearchBudget: KnowledgeResearchBudget = {
  maxCycles: 5,
  maxQueriesPerCycle: 4,
  maxSources: 10,
  maxEstimatedTokens: 12000,
  maxEstimatedCostUsd: 0.25,
};
