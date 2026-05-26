import type {
  KnowledgeDocument,
  KnowledgeVerificationRequest,
  KnowledgeVerificationVerdict,
  KnowledgeVerifierPort,
} from "@voiceagentsdk/core/sdk";
import type { BuilderPromptLibrary } from "../prompts/template.js";
import { renderPromptTemplate } from "../prompts/template.js";
import { parseJsonPayload } from "../utils.js";

export class KimiKnowledgeVerifier implements KnowledgeVerifierPort {
  constructor(
    private readonly config: {
      apiKey?: string;
      baseUrl: string;
      maxTokens: number;
      model: string;
      prompts: BuilderPromptLibrary;
    },
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async verifyKnowledge(
    input: KnowledgeVerificationRequest,
  ): Promise<KnowledgeVerificationVerdict> {
    if (!this.isConfigured()) return fallbackVerdict("Kimi is not configured.");
    const user = renderPromptTemplate(
      this.config.prompts.knowledgeVerification.user,
      {
        draftJson: input.draft,
        documentsJson: input.documents.map(summarizeDocument),
        researchJson: input.research ?? null,
      },
    );
    const fallback = fallbackVerdict("Kimi returned an invalid verdict.");
    const model = input.settings?.model || this.config.model;
    const content = await this.fetchVerdict(user, true, model).catch(async (error) => {
      if (!isResponseFormatError(error)) throw error;
      return this.fetchVerdict(user, false, model);
    });
    const parsed = parseJsonPayload<KnowledgeVerificationVerdict>(
      content,
      fallback,
    );
    return normalizeVerdict(parsed, fallback);
  }

  private async fetchVerdict(
    user: string,
    responseFormat: boolean,
    model = this.config.model,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.15,
      max_tokens: this.config.maxTokens,
      messages: [
        {
          role: "system",
          content: this.config.prompts.knowledgeVerification.system,
        },
        { role: "user", content: user },
      ],
    };
    if (responseFormat) body.response_format = { type: "json_object" };
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `Kimi verifier failed: ${response.status} ${await response.text()}`,
      );
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content?.trim() || "{}";
  }
}

function summarizeDocument(document: KnowledgeDocument) {
  return {
    id: document.id,
    name: document.name,
    kind: document.kind,
    status: document.status,
    metadata: document.metadata,
    excerpt: document.text?.slice(0, 4000),
  };
}

function fallbackVerdict(reason: string): KnowledgeVerificationVerdict {
  return {
    status: "needs_more_data",
    confidence: 0.35,
    reasons: [reason],
    missingTopics: ["teacher verification", "source coverage"],
    recommendedQueries: [],
    coverageMatrix: [],
    artifactTables: [],
    warnings: [reason],
  };
}

function normalizeVerdict(
  verdict: KnowledgeVerificationVerdict,
  fallback: KnowledgeVerificationVerdict,
): KnowledgeVerificationVerdict {
  const status = ["sufficient", "needs_more_data", "failed"].includes(
    verdict.status,
  )
    ? verdict.status
    : fallback.status;
  return {
    status,
    confidence: clampConfidence(verdict.confidence),
    reasons: stringList(verdict.reasons, fallback.reasons),
    missingTopics: stringList(verdict.missingTopics, fallback.missingTopics),
    recommendedQueries: stringList(verdict.recommendedQueries, []),
    coverageMatrix: Array.isArray(verdict.coverageMatrix)
      ? verdict.coverageMatrix
      : [],
    artifactTables: Array.isArray(verdict.artifactTables)
      ? verdict.artifactTables
      : [],
    enrichmentMarkdown: typeof verdict.enrichmentMarkdown === "string"
      ? verdict.enrichmentMarkdown
      : undefined,
    warnings: stringList(verdict.warnings, []),
    raw: verdict.raw,
  };
}

function stringList(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.35;
  return Math.min(Math.max(value, 0), 1);
}

function isResponseFormatError(error: unknown): boolean {
  return error instanceof Error &&
    /response_format|json_object|400/.test(error.message);
}
