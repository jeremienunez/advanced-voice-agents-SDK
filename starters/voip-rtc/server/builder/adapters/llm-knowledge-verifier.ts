import type {
  KnowledgeDocument,
  KnowledgeVerificationRequest,
  KnowledgeVerificationVerdict,
  KnowledgeVerifierPort,
  LlmModelProfile,
  LlmTaskRunnerPort,
} from "@voiceagentsdk/core/sdk";
import type { BuilderPromptLibrary } from "../prompts/template.js";
import { renderPromptTemplate } from "../prompts/template.js";
import { parseJsonPayload } from "../utils/json-payload.js";

export class LlmKnowledgeVerifier implements KnowledgeVerifierPort {
  constructor(
    private readonly config: {
      maxOutputTokens: number;
      profiles: LlmModelProfile[];
      prompts: BuilderPromptLibrary;
      runner: LlmTaskRunnerPort;
    },
  ) {}

  isConfigured(settings?: { provider?: string }): boolean {
    return this.verifierProfiles(settings).some((profile) => profile.configured);
  }

  async verifyKnowledge(
    input: KnowledgeVerificationRequest,
  ): Promise<KnowledgeVerificationVerdict> {
    if (!this.isConfigured(input.settings)) {
      return fallbackVerdict("Knowledge verifier provider is not configured.");
    }
    const user = renderPromptTemplate(
      this.config.prompts.knowledgeVerification.user,
      {
        draftJson: input.draft,
        documentsJson: input.documents.map(summarizeDocument),
        researchJson: input.research ?? null,
      },
    );
    const fallback = fallbackVerdict("Verifier returned an invalid verdict.");
    try {
      const result = await this.config.runner.run<KnowledgeVerificationVerdict>({
        id: `builder.verifier:${input.draft.id}:${crypto.randomUUID()}`,
        role: "builder.verifier",
        intent: input.draft.identity.intent,
        skillRef: "builder.knowledge_verification",
        messages: [
          {
            role: "system",
            content: this.config.prompts.knowledgeVerification.system,
          },
          { role: "user", content: user },
        ],
        outputContract: { kind: "json_object" },
        requestedModel: {
          provider: input.settings?.provider,
          model: input.settings?.model,
        },
        needs: {
          cost: "quality",
          latency: "batch",
          maxOutputTokens: this.config.maxOutputTokens,
          reasoning: "adaptive",
          tools: "none",
        },
        metadata: {
          draftId: input.draft.id,
          documentCount: input.documents.length,
        },
      });
      const parsed = result.parsed ??
        parseJsonPayload<KnowledgeVerificationVerdict>(result.content, fallback);
      return normalizeVerdict(parsed, fallback);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verifier failed.";
      return fallbackVerdict(message);
    }
  }

  private verifierProfiles(settings?: { provider?: string }): LlmModelProfile[] {
    return this.config.profiles.filter((profile) => {
      return profile.roles.includes("builder.verifier") &&
        (!settings?.provider || profile.provider === settings.provider);
    });
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
