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

export type AgentLearningScope = "agent" | "user";

export type AgentLearningStoreKind =
  | "temporal_workflow"
  | "temporal_memory"
  | "graph_memory"
  | "audit_source"
  | "vector_memory";

export type AgentLearningStoreCapability =
  | "workflow_queue"
  | "session_window"
  | "ttl"
  | "fact_memory"
  | "preference_memory"
  | "entity_graph"
  | "relation_graph"
  | "audit_log"
  | "source_archive"
  | "vector_search";

export type AdapterBoundaryOwner = "sdk" | "starter";

export type AdapterBindingMode = "runtime_adapter" | "planned_only";

export type AdapterPromotionPath =
  | "stay_starter"
  | "candidate_sdk_package"
  | "sdk_package";

export interface AdapterOwnershipBoundary {
  owner: AdapterBoundaryOwner;
  binding: AdapterBindingMode;
  promotion: AdapterPromotionPath;
  reason: string;
  promotionCriteria: string[];
}

export interface AgentLearningStoreBackendPlan {
  id: string;
  kind: AgentLearningStoreKind;
  provider: string;
  configured: boolean;
  required: boolean;
  namespace: string;
  provisioningMode: InfraProvisioningMode;
  isolation: InfraIsolationMode;
  createOn: "session_end";
  capabilities: AgentLearningStoreCapability[];
  reason: string;
  requiredEnv?: string[];
  resources?: InfraResourceRef[];
  adapterBoundary?: AdapterOwnershipBoundary;
  ttlSeconds?: number;
}

export interface AgentLearningGuardrails {
  appendOnlyVersions: boolean;
  rollbackPointer: boolean;
  auditEveryChange: boolean;
  redactSecrets: boolean;
  destructiveInfraMigrations: "forbidden" | "approval_required";
}

export interface AgentStorePlan {
  enabled: boolean;
  scopes: AgentLearningScope[];
  createOn: "session_end";
  temporalWorkflow: AgentLearningStoreBackendPlan;
  temporalMemory: AgentLearningStoreBackendPlan;
  graphMemory: AgentLearningStoreBackendPlan;
  auditStore: AgentLearningStoreBackendPlan;
  vectorBackend?: AgentLearningStoreBackendPlan;
  guardrails: AgentLearningGuardrails;
  reasons: string[];
  warnings?: string[];
}

export interface InfraResourceRef {
  kind: string;
  name: string;
  provider?: string;
  namespace?: string;
  externalId?: string;
  metadata?: JsonObject;
}

export interface RuntimeDatabaseCredentialRef {
  name: string;
  provider: string;
  scope: "agent";
  schemaName: string;
  roleName: string;
  envName: string;
}

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
  storePlan?: AgentStorePlan;
  reasons: string[];
  warnings?: string[];
  iac?: InfraIacBundle;
  raw?: JsonObject;
}
