import type { AgentBuildDraft, ToolName } from "@voiceagentsdk/core/sdk";
import { SERVER_POLICY_START } from "./policy.js";

export function assertCompiledPromptInvariants(
  prompt: string,
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
): void {
  const missing = compiledPromptInvariantViolations(
    prompt,
    draft,
    selectedTools,
  );
  if (missing.length > 0) {
    throw new Error(`Compiled prompt invariant failed: ${missing.join(", ")}`);
  }
}

export function compiledPromptInvariantViolations(
  prompt: string,
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
): string[] {
  const body = promptBody(prompt).toLowerCase();
  return [
    ...missingBodySections(body, draft, selectedTools),
    ...missingSelectedTools(body, selectedTools),
  ];
}

function missingBodySections(
  body: string,
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
): string[] {
  const agentName = draft.identity.publicAgentName.toLowerCase();
  const required = [
    [agentName, "agent identity"],
    ["conversation policy", "conversation policy"],
    ["knowledge policy", "knowledge policy"],
    ["tool policy", "tool policy"],
    ["success criteria", "success criteria"],
    ["confirm", "confirmation rule"],
  ] as const;
  const missing: string[] = required
    .filter(([needle]) => !body.includes(needle))
    .map(([, label]) => label);
  if (!hasUncertaintyRule(body)) {
    missing.push("uncertainty rule");
  }
  if (selectedTools.length > 0 && !body.includes("tool policy")) {
    missing.push("selected tool policy");
  }
  return missing;
}

function hasUncertaintyRule(body: string): boolean {
  const uncertaintySignals = [
    "uncertain",
    "missing context",
    "context is missing",
    "knowledge is missing",
    "missing, weak",
    "weak, or outside scope",
    "outside scope",
    "low confidence",
    "confidence is low",
    "unclear",
    "conflicting context",
    "context conflicts",
  ];
  return uncertaintySignals.some((signal) => body.includes(signal));
}

function missingSelectedTools(
  body: string,
  selectedTools: ToolName[],
): string[] {
  return selectedTools
    .filter((tool) => !body.includes(tool.toLowerCase()))
    .map((tool) => `selected tool ${tool}`);
}

function promptBody(prompt: string): string {
  const policyStart = prompt.indexOf(SERVER_POLICY_START);
  return policyStart >= 0 ? prompt.slice(0, policyStart) : prompt;
}
