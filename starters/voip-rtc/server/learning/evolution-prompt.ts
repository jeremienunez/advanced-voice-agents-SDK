import type { AgentEvolutionInput } from "@voiceagentsdk/core/sdk";

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
  return `${stripPreviousLearningBlock(currentPrompt).trim()}\n\n${block}`.trim();
}

function stripPreviousLearningBlock(prompt: string): string {
  return prompt.replace(/\n*## Learned Session Memory[\s\S]*$/m, "");
}

function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-secret]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-secret]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[redacted-secret]")
    .slice(0, 600);
}
