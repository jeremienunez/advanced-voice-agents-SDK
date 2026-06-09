import type {
  InfraIsolationMode,
  InfraProvisioningMode,
  InfraResourceRef,
  RuntimeDatabaseCredentialRef,
} from "./base.js";
import type { AdapterOwnershipBoundary } from "./ownership.js";

export type KnowledgeBackendProvider =
  | "postgres-pgvector"
  | "milvus"
  | "graph"
  | "redis"
  | "custom";

export type KnowledgeBackendRole =
  | "source_of_truth"
  | "vector_index"
  | "graph_index"
  | "cache";

export type KnowledgeBackendCapability =
  | "sql"
  | "lexical_search"
  | "vector_search"
  | "hybrid_search"
  | "graph_search"
  | "metadata_filter"
  | "cache";

export interface DatabaseBackendPlan {
  id: string;
  provider: KnowledgeBackendProvider | string;
  configured: boolean;
  namespace: string;
  databaseName?: string;
  schemaName?: string;
  runtimeCredentialRef?: RuntimeDatabaseCredentialRef;
  provisioningMode: InfraProvisioningMode;
  isolation: InfraIsolationMode;
  reason: string;
  requiredEnv?: string[];
  resources?: InfraResourceRef[];
  adapterBoundary?: AdapterOwnershipBoundary;
}

export interface KnowledgeBackendPlan {
  id: string;
  provider: KnowledgeBackendProvider | string;
  role: KnowledgeBackendRole;
  configured: boolean;
  namespace: string;
  required: boolean;
  capabilities: KnowledgeBackendCapability[];
  provisioningMode: InfraProvisioningMode;
  isolation: InfraIsolationMode;
  reason: string;
  requiredEnv?: string[];
  resources?: InfraResourceRef[];
  adapterBoundary?: AdapterOwnershipBoundary;
}
