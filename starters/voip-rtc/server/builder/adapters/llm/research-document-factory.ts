import type {
  AgentBuildDraft,
  KnowledgeDocument,
} from "@voiceagentsdk/core/sdk";
import type { LlmResearchCycleResult } from "./research-result.js";

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
