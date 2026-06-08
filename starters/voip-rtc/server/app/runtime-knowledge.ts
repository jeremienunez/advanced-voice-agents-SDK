import type {
  SecretResolverPort,
} from "@voiceagentsdk/core/sdk";
import { VoyageEmbeddingPort } from "../builder/adapters/embeddings/voyage.js";
import { PostgresKnowledgeSearch } from "../adapters/postgres/knowledge-search.js";
import type { RuntimeKnowledge } from "../voice/types.js";
import { EnvDatabaseCredentialResolver } from "./env-database-credentials.js";
import { createEnvSecretResolver } from "../secrets/env-secret-resolver.js";

export interface RuntimeKnowledgeEnvInput {
  env?: Record<string, string | undefined>;
  secretResolver?: SecretResolverPort;
}

export function createRuntimeKnowledgeFromEnv(
  input: RuntimeKnowledgeEnvInput = {},
): RuntimeKnowledge {
  const env = input.env ?? Bun.env;
  const secretResolver = input.secretResolver ?? createEnvSecretResolver(env);
  const voyageApiKey = secretResolver.resolveSecret({
    ref: { name: "VOYAGE_API_KEY" },
    purpose: "runtime-knowledge-embeddings",
  });

  return {
    embeddings: new VoyageEmbeddingPort({
      apiKey: voyageApiKey,
      model: env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4-large",
      dimensions: Number(env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024),
    }),
    embeddingAvailable: Boolean(voyageApiKey),
    search: new PostgresKnowledgeSearch({
      databaseUrl: env.DATABASE_URL,
      credentialResolver: new EnvDatabaseCredentialResolver(env),
    }),
  };
}
