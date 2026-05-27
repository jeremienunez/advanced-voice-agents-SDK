import { VoyageEmbeddingPort } from "../builder/adapters/voyage-embeddings.js";
import { PostgresKnowledgeSearch } from "../adapters/postgres/knowledge-search.js";
import type { RuntimeKnowledge } from "../voice/types.js";

export function createRuntimeKnowledgeFromEnv(): RuntimeKnowledge {
  return {
    embeddings: new VoyageEmbeddingPort({
      apiKey: Bun.env.VOYAGE_API_KEY,
      model: Bun.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4-large",
      dimensions: Number(Bun.env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024),
    }),
    embeddingAvailable: Boolean(Bun.env.VOYAGE_API_KEY),
    search: new PostgresKnowledgeSearch({
      databaseUrl: Bun.env.DATABASE_URL,
    }),
  };
}
