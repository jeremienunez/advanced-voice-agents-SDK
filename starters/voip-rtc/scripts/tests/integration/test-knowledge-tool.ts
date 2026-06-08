import type { KnowledgeSearchResult } from "@voiceagentsdk/core/sdk";
import { PostgresKnowledgeSearch } from "../../../server/adapters/postgres/knowledge-search.js";
import { VoyageEmbeddingPort } from "../../../server/builder/adapters/embeddings/voyage.js";
import { EnvDatabaseCredentialResolver } from "../../../server/app/env-database-credentials.js";
import { activeCompiledDraft } from "../../../server/builder/state/active-draft.js";
import { runtimeAgentFromDraft } from "../../../server/runtime/compiled-agent.js";
import { runtimeKnowledgeTools } from "../../../server/runtime/knowledge-tools.js";
import { loadStarterEnv } from "../shared/env.js";

const env = await loadStarterEnv(import.meta.url);
const draft = activeCompiledDraft();
if (!draft?.compiled) fail("No active compiled draft");

const tools = runtimeKnowledgeTools(draft.id, {
  embeddings: new VoyageEmbeddingPort({
    apiKey: env.VOYAGE_API_KEY,
    model: env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4-large",
    dimensions: Number(env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024),
  }),
  embeddingAvailable: Boolean(env.VOYAGE_API_KEY),
  search: new PostgresKnowledgeSearch({
    databaseUrl: env.DATABASE_URL,
    credentialResolver: new EnvDatabaseCredentialResolver(env),
  }),
  getAgent: () => runtimeAgentFromDraft(draft),
});

const tool = tools.find((item) => item.name === "search_knowledge");
if (!tool) fail("search_knowledge runtime tool is not available");

const query = env.KNOWLEDGE_TOOL_TEST_QUERY ?? "route des vins Bordeaux";
const mode = env.VOYAGE_API_KEY ? "hybrid" : "lexical";
const result = (await tool.execute({ query, mode, limit: 4 }, {
  sessionId: "knowledge_tool_test",
  tenantId: "local",
  userId: "test",
  providerId: "gemini",
})) as KnowledgeSearchResult;

if (result.status !== "ok" || result.resultCount < 1) {
  fail(`Knowledge search returned no usable result: ${JSON.stringify(result)}`);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      draftId: draft.id,
      query,
      mode: result.mode,
      resultCount: result.resultCount,
      topResult: {
        documentName: result.results[0]?.documentName,
        score: result.results[0]?.score,
        preview: result.results[0]?.content.slice(0, 180),
      },
      toolNames: tools.map((item) => item.name),
    },
    null,
    2,
  ),
);

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
