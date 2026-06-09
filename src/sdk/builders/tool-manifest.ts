import type { ToolManifest } from "../types/core/index.js";
import { copy } from "./builder-values.js";

export function toToolManifest(tool: ToolManifest): ToolManifest {
  return {
    name: tool.name,
    description: tool.description,
    category: tool.category,
    parameters: copy(tool.parameters),
    outputSchema: tool.outputSchema ? copy(tool.outputSchema) : undefined,
    permissions: tool.permissions ? [...tool.permissions] : undefined,
    requiredSecrets: tool.requiredSecrets
      ? tool.requiredSecrets.map((secret) => copy(secret))
      : undefined,
    handlerRef: tool.handlerRef,
    sideEffect: tool.sideEffect,
    allowedPlans: tool.allowedPlans ? [...tool.allowedPlans] : undefined,
    executionMode: tool.executionMode,
    voicePreamble: tool.voicePreamble,
    maxCallsPerSession: tool.maxCallsPerSession,
    timeoutMs: tool.timeoutMs,
  };
}
