import type { KnowledgeResearchBudget } from "./knowledge.js";
import type { BuilderIdentity, BuilderSystemConfig } from "./types.js";

export const emptyIdentity: BuilderIdentity = {
  builderFirstName: "",
  builderLastName: "",
  publicAgentName: "",
  intent: "",
  mustDo: "",
  mustNotDo: "",
};

export const emptyBuilderSystem: BuilderSystemConfig = {
  modelSelections: {},
};

export const defaultResearchBudget: KnowledgeResearchBudget = {
  maxCycles: 5,
  maxQueriesPerCycle: 4,
  maxSources: 10,
  maxEstimatedTokens: 12000,
  maxEstimatedCostUsd: 0.25,
};
