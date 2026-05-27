import type {
  AgentBuildDraft,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchRequest,
  KnowledgeResearchSpend,
  LlmModelProfile,
  LlmTask,
} from "@voiceagentsdk/core/sdk";

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

export function createLlmResearchTask(
  input: KnowledgeResearchRequest,
  objective: { objective: string; queries: string[] },
  system: string,
  user: string,
  provider: string | undefined,
  model: string | undefined,
  maxOutputTokens: number,
): LlmTask {
  return {
    id: `builder.research:${input.draft.id}:${crypto.randomUUID()}`,
    role: "builder.researcher",
    intent: input.draft.identity.intent,
    skillRef: "builder.research",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    outputContract: { kind: "text" },
    requestedModel: { provider, model },
    needs: {
      cost: "quality",
      latency: "batch",
      maxOutputTokens,
      reasoning: "adaptive",
      tools: "none",
    },
    metadata: {
      draftId: input.draft.id,
      objective: objective.objective,
      queryCount: objective.queries.length,
    },
  };
}

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

export function summarizeDocumentForResearch(document: KnowledgeDocument) {
  return {
    name: document.name,
    kind: document.kind,
    metadata: document.metadata,
    excerpt: document.text?.slice(0, 900),
  };
}

export function researchDocument(
  draft: AgentBuildDraft,
  result: LlmResearchCycleResult,
): KnowledgeDocument {
  const documentId = `doc_research_${crypto.randomUUID()}`;
  return {
    id: documentId,
    name: `${draft.identity.publicAgentName} autonomous research.research.md`,
    kind: "web_research",
    mimeType: "text/x-web-research",
    text: result.text,
    status: "parsed",
    metadata: {
      provider: `${result.provider}-knowledge-research`,
      mode: "autonomous-budget-aware",
      model: result.model,
      visitedAt: new Date().toISOString(),
      objective: result.objective,
      queries: result.queries,
      sourceCount: result.sources.length,
      sources: result.sources,
      estimatedTokens: result.estimatedTokens,
      estimatedCostUsd: result.estimatedCostUsd,
    },
  };
}

export function defaultResearchModel(
  profiles: LlmModelProfile[],
  provider: string | undefined,
): string | undefined {
  return profiles.find((profile) => {
    return profile.roles.includes("builder.researcher") &&
      (!provider || profile.provider === provider);
  })?.model;
}
