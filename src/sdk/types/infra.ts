import type { JsonObject } from "./json.js";
import type { InfraIacBundle } from "./iac.js";

export type AgentInfraStatus = "planned" | "validated" | "applied" | "failed";

export type InfraComputeTarget =
  | "local"
  | "vm"
  | "k3s"
  | "kubernetes"
  | "managed";

export type InfraIsolationMode =
  | "shared_cluster"
  | "namespace"
  | "dedicated_database"
  | "dedicated_vm"
  | "dedicated_cluster";

export type InfraProvisioningMode =
  | "manual"
  | "server_template"
  | "iac_plan"
  | "external";

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

export interface InfraResourceRef {
  kind: string;
  name: string;
  provider?: string;
  namespace?: string;
  externalId?: string;
  metadata?: JsonObject;
}

export interface DatabaseBackendPlan {
  id: string;
  provider: KnowledgeBackendProvider | string;
  configured: boolean;
  namespace: string;
  databaseName?: string;
  schemaName?: string;
  provisioningMode: InfraProvisioningMode;
  isolation: InfraIsolationMode;
  reason: string;
  requiredEnv?: string[];
  resources?: InfraResourceRef[];
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
}

export interface InfraMigrationPolicy {
  source: "server_owned_templates" | "iac_module" | "external";
  allowGeneratedSql: boolean;
  requiresApproval: boolean;
  versionTable?: string;
  notes?: string[];
}

export interface InfraSecurityPlan {
  tenantScoped: boolean;
  leastPrivilegeRole: boolean;
  secretRefs: string[];
  networkPolicy: "local_only" | "private_network" | "public_restricted";
  notes?: string[];
}

export interface AgentInfraPlan {
  id: string;
  draftId: string;
  status: AgentInfraStatus;
  computeTarget: InfraComputeTarget;
  isolation: InfraIsolationMode;
  provisioningMode: InfraProvisioningMode;
  defaultBackendId: string;
  database: DatabaseBackendPlan;
  knowledgeBackends: KnowledgeBackendPlan[];
  resources: InfraResourceRef[];
  migrationPolicy: InfraMigrationPolicy;
  security: InfraSecurityPlan;
  reasons: string[];
  warnings?: string[];
  iac?: InfraIacBundle;
  raw?: JsonObject;
}
