import type {
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchCycle,
  KnowledgeResearchPort,
  KnowledgeResearchRequest,
  KnowledgeResearchResult,
  KnowledgeResearchSpend,
  LlmModelProfile,
  LlmTaskRunnerPort,
} from "@voiceagentsdk/core/sdk";
import {
  buildResearchObjectives,
  estimateTokens,
  resolveResearchBudget,
} from "../domain/research.js";
import { capResearchIntentQueries } from "../domain/research-budget-scope.js";
import type { BuilderPromptLibrary } from "../prompts/template.js";
import { renderPromptTemplate } from "../prompts/template.js";
import {
  createResearchCycle,
  flattenResearchCheckpoints,
  pushResearchCheckpoint,
  researchStatus,
  researchStopReason,
  sourcesFromMarkdown,
} from "./research-helpers.js";
import {
  createLlmResearchTask,
  defaultResearchModel,
  emptyResearchSpend,
  isResearchBudgetExhausted,
  researchDocument,
  summarizeDocumentForResearch,
  type LlmResearchCycleResult,
} from "./llm-research-helpers.js";
import { researchCycleTokenBudget } from "./research-token-budget.js";

export class LlmKnowledgeResearch implements KnowledgeResearchPort {
  constructor(
    private readonly config: {
      estimatedCostPer1kTokens: number;
      profiles: LlmModelProfile[];
      prompts: BuilderPromptLibrary;
      runner: LlmTaskRunnerPort;
    },
  ) {}

  isConfigured(settings?: { provider?: string }): boolean {
    return this.researchProfiles(settings).some((profile) => profile.configured);
  }

  async growKnowledge(
    input: KnowledgeResearchRequest,
  ): Promise<KnowledgeResearchResult> {
    if (!this.isConfigured(input.settings)) {
      throw new Error("A configured LLM research provider is required");
    }

    const budget = resolveResearchBudget(input.budget);
    const requestedObjectives = buildResearchObjectives(input);
    const objectives = requestedObjectives.slice(0, budget.maxCycles);
    const documents: KnowledgeDocument[] = [];
    const cycles: KnowledgeResearchCycle[] = [];
    const spend = emptyResearchSpend();
    let stopReason = requestedObjectives.length > objectives.length
      ? "Research cycle limit reached before all objectives completed"
      : undefined;

    for (const objective of objectives) {
      if (isResearchBudgetExhausted(spend, budget)) {
        stopReason = "Research budget exhausted by source, token, or cost limit";
        break;
      }
      const cycleObjective = capResearchIntentQueries(objective, budget);
      if (!cycleObjective) continue;
      const cycle = createResearchCycle(cycles.length, cycleObjective);
      cycles.push(cycle);
      const cycleStopReason = await this.runCycle(
        input,
        cycleObjective,
        budget,
        spend,
        documents,
        cycle,
      );
      if (cycleStopReason) {
        stopReason = cycleStopReason;
        break;
      }
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
  ): Promise<string | undefined> {
    try {
      pushResearchCheckpoint(cycle, {
        label: "cycle-started",
        status: "running",
        detail: objective.objective,
        metadata: { queryCount: objective.queries.length },
      });
      const provider = input.settings?.provider;
      const model = input.settings?.model || undefined;
      const user = this.renderResearchPrompt(input, objective, budget, spend);
      pushResearchCheckpoint(cycle, {
        label: "prompt-rendered",
        status: "completed",
        detail: "Research prompt rendered from external template.",
        metadata: {
          promptChars: user.length,
          provider: provider ?? "auto",
          model: model ?? defaultResearchModel(this.config.profiles, provider) ??
            "auto",
        },
      });
      const tokenBudget = researchCycleTokenBudget(
        spend,
        budget,
        estimateTokens(this.config.prompts.research.system) +
          estimateTokens(user),
      );
      if (tokenBudget.stopReason) {
        cycle.status = "skipped";
        cycle.warnings = [tokenBudget.stopReason];
        pushResearchCheckpoint(cycle, {
          label: "cycle-skipped",
          status: "failed",
          detail: tokenBudget.stopReason,
          metadata: {
            promptTokens: tokenBudget.promptTokens,
            remainingTokens: tokenBudget.remainingTokens,
          },
        });
        return tokenBudget.stopReason;
      }
      const result = await this.requestResearch(
        input,
        objective,
        budget,
        spend,
        cycle,
        user,
        tokenBudget.maxOutputTokens,
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
      const message = error instanceof Error ? error.message : "Research cycle failed";
      pushResearchCheckpoint(cycle, {
        label: "cycle-failed",
        status: "failed",
        detail: message,
      });
      cycle.warnings = [message];
    }
    return undefined;
  }

  private async requestResearch(
    input: KnowledgeResearchRequest,
    objective: { objective: string; queries: string[] },
    budget: KnowledgeResearchBudget,
    spend: KnowledgeResearchSpend,
    cycle: KnowledgeResearchCycle,
    user: string,
    maxOutputTokens: number,
  ): Promise<LlmResearchCycleResult> {
    const provider = input.settings?.provider;
    const model = input.settings?.model || undefined;
    pushResearchCheckpoint(cycle, {
      label: "model-call-started",
      status: "running",
      detail: "Waiting for builder model response without network timeout.",
      metadata: {
        maxOutputTokens,
        provider: provider ?? "auto",
      },
    });

    const result = await this.config.runner.run<string>(
      createLlmResearchTask(
        input,
        objective,
        this.config.prompts.research.system,
        user,
        provider,
        model,
        maxOutputTokens,
      ),
    );
    const text = result.content;
    pushResearchCheckpoint(cycle, {
      label: "model-response-received",
      status: "completed",
      detail: "Builder model returned research distillation.",
      metadata: {
        provider: String(result.provider),
        model: result.model,
        responseChars: text.length,
      },
    });
    const sources = sourcesFromMarkdown(text).slice(
      0,
      budget.maxSources - spend.sources,
    );
    const estimatedTokens = result.usage?.totalTokens ??
      estimateTokens(this.config.prompts.research.system) + estimateTokens(user) +
        estimateTokens(text);
    const estimatedCostUsd =
      (estimatedTokens / 1000) * this.config.estimatedCostPer1kTokens;
    pushResearchCheckpoint(cycle, {
      label: "sources-extracted",
      status: "completed",
      detail: "Source candidates extracted from research distillation.",
      metadata: {
        sourceCount: sources.length,
        estimatedTokens,
        estimatedCostUsd,
      },
    });
    return {
      text,
      objective: objective.objective,
      queries: objective.queries,
      sources,
      estimatedTokens,
      estimatedCostUsd,
      provider: String(result.provider),
      model: result.model,
    };
  }

  private renderResearchPrompt(
    input: KnowledgeResearchRequest,
    objective: { objective: string; queries: string[] },
    budget: KnowledgeResearchBudget,
    spend: KnowledgeResearchSpend,
  ): string {
    return renderPromptTemplate(this.config.prompts.research.user, {
      objective: objective.objective,
      queriesJson: objective.queries,
      remainingSources: budget.maxSources - spend.sources,
      agentIntent: input.draft.identity.intent,
      mustDo: input.draft.identity.mustDo.join("; "),
      mustNotDo: input.draft.identity.mustNotDo.join("; "),
      documentsJson: input.documents.map(summarizeDocumentForResearch),
    });
  }

  private researchProfiles(settings?: { provider?: string }): LlmModelProfile[] {
    return this.config.profiles.filter((profile) => {
      return profile.roles.includes("builder.researcher") &&
        (!settings?.provider || profile.provider === settings.provider);
    });
  }
}
