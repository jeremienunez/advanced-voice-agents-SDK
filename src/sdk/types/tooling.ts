import type { JsonSchema } from "./json.js";
import type { SecretRef, ToolName } from "./core.js";

export type ToolSideEffect =
  | "none"
  | "read"
  | "write"
  | "external_action"
  | "handoff";

export type ToolReadiness = "ready" | "blocked" | "needs_configuration";

export interface ToolConfirmationPolicy {
  required: boolean;
  prompt?: string;
  reason?: string;
}

export interface ToolRuntimeBinding {
  handlerRef: string;
  timeoutMs?: number;
}

export interface ToolBuildContract {
  name: ToolName;
  title: string;
  description: string;
  category: string;
  permissions: string[];
  parameters: JsonSchema;
  outputSchema?: JsonSchema;
  sideEffect: ToolSideEffect;
  confirmation: ToolConfirmationPolicy;
  runtimeBinding: ToolRuntimeBinding;
  requiresKnowledge?: boolean;
  requiresGraph?: boolean;
  requiredSecrets?: SecretRef[];
  readiness: ToolReadiness;
  selected: boolean;
  reasons: string[];
}

export interface ToolBuildPlan {
  id: string;
  status: "planned" | "validated" | "failed";
  tools: ToolBuildContract[];
  selectedToolNames: ToolName[];
  warnings?: string[];
}

export interface ToolValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  toolName?: ToolName;
}

export interface ToolValidationReport {
  status: "valid" | "invalid";
  issues: ToolValidationIssue[];
  checkedAt: string;
}
