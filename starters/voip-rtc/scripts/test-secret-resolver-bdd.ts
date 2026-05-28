import type {
  ProviderDefinition,
  SecretResolveInput,
} from "@voiceagentsdk/core/sdk";
import {
  createEnvSecretResolver,
  resolveRequiredSecret,
} from "../server/secrets/index.js";
import { createRuntimeKnowledgeFromEnv } from "../server/app/runtime-knowledge.js";
import { createBuilderLlmCatalog } from "../server/builder/llm/profiles.js";
import { createStarterProviderFactory } from "../server/providers/realtime-provider-factory.js";
import { assert } from "./shared/assertions.js";
import { runtimeProvider } from "./solid-seams/fixtures.js";

const observedInput: { value?: SecretResolveInput } = {};

const results = [
  scenarioEnvSecretResolverUsesRefAndAliases(),
  scenarioBuilderLlmCatalogUsesSecretResolver(),
  scenarioRuntimeKnowledgeUsesSecretResolver(),
  scenarioProviderFactoryUsesSecretResolverInsteadOfEnv(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioEnvSecretResolverUsesRefAndAliases(): string {
  const resolver = createEnvSecretResolver({
    PRIMARY_SECRET: "primary-value",
    ALIAS_SECRET: "alias-value",
  });
  const primary = resolveRequiredSecret(resolver, {
    ref: { name: "PRIMARY_SECRET" },
    aliases: ["ALIAS_SECRET"],
  });
  const alias = resolveRequiredSecret(resolver, {
    ref: { name: "MISSING_SECRET" },
    aliases: ["ALIAS_SECRET"],
  });
  const error = captureError(() =>
    resolveRequiredSecret(resolver, {
      ref: { name: "MISSING_SECRET" },
      aliases: ["MISSING_ALIAS"],
    })
  );

  assert(primary === "primary-value", "secret ref must win over aliases");
  assert(alias === "alias-value", "secret aliases must resolve as fallback");
  assert(
    error?.message === "Missing secret: MISSING_SECRET, MISSING_ALIAS",
    `missing secret errors must expose refs only, got: ${error?.message}`,
  );

  return "env-secret-resolver-ref-aliases";
}

function scenarioBuilderLlmCatalogUsesSecretResolver(): string {
  const catalog = createBuilderLlmCatalog({
    env: { DEEPSEEK_MODEL: "deepseek-test" },
    secretResolver: {
      resolveSecret: (input: SecretResolveInput) =>
        input.ref.name === "DEEPSEEK_API_KEY" ? "deepseek-secret" : undefined,
    },
  });

  assert(
    catalog.profiles.some((profile) =>
      profile.provider === "deepseek" && profile.configured
    ),
    "builder LLM catalog must mark resolver-backed providers configured",
  );
  assert(
    catalog.providerConfigs.deepseek?.apiKey === "deepseek-secret",
    "builder LLM catalog must use resolver-backed API keys",
  );

  return "builder-llm-catalog-uses-secret-resolver";
}

function scenarioRuntimeKnowledgeUsesSecretResolver(): string {
  const previous = Bun.env.VOYAGE_API_KEY;
  delete Bun.env.VOYAGE_API_KEY;

  try {
    const runtimeKnowledge = createRuntimeKnowledgeFromEnv({
      env: {
        VOYAGE_EMBEDDING_MODEL: "voyage-test",
        VOYAGE_EMBEDDING_DIMENSIONS: "256",
      },
      secretResolver: {
        resolveSecret: (input: SecretResolveInput) =>
          input.ref.name === "VOYAGE_API_KEY" ? "voyage-secret" : undefined,
      },
    });
    const embeddings = runtimeKnowledge.embeddings as unknown as {
      config?: { apiKey?: string; model?: string; dimensions?: number };
    };

    assert(
      runtimeKnowledge.embeddingAvailable,
      "runtime knowledge must expose resolver-backed embedding availability",
    );
    assert(
      embeddings.config?.apiKey === "voyage-secret",
      "runtime knowledge embeddings must use resolver-backed API key",
    );
    assert(
      embeddings.config?.model === "voyage-test" &&
        embeddings.config.dimensions === 256,
      "runtime knowledge must still read non-secret env config",
    );
  } finally {
    if (previous === undefined) delete Bun.env.VOYAGE_API_KEY;
    else Bun.env.VOYAGE_API_KEY = previous;
  }

  return "runtime-knowledge-uses-secret-resolver";
}

function scenarioProviderFactoryUsesSecretResolverInsteadOfEnv(): string {
  const envName = "SECRET_RESOLVER_ONLY_KEY";
  const previous = Bun.env[envName];
  delete Bun.env[envName];

  try {
    const provider = createStarterProviderFactory({
      providerCatalog: [runtimeProvider(envName)],
      secretResolver: {
        resolveSecret: (input: SecretResolveInput) => {
          observedInput.value = input;
          return "resolved-provider-key";
        },
      },
    }).createProvider({
      definition: providerDefinition(envName),
      instructions: "test instructions",
      tools: [],
    });
    const config = provider as unknown as { config?: { apiKey?: string } };

    assert(
      observedInput.value?.ref.name === envName,
      "secret resolver must receive the provider secret ref",
    );
    assert(
      observedInput.value?.aliases?.includes(envName),
      "secret resolver must receive provider env aliases",
    );
    assert(
      config.config?.apiKey === "resolved-provider-key",
      "provider factory must use the resolved secret value",
    );
  } finally {
    if (previous === undefined) delete Bun.env[envName];
    else Bun.env[envName] = previous;
  }

  return "provider-factory-uses-secret-resolver";
}

function providerDefinition(envName: string): ProviderDefinition {
  return {
    id: "gemini",
    kind: "gemini-live",
    model: "gemini-test",
    voice: "Puck",
    apiKey: { name: envName },
  };
}

function captureError(action: () => unknown): Error | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
