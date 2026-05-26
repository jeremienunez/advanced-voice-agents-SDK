import type {
  AgentBuildDraft,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchCycle,
  KnowledgeResearchPort,
  KnowledgeResearchRequest,
  KnowledgeResearchResult,
  KnowledgeResearchSpend,
} from "@voiceagentsdk/core/sdk";
import {
  buildResearchObjectives,
  estimateTokens,
  resolveResearchBudget,
} from "../domain/research.js";
import type { BuilderPromptLibrary } from "../prompts/template.js";
import { renderPromptTemplate } from "../prompts/template.js";
import { fetchDeepSeekText } from "./deepseek-chat.js";
import {
  createResearchCycle,
  flattenResearchCheckpoints,
  pushResearchCheckpoint,
  researchStatus,
  researchStopReason,
  sourcesFromMarkdown,
} from "./research-helpers.js";

interface ResearchCycleResult {
  text: string;
  objective: string;
  queries: string[];
  sources: Array<{ url: string; title: string }>;
  estimatedTokens: number;
  estimatedCostUsd: number;
  model?: string;
}

export class DeepSeekKnowledgeResearch implements KnowledgeResearchPort {
  constructor(
    private readonly config: {
      apiKey?: string;
      baseUrl: string;
      defaultModel: string;
      estimatedCostPer1kTokens: number;
      prompts: BuilderPromptLibrary;
    },
  ) {}

  isConfigured(settings?: { provider?: string }): boolean {
    return (!settings?.provider || settings.provider === "deepseek") &&
      Boolean(this.config.apiKey);
  }

  async growKnowledge(
    input: KnowledgeResearchRequest,
  ): Promise<KnowledgeResearchResult> {
    if (!this.isConfigured(input.settings)) {
      throw new Error("DeepSeek API key is required for knowledge research");
    }

    const budget = resolveResearchBudget(input.budget);
    const objectives = buildResearchObjectives(input);
    const documents: KnowledgeDocument[] = [];
    const cycles: KnowledgeResearchCycle[] = [];
    const spend = emptySpend();
    let stopReason: string | undefined;

    for (const objective of objectives) {
      if (budgetExhausted(spend, budget)) {
        stopReason = "Research budget exhausted by source, token, or cost limit";
        break;
      }
      const cycle = createResearchCycle(cycles.length, objective);
      cycles.push(cycle);
      await this.runCycle(input, objective, budget, spend, documents, cycle);
    }

    return {
      status: researchStatus(documents, stopReason),
      budget,
      spend,
      documents,
      cycles,
      checkpoints: flattenResearchCheckpoints(cycles),
      stopReason: stopReason ?? researchStopReason(documents, objectives),
      warnings: cycles.flatMap((cycle) => cycle.warnings ?? []),
    };
  }

  private async runCycle(
    input: KnowledgeResearchRequest,
    objective: { objective: string; queries: string[] },
    budget: KnowledgeResearchBudget,
    spend: KnowledgeResearchSpend,
    documents: KnowledgeDocument[],
    cycle: KnowledgeResearchCycle,
  ): Promise<void> {
    try {
      pushResearchCheckpoint(cycle, {
        label: "cycle-started",
        status: "running",
        detail: objective.objective,
        metadata: { queryCount: objective.queries.length },
      });
      const result = await this.requestResearch(
        input,
        objective,
        budget,
        spend,
        cycle,
      );
      const document = researchDocument(input.draft, result);
      documents.push(document);
      spend.cycles += 1;
      spend.queries += result.queries.length;
      spend.sources += result.sources.length;
      spend.estimatedTokens += result.estimatedTokens;
      spend.estimatedCostUsd += result.estimatedCostUsd;
      Object.assign(cycle, {
        status: "completed",
        sourceCount: result.sources.length,
        estimatedTokens: result.estimatedTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        documentId: document.id,
      });
      pushResearchCheckpoint(cycle, {
        label: "document-created",
        status: "completed",
        detail: document.name,
        metadata: {
          documentId: document.id,
          sourceCount: result.sources.length,
          estimatedTokens: result.estimatedTokens,
        },
      });
    } catch (error) {
      cycle.status = "failed";
      pushResearchCheckpoint(cycle, {
        label: "cycle-failed",
        status: "failed",
        detail: error instanceof Error ? error.message : "Research cycle failed",
      });
      cycle.warnings = [
        error instanceof Error ? error.message : "Research cycle failed",
      ];
    }
  }

  private async requestResearch(
    input: KnowledgeResearchRequest,
    objective: { objective: string; queries: string[] },
    budget: KnowledgeResearchBudget,
    spend: KnowledgeResearchSpend,
    cycle: KnowledgeResearchCycle,
  ): Promise<ResearchCycleResult> {
    const user = renderPromptTemplate(this.config.prompts.research.user, {
      objective: objective.objective,
      queriesJson: objective.queries.slice(0, budget.maxQueriesPerCycle),
      remainingSources: budget.maxSources - spend.sources,
      agentIntent: input.draft.identity.intent,
      mustDo: input.draft.identity.mustDo.join("; "),
      mustNotDo: input.draft.identity.mustNotDo.join("; "),
      documentsJson: input.documents.map(summarizeDocumentForResearch),
    });
    const model = input.settings?.model || input.draft.identity.llmModel;
    pushResearchCheckpoint(cycle, {
      label: "prompt-rendered",
      status: "completed",
      detail: "Research prompt rendered from external template.",
      metadata: {
        promptChars: user.length,
        provider: input.settings?.provider ?? "deepseek",
        model,
      },
    });
    pushResearchCheckpoint(cycle, {
      label: "model-call-started",
      status: "running",
      detail: "Waiting for builder model response without network timeout.",
      metadata: {
        model,
        maxOutputTokens: Math.min(
          16_384,
          Math.max(512, budget.maxEstimatedTokens),
        ),
      },
    });
    const text = await fetchDeepSeekText({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      defaultModel: this.config.defaultModel,
      model,
      system: this.config.prompts.research.system,
      user,
      maxTokens: Math.min(16_384, Math.max(512, budget.maxEstimatedTokens)),
    });
    pushResearchCheckpoint(cycle, {
      label: "model-response-received",
      status: "completed",
      detail: "Builder model returned research distillation.",
      metadata: { responseChars: text.length },
    });
    const sources = sourcesFromMarkdown(text).slice(
      0,
      budget.maxSources - spend.sources,
    );
    const estimatedTokens = estimateTokens(user) + estimateTokens(text);
    pushResearchCheckpoint(cycle, {
      label: "sources-extracted",
      status: "completed",
      detail: "Source candidates extracted from research distillation.",
      metadata: {
        sourceCount: sources.length,
        estimatedTokens,
        estimatedCostUsd:
          (estimatedTokens / 1000) * this.config.estimatedCostPer1kTokens,
      },
    });
    return {
      text,
      objective: objective.objective,
      queries: objective.queries,
      sources,
      estimatedTokens,
      estimatedCostUsd:
        (estimatedTokens / 1000) * this.config.estimatedCostPer1kTokens,
      model,
    };
  }

}

function emptySpend(): KnowledgeResearchSpend {
  return {
    cycles: 0,
    queries: 0,
    sources: 0,
    estimatedTokens: 0,
    estimatedCostUsd: 0,
  };
}

function budgetExhausted(
  spend: KnowledgeResearchSpend,
  budget: KnowledgeResearchBudget,
): boolean {
  return spend.sources >= budget.maxSources ||
    spend.estimatedTokens >= budget.maxEstimatedTokens ||
    spend.estimatedCostUsd >= budget.maxEstimatedCostUsd;
}

function summarizeDocumentForResearch(document: KnowledgeDocument) {
  return {
    name: document.name,
    kind: document.kind,
    metadata: document.metadata,
    excerpt: document.text?.slice(0, 900),
  };
}

function researchDocument(
  draft: AgentBuildDraft,
  result: ResearchCycleResult,
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
      provider: "deepseek-knowledge-research",
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
