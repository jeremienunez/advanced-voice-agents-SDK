import type {
  ToolManifest,
  ToolRegistryAdapterPort,
} from "@voiceagentsdk/core/sdk";
import type { VoiceSessionTool } from "@voiceagentsdk/core/server";
import type { RuntimeCompiledAgent } from "../compiled-agent.js";
import { actionToolRegistryAdapter } from "./action-tool-registry.js";

export function runtimeActionTools(
  agent: RuntimeCompiledAgent,
  registry: ToolRegistryAdapterPort = actionToolRegistryAdapter,
): VoiceSessionTool[] {
  const selectedTools = new Set(agent.selectedTools);

  return agent.artifact.sdkDefinition.tools
    .filter((tool) => selectedTools.has(tool.name))
    .filter((tool) => registry.canExecute(tool))
    .map((tool) => toRuntimeTool(tool, registry));
}

function toRuntimeTool(
  tool: ToolManifest,
  registry: ToolRegistryAdapterPort,
): VoiceSessionTool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    policy: {
      sideEffect: tool.sideEffect ?? "none",
      executionMode: tool.executionMode ?? "explicit",
      maxCallsPerSession: tool.maxCallsPerSession,
      timeoutMs: tool.timeoutMs,
      confirmationReason: confirmationReason(tool),
    },
    execute: (args, context) => registry.execute({ tool, args, context }),
  };
}

function confirmationReason(tool: ToolManifest): string | undefined {
  if (tool.executionMode !== "confirmation") return undefined;
  return "External action or write side effect.";
}
