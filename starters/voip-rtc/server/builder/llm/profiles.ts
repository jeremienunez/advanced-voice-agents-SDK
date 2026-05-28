import type {
  LlmLatencyNeed,
  LlmModelCapabilities,
  LlmModelProfile,
  LlmProviderId,
  LlmTaskRole,
  SecretResolverPort,
} from "@voiceagentsdk/core/sdk";
import { trimTrailingSlash } from "../utils/url-format.js";

const builderRoles: LlmTaskRole[] = [
  "builder.planner",
  "builder.prompt_composer",
  "builder.database_planner",
  "builder.tool_planner",
];

const verifierRoles: LlmTaskRole[] = ["builder.verifier"];
const researcherRoles: LlmTaskRole[] = ["builder.researcher"];

const chatCapabilities: LlmModelCapabilities = {
  chat: true,
  structuredOutput: true,
  jsonSchema: false,
  toolCalling: true,
  streaming: true,
  reasoning: true,
  reasoningBudget: false,
  realtimeAudio: false,
};

export interface BuilderLlmProviderConfig {
  apiKey?: string;
  baseUrl: string;
  defaultModel: string;
  maxRetries: number;
  provider: LlmProviderId;
}

export interface BuilderLlmCatalog {
  profiles: LlmModelProfile[];
  providerConfigs: Partial<Record<LlmProviderId, BuilderLlmProviderConfig>>;
}

export interface BuilderLlmCatalogInput {
  env: Record<string, string | undefined>;
  secretResolver?: SecretResolverPort;
}

export function createBuilderLlmCatalog(
  input: Record<string, string | undefined> | BuilderLlmCatalogInput,
): BuilderLlmCatalog {
  const { env, secretResolver } = normalizeInput(input);
  const deepseekModel = env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
  const qwenModel = env.QWEN_MODEL ?? env.DASHSCOPE_MODEL ?? "qwen-plus";
  const kimiModel = env.KIMI_MODEL ?? env.MOONSHOT_MODEL ?? "kimi-k2.6";
  const geminiModel = env.GEMINI_TEXT_MODEL ?? env.BUILDER_GEMINI_MODEL ??
    "gemini-3.5-flash";
  const deepseekBaseUrl = trimTrailingSlash(
    env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  );
  const qwenBaseUrl = trimTrailingSlash(
    env.QWEN_BASE_URL ?? env.DASHSCOPE_BASE_URL ??
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  );
  const kimiBaseUrl = trimTrailingSlash(
    env.KIMI_BASE_URL ?? env.MOONSHOT_BASE_URL ??
      "https://api.moonshot.ai/v1",
  );
  const geminiBaseUrl = trimTrailingSlash(
    env.GEMINI_API_BASE_URL ?? "https://generativelanguage.googleapis.com",
  );
  const deepseekApiKey = resolveSecret(secretResolver, env, "DEEPSEEK_API_KEY");
  const qwenApiKey = resolveSecret(secretResolver, env, "QWEN_API_KEY", [
    "DASHSCOPE_API_KEY",
  ]);
  const kimiApiKey = resolveSecret(secretResolver, env, "KIMI_API_KEY", [
    "MOONSHOT_API_KEY",
  ]);
  const geminiApiKey = resolveSecret(secretResolver, env, "GEMINI_API_KEY", [
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
  ]);

  const profiles: LlmModelProfile[] = [
    profile({
      provider: "deepseek",
      model: deepseekModel,
      label: "DeepSeek",
      configured: Boolean(deepseekApiKey),
      roles: [...builderRoles, ...researcherRoles, ...verifierRoles],
      capabilities: chatCapabilities,
      latencyClass: "batch",
      notes: [
        "OpenAI-compatible builder model with provider-specific thinking controls.",
      ],
    }),
    profile({
      provider: "qwen",
      model: qwenModel,
      label: "Qwen",
      configured: Boolean(qwenApiKey),
      roles: [...builderRoles, ...researcherRoles, ...verifierRoles],
      capabilities: {
        ...chatCapabilities,
        jsonSchema: true,
        reasoningBudget: true,
      },
      latencyClass: "batch",
      notes: [
        "OpenAI-compatible Model Studio adapter; structured output disables thinking.",
      ],
    }),
    profile({
      provider: "kimi",
      model: kimiModel,
      label: "Kimi",
      configured: Boolean(kimiApiKey),
      roles: [...builderRoles, ...researcherRoles, ...verifierRoles],
      capabilities: {
        ...chatCapabilities,
        jsonSchema: true,
      },
      latencyClass: "batch",
      notes: [
        "OpenAI-compatible teacher/verifier model; sampling params are mostly provider-owned.",
      ],
    }),
    profile({
      provider: "gemini",
      model: geminiModel,
      label: "Gemini",
      configured: Boolean(geminiApiKey),
      roles: [...builderRoles, ...verifierRoles],
      capabilities: {
        chat: true,
        structuredOutput: true,
        jsonSchema: true,
        toolCalling: true,
        streaming: true,
        reasoning: true,
        reasoningBudget: true,
        realtimeAudio: false,
      },
      latencyClass: "interactive",
      notes: [
        "Business-approved planner option; text uses Gemini contents/parts, voice stays on Live.",
      ],
    }),
  ];

  return {
    profiles,
    providerConfigs: {
      deepseek: {
        apiKey: deepseekApiKey,
        baseUrl: deepseekBaseUrl,
        defaultModel: deepseekModel,
        maxRetries: Number(env.DEEPSEEK_MAX_RETRIES ?? 2),
        provider: "deepseek",
      },
      qwen: {
        apiKey: qwenApiKey,
        baseUrl: qwenBaseUrl,
        defaultModel: qwenModel,
        maxRetries: Number(env.QWEN_MAX_RETRIES ?? 2),
        provider: "qwen",
      },
      kimi: {
        apiKey: kimiApiKey,
        baseUrl: kimiBaseUrl,
        defaultModel: kimiModel,
        maxRetries: Number(env.KIMI_MAX_RETRIES ?? 2),
        provider: "kimi",
      },
      gemini: {
        apiKey: geminiApiKey,
        baseUrl: geminiBaseUrl,
        defaultModel: geminiModel,
        maxRetries: Number(env.GEMINI_MAX_RETRIES ?? 2),
        provider: "gemini",
      },
    },
  };
}

function normalizeInput(
  input: Record<string, string | undefined> | BuilderLlmCatalogInput,
): BuilderLlmCatalogInput {
  if (isCatalogInput(input)) return input;
  return { env: input };
}

function isCatalogInput(
  input: Record<string, string | undefined> | BuilderLlmCatalogInput,
): input is BuilderLlmCatalogInput {
  return typeof (input as BuilderLlmCatalogInput).env === "object";
}

function resolveSecret(
  resolver: SecretResolverPort | undefined,
  env: Record<string, string | undefined>,
  name: string,
  aliases: readonly string[] = [],
): string | undefined {
  if (resolver) {
    return resolver.resolveSecret({
      ref: { name },
      aliases,
      purpose: "builder-llm-api-key",
    });
  }
  for (const candidate of [name, ...aliases]) {
    const value = env[candidate];
    if (value) return value;
  }
  return undefined;
}

function profile(input: {
  capabilities: LlmModelCapabilities;
  configured: boolean;
  label: string;
  latencyClass: LlmLatencyNeed;
  model: string;
  notes: string[];
  provider: LlmProviderId;
  roles: LlmTaskRole[];
}): LlmModelProfile {
  return {
    id: `${input.provider}:${input.model}`,
    provider: input.provider,
    model: input.model,
    label: input.label,
    roles: input.roles,
    configured: input.configured,
    capabilities: input.capabilities,
    costClass: "balanced",
    latencyClass: input.latencyClass,
    notes: input.notes,
  };
}
