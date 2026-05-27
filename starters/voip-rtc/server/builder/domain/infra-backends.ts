import type {
  DatabaseBackendPlan,
  InfraIsolationMode,
  InfraProvisioningMode,
  KnowledgeBackendPlan,
} from "@voiceagentsdk/core/sdk";
import type { IntentInfraPlannerOptions } from "./infra-routing.js";

export interface BackendPlanInput {
  options: IntentInfraPlannerOptions;
  schemaName: string;
  isolation: InfraIsolationMode;
  provisioningMode: InfraProvisioningMode;
}

export function createDatabaseBackend(
  input: BackendPlanInput,
): DatabaseBackendPlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  return {
    id: "postgres-primary",
    provider: "postgres-pgvector",
    configured: Boolean(options.databaseUrl),
    namespace: schemaName,
    schemaName,
    provisioningMode,
    isolation,
    reason: "Durable source-of-truth store for agent knowledge, metadata, and pgvector fallback.",
    requiredEnv: ["DATABASE_URL"],
    resources: [{
      kind: "postgres-schema",
      name: schemaName,
      provider: "postgres-pgvector",
      namespace: schemaName,
    }],
  };
}

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

export function resolveDefaultBackendId(
  backends: KnowledgeBackendPlan[],
  explicitMilvus: boolean,
  wantsVectorScale: boolean,
): string {
  const milvus = backends.find((backend) => backend.id === "milvus-vector");
  if (explicitMilvus && milvus) return milvus.id;
  if (wantsVectorScale && milvus?.configured) return milvus.id;
  return "postgres-primary";
}
