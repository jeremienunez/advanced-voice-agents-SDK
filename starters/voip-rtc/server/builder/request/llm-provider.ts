import type { AgentBuilderLlmProvider } from "@voiceagentsdk/core/sdk";

const BUILDER_LLM_PROVIDERS = new Set([
  "deepseek",
  "qwen",
  "kimi",
  "openai",
  "gemini",
  "anthropic",
  "custom",
]);

export function normalizeLlmProvider(
  value: string,
  fallback: AgentBuilderLlmProvider,
): AgentBuilderLlmProvider {
  return BUILDER_LLM_PROVIDERS.has(value)
    ? (value as AgentBuilderLlmProvider)
    : fallback;
}
