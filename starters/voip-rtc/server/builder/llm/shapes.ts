import type {
  JsonObject,
  JsonSchema,
  LlmProviderId,
  LlmTask,
} from "@voiceagentsdk/core/sdk";
import type { BuilderLlmProviderConfig } from "./profiles.js";
import { readNumber, toJsonValue } from "./values.js";

export function openAiCompatibleBody(
  task: LlmTask,
  config: BuilderLlmProviderConfig,
  providerOptions: JsonObject | undefined,
): JsonObject {
  const body: Record<string, unknown> = {
    model: task.requestedModel?.model || config.defaultModel,
    messages: task.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
    })),
  };
  const maxOutputTokens = readNumber(providerOptions, "maxOutputTokens") ??
    task.needs?.maxOutputTokens;
  if (maxOutputTokens) {
    if (config.provider === "kimi") body.max_completion_tokens = maxOutputTokens;
    else body.max_tokens = maxOutputTokens;
  }
  applyResponseFormat(body, task);
  applyTools(body, task);
  applyThinkingOptions(body, config.provider, Boolean(providerOptions?.disableThinking));
  if (config.provider === "deepseek" && providerOptions?.disableThinking) {
    body.temperature = 0.2;
  }
  return toJsonValue(body) as JsonObject;
}

export function geminiBody(
  task: LlmTask,
  providerOptions: JsonObject | undefined,
): JsonObject {
  const system = task.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = task.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  const generationConfig: Record<string, unknown> = {};
  const maxOutputTokens = readNumber(providerOptions, "maxOutputTokens") ??
    task.needs?.maxOutputTokens;
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
  if (task.outputContract?.kind === "json_object") {
    generationConfig.responseMimeType = "application/json";
  }
  if (task.outputContract?.kind === "json_schema") {
    generationConfig.responseMimeType = "application/json";
    if (task.outputContract.schema) {
      generationConfig.responseSchema = task.outputContract.schema as JsonSchema;
    }
  }
  if (!providerOptions?.disableThinking && task.needs?.reasoning === "adaptive") {
    generationConfig.thinkingConfig = { thinkingLevel: "MEDIUM" };
  }
  return toJsonValue({
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  }) as JsonObject;
}

function applyResponseFormat(body: Record<string, unknown>, task: LlmTask): void {
  if (task.outputContract?.kind === "json_object") {
    body.response_format = { type: "json_object" };
  }
  if (task.outputContract?.kind === "json_schema") {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: task.outputContract.schemaName ?? task.skillRef.replace(/\W+/g, "_"),
        schema: task.outputContract.schema ?? {},
        strict: task.outputContract.strict ?? true,
      },
    };
  }
}

function applyTools(body: Record<string, unknown>, task: LlmTask): void {
  if (!task.tools?.length) return;
  body.tools = task.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      ...(tool.strict === undefined ? {} : { strict: tool.strict }),
    },
  }));
  body.tool_choice = task.needs?.tools === "required" ? "required" : "auto";
}

function applyThinkingOptions(
  body: Record<string, unknown>,
  provider: LlmProviderId,
  disableThinking: boolean,
): void {
  if (provider === "deepseek") {
    body.thinking = { type: disableThinking ? "disabled" : "enabled" };
  }
  if (provider === "qwen") body.enable_thinking = !disableThinking;
  if (provider === "kimi" && disableThinking) {
    body.thinking = { type: "disabled" };
  }
}
