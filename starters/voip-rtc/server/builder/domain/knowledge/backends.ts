import type { KnowledgeBackendPlan } from "@voiceagentsdk/core/sdk";
import type { BackendPlanInput } from "../infra/backend-input.js";
import { plannedStarterAdapterBoundary } from "../shared/adapter-boundary.js";

export function createPostgresKnowledgeBackend(
  input: BackendPlanInput,
): KnowledgeBackendPlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  return {
    id: "postgres-primary",
    provider: "postgres-pgvector",
    role: "source_of_truth",
    configured: Boolean(options.databaseUrl),
    namespace: schemaName,
    required: true,
    capabilities: [
      "sql",
      "lexical_search",
      "vector_search",
      "hybrid_search",
      "metadata_filter",
    ],
    provisioningMode,
    isolation,
    reason: "Default backend for source documents, chunks, lexical search, and pgvector retrieval.",
    requiredEnv: ["DATABASE_URL"],
  };
}

export function createMilvusBackend(
  input: BackendPlanInput,
  required: boolean,
): KnowledgeBackendPlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  return {
    id: "milvus-vector",
    provider: "milvus",
    role: "vector_index",
    configured: Boolean(options.milvusUrl),
    namespace: `${schemaName}_vectors`,
    required,
    capabilities: ["vector_search", "metadata_filter"],
    provisioningMode,
    isolation,
    reason: "Dedicated vector index for larger corpora or explicit Milvus routing.",
    requiredEnv: ["MILVUS_URL", "MILVUS_ADDRESS"],
    adapterBoundary: plannedStarterAdapterBoundary("milvus"),
  };
}

export function createGraphBackend(
  input: BackendPlanInput,
): KnowledgeBackendPlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  return {
    id: "graph-index",
    provider: "graph",
    role: "graph_index",
    configured: Boolean(options.graphUrl),
    namespace: `${schemaName}_graph`,
    required: false,
    capabilities: ["graph_search", "metadata_filter"],
    provisioningMode,
    isolation,
    reason: "Optional graph index for entity and relationship traversal.",
    requiredEnv: ["NEO4J_URI", "GRAPH_DATABASE_URL"],
    adapterBoundary: plannedStarterAdapterBoundary("graph"),
  };
}

export function createRedisBackend(
  input: BackendPlanInput,
): KnowledgeBackendPlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  return {
    id: "redis-cache",
    provider: "redis",
    role: "cache",
    configured: Boolean(options.redisUrl),
    namespace: `${schemaName}_cache`,
    required: false,
    capabilities: ["cache"],
    provisioningMode,
    isolation,
    reason: "Optional cache namespace for sessions, hot retrieval results, or orchestration state.",
    requiredEnv: ["REDIS_URL"],
  };
}
