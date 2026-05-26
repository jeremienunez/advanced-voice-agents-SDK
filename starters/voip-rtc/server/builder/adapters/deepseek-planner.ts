import type {
  AgentBuildDraft,
  DatabaseBuildRequest,
  DatabaseBuildPlan,
  DatabasePlannerPort,
  FinalPromptBuildRequest,
  KnowledgeBuildPlan,
  KnowledgeBuildRequest,
  KnowledgeDocument,
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
import { parseJsonPayload } from "../utils.js";

export class DeepSeekPromptPlanner
  implements PromptPlannerPort, DatabasePlannerPort {
  constructor(
    private readonly config: {
      apiKey?: string;
      baseUrl: string;
      model: string;
      maxRetries: number;
      prompts: BuilderPromptLibrary;
    },
  ) {}

  async createPromptPlan(input: PromptBuildRequest): Promise<PromptBuildPlan> {
    const fallback = fallbackPromptPlan(input.draft);
    if (!this.config.apiKey) return fallback;

    return this.requestJson<PromptBuildPlan>({
      model: input.draft.identity.llmModel,
      system: this.config.prompts.promptPlan.system,
      user: renderPromptTemplate(this.config.prompts.promptPlan.user, {
        draftJson: input.draft,
      }),
      fallback,
      maxTokens: 1800,
    });
  }

  async createKnowledgePlan(
    input: KnowledgeBuildRequest,
  ): Promise<KnowledgeBuildPlan> {
    const fallback = fallbackKnowledgePlan(input.draft, input.documents);
    if (!this.config.apiKey) return fallback;

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
      model: input.draft.identity.llmModel,
      system: this.config.prompts.knowledgePlan.system,
      user: renderPromptTemplate(this.config.prompts.knowledgePlan.user, {
        draftIdentityJson: input.draft.identity,
        documentSummaryJson: documentSummary,
      }),
      fallback,
      maxTokens: 2200,
    });

    return normalizeKnowledgePlan(result, input.documents, fallback);
  }

  async composeFinalPrompt(input: FinalPromptBuildRequest): Promise<string> {
    const fallback = fallbackFinalPrompt(input.draft, input.selectedTools);
    if (!this.config.apiKey) return fallback;

    const result = await this.requestJson<{ finalPrompt: string }>({
      model: input.draft.identity.llmModel,
      system: this.config.prompts.finalPrompt.system,
      user: renderPromptTemplate(this.config.prompts.finalPrompt.user, {
        draftJson: input.draft,
        selectedToolsJson: input.selectedTools,
      }),
      fallback: { finalPrompt: fallback },
      maxTokens: 2200,
    });
    return result.finalPrompt || fallback;
  }

  async createDatabasePlan(
    input: DatabaseBuildRequest,
  ): Promise<DatabaseBuildPlan> {
    const fallback = fallbackDatabasePlan(input);
    if (!this.config.apiKey) return fallback;

    const documentSummary = input.documents.map(summarizeDocumentForDatabasePlanner);
    const result = await this.requestJson<DatabaseBuildPlan>({
      model: input.draft.identity.llmModel,
      system: this.config.prompts.databasePlan.system,
      user: renderPromptTemplate(this.config.prompts.databasePlan.user, {
        schemaName: fallback.schemaName,
        draftIdentityJson: input.draft.identity,
        knowledgeStrategy: input.knowledgePlan?.strategy ?? "hybrid",
        documentSummaryJson: documentSummary,
      }),
      fallback,
      maxTokens: 3000,
    });

    return normalizeDatabasePlan(result, fallback);
  }

  private async requestJson<T>(input: {
    model?: string;
    system: string;
    user: string;
    fallback: T;
    maxTokens?: number;
  }): Promise<T> {
    const maxAttempts = Math.max(1, this.config.maxRetries + 1);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.fetchJson(input);
        if (result.ok) return result.value;
        if (shouldRetryDeepSeekStatus(result.status, attempt, maxAttempts)) {
          console.warn(
            `DeepSeek planner retry ${attempt}/${maxAttempts}: ${result.status} ${result.detail}`,
          );
          await Bun.sleep(deepSeekRetryDelayMs(attempt));
          continue;
        }
        console.warn(`DeepSeek planner failed: ${result.status} ${result.detail}`);
        return input.fallback;
      } catch (error) {
        if (shouldRetryDeepSeekError(error, attempt, maxAttempts)) {
          console.warn(
            `DeepSeek planner retry ${attempt}/${maxAttempts}: ${String(error)}`,
          );
          await Bun.sleep(deepSeekRetryDelayMs(attempt));
          continue;
        }
        console.warn("DeepSeek planner failed:", error);
        return input.fallback;
      }
    }
    return input.fallback;
  }

  private async fetchJson<T>(
    input: {
      model?: string;
      system: string;
      user: string;
      fallback: T;
      maxTokens?: number;
    },
  ): Promise<{ ok: true; value: T } | { ok: false; status: number; detail: string }> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model || this.config.model,
        temperature: 0.2,
        max_tokens: input.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, detail: await response.text() };
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return {
      ok: true,
      value: content ? parseJsonPayload<T>(content, input.fallback) : input.fallback,
    };
  }
}

function shouldRetryDeepSeekStatus(
  status: number,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) return false;
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function shouldRetryDeepSeekError(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("EAI_AGAIN") ||
    message.includes("fetch failed") ||
    message.includes("socket connection was closed")
  );
}

function deepSeekRetryDelayMs(attempt: number): number {
  return Math.min(4000, 500 * 2 ** (attempt - 1));
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
