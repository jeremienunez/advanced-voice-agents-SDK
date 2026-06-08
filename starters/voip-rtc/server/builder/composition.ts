import { PlainTextDocumentIngestion } from "./adapters/documents/plain-text-ingestion.js";
import { LlmKnowledgeResearch } from "./adapters/llm/knowledge-research.js";
import { LlmKnowledgeVerifier } from "./adapters/llm/knowledge-verifier.js";
import { LlmPromptPlanner } from "./adapters/llm/prompt-planner.js";
import { PlannedInfraProvisioner } from "./adapters/infra/planned-provisioner.js";
import { PostgresAgentDatabaseProvisioner } from "./adapters/postgres/database-provisioner.js";
import { PostgresPgVectorKnowledgeStore } from "./adapters/postgres/knowledge-store.js";
import { VoyageEmbeddingPort } from "./adapters/embeddings/voyage.js";
import {
  defaultResearchBudget,
  defaultToolRegistry,
  researchBudgetFromEnv,
  strategyLabels,
} from "./catalog.js";
import { IntentInfraPlanner } from "./domain/infra/planner.js";
import { PlanOnlyInfraIacGenerator } from "./domain/infra/iac-generator.js";
import { createBuilderLlmCatalog } from "./llm/profiles.js";
import { AdaptiveLlmModelResolver } from "./llm/resolver.js";
import { BuilderLlmTaskRunner } from "./llm/task-runner.js";
import { InMemoryDocumentIngestionQuota } from "./quotas/document-ingestion-quota.js";
import { loadBuilderPromptLibrary } from "./prompts/template.js";
import type {
  AgentBuilderLlmProvider,
  LlmModelProfile,
  LlmTaskRole,
} from "@voiceagentsdk/core/sdk";
import { runtimeToolHandlerRefs } from "../runtime/tools/handler-refs.js";
import { createEnvSecretResolver } from "../secrets/env-secret-resolver.js";
import type { BuilderConfig, BuilderServiceComposition } from "./types.js";

export function createBuilderServiceCompositionFromEnv(
  env: Record<string, string | undefined> = Bun.env,
): BuilderServiceComposition {
  const requestedResearchProvider = env.BUILDER_RESEARCH_PROVIDER;
  const kimiModel = env.KIMI_MODEL ?? "kimi-k2.6";
  const secretResolver = createEnvSecretResolver(env);
  const requestedKnowledgeVerificationProvider =
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
  const documentParseTimeoutMs = readPositiveNumber(
    env.BUILDER_DOCUMENT_PARSE_TIMEOUT_MS,
    5000,
  );
  const documentIngestionQuotaPerIp = readPositiveNumber(
    env.BUILDER_DOCUMENT_INGESTION_QUOTA_PER_IP,
    20,
  );
  const documentIngestionQuotaWindowMs = readPositiveNumber(
    env.BUILDER_DOCUMENT_INGESTION_QUOTA_WINDOW_MS,
    60_000,
  );
  const researchBudget = researchBudgetFromEnv(env);
  const promptLibrary = loadBuilderPromptLibrary();
  const llmCatalog = createBuilderLlmCatalog({ env, secretResolver });
  const voyageApiKey = secretResolver.resolveSecret({
    ref: { name: "VOYAGE_API_KEY" },
    purpose: "builder-voyage-embeddings",
  });
  const deepseekConfigured = Boolean(llmCatalog.providerConfigs.deepseek?.apiKey);
  const promptProfile = resolveRoleProfile(
    llmCatalog.profiles,
    "builder.planner",
    env.BUILDER_PROMPT_PROVIDER,
  );
  const promptProvider = String(
    promptProfile?.provider ?? llmCatalog.profiles[0]?.provider ?? "custom",
  ) as AgentBuilderLlmProvider;
  const promptModel = promptProfile?.model ?? llmCatalog.profiles[0]?.model ?? "";
  const researchProfile = resolveRoleProfile(
    llmCatalog.profiles,
    "builder.researcher",
    requestedResearchProvider,
  );
  const researchProvider = String(
    researchProfile?.provider ?? requestedResearchProvider ?? promptProvider,
  );
  const researchModel = env.BUILDER_RESEARCH_MODEL ??
    researchProfile?.model ?? promptModel;
  const knowledgeVerificationProfile = resolveRoleProfile(
    llmCatalog.profiles,
    "builder.verifier",
    requestedKnowledgeVerificationProvider,
  );
  const knowledgeVerificationProvider = String(
    knowledgeVerificationProfile?.provider ??
      requestedKnowledgeVerificationProvider,
  );
  const knowledgeVerificationModel =
    env.BUILDER_KNOWLEDGE_VERIFICATION_MODEL ??
      knowledgeVerificationProfile?.model ?? kimiModel;
  const resolver = new AdaptiveLlmModelResolver(llmCatalog.profiles);
  const llmRunner = new BuilderLlmTaskRunner({
    providerConfigs: llmCatalog.providerConfigs,
    resolver,
  });

  const config: BuilderConfig = {
    defaults: {
      promptProvider,
      promptModel,
      researchProvider,
      researchModel,
      voyageEmbeddingModel: voyageModel,
      voyageEmbeddingDimensions: voyageDimensions,
      documentParseTimeoutMs,
      documentIngestionQuotaPerIp,
      documentIngestionQuotaWindowMs,
      knowledgeVerificationProvider,
      knowledgeVerificationModel,
      knowledgeVerificationPasses,
      researchBudget,
    },
    availability: {
      deepseek: deepseekConfigured,
      qwen: Boolean(llmCatalog.providerConfigs.qwen?.apiKey),
      kimi: Boolean(llmCatalog.providerConfigs.kimi?.apiKey),
      gemini: Boolean(llmCatalog.providerConfigs.gemini?.apiKey),
      voyage: Boolean(voyageApiKey),
      knowledgeStore: Boolean(env.DATABASE_URL),
      databaseProvisioner: Boolean(env.DATABASE_URL),
      research: isRoleProviderConfigured(
        llmCatalog.profiles,
        researchProvider,
        "builder.researcher",
      ),
      knowledgeVerifier: isRoleProviderConfigured(
        llmCatalog.profiles,
        knowledgeVerificationProvider,
        "builder.verifier",
      ),
    },
    toolRegistry: defaultToolRegistry,
    strategies: strategyLabels,
    providers: {
      prompt: providerOptionsForRole(llmCatalog.profiles, "builder.planner", {
        [String(promptProvider)]: promptModel,
      }),
      research: providerOptionsForRole(llmCatalog.profiles, "builder.researcher", {
        [researchProvider]: researchModel,
      }),
      verification: providerOptionsForRole(llmCatalog.profiles, "builder.verifier", {
        [knowledgeVerificationProvider]: knowledgeVerificationModel,
      }),
    },
  };

  return {
    config,
    workflows: {
      planner: new LlmPromptPlanner({
        runner: llmRunner,
        prompts: promptLibrary,
      }),
      embeddings: new VoyageEmbeddingPort({
        apiKey: voyageApiKey,
        model: voyageModel,
        dimensions: voyageDimensions,
      }),
      ingestion: new PlainTextDocumentIngestion(),
      documentParseTimeoutMs,
      documentIngestionQuota: new InMemoryDocumentIngestionQuota({
        maxRequests: documentIngestionQuotaPerIp,
        windowMs: documentIngestionQuotaWindowMs,
      }),
      knowledgeStore: new PostgresPgVectorKnowledgeStore({
        databaseUrl: env.DATABASE_URL,
        dimensions: voyageDimensions,
      }),
      databaseProvisioner: new PostgresAgentDatabaseProvisioner({
        databaseUrl: env.DATABASE_URL,
      }),
      infraPlanner: new IntentInfraPlanner({
        computeTarget: env.BUILDER_INFRA_COMPUTE_TARGET,
        databaseUrl: env.DATABASE_URL,
        defaultVectorBackend: env.BUILDER_VECTOR_BACKEND,
        learningEnabled: env.AGENT_LEARNING_ENABLED ?? "true",
        learningMemoryTtlSeconds: env.AGENT_LEARNING_MEMORY_TTL_SECONDS,
        learningProfile: env.AGENT_LEARNING_PROFILE,
        graphUrl: env.NEO4J_URI ?? env.GRAPH_DATABASE_URL,
        isolation: env.BUILDER_INFRA_ISOLATION,
        milvusUrl: env.MILVUS_URL ?? env.MILVUS_ADDRESS,
        provisioningMode: env.BUILDER_INFRA_PROVISIONING_MODE,
        redisUrl: env.REDIS_URL,
        temporalAddress: env.TEMPORAL_ADDRESS,
        temporalNamespace: env.TEMPORAL_NAMESPACE,
        temporalTaskQueue: env.TEMPORAL_TASK_QUEUE,
      }),
      infraProvisioner: new PlannedInfraProvisioner(),
      infraIacGenerator: new PlanOnlyInfraIacGenerator(),
      research: new LlmKnowledgeResearch({
        profiles: llmCatalog.profiles,
        runner: llmRunner,
        estimatedCostPer1kTokens: Number(
          env.BUILDER_RESEARCH_ESTIMATED_COST_PER_1K_TOKENS ??
            env.DEEPSEEK_RESEARCH_ESTIMATED_COST_PER_1K_TOKENS ?? 0.00014,
        ),
        prompts: promptLibrary,
      }),
      knowledgeVerifier: new LlmKnowledgeVerifier({
        profiles: llmCatalog.profiles,
        runner: llmRunner,
        maxOutputTokens: Number(
          env.BUILDER_KNOWLEDGE_VERIFICATION_MAX_TOKENS ??
            env.KIMI_MAX_TOKENS ?? 65_536,
        ),
        prompts: promptLibrary,
      }),
      knowledgeVerificationPasses,
      knowledgeVerificationProvider,
      knowledgeVerificationModel,
      promptProvider,
      promptModel,
      researchProvider,
      researchModel,
      voyageConfigured: Boolean(voyageApiKey),
      toolRegistry: defaultToolRegistry,
      availableToolHandlerRefs: runtimeToolHandlerRefs(),
      availableSecretNames: configuredSecretNames(env),
    },
  };
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveRoleProfile(
  profiles: LlmModelProfile[],
  role: LlmTaskRole,
  requestedProvider: string | undefined,
) {
  const roleProfiles = profiles.filter((profile) => {
    return profile.roles.includes(role);
  });
  if (requestedProvider) {
    const requested = roleProfiles.find((profile) => {
      return profile.provider === requestedProvider;
    });
    if (requested) return requested;
  }
  return roleProfiles.find((profile) => profile.configured) ?? roleProfiles[0];
}

function isRoleProviderConfigured(
  profiles: LlmModelProfile[],
  provider: string,
  role: LlmTaskRole,
): boolean {
  return profiles.some((profile) => {
    return profile.provider === provider &&
      profile.roles.includes(role) &&
      profile.configured;
  });
}

function providerOptionsForRole(
  profiles: LlmModelProfile[],
  role: LlmTaskRole,
  modelOverrides: Record<string, string> = {},
) {
  return profiles
    .filter((profile) => profile.roles.includes(role))
    .map((profile) => {
      const id = String(profile.provider);
      const defaultModel = modelOverrides[id] || profile.model;
      return {
        id,
        label: profile.label,
        configured: profile.configured,
        defaultModel,
        models: uniqueList([defaultModel, profile.model]),
        notes: profile.notes,
      };
    });
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function configuredSecretNames(env: Record<string, string | undefined>): string[] {
  return Object.entries(env)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([name]) => name);
}
