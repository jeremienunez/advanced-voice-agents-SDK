import type {
  ToolBuildPlan,
  ToolManifest,
} from "@voiceagentsdk/core/sdk";

export function compileToolDefinitions(plan: ToolBuildPlan): ToolManifest[] {
  return plan.tools
    .filter((tool) => tool.selected && tool.readiness === "ready")
    .map((tool): ToolManifest => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      outputSchema: tool.outputSchema,
      permissions: tool.permissions,
      requiredSecrets: tool.requiredSecrets,
      handlerRef: tool.runtimeBinding.handlerRef,
      sideEffect: tool.sideEffect,
      executionMode: tool.confirmation.required ? "confirmation" : "explicit",
    }));
}

export function toolInstructionsFromPlan(plan: ToolBuildPlan): string {
  const selected = plan.tools.filter((tool) => tool.selected);
  if (selected.length === 0) return "- No tools are enabled.";
  return selected.map((tool, index) => {
    const confirmation = tool.confirmation.required
      ? "Requires explicit confirmation."
      : "No external confirmation required.";
    return [
      `${index + 1}. ${tool.name}: ${tool.description}`,
      `Permissions: ${tool.permissions.join(", ")}.`,
      `Side effect: ${tool.sideEffect}. ${confirmation}`,
    ].join(" ");
  }).join("\n");
}
