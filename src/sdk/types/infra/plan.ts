import type { InfraIacBundle } from "../iac.js";
import type { JsonObject } from "../json.js";
import type {
  AgentInfraStatus,
  InfraComputeTarget,
  InfraIsolationMode,
  InfraProvisioningMode,
  InfraResourceRef,
} from "./base.js";
import type { DatabaseBackendPlan, KnowledgeBackendPlan } from "./backends.js";
import type { AgentStorePlan } from "./learning-store.js";
import type { InfraMigrationPolicy, InfraSecurityPlan } from "./policies.js";

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
