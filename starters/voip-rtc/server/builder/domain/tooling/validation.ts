import type {
  AgentBuildDraft,
  ToolBuildContract,
  ToolBuildPlan,
  ToolValidationIssue,
  ToolValidationReport,
} from "@voiceagentsdk/core/sdk";

const runtimeHandlers = new Set([
  "knowledge.search",
  "summary.create",
  "handoff.create",
  "task.schedule",
  "event.emit",
]);

export function validateToolBuildPlan(
  draft: AgentBuildDraft,
  plan: ToolBuildPlan,
  availableSecrets: Set<string>,
): ToolValidationReport {
  const issues: ToolValidationIssue[] = [];
  const toolsByName = new Map(plan.tools.map((tool) => [tool.name, tool]));

  for (const name of plan.selectedToolNames) {
    const tool = toolsByName.get(name);
    if (!tool) {
      issues.push(error("unknown_tool", `Selected tool "${name}" is not planned.`, name));
      continue;
    }
    validateSelectedTool(draft, tool, availableSecrets, issues);
  }

  return {
    status: issues.some((issue) => issue.severity === "error")
      ? "invalid"
      : "valid",
    issues,
    checkedAt: new Date().toISOString(),
  };
}

export function validatedToolPlan(
  plan: ToolBuildPlan,
  report: ToolValidationReport,
): ToolBuildPlan {
  return {
    ...plan,
    status: report.status === "valid" ? "validated" : "failed",
    tools: plan.tools.map((tool) => markReadiness(tool, report.issues)),
    warnings: report.issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.message),
  };
}

function validateSelectedTool(
  draft: AgentBuildDraft,
  tool: ToolBuildContract,
  secrets: Set<string>,
  issues: ToolValidationIssue[],
): void {
  if (!tool.runtimeBinding.handlerRef) {
    issues.push(error("missing_handler", "Tool is missing handlerRef.", tool.name));
  } else if (!runtimeHandlers.has(tool.runtimeBinding.handlerRef)) {
    issues.push(error("unknown_handler", `Unknown handler "${tool.runtimeBinding.handlerRef}".`, tool.name));
  }
  if (!tool.parameters || tool.parameters.type !== "object") {
    issues.push(error("invalid_schema", "Tool parameters must be an object schema.", tool.name));
  }
  if (tool.requiresKnowledge && !draft.metadata?.knowledgeStore) {
    issues.push(error("knowledge_required", "Tool requires compiled knowledge.", tool.name));
  }
  if (tool.requiresGraph && !draft.knowledgePlan?.kg.enabled) {
    issues.push(error("graph_required", "Tool requires an enabled KG plan.", tool.name));
  }
  for (const secret of tool.requiredSecrets ?? []) {
    if (!secret.optional && !secrets.has(secret.name)) {
      issues.push(error("secret_required", `Missing secret ${secret.name}.`, tool.name));
    }
  }
  if (requiresConfirmation(tool) && !tool.confirmation.required) {
    issues.push(error("confirmation_required", "Write/external tools need confirmation.", tool.name));
  }
}

function requiresConfirmation(tool: ToolBuildContract): boolean {
  return tool.sideEffect === "write" ||
    tool.sideEffect === "external_action" ||
    tool.sideEffect === "handoff";
}

function markReadiness(
  tool: ToolBuildContract,
  issues: ToolValidationIssue[],
): ToolBuildContract {
  const ownIssues = issues.filter((issue) => issue.toolName === tool.name);
  const readiness = ownIssues.some((issue) => issue.severity === "error")
    ? "blocked"
    : tool.readiness;
  return {
    ...tool,
    readiness,
    reasons: [...tool.reasons, ...ownIssues.map((issue) => issue.message)],
  };
}

function error(
  code: string,
  message: string,
  toolName?: string,
): ToolValidationIssue {
  return { code, message, severity: "error", toolName };
}
