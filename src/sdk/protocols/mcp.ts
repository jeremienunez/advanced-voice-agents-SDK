import type { ToolManifest } from "../types/core.js";
import type { McpToolDescriptor } from "./types.js";

export function toMcpToolDescriptor(tool: ToolManifest): McpToolDescriptor {
  return {
    name: tool.name,
    title: tool.category,
    description: tool.description,
    inputSchema: tool.parameters,
    outputSchema: tool.outputSchema,
    annotations: {
      readOnlyHint: tool.sideEffect === "none" || tool.sideEffect === "read",
      destructiveHint: tool.sideEffect === "write" ||
        tool.sideEffect === "external_action",
      openWorldHint: tool.sideEffect === "external_action" ||
        tool.sideEffect === "handoff",
      requiresConfirmation: tool.executionMode === "confirmation",
      sideEffect: tool.sideEffect ?? "none",
      executionMode: tool.executionMode ?? "explicit",
      maxCallsPerSession: tool.maxCallsPerSession,
      timeoutMs: tool.timeoutMs,
    },
  };
}

export function toMcpToolDescriptors(
  tools: readonly ToolManifest[],
): McpToolDescriptor[] {
  return tools.map(toMcpToolDescriptor);
}
