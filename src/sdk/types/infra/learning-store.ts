import type {
  InfraIsolationMode,
  InfraProvisioningMode,
  InfraResourceRef,
} from "./base.js";
import type { AdapterOwnershipBoundary } from "./ownership.js";

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
