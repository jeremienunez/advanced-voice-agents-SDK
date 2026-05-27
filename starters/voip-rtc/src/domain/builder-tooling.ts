export interface ToolBuildContract {
  name: string;
  title: string;
  description: string;
  category: string;
  permissions: string[];
  sideEffect: "none" | "read" | "write" | "external_action" | "handoff";
  readiness: "ready" | "blocked" | "needs_configuration";
  selected: boolean;
  reasons: string[];
  requiresKnowledge?: boolean;
  requiresGraph?: boolean;
  runtimeBinding: {
    handlerRef: string;
    timeoutMs?: number;
  };
  confirmation: {
    required: boolean;
    reason?: string;
  };
}

export interface ToolBuildPlan {
  id: string;
  status: "planned" | "validated" | "failed";
  selectedToolNames: string[];
  tools: ToolBuildContract[];
  warnings?: string[];
}

export interface ToolValidationReport {
  status: "valid" | "invalid";
  checkedAt: string;
  issues: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
    toolName?: string;
  }>;
}
