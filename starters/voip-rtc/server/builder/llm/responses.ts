import type { LlmToolCall, LlmUsage } from "@voiceagentsdk/core/sdk";

export interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
      model?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

export function normalizeToolCalls(value: unknown): LlmToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item, index) => {
    const record = item as {
      id?: string;
      function?: { name?: string; arguments?: string };
    };
    return {
      id: record.id ?? `tool_${index + 1}`,
      name: record.function?.name ?? "unknown",
      argumentsJson: record.function?.arguments ?? "{}",
    };
  });
}

export function openAiUsage(
  value: OpenAiCompatibleResponse["usage"],
): LlmUsage | undefined {
  if (!value) return undefined;
  return {
    inputTokens: value.prompt_tokens,
    outputTokens: value.completion_tokens,
    reasoningTokens: value.completion_tokens_details?.reasoning_tokens,
    totalTokens: value.total_tokens,
  };
}

export function geminiUsage(
  value: GeminiResponse["usageMetadata"],
): LlmUsage | undefined {
  if (!value) return undefined;
  return {
    inputTokens: value.promptTokenCount,
    outputTokens: value.candidatesTokenCount,
    reasoningTokens: value.thoughtsTokenCount,
    totalTokens: value.totalTokenCount,
  };
}
