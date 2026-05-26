import { DeepSeekPromptPlanner } from "./adapters/deepseek-planner.js";
import { DeepSeekKnowledgeResearch } from "./adapters/deepseek-research.js";
import { PlainTextDocumentIngestion } from "./adapters/document-ingestion.js";
import { KimiKnowledgeVerifier } from "./adapters/kimi-knowledge-verifier.js";
import { PostgresAgentDatabaseProvisioner } from "./adapters/postgres-database-provisioner.js";
import { PostgresPgVectorKnowledgeStore } from "./adapters/postgres-knowledge-store.js";
import { VoyageEmbeddingPort } from "./adapters/voyage-embeddings.js";
import {
  defaultResearchBudget,
  defaultToolRegistry,
  researchBudgetFromEnv,
  strategyLabels,
} from "./catalog.js";
import { loadBuilderPromptLibrary } from "./prompts/template.js";
import type { BuilderConfig, BuilderServiceComposition } from "./types.js";
import { trimTrailingSlash } from "./utils.js";

export function createBuilderServiceCompositionFromEnv(
  env: Record<string, string | undefined> = Bun.env,
): BuilderServiceComposition {
  const deepseekModel = env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
  const deepseekBaseUrl = trimTrailingSlash(
    env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  );
  const researchProvider = env.BUILDER_RESEARCH_PROVIDER ?? "deepseek";
  const researchModel = env.BUILDER_RESEARCH_MODEL ?? deepseekModel;
  const kimiApiKey = env.KIMI_API_KEY ?? env.MOONSHOT_API_KEY;
  const kimiBaseUrl = trimTrailingSlash(
    env.KIMI_BASE_URL ?? env.MOONSHOT_BASE_URL ??
      "https://api.moonshot.ai/v1",
  );
  const kimiModel = env.KIMI_MODEL ?? "kimi-k2.6";
  const knowledgeVerificationProvider =
    env.BUILDER_KNOWLEDGE_VERIFICATION_PROVIDER ?? "kimi";
  const rawKnowledgeVerificationPasses = Number(
    env.BUILDER_KNOWLEDGE_VERIFICATION_PASSES ?? 3,
  );
  const knowledgeVerificationPasses = Number.isFinite(
    rawKnowledgeVerificationPasses,
  )
    ? rawKnowledgeVerificationPasses
    : 3;
  const voyageModel = env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4-large";
  const voyageDimensions = Number(env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024);
  const researchBudget = researchBudgetFromEnv(env);
  const promptLibrary = loadBuilderPromptLibrary();
  const deepseekConfigured = Boolean(env.DEEPSEEK_API_KEY);

  const config: BuilderConfig = {
    defaults: {
      deepseekModel,
      deepseekBaseUrl,
      promptProvider: "deepseek",
      researchProvider,
      researchModel,
      voyageEmbeddingModel: voyageModel,
      voyageEmbeddingDimensions: voyageDimensions,
      knowledgeVerificationProvider,
      knowledgeVerificationModel: kimiModel,
      knowledgeVerificationPasses,
      researchBudget,
    },
    availability: {
      deepseek: deepseekConfigured,
      voyage: Boolean(env.VOYAGE_API_KEY),
      knowledgeStore: Boolean(env.DATABASE_URL),
      databaseProvisioner: Boolean(env.DATABASE_URL),
      research: researchProvider === "deepseek" && deepseekConfigured,
      knowledgeVerifier: knowledgeVerificationProvider === "kimi" &&
        Boolean(kimiApiKey),
    },
    toolRegistry: defaultToolRegistry,
    strategies: strategyLabels,
    providers: {
      prompt: [
        {
          id: "deepseek",
          label: "DeepSeek",
          configured: deepseekConfigured,
          defaultModel: deepseekModel,
          models: uniqueList([deepseekModel, "deepseek-v4-pro"]),
        },
      ],
      research: [
        {
          id: "deepseek",
          label: "DeepSeek Knowledge Builder",
          configured: deepseekConfigured,
          defaultModel: researchModel,
          models: uniqueList([researchModel, deepseekModel, "deepseek-v4-pro"]),
          notes: [
            "Default builder/research engine. Add a search adapter later for fully grounded live web browsing.",
          ],
        },
      ],
      verification: [
        {
          id: "kimi",
          label: "Kimi 2.6 Thinking Teacher",
          configured: Boolean(kimiApiKey),
          defaultModel: kimiModel,
          models: uniqueList([kimiModel, "kimi-k2.6"]),
          notes: [
            "Teacher/verifier pass: audits coverage, proposes follow-up searches, and emits rich RAG artifacts.",
          ],
        },
      ],
    },
  };

  return {
    config,
    workflows: {
      planner: new DeepSeekPromptPlanner({
        apiKey: env.DEEPSEEK_API_KEY,
        baseUrl: deepseekBaseUrl,
        model: deepseekModel,
        maxRetries: Number(env.DEEPSEEK_MAX_RETRIES ?? 2),
        prompts: promptLibrary,
      }),
      embeddings: new VoyageEmbeddingPort({
        apiKey: env.VOYAGE_API_KEY,
        model: voyageModel,
        dimensions: voyageDimensions,
      }),
      ingestion: new PlainTextDocumentIngestion(),
      knowledgeStore: new PostgresPgVectorKnowledgeStore({
        databaseUrl: env.DATABASE_URL,
        dimensions: voyageDimensions,
      }),
      databaseProvisioner: new PostgresAgentDatabaseProvisioner({
        databaseUrl: env.DATABASE_URL,
      }),
      research: new DeepSeekKnowledgeResearch({
        apiKey: env.DEEPSEEK_API_KEY,
        baseUrl: deepseekBaseUrl,
        defaultModel: researchModel,
        estimatedCostPer1kTokens: Number(
          env.DEEPSEEK_RESEARCH_ESTIMATED_COST_PER_1K_TOKENS ?? 0.00014,
        ),
        prompts: promptLibrary,
      }),
      knowledgeVerifier: knowledgeVerificationProvider === "kimi"
        ? new KimiKnowledgeVerifier({
            apiKey: kimiApiKey,
            baseUrl: kimiBaseUrl,
            maxTokens: Number(env.KIMI_MAX_TOKENS ?? 16_384),
            model: kimiModel,
            prompts: promptLibrary,
          })
        : undefined,
      knowledgeVerificationPasses,
      deepseekModel,
      voyageConfigured: Boolean(env.VOYAGE_API_KEY),
      toolRegistry: defaultToolRegistry,
    },
  };
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
