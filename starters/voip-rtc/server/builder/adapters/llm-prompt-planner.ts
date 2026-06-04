import type {
  AgentBuildDraft,
  DatabaseBuildPlan,
  DatabaseBuildRequest,
  DatabasePlannerPort,
  FinalPromptBuildRequest,
  KnowledgeBuildPlan,
  KnowledgeBuildRequest,
  KnowledgeDocument,
  LlmTask,
  LlmTaskRunnerPort,
  PromptBuildPlan,
  PromptBuildRequest,
  PromptPlannerPort,
} from "@voiceagentsdk/core/sdk";
import {
  fallbackDatabasePlan,
  normalizeDatabasePlan,
} from "../domain/database.js";
import {
  fallbackKnowledgePlan,
  normalizeKnowledgePlan,
} from "../domain/knowledge.js";
import { fallbackFinalPrompt, fallbackPromptPlan } from "../domain/prompt.js";
import type { BuilderPromptLibrary } from "../prompts/template.js";
import { renderPromptTemplate } from "../prompts/template.js";
import { parseJsonPayload } from "../utils/json-payload.js";

export class LlmPromptPlanner
  implements PromptPlannerPort, DatabasePlannerPort {
  constructor(
    private readonly config: {
      prompts: BuilderPromptLibrary;
      runner: LlmTaskRunnerPort;
    },
  ) {}

  async createPromptPlan(input: PromptBuildRequest): Promise<PromptBuildPlan> {
    const fallback = fallbackPromptPlan(input.draft);
    return this.requestJson<PromptBuildPlan>({
      draft: input.draft,
      fallback,
      maxOutputTokens: 1800,
      role: "builder.planner",
      skillRef: "builder.prompt_plan",
      system: this.config.prompts.promptPlan.system,
      user: renderPromptTemplate(this.config.prompts.promptPlan.user, {
        draftJson: input.draft,
      }),
    });
  }

  async createKnowledgePlan(
    input: KnowledgeBuildRequest,
  ): Promise<KnowledgeBuildPlan> {
    const fallback = fallbackKnowledgePlan(input.draft, input.documents);
    const documentSummary = input.documents.map((document) => ({
      id: document.id,
      name: document.name,
      kind: document.kind,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      excerpt: document.text?.slice(0, 1400),
    }));
    const result = await this.requestJson<KnowledgeBuildPlan>({
      draft: input.draft,
      fallback,
      maxOutputTokens: 2200,
      role: "builder.planner",
      skillRef: "builder.knowledge_plan",
      system: this.config.prompts.knowledgePlan.system,
      user: renderPromptTemplate(this.config.prompts.knowledgePlan.user, {
        draftIdentityJson: input.draft.identity,
        documentSummaryJson: documentSummary,
      }),
    });
    return normalizeKnowledgePlan(result, input.documents, fallback);
  }

  async composeFinalPrompt(input: FinalPromptBuildRequest): Promise<string> {
    const fallback = fallbackFinalPrompt(input.draft, input.selectedTools);
    const result = await this.requestJson<{ finalPrompt: string }>({
      draft: input.draft,
      fallback: { finalPrompt: fallback },
      maxOutputTokens: 2200,
      role: "builder.prompt_composer",
      skillRef: "builder.final_prompt",
      system: this.config.prompts.finalPrompt.system,
      user: renderPromptTemplate(this.config.prompts.finalPrompt.user, {
        compositionAttempt: input.compositionAttempt ?? 1,
        draftJson: input.draft,
        previousPrompt: input.previousPrompt ?? "",
        promptQualityFeedbackJson: input.promptQualityFeedback ?? [],
        selectedToolsJson: input.selectedTools,
      }),
    });
    return result.finalPrompt || fallback;
  }

  async createDatabasePlan(
    input: DatabaseBuildRequest,
  ): Promise<DatabaseBuildPlan> {
    const fallback = fallbackDatabasePlan(input);
    const documentSummary = input.documents.map(summarizeDocumentForDatabasePlanner);
    const result = await this.requestJson<DatabaseBuildPlan>({
      draft: input.draft,
      fallback,
      maxOutputTokens: 3000,
      role: "builder.database_planner",
      skillRef: "builder.database_plan",
      system: this.config.prompts.databasePlan.system,
      user: renderPromptTemplate(this.config.prompts.databasePlan.user, {
        schemaName: fallback.schemaName,
        draftIdentityJson: input.draft.identity,
        knowledgeStrategy: input.knowledgePlan?.strategy ?? "hybrid",
        documentSummaryJson: documentSummary,
      }),
    });
    return normalizeDatabasePlan(result, fallback);
  }

  private async requestJson<T>(input: {
    draft: AgentBuildDraft;
    fallback: T;
    maxOutputTokens: number;
    role: LlmTask["role"];
    skillRef: string;
    system: string;
    user: string;
  }): Promise<T> {
    const task: LlmTask = {
      id: `${input.skillRef}:${input.draft.id}`,
      role: input.role,
      intent: input.draft.identity.intent,
      skillRef: input.skillRef,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      outputContract: { kind: "json_object" },
      requestedModel: {
        provider: input.draft.identity.llmProvider,
        model: input.draft.identity.llmModel,
      },
      needs: {
        cost: "quality",
        latency: "batch",
        maxOutputTokens: input.maxOutputTokens,
        reasoning: "adaptive",
        tools: "none",
      },
      metadata: {
        draftId: input.draft.id,
      },
    };
    try {
      const result = await this.config.runner.run<T>(task);
      return result.parsed ?? parseJsonPayload<T>(result.content, input.fallback);
    } catch (error) {
      console.warn(`${input.skillRef} failed:`, error);
      return input.fallback;
    }
  }
}

function summarizeDocumentForDatabasePlanner(
  document: KnowledgeDocument,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    id: document.id,
    name: document.name,
    kind: document.kind,
    status: document.status,
  };
  if (document.metadata?.rowCount) summary.rowCount = document.metadata.rowCount;
  if (Array.isArray(document.metadata?.columns)) {
    summary.columns = document.metadata.columns.slice(0, 24);
  }
  if (document.metadata?.sheetNames) summary.sheetNames = document.metadata.sheetNames;
  if (document.metadata?.sourceCount) summary.sourceCount = document.metadata.sourceCount;
  if (document.text) summary.excerpt = document.text.slice(0, 420);
  return summary;
}
