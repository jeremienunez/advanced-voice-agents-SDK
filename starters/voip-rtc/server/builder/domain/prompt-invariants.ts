import type { AgentBuildDraft, ToolName } from "@voiceagentsdk/core/sdk";
import { SERVER_POLICY_START } from "./prompt-policy.js";

export function assertCompiledPromptInvariants(
  prompt: string,
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
): void {
  const body = promptBody(prompt).toLowerCase();
  const missing = [
    ...missingBodySections(body, draft, selectedTools),
    ...missingSelectedTools(body, selectedTools),
  ];
  if (missing.length > 0) {
    throw new Error(`Compiled prompt invariant failed: ${missing.join(", ")}`);
  }
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
  if (!body.includes("uncertain") && !body.includes("missing context")) {
    missing.push("uncertainty rule");
  }
  if (selectedTools.length > 0 && !body.includes("tool policy")) {
    missing.push("selected tool policy");
  }
  return missing;
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
