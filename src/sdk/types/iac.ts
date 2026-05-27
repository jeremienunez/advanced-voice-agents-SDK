import type { JsonObject } from "./json.js";
import type { InfraComputeTarget } from "./infra.js";

export type InfraIacDialect =
  | "json-plan"
  | "cloud-init"
  | "kubernetes"
  | "k3s"
  | "opentofu";

export type InfraIacArtifactKind =
  | "plan"
  | "manifest"
  | "variables"
  | "bootstrap";

export interface InfraIacArtifact {
  path: string;
  kind: InfraIacArtifactKind;
  dialect: InfraIacDialect;
  contentType: "application/json" | "text/yaml" | "text/plain";
  content: string;
  sensitive: boolean;
  description: string;
  metadata?: JsonObject;
}

export interface InfraIacBundle {
  id: string;
  planId: string;
  target: InfraComputeTarget;
  applyMode: "manual" | "external";
  generatedAt: string;
  artifacts: InfraIacArtifact[];
  notes: string[];
  warnings?: string[];
}
