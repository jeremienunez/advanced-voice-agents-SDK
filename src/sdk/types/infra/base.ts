import type { JsonObject } from "../json.js";

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
