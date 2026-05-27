import type { JsonObject, JsonSchema, JsonValue } from "./json.js";

export type LlmProviderId =
  | "deepseek"
  | "qwen"
  | "kimi"
  | "openai"
  | "gemini"
  | "anthropic"
  | "custom";

export type LlmTaskRole =
  | "builder.planner"
  | "builder.researcher"
  | "builder.verifier"
  | "builder.prompt_composer"
  | "builder.tool_planner"
  | "builder.database_planner"
  | "runtime.voice"
  | "runtime.fallback_text";

export type LlmOutputKind = "text" | "json_object" | "json_schema";

export interface LlmOutputContract {
  kind: LlmOutputKind;
  schema?: JsonSchema;
  schemaName?: string;
  strict?: boolean;
}

export type LlmReasoningNeed = "adaptive";
export type LlmToolNeed = "none" | "available" | "required";
export type LlmLatencyNeed = "interactive" | "batch";
export type LlmCostNeed = "low" | "balanced" | "quality";

export interface LlmTaskNeeds {
  reasoning?: LlmReasoningNeed;
  tools?: LlmToolNeed;
  latency?: LlmLatencyNeed;
  cost?: LlmCostNeed;
  maxOutputTokens?: number;
}

export type LlmMessageRole = "system" | "user" | "assistant" | "tool";

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: JsonObject;
}

export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
  strict?: boolean;
}

export interface LlmModelRequest {
  provider?: LlmProviderId | string;
  model?: string;
}

export interface LlmTask<TInput = unknown> {
  id: string;
  role: LlmTaskRole;
  intent: string;
  skillRef: string;
  input?: TInput;
  messages: LlmMessage[];
  outputContract?: LlmOutputContract;
  requestedModel?: LlmModelRequest;
  needs?: LlmTaskNeeds;
  tools?: LlmToolSpec[];
  metadata?: JsonObject;
}

export interface LlmModelCapabilities {
  chat: boolean;
  structuredOutput: boolean;
  jsonSchema: boolean;
  toolCalling: boolean;
  streaming: boolean;
  reasoning: boolean;
  reasoningBudget: boolean;
  realtimeAudio: boolean;
}

export interface LlmModelProfile {
  id: string;
  provider: LlmProviderId | string;
  model: string;
  label: string;
  roles: LlmTaskRole[];
  configured: boolean;
  capabilities: LlmModelCapabilities;
  costClass?: LlmCostNeed;
  latencyClass?: LlmLatencyNeed;
  notes?: string[];
  providerConfig?: JsonObject;
}

export interface LlmResolvedModel {
  profile: LlmModelProfile;
  providerOptions?: JsonObject;
}

export interface LlmToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}

export interface LlmTaskResult<TOutput = unknown> {
  taskId: string;
  provider: LlmProviderId | string;
  model: string;
  content: string;
  parsed?: TOutput;
  reasoningContent?: string;
  toolCalls?: LlmToolCall[];
  usage?: LlmUsage;
  raw?: JsonValue;
}
