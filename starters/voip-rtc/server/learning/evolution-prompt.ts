import type { AgentEvolutionInput } from "@voiceagentsdk/core/sdk";
import { SERVER_POLICY_START } from "../builder/domain/prompt/policy.js";

export function buildPromptVersion(
  currentPrompt: string,
  input: AgentEvolutionInput,
): string {
  const memoryLines = input.memories
    .slice(0, 8)
    .map((memory) => `- ${memory.kind}: ${redact(memory.text)}`);
  const retrievalWeights = input.recommendations.retrievalWeights ?? {};
  const retrievalLine = Object.entries(retrievalWeights)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const block = [
    "## Learned Session Memory",
    `Source session: ${input.sourceSessionId}`,
    ...memoryLines,
    retrievalLine ? `Retrieval weights: ${retrievalLine}` : "",
    "Use these notes as private operating context. Do not reveal raw memory IDs or audit details to users.",
  ].filter(Boolean).join("\n");
  return insertLearningBeforeServerPolicy(
    stripPreviousLearningBlock(currentPrompt),
    block,
  );
}

function stripPreviousLearningBlock(prompt: string): string {
  const policyStart = prompt.lastIndexOf(SERVER_POLICY_START);
  if (policyStart < 0) {
    return prompt.replace(/\n*## Learned Session Memory[\s\S]*$/m, "");
  }
  const beforePolicy = prompt.slice(0, policyStart)
    .replace(/\n*## Learned Session Memory[\s\S]*$/m, "");
  const policy = prompt.slice(policyStart);
  return [beforePolicy.trimEnd(), policy.trimStart()]
    .filter(Boolean)
    .join("\n\n");
}

function insertLearningBeforeServerPolicy(prompt: string, block: string): string {
  const trimmed = prompt.trim();
  const policyStart = trimmed.lastIndexOf(SERVER_POLICY_START);
  if (policyStart < 0) return `${trimmed}\n\n${block}`.trim();
  const beforePolicy = trimmed.slice(0, policyStart).trim();
  const policy = trimmed.slice(policyStart).trim();
  return [beforePolicy, block, policy].filter(Boolean).join("\n\n");
}

function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-secret]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-secret]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[redacted-secret]")
    .slice(0, 600);
}
