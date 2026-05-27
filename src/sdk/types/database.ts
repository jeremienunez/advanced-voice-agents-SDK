import type { DatabaseTableDefinition } from "./core.js";
import type { JsonObject } from "./json.js";
import type { StoreOperation } from "./store.js";
import type {
  KnowledgeChunkingPlan,
  KnowledgeGraphPlan,
} from "./builder.js";

export type DatabaseBuildStatus =
  | "planned"
  | "validated"
  | "applied"
  | "failed";

export type VectorizationIndexKind = "hnsw" | "ivfflat";

export interface VectorizationPlan {
  embeddingProvider: string;
  embeddingModel: string;
  dimensions: number;
  sourceFields: string[];
  metadataFields: string[];
  retrievalMode: "vector" | "lexical" | "hybrid";
  chunking: KnowledgeChunkingPlan;
  index: {
    kind: VectorizationIndexKind;
    metric: "cosine" | "dot" | "euclidean";
    lists?: number;
    m?: number;
    efConstruction?: number;
  };
  rationale?: string;
}

export interface DatabaseSqlStatement {
  id: string;
  sql: string;
  purpose: string;
  riskLevel: "low" | "medium" | "high";
}

export interface DatabaseIndexPlan {
  id: string;
  table: string;
  kind: "primary" | "btree" | "gin" | "hnsw" | "ivfflat" | "custom";
  fields: string[];
  sql?: string;
}

export interface RepositorySafeOperationPlan {
  id: string;
  table: string;
  operations: StoreOperation[];
  filterFields: string[];
  sortFields: string[];
  maxPageSize: number;
  vectorSearch?: boolean;
  lexicalSearch?: boolean;
}

export interface RepositoryBuildPlan {
  repositories: RepositorySafeOperationPlan[];
  safetyRules: string[];
  rationale?: string;
}

export interface DatabaseBuildPlan {
  id: string;
  status: DatabaseBuildStatus;
  databaseProvider: "postgres-pgvector" | string;
  schemaName: string;
  sqlMigration: string;
  statements: DatabaseSqlStatement[];
  tables: DatabaseTableDefinition[];
  indexes: DatabaseIndexPlan[];
  vectorization: VectorizationPlan;
  kg: KnowledgeGraphPlan;
  repositories: RepositoryBuildPlan;
  reasons: string[];
  risks: string[];
  validationErrors?: string[];
  appliedAt?: string;
  raw?: JsonObject;
}
