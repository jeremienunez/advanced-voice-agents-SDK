import type { JsonSchema } from "../json.js";
import type { DomainDataAdapter } from "./data.js";
import type { RuntimeEvent, SecretRef } from "./foundation.js";
import type { AgentChannel, PlanId, TenantId, ToolName } from "./ids.js";

export interface ToolRuntimeContext {
  sessionId: string;
  tenantId: TenantId;
  userId?: string;
  channel: AgentChannel;
  planId?: PlanId;
  services: Record<string, unknown>;
  database?: DomainDataAdapter;
  emit?: (event: RuntimeEvent) => void;
}

export interface ToolManifest {
  name: ToolName;
  description: string;
  category?: string;
  parameters: JsonSchema;
  outputSchema?: JsonSchema;
  permissions?: string[];
  requiredSecrets?: SecretRef[];
  handlerRef?: string;
  sideEffect?: "none" | "read" | "write" | "external_action" | "handoff";
  allowedPlans?: PlanId[];
  executionMode?: "automatic" | "confirmation" | "explicit";
  voicePreamble?: string;
  maxCallsPerSession?: number;
  timeoutMs?: number;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown>
  extends ToolManifest {
  execute: (input: TInput, context: ToolRuntimeContext) => Promise<TOutput>;
  format?: (output: TOutput, channel: AgentChannel) => string;
  keyFacts?: (output: TOutput) => string[];
}
