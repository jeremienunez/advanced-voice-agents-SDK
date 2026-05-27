import { PlainTextDocumentIngestion } from "./adapters/document-ingestion.js";
import { LlmKnowledgeResearch } from "./adapters/llm-knowledge-research.js";
import { LlmKnowledgeVerifier } from "./adapters/llm-knowledge-verifier.js";
import { LlmPromptPlanner } from "./adapters/llm-prompt-planner.js";
import { PlannedInfraProvisioner } from "./adapters/planned-infra-provisioner.js";
import { PostgresAgentDatabaseProvisioner } from "./adapters/postgres-database-provisioner.js";
import { PostgresPgVectorKnowledgeStore } from "./adapters/postgres-knowledge-store.js";
import { VoyageEmbeddingPort } from "./adapters/voyage-embeddings.js";
import {
  defaultResearchBudget,
  defaultToolRegistry,
  researchBudgetFromEnv,
  strategyLabels,
} from "./catalog.js";
import { IntentInfraPlanner } from "./domain/infra.js";
import { PlanOnlyInfraIacGenerator } from "./domain/infra-iac.js";
import { createBuilderLlmCatalog } from "./llm/profiles.js";
import { AdaptiveLlmModelResolver } from "./llm/resolver.js";
import { BuilderLlmTaskRunner } from "./llm/task-runner.js";
import { loadBuilderPromptLibrary } from "./prompts/template.js";
import type {
  AgentBuilderLlmProvider,
  LlmModelProfile,
  LlmTaskRole,
} from "@voiceagentsdk/core/sdk";
import type { BuilderConfig, BuilderServiceComposition } from "./types.js";

export function createBuilderServiceCompositionFromEnv(
  env: Record<string, string | undefined> = Bun.env,
): BuilderServiceComposition {
  const requestedResearchProvider = env.BUILDER_RESEARCH_PROVIDER;
  const kimiApiKey = env.KIMI_API_KEY ?? env.MOONSHOT_API_KEY;
  const kimiModel = env.KIMI_MODEL ?? "kimi-k2.6";
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
  const researchBudget = researchBudgetFromEnv(env);
  const promptLibrary = loadBuilderPromptLibrary();
  const llmCatalog = createBuilderLlmCatalog(env);
  const deepseekConfigured = Boolean(env.DEEPSEEK_API_KEY);
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
      knowledgeVerificationProvider,
      knowledgeVerificationModel,
      knowledgeVerificationPasses,
      researchBudget,
    },
    availability: {
      deepseek: deepseekConfigured,
      qwen: Boolean(env.QWEN_API_KEY ?? env.DASHSCOPE_API_KEY),
      kimi: Boolean(kimiApiKey),
      gemini: Boolean(env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY ??
        env.GOOGLE_GENERATIVE_AI_API_KEY),
      voyage: Boolean(env.VOYAGE_API_KEY),
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
      infraPlanner: new IntentInfraPlanner({
        computeTarget: env.BUILDER_INFRA_COMPUTE_TARGET,
        databaseUrl: env.DATABASE_URL,
        defaultVectorBackend: env.BUILDER_VECTOR_BACKEND,
        learningEnabled: env.AGENT_LEARNING_ENABLED ?? "true",
        learningMemoryTtlSeconds: env.AGENT_LEARNING_MEMORY_TTL_SECONDS,
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
      voyageConfigured: Boolean(env.VOYAGE_API_KEY),
      toolRegistry: defaultToolRegistry,
      availableSecretNames: configuredSecretNames(env),
    },
  };
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
